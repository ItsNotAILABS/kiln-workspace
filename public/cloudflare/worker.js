/**
 * Kiln edge worker — kiln.pocketnova.app
 *
 * Cloudflare → Workers → kiln → Edit code → paste this file (replace Hello World).
 * Variable ORIGIN = the published Kiln host (no https://, no trailing slash).
 * Domains → Custom Domain → kiln.pocketnova.app (already attached).
 *
 * The worker is the public origin. Do not CNAME at Grok.
 * X-Forwarded-Host stays the seat host so live capsules keep isolation.
 */
export default {
  async fetch(request, env) {
    const originHost = String(env.ORIGIN || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .trim();
    if (!originHost) {
      return new Response("Set ORIGIN to the published Kiln host.", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const incoming = new URL(request.url);
    const outbound = new URL(request.url);
    outbound.protocol = "https:";
    outbound.hostname = originHost;
    outbound.port = "";

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("connection");
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ray");
    headers.set("X-Forwarded-Host", incoming.host);
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Kiln-Edge", "worker");

    if ((request.headers.get("Upgrade") || "").toLowerCase() === "websocket") {
      return fetch(new Request(outbound.toString(), request));
    }

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      init.duplex = "half";
    }

    const res = await fetch(outbound.toString(), init);
    const outHeaders = new Headers(res.headers);
    const loc = outHeaders.get("location");
    if (loc) {
      try {
        const next = new URL(loc, outbound);
        if (next.hostname === originHost) {
          next.hostname = incoming.hostname;
          next.protocol = incoming.protocol;
          outHeaders.set("Location", next.toString());
        }
      } catch {
        /* leave location */
      }
    }
    outHeaders.set("X-Kiln-Edge", "worker");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: outHeaders,
    });
  },
};
