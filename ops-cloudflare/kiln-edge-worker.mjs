/**
 * kiln.pocketnova.app — the REAL KILN app (Grok's original build) on
 * Cloudflare, working with the local machine the way the app works:
 *
 *   - Static app: the frozen original build (public/) served from
 *     Worker assets — production is NOT tied to Grok servers.
 *   - /_serverFn/*: the app's designed stub, {result:null} (parity
 *     with scripts/serve-original.mjs).
 *   - /api/kiln*, /api/mcp, /api/github*: proxied through the tunnel
 *     to the original server running on the architect's iron
 *     (kiln-original.service, :8931) — agent turns, the Kiln API and
 *     the GitHub engine live there, SSE streams pass through.
 *   - Everything else: static file, else the SPA shell (index.html);
 *     missing /assets/* stays a real 404, like the original server.
 */
const FALLBACK_ORIGIN = "https://kiln-original.medinatechlabs.net";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/_serverFn/")) {
      return new Response(JSON.stringify({ result: null }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (path.startsWith("/api/kiln") || path === "/api/mcp" || path.startsWith("/api/github")) {
      const origin = env.ORIGINAL_API_URL || FALLBACK_ORIGIN;
      const target = new URL(path + url.search, origin);
      const headers = new Headers(request.headers);
      headers.delete("host");
      const init = { method: request.method, headers, redirect: "manual" };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
        init.duplex = "half";
      }
      const resp = await fetch(target, init);
      return new Response(resp.body, { status: resp.status, headers: resp.headers });
    }

    if (path === "/freeze" || path === "/freeze/") {
      return env.ASSETS.fetch(new Request(new URL("/freeze/index.html", url), request));
    }

    const resp = await env.ASSETS.fetch(request);
    if (resp.status === 404) {
      if (path.startsWith("/assets/")) return resp;
      return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }
    return resp;
  },
};

