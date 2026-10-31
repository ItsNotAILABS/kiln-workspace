/**
 * Custom domain bind. Worker on kiln.pocketnova.app is the public Kiln.
 * A seat owns one host. Verify with TXT, then the live origin uses it.
 */
import dns from "node:dns/promises";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { sessionAccount, bearerFrom, normalizeHandle } from "./kiln-accounts.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const INDEX = path.join(ROOT, "data", "domains.json");
const DEFAULT_HOST = "kiln.pocketnova.app";
const PLACEHOLDER_ORIGIN = "your-kiln.grok.me";

function json(status, body) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function normalizeHost(raw) {
  let h = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (h.startsWith("www.")) h = h.slice(4);
  if (!/^[a-z0-9][a-z0-9.-]{0,250}[a-z0-9]$/.test(h) || !h.includes(".")) return "";
  if (h.split(".").length < 2) return "";
  return h.slice(0, 253);
}

function isApex(host) {
  const parts = String(host).split(".");
  return parts.length === 2;
}

function cnameName(host) {
  if (isApex(host)) return "@";
  const parts = host.split(".");
  return parts.slice(0, parts.length - 2).join(".");
}

function txtName(host) {
  const n = cnameName(host);
  return n === "@" ? "_kiln" : `_kiln.${n}`;
}

