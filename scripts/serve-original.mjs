#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { handleGithubRequest } from "./github-engine.mjs";
import { handleKilnApi, runAgentTurnStream } from "./agent-turn.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const PORT = Number(process.env.KILN_PORT || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".md": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function send(res, code, headers, body) {
  res.writeHead(code, headers);
  res.end(body);
}

function sendFile(res, file, req) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const st = fs.statSync(file);
  const range = req && req.headers && req.headers.range;
  if (range && st.size) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end >= st.size || start > end) {
        res.writeHead(416, { "content-range": `bytes */${st.size}` });
        res.end();
        return;
      }
      const chunk = end - start + 1;
      res.writeHead(206, {
        "content-type": mime,
        "content-length": chunk,
        "content-range": `bytes ${start}-${end}/${st.size}`,
        "accept-ranges": "bytes",
        "cache-control": "no-store",
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
  }
  res.writeHead(200, {
    "content-type": mime,
    "content-length": st.size,
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------------------
// Forge activity mirror (GET /api/kiln/forge-activity)
//
// Reads recent commits from the swarm daemon on this same host
// (loopback :18787) with the operator token from ~/.kiln-swarm/api.token and
// returns them normalized for the app's L1 ledger. The token is used only as
// a Bearer header to the daemon — never logged, never returned. Any failure
// (daemon down, token missing, bad payload) answers an empty list: this
// route must never break the app that consumes it.
// ---------------------------------------------------------------------------
const FORGE_DAEMON = "http://127.0.0.1:18787";
const FORGE_REPO_CAP = 40;
const FORGE_COMMITS_PER_REPO = 4;
const FORGE_ACTIVITY_CAP = 48;
const FORGE_FETCH_TIMEOUT_MS = 2500;
let forgeActivityCache = { at: 0, body: null };

async function daemonJson(pathname, token) {
  const res = await fetch(FORGE_DAEMON + pathname, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(FORGE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`daemon ${res.status} for ${pathname.split("?")[0]}`);
  return res.json();
}

async function computeForgeActivity() {
  const token = fs.readFileSync(path.join(os.homedir(), ".kiln-swarm", "api.token"), "utf8").trim();
  if (!token) return [];
  const listed = await daemonJson("/git", token);
  const repoList = Array.isArray(listed) ? listed : Array.isArray(listed?.repos) ? listed.repos : [];
  const repos = repoList.filter((r) => r && r.owner && r.repo).slice(0, FORGE_REPO_CAP);
  const out = [];
  let idx = 0;
  const worker = async () => {
    while (idx < repos.length) {
      const r = repos[idx++];
      try {
        const data = await daemonJson(
          `/v1/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/commits?limit=${FORGE_COMMITS_PER_REPO}`,
          token,
        );
        for (const c of Array.isArray(data?.commits) ? data.commits : []) {
          if (!c || !c.sha) continue;
          const rec = {
            sha: c.sha,
            owner: r.owner,
            repo: r.repo,
            authorName: c.author?.name || "unknown",
            message: typeof c.subject === "string" ? c.subject : "",
            timestamp: c.date || null,
          };
          // The daemon's actorOf(): agent tokens and account sessions both
          // stamp the account's real email, so git data cannot tell them
          // apart (kind omitted). Only the daemon's own plane — operator,
          // node, memory — writes under @kiln.local.
          if (typeof c.author?.email === "string" && c.author.email.endsWith("@kiln.local")) rec.authorKind = "operator";
          out.push(rec);
        }
      } catch {
        /* one bad repo must not sink the mirror */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(6, repos.length)) }, worker));
  out.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  return out.slice(0, FORGE_ACTIVITY_CAP);
}

async function forgeActivityBody() {
  const now = Date.now();
  if (forgeActivityCache.body && now - forgeActivityCache.at < 30000) return forgeActivityCache.body;
  let activities = [];
  try {
    activities = await computeForgeActivity();
  } catch {
    activities = [];
  }
  const body = JSON.stringify({ ok: true, activities });
  forgeActivityCache = { at: now, body };
  return body;
}

// ---------------------------------------------------------------------------
// Public account surface
// (GET /api/kiln/public/accounts/:owner/repos[/:repo/commits])
//
// Reads the swarm daemon ANONYMOUSLY — deliberately no token, unlike the
// forge-activity mirror above. The daemon's own visibility gate is the
// enforcement: with no credential it only ever surfaces public repos, so
// this surface cannot leak a private repo even if the code below has a bug.
// As belt-and-braces, each repo's details must still say visibility:"public"
// before the repo is included. Any failure answers 200 with an empty list:
// this surface must never break the app that consumes it.
// ---------------------------------------------------------------------------
const PUBLIC_REPO_CAP = 40;
const PUBLIC_COMMITS_LIMIT = 30;
const PUBLIC_COMMITS_PAGE_LIMIT = 100;
const PUBLIC_TREE_FILE_CAP = 200;
const PUBLIC_TEXT_FILE_CAP = 40;
const PUBLIC_TEXT_MAX_BYTES = 32768;
const publicAccountCache = new Map();

// The public surface computes whole accounts at once (several repos in
// parallel, each walking its tree and fetching file contents), so daemon
// calls can queue behind each other in the fetch connection pool — and an
// abort timeout ticks while a request is still queued. This reader gets a
// longer timeout than the forge-activity reader plus one retry, so queue
// waits never masquerade as daemon failures.
const PUBLIC_FETCH_TIMEOUT_MS = 8000;

async function daemonAnonJson(pathname) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(FORGE_DAEMON + pathname, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(PUBLIC_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`daemon ${res.status} for ${pathname.split("?")[0]}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr;
}

const PUBLIC_LANG_BY_EXT = {
  md: "Markdown", markdown: "Markdown", ts: "TypeScript", tsx: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  json: "JSON", rs: "Rust", py: "Python", sol: "Solidity", toml: "toml",
  css: "CSS", html: "HTML", yml: "YAML", yaml: "YAML", sh: "Shell", go: "Go",
  txt: "Text",
};
const PUBLIC_TEXT_EXTS = new Set([
  ...Object.keys(PUBLIC_LANG_BY_EXT), "gitignore", "lock", "cfg", "ini", "env.example",
]);

function publicExtOf(p) {
  const base = String(p).split("/").pop() || "";
  if (base === ".gitignore") return "gitignore";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

function publicLangOf(p) {
  return PUBLIC_LANG_BY_EXT[publicExtOf(p)] || "";
}

async function walkPublicTree(owner, repo, branch) {
  // Level-by-level, directories in parallel. A failed tree read aborts the
  // walk (and with it the whole repo record): a partial tree presented as
  // complete would be a false surface, so this is all-or-nothing per repo.
  const files = [];
  let level = [""];
  while (level.length && files.length < PUBLIC_TREE_FILE_CAP) {
    const datas = await Promise.all(
      level.map((dir) =>
        daemonAnonJson(
          `/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree?ref=${encodeURIComponent(branch)}${dir ? `&path=${encodeURIComponent(dir)}` : ""}`,
        ),
      ),
    );
    const next = [];
    for (const data of datas) {
      for (const e of Array.isArray(data?.entries) ? data.entries : []) {
        if (!e || !e.path) continue;
        if (e.type === "tree") {
          if (next.length < 32) next.push(e.path);
          continue;
        }
        if (e.type !== "blob") continue;
        files.push({
          path: e.path,
          size: typeof e.size === "number" ? e.size : 0,
          sha: e.sha || "",
          language: publicLangOf(e.path),
        });
        if (files.length >= PUBLIC_TREE_FILE_CAP) break;
      }
    }
    level = next;
  }
  return files;
}

async function publicFileContent(owner, repo, filePath) {
  const data = await daemonAnonJson(
    `/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents?path=${encodeURIComponent(filePath)}`,
  );
  if (!data || data.encoding !== "base64" || typeof data.content !== "string") return null;
  const buf = Buffer.from(data.content, "base64");
  if (buf.length > PUBLIC_TEXT_MAX_BYTES || buf.includes(0)) return null;
  return buf.toString("utf8");
}

function mapDaemonCommit(c) {
  if (!c || !c.sha) return null;
  return {
    sha: c.sha,
    subject: typeof c.subject === "string" ? c.subject : "",
    author: c.author?.name || "unknown",
    email: c.author?.email || "",
    date: c.date || null,
  };
}

async function computePublicRepo(owner, repo) {
  const details = await daemonAnonJson(
    `/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/details`,
  );
  // Belt-and-braces on top of the daemon's anonymous gate: a repo is only
  // ever surfaced when its own details call it public.
  if (!details || details.visibility !== "public") return null;
  const branch = details.defaultBranch || "main";
  let commits = [];
  try {
    const data = await daemonAnonJson(
      `/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?limit=${PUBLIC_COMMITS_LIMIT}`,
    );
    commits = (Array.isArray(data?.commits) ? data.commits : []).map(mapDaemonCommit).filter(Boolean);
  } catch {
    commits = [];
  }
  const files = await walkPublicTree(owner, repo, branch);
  let readme = null;
  const isRootReadme = (p) => !p.includes("/") && /^readme(\.md|\.markdown|\.txt)?$/i.test(p);
  const candidates = files
    .filter((f) => (PUBLIC_TEXT_EXTS.has(publicExtOf(f.path)) || isRootReadme(f.path)) && f.size <= PUBLIC_TEXT_MAX_BYTES)
    .sort((a, b) => (isRootReadme(b.path) ? 1 : 0) - (isRootReadme(a.path) ? 1 : 0))
    .slice(0, PUBLIC_TEXT_FILE_CAP + 1);
  let ci = 0;
  const fetchWorker = async () => {
    while (ci < candidates.length) {
      const f = candidates[ci++];
      try {
        const content = await publicFileContent(owner, repo, f.path);
        if (content != null) {
          f.content = content;
          if (isRootReadme(f.path)) readme = content;
        }
      } catch {
        /* one unreadable file must not sink the repo */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(6, candidates.length)) }, fetchWorker));
  const languages = {};
  for (const f of files) {
    if (!f.language) continue;
    languages[f.language] = (languages[f.language] || 0) + 1;
  }
  const language = Object.entries(languages).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const tip =
    commits[0] ||
    (details.lastCommit
      ? {
          sha: details.lastCommit.sha,
          subject: details.lastCommit.subject || "",
          author: details.lastCommit.author || "unknown",
          email: "",
          date: details.lastCommit.date || null,
        }
      : null);
  return {
    id: `${owner}/${repo}`,
    owner,
    name: repo,
    description: details.description || "",
    topics: Array.isArray(details.topics) ? details.topics : [],
    visibility: "public",
    defaultBranch: branch,
    createdAt: details.createdAt || null,
    updatedAt: tip?.date || details.createdAt || null,
    commitCount: typeof details.commitCount === "number" ? details.commitCount : commits.length,
    fileCount: typeof details.fileCount === "number" ? details.fileCount : files.length,
    tip: tip
      ? { sha: tip.sha, shortSha: String(tip.sha).slice(0, 7), subject: tip.subject, author: tip.author, date: tip.date }
      : null,
    commits,
    files,
    readme,
    language,
    languages,
  };
}

async function computePublicAccount(owner) {
  const listed = await daemonAnonJson("/git");
  const repoList = Array.isArray(listed) ? listed : Array.isArray(listed?.repos) ? listed.repos : [];
  const names = repoList
    .filter((r) => r && r.owner === owner && r.repo)
    .map((r) => r.repo)
    .slice(0, PUBLIC_REPO_CAP);
  const out = [];
  let idx = 0;
  const worker = async () => {
    while (idx < names.length) {
      const name = names[idx++];
      try {
        const rec = await computePublicRepo(owner, name);
        if (rec) out.push(rec);
      } catch {
        /* one bad repo must not sink the account */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, names.length)) }, worker));
  out.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  return out;
}

async function publicAccountBody(owner) {
  const now = Date.now();
  const hit = publicAccountCache.get(owner);
  if (hit && now - hit.at < 30000) return hit.body;
  let repos = [];
  try {
    repos = await computePublicAccount(owner);
  } catch {
    repos = [];
  }
  const body = JSON.stringify({ ok: true, owner, repos });
  publicAccountCache.set(owner, { at: now, body });
  return body;
}

async function publicCommitsBody(owner, repo) {
  const empty = JSON.stringify({ ok: true, owner, repo, commits: [] });
  try {
    const listed = await daemonAnonJson("/git");
    const repoList = Array.isArray(listed) ? listed : Array.isArray(listed?.repos) ? listed.repos : [];
    // Not in the anonymous listing → not public → answer exactly as if the
    // repo did not exist.
    if (!repoList.some((r) => r && r.owner === owner && r.repo === repo)) return empty;
    const details = await daemonAnonJson(
      `/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/details`,
    );
    if (!details || details.visibility !== "public") return empty;
    const data = await daemonAnonJson(
      `/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?limit=${PUBLIC_COMMITS_PAGE_LIMIT}`,
    );
    const commits = (Array.isArray(data?.commits) ? data.commits : []).map(mapDaemonCommit).filter(Boolean);
    return JSON.stringify({ ok: true, owner, repo, commits });
  } catch {
    return empty;
  }
}

// Public search (GET /api/kiln/public/search?q=): matches account handles
// and repo names across the ANONYMOUS daemon listing only — the same
// public-only universe as the account surface. Repo records are the full
// account-surface records (reused through the per-account cache), so a
// search hit carries everything the app needs to render it.
async function publicSearchBody(q) {
  const empty = JSON.stringify({ ok: true, q, accounts: [], repos: [] });
  if (!q || q.length < 2) return empty;
  try {
    const listed = await daemonAnonJson("/git");
    const repoList = Array.isArray(listed) ? listed : Array.isArray(listed?.repos) ? listed.repos : [];
    const owners = [];
    const seenOwners = new Set();
    const addOwner = (o) => {
      if (o && !seenOwners.has(o) && owners.length < 4) {
        seenOwners.add(o);
        owners.push(o);
      }
    };
    for (const r of repoList) if (r?.owner && r.owner.includes(q)) addOwner(r.owner);
    for (const r of repoList)
      if (r?.owner && r?.repo && (r.repo.includes(q) || `${r.owner}/${r.repo}`.includes(q))) addOwner(r.owner);
    if (!owners.length) return empty;
    const accounts = [];
    const repos = [];
    for (const owner of owners) {
      let recs = [];
      try {
        recs = JSON.parse(await publicAccountBody(owner)).repos || [];
      } catch {
        recs = [];
      }
      if (!recs.length) continue;
      if (owner.includes(q)) accounts.push({ owner, repoCount: recs.length });
      for (const rec of recs) {
        if (repos.length < 8 && (rec.name.includes(q) || rec.id.includes(q))) repos.push(rec);
      }
    }
    return JSON.stringify({ ok: true, q, accounts, repos });
  } catch {
    return empty;
  }
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  let pathname = decodeURIComponent(u.pathname || "/");

  if (req.method === "OPTIONS") {
    send(
      res,
      204,
      {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type,accept,authorization",
      },
      "",
    );
    return;
  }

  // Forge API proxy: /api/forge/X -> daemon http://127.0.0.1:18787/X
  // The caller's Authorization header is forwarded verbatim; no token is
  // injected server-side — the daemon enforces accounts-only itself (401
  // without a credential). Status, content type and body pass through.
  if (pathname.startsWith("/api/forge/")) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const target = pathname.slice("/api/forge".length) + (u.search || "");
    const headers = {};
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
    if (body.length) headers["content-length"] = body.length;
    const upstream = http.request(
      { host: "127.0.0.1", port: 18787, path: target, method: req.method, headers },
      (up) => {
        const parts = [];
        up.on("data", (d) => parts.push(d));
        up.on("end", () => {
          const out = { "cache-control": "no-store" };
          if (up.headers["content-type"]) out["content-type"] = up.headers["content-type"];
          if (up.headers["content-disposition"]) out["content-disposition"] = up.headers["content-disposition"];
          send(res, up.statusCode || 502, out, Buffer.concat(parts));
        });
      },
    );
    upstream.on("error", (e) => {
      send(
        res,
        502,
        { "content-type": "application/json; charset=utf-8" },
        JSON.stringify({ ok: false, error: `forge daemon unreachable: ${e.message}` }),
      );
    });
    if (body.length) upstream.write(body);
    upstream.end();
    return;
  }

  // Original createServerFn client passes this JSON to next(). next(null) throws.
  // `{result:null}` makes sessionUser null without crashing beforeLoad.
  if (pathname.startsWith("/_serverFn/")) {
    send(
      res,
      200,
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
      JSON.stringify({ result: null }),
    );
    return;
  }

  // Forge activity mirror — answered here, before the agent-turn API, so the
  // handler stays self-contained. Always 200; failures answer an empty list.
  if (pathname === "/api/kiln/forge-activity" && req.method === "GET") {
    send(
      res,
      200,
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
      await forgeActivityBody(),
    );
    return;
  }

  // Public account surface — answered here for the same reason. Reads the
  // daemon anonymously (see the section above); always 200, and an invalid
  // or unknown handle answers exactly like an account with no public repos.
  const publicReposMatch = pathname.match(/^\/api\/kiln\/public\/accounts\/([^/]+)\/repos$/);
  const publicCommitsMatch = pathname.match(/^\/api\/kiln\/public\/accounts\/([^/]+)\/repos\/([^/]+)\/commits$/);
  if (req.method === "GET" && (publicReposMatch || publicCommitsMatch)) {
    const owner = String((publicReposMatch || publicCommitsMatch)[1]).toLowerCase();
    const ownerOk = /^[a-z0-9][a-z0-9-]{0,38}$/.test(owner);
    let body;
    if (publicCommitsMatch) {
      const repo = String(publicCommitsMatch[2]);
      body =
        ownerOk && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repo)
          ? await publicCommitsBody(owner, repo)
          : JSON.stringify({ ok: true, owner, repo, commits: [] });
    } else {
      body = ownerOk ? await publicAccountBody(owner) : JSON.stringify({ ok: true, owner, repos: [] });
    }
    send(
      res,
      200,
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
      body,
    );
    return;
  }

  // Public search — same anonymous-only universe as the account surface.
  if (pathname === "/api/kiln/public/search" && req.method === "GET") {
    const q = String(u.query?.q || "").trim().toLowerCase();
    send(
      res,
      200,
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
      await publicSearchBody(q),
    );
    return;
  }

  if (pathname.startsWith("/api/kiln") || pathname === "/api/mcp") {
    try {
      const chunks = [];
      if (req.method === "POST" || req.method === "PUT") {
        for await (const c of req) chunks.push(c);
      }
      const bodyText = Buffer.concat(chunks).toString("utf8");
      let parsed = {};
      try {
        parsed = JSON.parse(bodyText || "{}");
      } catch {
        parsed = {};
      }
      const wantsStream =
        pathname === "/api/kiln/agent-turn" &&
        (parsed.stream === true || String(req.headers.accept || "").includes("text/event-stream"));
      if (wantsStream) {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
          connection: "keep-alive",
        });
        await runAgentTurnStream(parsed, (ev) => {
          try {
            res.write(`data: ${JSON.stringify(ev)}\n\n`);
          } catch {
            /* closed */
          }
        });
        res.end();
        return;
      }
      const result = await handleKilnApi(pathname, { method: req.method, bodyText, query: u.query || {} });
      if (result) {
        send(res, result.status, result.headers, result.body);
        return;
      }
    } catch (e) {
      send(
        res,
        500,
        { "content-type": "application/json; charset=utf-8" },
        JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "kiln api error" }),
      );
      return;
    }
  }

  if (pathname.startsWith("/api/github")) {
    try {
      const q = new URLSearchParams(u.search || "");
      if ((req.method === "POST" || req.method === "PUT") && !q.get("q") && !q.get("owner")) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          if (body.query || body.q) q.set("q", body.query || body.q);
          if (body.owner) q.set("owner", body.owner);
          if (body.repo) q.set("repo", body.repo);
          if (body.data?.query) q.set("q", body.data.query);
          if (body.data?.owner) q.set("owner", body.data.owner);
          if (body.data?.repo) q.set("repo", body.data.repo);
        } catch {
          /* ignore */
        }
      }
      const result = await handleGithubRequest(pathname, q);
      if (result) {
        send(res, result.status, result.headers, result.body);
        return;
      }
    } catch (e) {
      send(
        res,
        500,
        { "content-type": "application/json; charset=utf-8" },
        JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "engine error", items: [], files: [] }),
      );
      return;
    }
  }

  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/freeze" || pathname === "/freeze/") pathname = "/freeze/index.html";
  const rel = pathname.replace(/^\/+/, "");
  const file = path.join(PUB, rel);
  if (file.startsWith(PUB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    sendFile(res, file, req);
    return;
  }
  if (pathname.startsWith("/assets/")) {
    send(res, 404, { "content-type": "text/plain" }, "not found");
    return;
  }
  sendFile(res, path.join(PUB, "index.html"), req);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("original kiln on :" + PORT);
});
