#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";
import { handleGithubRequest } from "./github-engine.mjs";
import { handleKilnApi, runAgentTurnStream } from "./agent-turn.mjs";
import { handleLoop, serveLive } from "./kiln-loop.mjs";
import { handleDomain } from "./kiln-domain.mjs";
import { handleStudioMcp } from "./kiln-mcp.mjs";
import { getBadge, badgePageHtml, getPassport, passportPageHtml } from "./kiln-badge.mjs";
import { profilePageHtml, loadAccount, sessionAccount, bearerFrom } from "./kiln-accounts.mjs";
import { baseBus, basePageHtml, canSeeBase, readWal } from "./kiln-base.mjs";
import { originIngest, repoIngest, seatIngest, llmsText, ingestPageHtml, wellKnownKiln, wellKnownAgent } from "./kiln-ingest.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const PORT = 8080;

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

function cacheControl(file, ext) {
  const base = path.basename(file);
  // Fingerprinted bundles only. kiln-forge.js / kiln-boot.js must stay no-store
  // so ?k= cache-busts actually land.
  const fingerprinted = /-[A-Za-z0-9_]{6,}\.(js|css|woff2|map)$/.test(base);
  if (file.includes(`${path.sep}assets${path.sep}`) && fingerprinted) {
    return "public, max-age=31536000, immutable";
  }
  if ([".jpg", ".jpeg", ".png", ".webp", ".svg", ".mp4", ".woff2"].includes(ext)) {
    return "public, max-age=86400";
  }
  return "no-store";
}

const GZIP_EXT = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".md", ".txt", ".map", ".webmanifest"]);
const gzipCache = new Map();

function wantsGzip(req) {
  return /\bgzip\b/i.test(String(req && req.headers && req.headers["accept-encoding"] || ""));
}

function gzipFile(file, raw) {
  try {
    const st = fs.statSync(file);
    const key = file + ":" + st.mtimeMs + ":" + st.size;
    let hit = gzipCache.get(key);
    if (hit) return hit;
    if (gzipCache.size > 64) gzipCache.clear();
    hit = zlib.gzipSync(raw, { level: 5 });
    gzipCache.set(key, hit);
    return hit;
  } catch {
    return null;
  }
}

function pipeFile(stream, res) {
  stream.on("error", () => {
    try {
      res.destroy();
    } catch {
      /* ignore */
    }
  });
  res.on("close", () => {
    try {
      stream.destroy();
    } catch {
      /* ignore */
    }
  });
  stream.pipe(res);
}

function sendFile(res, file, req) {
  try {
    const ext = path.extname(file).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    const st = fs.statSync(file);
    if (!st.isFile()) {
      send(res, 404, { "content-type": "text/plain" }, "not found");
      return;
    }
    const cache = cacheControl(file, ext);
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
          "cache-control": cache,
        });
        pipeFile(fs.createReadStream(file, { start, end }), res);
        return;
      }
    }
    const headers = {
      "content-type": mime,
      "content-length": st.size,
      "accept-ranges": "bytes",
      "cache-control": cache,
    };
    try {
      const wantDl = req && req.url && /[?&](dl|download)=/i.test(String(req.url));
      const isPlate = String(file).includes(`${path.sep}badges${path.sep}`) && [".jpg", ".jpeg", ".png", ".svg", ".webp"].includes(ext);
      if (wantDl && isPlate) {
        const q = url.parse(req.url, true).query || {};
        const raw = String(q.name || q.download || path.basename(file));
        const safe = raw.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+/, "").slice(0, 96) || path.basename(file);
        headers["content-disposition"] = `attachment; filename="${safe}"`;
        headers["cache-control"] = "private, no-store";
      }
    } catch {
      /* serve the plate inline */
    }
    if (wantsGzip(req) && GZIP_EXT.has(ext) && st.size > 256 && st.size < 1_500_000 && !headers["content-disposition"]) {
      try {
        const raw = fs.readFileSync(file);
        const gz = gzipFile(file, raw);
        if (gz && gz.length < st.size * 0.92) {
          headers["content-encoding"] = "gzip";
          headers["content-length"] = gz.length;
          headers["vary"] = "Accept-Encoding";
          res.writeHead(200, headers);
          res.end(gz);
          return;
        }
      } catch {
        /* fall through to raw stream */
      }
    }
    res.writeHead(200, headers);
    pipeFile(fs.createReadStream(file), res);
  } catch {
    send(res, 404, { "content-type": "text/plain" }, "not found");
  }
}

