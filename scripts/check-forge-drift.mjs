#!/usr/bin/env node
// check-forge-drift — is what is served still a pure function of the forge?
// (ENTERPRISE-PLAN §6/§7 Phase D. Built for Doctor/VIVAX to run on their
// own cadence; read-only, no side effects.)
//
// Three comparisons, each against forge main in the daemon's bare repo:
//   worker   — the last promoted publish receipt (~/workspace/.publish/
//              kiln-workspace/*/PUBLISHED.json). DRIFT only if the diff
//              published..main touches the Worker's inputs (public/ or
//              ops-cloudflare/kiln-edge-worker.mjs): publishing is a
//              function of those inputs, not of every commit.
//   origin   — the serving export (~/kiln-site/current -> <sha>). DRIFT
//              only if the diff serving..main touches the server's
//              inputs (scripts/ or public/).
//   account  — the served /kiln-account.json forgeBridge counts vs the
//              daemon's repo list: reposDerived < listed is a data-plane
//              drift signal (a rising reposStaticFallback is the early
//              warning). Needs the operator token; skipped if unreadable.
//
// Exit: 0 = no drift · 1 = drift found · 2 = a check could not be made
// (transport/unknown — reported as UNKNOWN, never silently as OK).
// Output: one JSON object.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const HOME = os.homedir();
const BARE = path.join(HOME, ".kiln-swarm", "git", "auro", "kiln-workspace.git");
const PUBLISH_ROOT = path.join(HOME, "workspace", ".publish", "kiln-workspace");
const SITE_CURRENT = path.join(HOME, "kiln-site", "current");
const ORIGIN = "https://kiln.pocketnova.app";
const DAEMON = "http://127.0.0.1:18787";

const out = { at: new Date().toISOString(), checks: {}, drift: false, unknown: false };
const note = (name, state, detail) => {
  out.checks[name] = { state, ...detail };
  if (state === "DRIFT") out.drift = true;
  if (state === "UNKNOWN") out.unknown = true;
};

function git(...args) {
  return execFileSync("git", [`--git-dir=${BARE}`, ...args], { encoding: "utf8" }).trim();
}
function inputsChanged(from, to, paths) {
  if (from === to) return false;
  const diff = git("diff", "--name-only", from, to, "--", ...paths);
  return diff.length > 0;
}

let mainSha;
try {
  mainSha = git("rev-parse", "main");
  out.forgeMain = mainSha;
} catch (e) {
  note("forge", "UNKNOWN", { error: String(e.message || e).slice(0, 120) });
  console.log(JSON.stringify(out, null, 2));
  process.exit(2);
}

// --- worker: last promoted receipt --------------------------------------
try {
  const receipts = [];
  for (const d of fs.readdirSync(PUBLISH_ROOT)) {
    const p = path.join(PUBLISH_ROOT, d, "PUBLISHED.json");
    if (fs.existsSync(p)) {
      const r = JSON.parse(fs.readFileSync(p, "utf8"));
      if (r.promoted) receipts.push(r);
    }
  }
  receipts.sort((a, b) => b.worker_version - a.worker_version);
  const last = receipts[0];
  if (!last) {
    note("worker", "UNKNOWN", { error: "no promoted publish receipt found" });
  } else if (inputsChanged(last.published_sha, mainSha, ["public", "ops-cloudflare/kiln-edge-worker.mjs"])) {
    note("worker", "DRIFT", { publishedSha: last.published_sha, workerVersion: last.worker_version, reason: "worker inputs changed since publish" });
  } else {
    note("worker", "OK", { publishedSha: last.published_sha, workerVersion: last.worker_version });
  }
} catch (e) {
  note("worker", "UNKNOWN", { error: String(e.message || e).slice(0, 120) });
}

// --- origin: serving export ---------------------------------------------
try {
  const target = fs.realpathSync(SITE_CURRENT);
  const servingSha = path.basename(target);
  if (inputsChanged(servingSha, mainSha, ["scripts", "public"])) {
    note("origin", "DRIFT", { servingSha, reason: "server inputs changed since the serving export" });
  } else {
    note("origin", "OK", { servingSha });
  }
} catch (e) {
  note("origin", "UNKNOWN", { error: String(e.message || e).slice(0, 120) });
}

// --- account doc: derivation coverage ------------------------------------
try {
  const token = fs.readFileSync(path.join(HOME, ".kiln-swarm", "api.token"), "utf8").trim();
  const listRes = await fetch(`${DAEMON}/git`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  const listedDoc = await listRes.json();
  const listed = (Array.isArray(listedDoc) ? listedDoc : listedDoc.repos || []).length;
  const docRes = await fetch(`${ORIGIN}/kiln-account.json`, { signal: AbortSignal.timeout(30000) });
  const doc = await docRes.json();
  const fb = doc.forgeBridge || {};
  if (typeof fb.reposDerived !== "number") {
    note("account", "UNKNOWN", { error: "served doc has no derivation counts (pre-derivation server?)" });
  } else if (fb.reposDerived < listed) {
    note("account", "DRIFT", { derived: fb.reposDerived, listed, fallback: fb.reposStaticFallback ?? 0, staticOnly: fb.reposStaticOnly ?? 0 });
  } else {
    note("account", "OK", { derived: fb.reposDerived, listed, fallback: fb.reposStaticFallback ?? 0, staticOnly: fb.reposStaticOnly ?? 0 });
  }
} catch (e) {
  note("account", "UNKNOWN", { error: String(e.message || e).slice(0, 120) });
}

// --- live asset spot check vs the serving export --------------------------
try {
  const exportDir = fs.realpathSync(SITE_CURRENT);
  const h = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
  const bad = [];
  for (const rel of ["/index.html", "/assets/kiln-public.js", "/assets/RepoChrome-BaVvC5oG.js"]) {
    const local = fs.readFileSync(path.join(exportDir, "public", rel));
    const res = await fetch(ORIGIN + rel, { signal: AbortSignal.timeout(20000) });
    const live = Buffer.from(await res.arrayBuffer());
    if (!res.ok || h(live) !== h(local) || live.length !== local.length) bad.push(rel);
  }
  if (bad.length) note("liveAssets", "DRIFT", { mismatched: bad });
  else note("liveAssets", "OK", { checked: 3 });
} catch (e) {
  note("liveAssets", "UNKNOWN", { error: String(e.message || e).slice(0, 120) });
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.drift ? 1 : out.unknown ? 2 : 0);
