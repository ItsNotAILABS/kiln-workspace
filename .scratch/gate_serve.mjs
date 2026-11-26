// Static public/ of THIS worktree + /api/forge proxy to the gate stub.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const PUB = "/home/hatch/workspace/.worktrees/kiln-oauth-preflight/public";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" };
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/forge/") || u.pathname.startsWith("/_serverFn") || u.pathname.startsWith("/api/auth")) {
    const target = `http://127.0.0.1:18949${u.pathname}${u.search}`;
    const chunks = []; for await (const c of req) chunks.push(c);
    try {
      const up = await fetch(target, { method: req.method, headers: { "content-type": req.headers["content-type"] || "application/json" }, body: chunks.length ? Buffer.concat(chunks) : undefined });
      res.writeHead(up.status, { "content-type": up.headers.get("content-type") || "application/json" }); res.end(Buffer.from(await up.arrayBuffer()));
    } catch { res.writeHead(502, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "stub down" })); }
    return;
  }
  let file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname.replace(/^\/+/, ""));
  if (!file.startsWith(PUB) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(PUB, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" }); fs.createReadStream(file).pipe(res);
});
srv.listen(18948, "127.0.0.1", () => console.log("origin http://127.0.0.1:18948"));
