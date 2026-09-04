#!/usr/bin/env node
/**
 * After vite/nitro build:
 * 1. Recovered KILN HTML at static/index.html (and 404.html).
 * 2. SPA-rewrite *extensionless* paths only.
 *    Rewriting /assets/*.js → index.html is the live MIME error:
 *    'text/html' is not a valid JavaScript MIME type.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const src = path.join(ROOT, "public", "index.html");
const staticDir = path.join(ROOT, ".vercel", "output", "static");
const dests = [
  path.join(staticDir, "index.html"),
  path.join(staticDir, "404.html"),
  path.join(ROOT, "dist", "index.html"),
  path.join(ROOT, ".output", "public", "index.html"),
];

const PAGES = [
  "studio",
  "models",
  "new",
  "explore",
  "marketplace",
  "wallet",
  "login",
  "papers",
  "search",
  "start",
  "account",
  "apps",
  "cloud",
  "gpu",
  "mcp",
  "members",
  "notifications",
  "pricing",
  "gists",
  "bounties",
  "cli",
  "architecture",
  "assistants",
  "chain",
  "orgs",
  "packages",
  "invite",
  "enterprise",
];

const html = fs.readFileSync(src, "utf8");
if (!html.includes("kiln-boot.js")) {
  console.error("seal-live-html: public/index.html must load kiln-boot.js");
  process.exit(1);
}

let n = 0;
for (const dest of dests) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) continue;
  fs.writeFileSync(dest, html);
  n += 1;
  console.log("sealed", path.relative(ROOT, dest));
}

if (fs.existsSync(staticDir)) {
  for (const page of PAGES) {
    const dir = path.join(staticDir, page);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
  }
  n += PAGES.length;
  console.log("sealed", PAGES.length, "app routes");
}

const cfgPath = path.join(ROOT, ".vercel", "output", "config.json");
if (fs.existsSync(cfgPath)) {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  cfg.routes = [
    { headers: { "cache-control": "no-store" }, src: "/assets/(.*)" },
    { headers: { "cache-control": "public, max-age=3600" }, src: "/marketing/(.*)" },
    { handle: "filesystem" },
    { src: "/api/(.*)", dest: "/__server" },
    { src: "/_serverFn/(.*)", dest: "/__server" },
    { src: "/auth/(.*)", dest: "/__server" },
    {
      src: "/((?!assets/)(?!api/)(?!_serverFn/)(?!auth/)(?!__grok/)(?!.*\\.[a-zA-Z0-9]+$).*)",
      dest: "/index.html",
      headers: { "cache-control": "no-store" },
    },
  ];
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  console.log("sealed vercel SPA fallback (extensionless only)");
}

const vercelJson = path.join(ROOT, "vercel.json");
fs.writeFileSync(
  vercelJson,
  JSON.stringify(
    {
      rewrites: [
        { source: "/api/:path*", destination: "/api/:path*" },
        { source: "/_serverFn/:path*", destination: "/_serverFn/:path*" },
        { source: "/auth/:path*", destination: "/auth/:path*" },
        {
          source: "/((?!assets/|marketing/|api/|__grok/|freeze/|_serverFn/|auth/).*)",
          destination: "/index.html",
        },
      ],
      headers: [
        {
          source: "/assets/:path*",
          headers: [{ key: "Cache-Control", value: "no-store" }],
        },
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log("sealed vercel.json rewrites");

if (!n) console.log("seal-live-html: no build output yet (ok if vite has not run)");