function originOf(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:8080").split(",")[0].trim();
  return `${proto}://${host}`;
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

  if (pathname.startsWith("/api/kiln") || pathname === "/api/mcp") {
    try {
      const chunks = [];
      if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
        for await (const c of req) chunks.push(c);
      }
      const bodyText = Buffer.concat(chunks).toString("utf8");
      let parsed = {};
      try {
        parsed = JSON.parse(bodyText || "{}");
      } catch {
        parsed = {};
      }
      if (pathname === "/api/mcp" || pathname === "/api/kiln/mcp") {
        const mcp = await handleStudioMcp({
          method: req.method,
          bodyText,
          authorization: req.headers.authorization || "",
          accept: String(req.headers.accept || ""),
          query: u.query || {},
          origin: originOf(req),
          ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim(),
        });
        if (mcp) {
          send(res, mcp.status, mcp.headers || {}, mcp.body ?? "");
          return;
        }
      }
      const wantsStream =
        pathname === "/api/kiln/agent-turn" &&
        (parsed.stream === true || String(req.headers.accept || "").includes("text/event-stream"));
      const wantsBaseStream = pathname === "/api/kiln/base/realtime";
      if (wantsBaseStream) {
        const repoId = String(u.query?.repo || parsed.repo || parsed.repoId || "");
        const tok = bearerFrom({ authorization: req.headers.authorization || "", token: u.query?.token || parsed.token });
        const acc = sessionAccount(tok);
        const viewer = acc?.handle || null;
        if (repoId && !canSeeBase(viewer, repoId)) {
          send(res, 404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, JSON.stringify({ ok: false, error: "unknown base" }));
          return;
        }
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
          connection: "keep-alive",
        });
        const snap = repoId ? readWal(repoId, viewer, { limit: 24 }) : { events: [] };
        try {
          res.write(`data: ${JSON.stringify({ ok: true, hello: true, repoId: repoId || null, events: snap.events || [] })}\n\n`);
        } catch {
          /* closed */
        }
        const push = (kind) => (ev) => {
          if (repoId && ev.repoId !== repoId) return;
          if (ev.repoId && !canSeeBase(viewer, ev.repoId)) return;
          try {
            res.write(`data: ${JSON.stringify({ kind, ...ev })}\n\n`);
          } catch {
            /* closed */
          }
        };
        const onWal = push("wal");
        const onPresence = push("presence");
        const onBroadcast = push("broadcast");
        const onHook = push("hook");
        baseBus.on("wal", onWal);
        baseBus.on("presence", onPresence);
        baseBus.on("broadcast", onBroadcast);
        baseBus.on("hook", onHook);
        const hb = setInterval(() => {
          try {
            res.write(": hb\n\n");
          } catch {
            /* closed */
          }
        }, 15000);
        const stop = () => {
          clearInterval(hb);
          baseBus.off("wal", onWal);
          baseBus.off("presence", onPresence);
          baseBus.off("broadcast", onBroadcast);
          baseBus.off("hook", onHook);
        };
        req.on("close", stop);
        req.on("aborted", stop);
        return;
      }
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
      const result = await handleKilnApi(pathname, {
        method: req.method,
        bodyText,
        query: u.query || {},
        authorization: req.headers.authorization || "",
        ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim(),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 180),
        origin: originOf(req),
      });
      if (result) {
        send(res, result.status, result.headers, result.body);
        return;
      }
      if (pathname === "/api/kiln/domain" || pathname.startsWith("/api/kiln/domain/")) {
        const domain = await handleDomain(pathname, {
          method: req.method,
          bodyText,
          query: u.query || {},
          authorization: req.headers.authorization || "",
          origin: originOf(req),
          host: String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim(),
        });
        if (domain) {
          send(res, domain.status, domain.headers, domain.body);
          return;
        }
      }
      if (pathname === "/api/kiln/loop" || pathname.startsWith("/api/kiln/loop/")) {
        const loop = await handleLoop(pathname, {
          method: req.method,
          bodyText,
          query: u.query || {},
          authorization: req.headers.authorization || "",
          ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim(),
          origin: originOf(req),
        });
        if (loop) {
          send(res, loop.status, loop.headers, loop.body);
          return;
        }
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

  if (pathname.startsWith("/u/")) {
    const handle = decodeURIComponent(pathname.slice(3)).replace(/\/+$/, "").split("/")[0];
    const origin = originOf(req);
    const html = profilePageHtml(handle, origin);
    if (!html || !loadAccount(handle)) {
      send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "unknown account");
      return;
    }
    send(res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, html);
    return;
  }

  if (pathname.startsWith("/p/")) {
    const handle = decodeURIComponent(pathname.slice(3)).replace(/\/+$/, "").split("/")[0];
    const pass = getPassport(handle);
    if (!pass) {
      send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "unknown passport");
      return;
    }
    const origin = originOf(req);
    send(res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, passportPageHtml(pass, origin));
    return;
  }

  if (pathname.startsWith("/b/")) {
    const token = decodeURIComponent(pathname.slice(3)).replace(/\/+$/, "").split("/")[0];
    const b = getBadge(token);
    if (!b) {
      send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "unknown badge");
      return;
    }
    const origin = originOf(req);
    send(res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, badgePageHtml(b, origin));
    return;
  }

  if (pathname === "/base" || pathname.startsWith("/base/")) {
    const rest = pathname.slice("/base".length).replace(/^\/+/, "").replace(/\/+$/, "");
    const repoId = rest || "";
    const origin = originOf(req);
    const tok = bearerFrom({
      authorization: req.headers.authorization || "",
      token: u.query?.token,
    });
    const acc = sessionAccount(tok);
    const html = basePageHtml(repoId, origin, acc?.handle || null);
    send(res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, html);
    return;
  }

  if (pathname === "/llms.txt" || pathname === "/.well-known/llms.txt") {
    const origin = originOf(req);
    const tok = bearerFrom({ authorization: req.headers.authorization || "", token: u.query?.token });
    const acc = sessionAccount(tok);
    send(
      res,
      200,
      {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
      llmsText(origin, acc?.handle || null),
    );
    return;
  }

  if (pathname === "/.well-known/kiln.json" || pathname === "/.well-known/mcp.json") {
    send(
      res,
      200,
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
      JSON.stringify(wellKnownKiln(originOf(req))),
    );
    return;
  }

  if (pathname === "/.well-known/agent.json") {
    send(
      res,
      200,
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
      JSON.stringify(wellKnownAgent(originOf(req))),
    );
    return;
  }

  if (pathname === "/ingest" || pathname.startsWith("/ingest/")) {
    const rest = pathname.slice("/ingest".length).replace(/^\/+/, "").replace(/\/+$/, "");
    const origin = originOf(req);
    const tok = bearerFrom({ authorization: req.headers.authorization || "", token: u.query?.token });
    const acc = sessionAccount(tok);
    const viewer = acc?.handle || null;
    let card;
    if (!rest) card = originIngest(origin, viewer);
    else if (!rest.includes("/")) card = seatIngest(rest, origin, viewer);
    else card = repoIngest(rest, origin, viewer);
    if (!card || card.ok === false) {
      send(res, 404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, JSON.stringify(card || { ok: false, error: "unknown ingest" }));
      return;
    }
    const accept = String(req.headers.accept || "");
    const wantsJson = accept.includes("application/json") || String(u.query?.format || "") === "json";
    if (wantsJson) {
      send(
        res,
        200,
        {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
        },
        JSON.stringify(card),
      );
      return;
    }
    send(res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" }, ingestPageHtml(card, origin));
    return;
  }

  if (pathname === "/live" || pathname.startsWith("/live/")) {
    try {
      const live = await serveLive({
        method: req.method,
        pathname,
        query: u.query || {},
        authorization: req.headers.authorization || "",
        origin: originOf(req),
      });
      if (live) {
        send(res, live.status, live.headers, live.body);
        return;
      }
    } catch (e) {
      send(
        res,
        500,
        { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        e instanceof Error ? e.message : "live failed",
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

server.requestTimeout = 120000;
server.headersTimeout = 66000;
server.keepAliveTimeout = 65000;
server.timeout = 120000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("original kiln on :" + PORT);
});
process.on("uncaughtException", (e) => console.error("kiln serve", e instanceof Error ? e.message : e));
process.on("unhandledRejection", (e) => console.error("kiln serve", e instanceof Error ? e.message : e));
