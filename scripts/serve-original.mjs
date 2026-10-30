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