function hostOf(raw) {
  return String(raw || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .trim()
    .toLowerCase();
}

function isLoopback(h) {
  return !h || h === "localhost" || h === "127.0.0.1" || /^(\d+\.){3}\d+$/.test(h) || h.endsWith(".local");
}

export function cloudflareRecords({ host, target, handle, token }) {
  const h = normalizeHost(host) || DEFAULT_HOST;
  const origin = hostOf(target) || PLACEHOLDER_ORIGIN;
  return {
    zone: h.split(".").slice(-2).join("."),
    host: h,
    apex: isApex(h),
    ssl: "SSL/TLS → Full (not Flexible)",
    proxy: "Proxied (orange cloud)",
    origin,
    records: [
      {
        type: "CNAME",
        name: cnameName(h),
        content: origin,
        proxy: "Proxied",
        ttl: "Auto",
        hint: "DNS-only leftover. Worker custom domain or Tunnel route is the edge.",
      },
      {
        type: "TXT",
        name: txtName(h),
        content: `kiln-domain=${handle}:${token}`,
        proxy: "DNS only",
        ttl: "Auto",
        hint: "Grey cloud. Proves the zone is yours. Required for Verify.",
      },
    ],
  };
}

export function workerSource({ origin, host }) {
  const originHost = hostOf(origin) || PLACEHOLDER_ORIGIN;
  const h = normalizeHost(host) || DEFAULT_HOST;
  const www = h.startsWith("www.") ? h : `www.${h}`;
  return `/**
 * Kiln edge worker — ${h}
 * Workers → kiln → Edit code → replace Hello World → paste.
 * Variable ORIGIN = ${originHost}
 * Custom Domain = ${h} (already attached). Do not connect Git.
 */
export default {
  async fetch(request, env) {
    const originHost = String(env.ORIGIN || ${JSON.stringify(originHost)})
      .replace(/^https?:\\/\\//, "")
      .replace(/\\/.*$/, "")
      .replace(/:\\d+$/, "")
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
    const init = { method: request.method, headers, redirect: "manual" };
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
      } catch {}
    }
    outHeaders.set("X-Kiln-Edge", "worker");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders });
  },
};
`;
}

export function tunnelYaml({ host }) {
  const h = normalizeHost(host) || DEFAULT_HOST;
  const zone = h.split(".").slice(-2).join(".");
  const www = h.startsWith("www.") ? h : `www.${h}`;
  return `# Kiln tunnel — ${h}
# On the Mini (once):
#   cloudflared tunnel create kiln
#   cloudflared tunnel route dns kiln ${h}
#   cloudflared tunnel route dns kiln ${www}
# Drop this file at ~/.cloudflared/config.yml
# Replace TUNNEL_ID, then: cloudflared tunnel run kiln
tunnel: TUNNEL_ID
credentials-file: /Users/kiln/.cloudflared/TUNNEL_ID.json
ingress:
  - hostname: ${h}
    service: http://127.0.0.1:8080
  - hostname: ${www}
    service: http://127.0.0.1:8080
  - hostname: "*.${zone}"
    service: http://127.0.0.1:8080
  - service: http_status:404
`;
}

export function wranglerToml({ origin, host }) {
  const originHost = hostOf(origin) || PLACEHOLDER_ORIGIN;
  const h = normalizeHost(host) || DEFAULT_HOST;
  const www = h.startsWith("www.") ? h : `www.${h}`;
  return `name = "kiln-pocketnova"
main = "worker.js"
compatibility_date = "2026-09-21"

[vars]
ORIGIN = "${originHost}"

# Workers → kiln-pocketnova → Domains
# ${h}
# ${www}
`;
}

function edgePack({ host, target, handle, token, edge }) {
  const cf = cloudflareRecords({ host, target, handle, token });
  const txt = (cf.records || []).find((r) => r.type === "TXT") || null;
  return {
    edge: edge || "worker",
    origin: cf.origin,
    cloudflare: cf,
    worker: workerSource({ origin: cf.origin, host }),
    tunnel: tunnelYaml({ host }),
    wrangler: wranglerToml({ origin: cf.origin, host }),
    txt,
    files: {
      worker: "/cloudflare/worker.js",
      tunnel: "/cloudflare/tunnel.yml",
      wrangler: "/cloudflare/wrangler.toml",
    },
  };
}

function loadIndex() {
  return readJson(INDEX, { hosts: {} });
}

function saveIndex(doc) {
  writeJson(INDEX, doc);
}

function domainFile(handle) {
  const h = normalizeHandle(handle);
  return path.join(ROOT, "data", "users", h, "domain.json");
}

export function loadDomain(handle) {
  const rec = readJson(domainFile(handle), null);
  if (!rec || !rec.host) return null;
  return rec;
}

export function publicDomain(handle) {
  const rec = loadDomain(handle);
  if (!rec) return null;
  return {
    host: rec.host,
    status: rec.status || "pending",
    https: rec.status === "live",
    url: `https://${rec.host}`,
    apex: isApex(rec.host),
    verifiedAt: rec.verifiedAt || null,
  };
}

export function domainOrigin(handle) {
  const rec = publicDomain(handle);
  if (rec && rec.status === "live" && rec.host) return `https://${rec.host}`;
  return "";
}

export function findByHost(host) {
  const h = normalizeHost(host);
  if (!h) return null;
  const idx = loadIndex();
  const handle = idx.hosts && idx.hosts[h];
  if (!handle) return null;
  const rec = loadDomain(handle);
  if (!rec || rec.host !== h) return null;
  return rec;
}

function publicRec(rec, { target } = {}) {
  if (!rec) return null;
  const tgt = target || rec.target || "";
  const pack = edgePack({
    host: rec.host,
    target: tgt,
    handle: rec.handle,
    token: rec.token,
    edge: rec.edge || "worker",
  });
  return {
    host: rec.host,
    status: rec.status || "pending",
    url: `https://${rec.host}`,
    apex: isApex(rec.host),
    verifiedAt: rec.verifiedAt || null,
    edge: pack.edge,
    origin: pack.origin,
    cloudflare: pack.cloudflare,
    worker: pack.worker,
    tunnel: pack.tunnel,
    wrangler: pack.wrangler,
    txt: pack.txt,
    files: pack.files,
  };
}

function parseBody(req) {
  try {
    return JSON.parse(req.bodyText || "{}");
  } catch {
    return {};
  }
}

function accOf(req) {
  const tok = bearerFrom({ authorization: req.authorization, token: req.query?.token || parseBody(req).token });
  return { tok, acc: sessionAccount(tok) };
}

function targetOf(origin) {
  const h = hostOf(origin);
  if (isLoopback(h)) return "";
  try {
    const idx = loadIndex();
    if (idx.hosts && idx.hosts[h]) return "";
  } catch {
    /* index missing */
  }
  return h;
}

function pickTarget(req, rec) {
  const up = targetOf(req.upstream || "");
  if (up) return up;
  const fromOrigin = targetOf(req.origin || "");
  if (fromOrigin) return fromOrigin;
  return (rec && rec.target) || "";
}

export async function verifyHost(rec, { origin, upstream } = {}) {
  const host = rec.host;
  const expect = `kiln-domain=${rec.handle}:${rec.token}`;
  const checks = [];
  let txtOk = false;
  try {
    const rows = await dns.resolveTxt(`_kiln.${host}`);
    const flat = rows.map((r) => (Array.isArray(r) ? r.join("") : String(r)));
    txtOk = flat.some((t) => t.replace(/^"|"$/g, "") === expect);
    checks.push({ kind: "txt", ok: txtOk, at: `_kiln.${host}`, seen: flat.slice(0, 4) });
  } catch (e) {
    checks.push({ kind: "txt", ok: false, at: `_kiln.${host}`, error: e instanceof Error ? e.code || e.message : "nxdomain" });
  }
  let httpOk = false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://${host}/`, { method: "GET", redirect: "follow", signal: ctrl.signal, headers: { accept: "text/html" } });
    clearTimeout(t);
    const body = await res.text().catch(() => "");
    httpOk = res.ok && (/<title>\s*KILN/i.test(body) || /kiln:\/\//i.test(body) || /x-kiln/i.test(String(res.headers.get("x-kiln-isolation") || "")));
    checks.push({ kind: "https", ok: httpOk, status: res.status });
  } catch (e) {
    checks.push({ kind: "https", ok: false, error: e instanceof Error ? e.message : "fetch failed" });
  }
  const live = txtOk || httpOk;
  rec.status = live ? "live" : "pending";
  rec.verifiedAt = live ? new Date().toISOString() : rec.verifiedAt || null;
  rec.checks = checks;
  const nextTarget = targetOf(upstream || origin);
  if (nextTarget && nextTarget !== rec.host) rec.target = nextTarget;
  writeJson(domainFile(rec.handle), rec);
  return { ok: true, live, checks, domain: publicRec(rec, { target: rec.target }) };
}

export async function handleDomain(pathname, req) {
  if (!(pathname === "/api/kiln/domain" || pathname.startsWith("/api/kiln/domain/"))) return null;
  const data = { ...(req.query || {}), ...parseBody(req) };
  const action = String(data.action || req.query?.action || (req.method === "GET" ? "me" : "bind"));
  const target = pickTarget(req, null);

  if (action === "who" || action === "ping" || action === "challenge") {
    const host = normalizeHost(data.host || req.host || "");
    const rec = host ? findByHost(host) : null;
    return json(200, {
      ok: true,
      kiln: true,
      host: host || null,
      handle: rec?.handle || null,
      status: rec?.status || null,
    });
  }

  const { acc } = accOf(req);
  if (!acc) return json(401, { ok: false, error: "sign in" });

  if (action === "me" || action === "records") {
    const rec = loadDomain(acc.handle);
    if (!rec) {
      const pack = edgePack({
        host: DEFAULT_HOST,
        target,
        handle: acc.handle,
        token: "pending",
        edge: "worker",
      });
      return json(200, {
        ok: true,
        domain: null,
        suggest: DEFAULT_HOST,
        ...pack,
        note: "Worker on kiln.pocketnova.app is the public Kiln. One paste. Every visitor uses this host.",
      });
    }
    return json(200, { ok: true, domain: publicRec(rec, { target: rec.target || target }) });
  }

  if (action === "recipe") {
    const rec = loadDomain(acc.handle);
    const host = normalizeHost(data.host || rec?.host || DEFAULT_HOST) || DEFAULT_HOST;
    const pack = edgePack({
      host,
      target: rec?.target || target,
      handle: acc.handle,
      token: rec?.token || "pending",
      edge: data.edge || rec?.edge || "worker",
    });
    return json(200, { ok: true, host, ...pack });
  }

  if (action === "bind" || action === "set") {
    const host = normalizeHost(data.host || data.domain || data.name);
    if (!host) return json(400, { ok: false, error: "host looks like kiln.pocketnova.app" });
    const idx = loadIndex();
    const taken = idx.hosts[host];
    if (taken && taken !== acc.handle) return json(409, { ok: false, error: "that host is already bound" });
    const prev = loadDomain(acc.handle);
    if (prev && prev.host && prev.host !== host && idx.hosts[prev.host] === acc.handle) {
      delete idx.hosts[prev.host];
    }
    const token = (prev && prev.host === host && prev.token) || crypto.randomBytes(8).toString("hex");
    const rec = {
      handle: acc.handle,
      host,
      token,
      status: prev && prev.host === host ? prev.status : "pending",
      target: (target && target !== host ? target : "") || (prev && prev.host === host ? prev.target : "") || "",
      edge: String(data.edge || prev?.edge || "worker").replace(/[^a-z]/g, "").slice(0, 12) || "worker",
      boundAt: new Date().toISOString(),
      verifiedAt: prev && prev.host === host ? prev.verifiedAt : null,
    };
    writeJson(domainFile(acc.handle), rec);
    idx.hosts[host] = acc.handle;
    saveIndex(idx);
    return json(200, { ok: true, domain: publicRec(rec, { target: rec.target }) });
  }

  if (action === "verify" || action === "check") {
    const rec = loadDomain(acc.handle);
    if (!rec) return json(404, { ok: false, error: "bind a host first" });
    const out = await verifyHost(rec, { origin: req.origin, upstream: req.upstream });
    return json(200, out);
  }

  if (action === "unbind" || action === "clear") {
    const rec = loadDomain(acc.handle);
    if (rec && rec.host) {
      const idx = loadIndex();
      if (idx.hosts[rec.host] === acc.handle) delete idx.hosts[rec.host];
      saveIndex(idx);
    }
    try {
      fs.unlinkSync(domainFile(acc.handle));
    } catch {
      /* none */
    }
    return json(200, { ok: true, domain: null });
  }

  return json(400, { ok: false, error: "unknown domain action" });
}
