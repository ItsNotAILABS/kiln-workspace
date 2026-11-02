// Pre-boot stub: oauth start answers the operator-gate 401 exactly as
// measured live 2026-11-02; everything else minimal.
import http from "node:http";
const send = (res, s, obj) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); const p = u.pathname;
  const chunks = []; for await (const c of req) chunks.push(c);
  if (p === "/_serverFn" || p.startsWith("/api/auth")) return send(res, 200, { result: null });
  if (/^\/api\/forge\/v1\/accounts\/oauth\/(google|x)\/start$/.test(p) && req.method === "GET")
    return send(res, 401, { error: "unauthorized: valid token required (Bearer <redacted> or Basic password)" });
  if (p === "/api/forge/v1/accounts/oauth/handoff") return send(res, 401, { error: "unauthorized: valid token required (Bearer <redacted> or Basic password)" });
  return send(res, 404, { error: "not_found", path: p });
});
srv.listen(18949, "127.0.0.1", () => console.log("gate stub http://127.0.0.1:18949"));
