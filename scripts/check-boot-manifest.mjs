#!/usr/bin/env node
// check-boot-manifest — prove a deploy tree and the live site are the same
// bytes, file by file (ENTERPRISE-PLAN §4.2).
//
// Hashes <root>/public/** exactly the way ops-cloudflare/deploy_worker.py
// manifests it (sha256, first 32 hex chars, plus byte size) and compares
// each file against what --base actually serves at that path. Direction is
// tree → live: the deploy replaces the Worker's whole asset set, so a file
// the tree has must be served byte-identical; that is the property that
// makes "the forge tree is the truth" checkable instead of aspirational.
//
// A first mismatch is retried once with a cache-busting query — the zone's
// Browser Cache TTL can serve a stale asset briefly after a deploy, and a
// stale cache is a different fact than wrong bytes; the report says which.
//
// usage:
//   node scripts/check-boot-manifest.mjs --root <repoRoot> --base https://kiln.pocketnova.app [--allow <path>]...
//     --allow /assets/example.js   path may differ (declared exception;
//                                  repeatable) — printed, never silent
// exit 0: every non-allowed file byte-identical · exit 1: differences found

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
function opt(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const root = opt("--root");
const base = (opt("--base") || "").replace(/\/$/, "");
const allow = new Set();
for (let i = 0; i < args.length; i++) if (args[i] === "--allow") allow.add(args[i + 1]);
if (!root || !base) {
  console.error("usage: check-boot-manifest.mjs --root <repoRoot> --base <url> [--allow <path>]...");
  process.exit(2);
}

const pubDir = path.join(root, "public");
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile()) files.push("/" + path.relative(pubDir, p).replaceAll(path.sep, "/"));
  }
})(pubDir);

function manifestHash(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
}

async function fetchBytes(u) {
  const res = await fetch(u, { redirect: "follow" });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

let bad = 0;
let stale = 0;
for (const rel of files) {
  const local = fs.readFileSync(path.join(pubDir, rel));
  const want = { hash: manifestHash(local), size: local.length };
  let liveBuf = await fetchBytes(base + rel);
  let state;
  if (liveBuf && manifestHash(liveBuf) === want.hash && liveBuf.length === want.size) {
    state = "match";
  } else {
    const retry = await fetchBytes(`${base}${rel}?manifest=${Date.now()}`);
    if (retry && manifestHash(retry) === want.hash && retry.length === want.size) {
      state = "stale-cache";
      stale++;
    } else if (!liveBuf && !retry) {
      state = "MISSING";
    } else {
      state = "DIFFER";
    }
  }
  if (state === "DIFFER" || state === "MISSING") {
    if (allow.has(rel)) {
      console.log(`allowed  ${rel} (${state})`);
    } else {
      bad++;
      console.log(`FAIL     ${rel} (${state}) tree=${want.hash}/${want.size} live=${liveBuf ? manifestHash(liveBuf) + "/" + liveBuf.length : "none"}`);
    }
  }
}
console.log(`manifest: ${files.length} files · ${files.length - bad - stale} byte-identical · ${stale} stale-cache (bytes correct on retry) · ${bad} differing`);
process.exit(bad ? 1 : 0);
