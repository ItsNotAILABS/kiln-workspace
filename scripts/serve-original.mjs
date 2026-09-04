#!/usr/bin/env node
/**
 * Serves the original Kiln SPA (compiled bundles) plus the GitHub / MCP
 * backends those bundles expect. Does not replace the product — it hosts it.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawn } from "node:child_process";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const PORT = 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function token() {
  try {
    return fs.readFileSync("/tmp/grok/connectors/github.token", "utf8").trim();
  } catch {
    return process.env.GITHUB_TOKEN || "";
  }
}

function send(res, code, headers, body) {
  res.writeHead(code, { "access-control-allow-origin": "*", ...headers });
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, { "content-type": "application/json; charset=utf-8" }, JSON.stringify(obj));
}

function sendFile(req, res, file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const stat = fs.statSync(file);
  const range = req.headers.range;
  if (range && stat.size) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : stat.size - 1;
      res.writeHead(206, {
        "content-type": mime,
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "accept-ranges": "bytes",
        "content-length": end - start + 1,
        "cache-control": "public, max-age=120",
        "access-control-allow-origin": "*",
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
  }
  res.writeHead(200, {
    "content-type": mime,
    "content-length": stat.size,
    "accept-ranges": "bytes",
    "cache-control": ext === ".html" ? "no-store" : "public, max-age=120",
    "access-control-allow-origin": "*",
  });
  fs.createReadStream(file).pipe(res);
}

async function gh(pathname, init = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "kiln",
    ...(init.headers || {}),
  };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(`https://api.github.com${pathname}`, { ...init, headers });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 240) };
  }
  return { ok: r.ok, status: r.status, data, headers: r.headers };
}

const SKIP_DIR = new Set([
  "node_modules", "dist", "build", ".git", "vendor", "target", ".next",
  "coverage", "__pycache__", ".venv", "out", ".turbo", ".cache", ".idea",
  ".vscode", "Pods",
]);
const SKIP_EXT =
  /\.(png|jpe?g|gif|webp|pdf|zip|tar|gz|tgz|wasm|woff2?|mp4|webm|ico|bin|parquet|pyc|so|dylib|exe|lock|map|pack|idx)$/i;

function skipPath(p) {
  const parts = String(p).split("/").filter(Boolean);
  const github = parts.includes(".github");
  for (const part of parts) {
    if (SKIP_DIR.has(part)) return true;
    if (part.startsWith(".") && part !== ".github" && !github) return true;
  }
  return SKIP_EXT.test(p);
}

function mapRepo(r) {
  return {
    fullName: r.full_name,
    name: r.name,
    owner: r.owner?.login || String(r.full_name || "").split("/")[0],
    description: r.description || "",
    language: r.language || "",
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch || "main",
    topics: r.topics || [],
    license: r.license?.spdx_id || r.license?.name || "MIT",
  };
}

async function githubListRepos(query) {
  const q = String(query || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
  if (!q) return { ok: false, error: "Need a GitHub user, org, or owner/repo", items: [] };
  try {
    if (q.includes("/")) {
      const [owner, repo] = q.split("/");
      const { ok, status, data } = await gh(`/repos/${owner}/${repo}`);
      if (!ok) return { ok: false, error: data?.message || `GitHub ${status}`, items: [] };
      return { ok: true, items: [mapRepo(data)] };
    }
    let res = await gh(`/users/${encodeURIComponent(q)}/repos?per_page=100&sort=updated`);
    if (!res.ok) res = await gh(`/orgs/${encodeURIComponent(q)}/repos?per_page=100&sort=updated`);
    if (!res.ok) return { ok: false, error: res.data?.message || `GitHub ${res.status}`, items: [] };
    const list = Array.isArray(res.data) ? res.data : [];
    return { ok: true, items: list.map(mapRepo) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GitHub lookup failed", items: [] };
  }
}

async function githubImportTree(owner, repo) {
  owner = String(owner || "").trim();
  repo = String(repo || "").trim().replace(/\.git$/i, "");
  if (!owner || !repo) return { ok: false, error: "Need owner/repo", files: [] };
  try {
    const metaRes = await gh(`/repos/${owner}/${repo}`);
    if (!metaRes.ok) return { ok: false, error: metaRes.data?.message || `GitHub ${metaRes.status}`, files: [] };
    const metaJ = metaRes.data;
    const branch = metaJ.default_branch || "main";
    const treeRes = await gh(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (!treeRes.ok) return { ok: false, error: treeRes.data?.message || "Could not read git tree", files: [] };
    const blobs = (treeRes.data.tree || []).filter((t) => t.type === "blob" && t.path && !skipPath(t.path));
    const files = [];
    let skipped = 0;
    let bytes = 0;
    const sha = treeRes.data.sha || branch;
    for (const blob of blobs) {
      if (files.length >= 180) { skipped += 1; continue; }
      if ((blob.size || 0) > 280000) { skipped += 1; continue; }
      const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${blob.path}`, {
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      });
      if (!raw.ok) { skipped += 1; continue; }
      const content = await raw.text();
      if (content.slice(0, 800).includes("\0")) { skipped += 1; continue; }
      if (bytes + content.length > 6e6) { skipped += 1; continue; }
      files.push({ path: blob.path, content, size: content.length });
      bytes += content.length;
    }
    const meta = {
      owner: metaJ.owner?.login || owner,
      name: metaJ.name || repo,
      description: metaJ.description || "",
      language: metaJ.language || "source",
      license: metaJ.license?.spdx_id || metaJ.license?.name || "MIT",
      defaultBranch: branch,
      htmlUrl: metaJ.html_url,
      stars: metaJ.stargazers_count || 0,
      forks: metaJ.forks_count || 0,
      topics: metaJ.topics || [],
      sha,
      fullName: metaJ.full_name || `${owner}/${repo}`,
    };
    return { ok: true, via: "tree", files, skipped, meta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed", files: [] };
  }
}

function extractPayload(raw) {
  if (!raw) return {};
  let j;
  try { j = JSON.parse(raw); } catch { return {}; }
  if (j && typeof j === "object") {
    if (j.data && typeof j.data === "object") return j.data;
    if (j.query || j.owner || j.repo) return j;
  }
  const out = {};
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.p && Array.isArray(o.p.k) && Array.isArray(o.p.v)) {
      o.p.k.forEach((k, i) => {
        const v = o.p.v[i];
        if (v && v.t === 1 && typeof v.s === "string") out[k] = v.s;
        else walk(v);
      });
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  walk(j.t || j);
  return out;
}

const FN = {
  "0b7b4cff5b03ca073cdd9c6948bd973cfe32c7b2fa0c5ee68fc1e2978ba21ffa": async (p) => githubListRepos(p.query),
  "077e5dcf796c54bea58b430220b4e26f40f1c86bf489ceee29f5d6292dc2dcf1": async (p) => githubImportTree(p.owner, p.repo),
  "b4419771c301b3775ce3393c651adff6413e1a8958d1cad043b3080db18008b7": async (p) => ({ ok: true, github: p.github || p.handle || "" }),
  "58274acaa7d4b2199a8ffa70dacf0e21559cc62888430b318bd44503d0328a0c": async () => ({ ok: true, orgs: [] }),
  "8061be3dc9cae7e2bfff2dd5874725fbb13a37d3f3325ec7036cadc170001387": async (p) => ({ ok: true, handle: p.handle, displayName: p.displayName || p.handle }),
};

async function mcpHandle(body) {
  const method = body?.method;
  const id = body?.id ?? 1;
  const tools = [
    { name: "repos.list", description: "List Kiln repositories visible on this machine" },
    { name: "github.lookup", description: "Look up a public GitHub user, org, or owner/repo" },
    { name: "github.import", description: "Import a public GitHub tree into a sealed Kiln machine" },
    { name: "computer.help", description: "Describe the kilnsh computer attached to a repository" },
  ];
  if (method === "initialize") {
    return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", serverInfo: { name: "kiln", version: "1.0" }, capabilities: { tools: {} } } };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: { type: "object" } })) } };
  }
  if (method === "tools/call") {
    const name = body?.params?.name;
    const args = body?.params?.arguments || {};
    let text = "";
    if (name === "github.lookup") text = JSON.stringify(await githubListRepos(args.query || args.q), null, 2);
    else if (name === "github.import") text = JSON.stringify(await githubImportTree(args.owner, args.repo), null, 2);
    else if (name === "computer.help") text = "kilnsh · ls · tree · git status · memory search · python · gpu";
    else text = "Kiln MCP. Repositories are computers. Import GitHub with github.import.";
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } };
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method ${method}` } };
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(""));
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      send(res, 204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type,x-tsr-serverfn,authorization,accept",
        "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      }, "");
      return;
    }
    const u = url.parse(req.url, true);
    let pathname = decodeURIComponent(u.pathname || "/");

    if (pathname === "/api/gh/list" || pathname === "/api/github/list") {
      const body = req.method === "POST" ? extractPayload(await readBody(req)) : {};
      const q = body.query || body.q || u.query.query || u.query.q || "";
      sendJson(res, 200, await githubListRepos(q));
      return;
    }
    if (pathname === "/api/gh/import" || pathname === "/api/github/import") {
      const body = req.method === "POST" ? extractPayload(await readBody(req)) : {};
      const owner = body.owner || u.query.owner;
      const repo = body.repo || u.query.repo;
      sendJson(res, 200, await githubImportTree(owner, repo));
      return;
    }
    if (pathname.startsWith("/api/gh/proxy/")) {
      const rest = pathname.slice("/api/gh/proxy".length);
      const { ok, status, data } = await gh(rest + (u.search || ""));
      sendJson(res, ok ? 200 : status, data);
      return;
    }
    if (pathname.startsWith("/_serverFn/")) {
      const id = pathname.slice("/_serverFn/".length).split("?")[0];
      const raw = await readBody(req);
      const payload = extractPayload(raw);
      if (u.query.payload && !Object.keys(payload).length) {
        try { Object.assign(payload, extractPayload(u.query.payload)); } catch {}
      }
      const fn = FN[id];
      if (!fn) {
        console.log("unknown serverFn", id.slice(0, 16), req.method, pathname);
        sendJson(res, 200, {});
        return;
      }
      sendJson(res, 200, await fn(payload));
      return;
    }
    if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/auth/")) {
      sendJson(res, 200, { user: null, session: null, data: null });
      return;
    }
    if (pathname === "/mcp" || pathname === "/api/mcp") {
      if (req.method === "GET") {
        sendJson(res, 200, { ok: true, server: "kiln", jsonrpc: "2.0", tools: ["repos.list", "github.lookup", "github.import", "computer.help"] });
        return;
      }
      const body = JSON.parse((await readBody(req)) || "{}");
      sendJson(res, 200, await mcpHandle(body));
      return;
    }

    if (pathname === "/") pathname = "/index.html";
    const rel = pathname.replace(/^\/+/, "");
    const file = path.join(PUB, rel);
    if (file.startsWith(PUB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      sendFile(req, res, file);
      return;
    }
    if (pathname.startsWith("/assets/") || pathname.startsWith("/marketing/")) {
      send(res, 404, { "content-type": "text/plain" }, "not found");
      return;
    }
    sendFile(req, res, path.join(PUB, "index.html"));
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : "server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("kiln original on :" + PORT);
});
