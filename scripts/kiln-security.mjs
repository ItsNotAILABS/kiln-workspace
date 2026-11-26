/**
 * GitHub-like security kit per account.
 * Sessions bound to one handle. Wrong secret never opens another seat.
 * Rate-limited login. Agents can harden a tree they own.
 * Ingest jail: outside agents never get a host shell.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";
import { normalizeHandle, loadUserRepos, ownsRepo } from "./kiln-accounts.mjs";
import { spaceHome } from "./kiln-space.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const FAIL = path.join(ROOT, "data", "security-failures.json");
const MUT = path.join(ROOT, "data", "security-mutations.json");

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

function kitFile(handle) {
  return path.join(ROOT, "data", "users", handle, "security.json");
}

export function emptyKit(handle) {
  return {
    handle,
    cipher: "AES-256-GCM+ML-KEM-768",
    wallet: "ML-DSA-65+ML-KEM-768",
    sessionAuth: true,
    rateLimit: true,
    isolation: "handle-bound",
    twoFactor: false,
    createdAt: new Date().toISOString(),
    failed: [],
    sessions: [],
    hardened: [],
    events: [],
  };
}

export function ensureSecurity(handle) {
  const h = normalizeHandle(handle);
  if (!h || h === "kiln") return { ok: false, error: "user handle required" };
  const file = kitFile(h);
  let doc = readJson(file, null);
  if (!doc) {
    doc = emptyKit(h);
    writeJson(file, doc);
  }
  return { ok: true, security: publicKit(doc) };
}

function publicKit(doc) {
  if (!doc) return null;
  return {
    handle: doc.handle,
    cipher: doc.cipher || "AES-256-GCM+ML-KEM-768",
    wallet: doc.wallet || "ML-DSA-65+ML-KEM-768",
    sessionAuth: true,
    rateLimit: true,
    isolation: doc.isolation,
    twoFactor: !!doc.twoFactor,
    sessionCount: (doc.sessions || []).length,
    hardened: doc.hardened || [],
    lastEvent: (doc.events || []).at(-1) || null,
  };
}

function loadKit(handle) {
  const h = normalizeHandle(handle);
  return readJson(kitFile(h), emptyKit(h));
}

function saveKit(doc) {
  doc.failed = (doc.failed || []).slice(-40);
  doc.sessions = (doc.sessions || []).slice(-20);
  doc.events = (doc.events || []).slice(-80);
  writeJson(kitFile(doc.handle), doc);
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_HANDLE = 8;
const MAX_IP = 24;
const MUT_WINDOW = 10 * 60 * 1000;
const MAX_MUT = 80;

function pruneFails(rows, now, window = WINDOW_MS) {
  return (rows || []).filter((r) => now - (r.at || 0) < window);
}

export function admitLogin(handle, ip) {
  const h = normalizeHandle(handle);
  const now = Date.now();
  const doc = readJson(FAIL, { handles: {}, ips: {} });
  doc.handles = doc.handles || {};
  doc.ips = doc.ips || {};
  const hFails = pruneFails(doc.handles[h], now);
  const iFails = pruneFails(doc.ips[ip || "local"], now);
  doc.handles[h] = hFails;
  doc.ips[ip || "local"] = iFails;
  writeJson(FAIL, doc);
  if (hFails.length >= MAX_HANDLE) {
    return { ok: false, error: "too many attempts for this handle. wait 15 minutes." };
  }
  if (iFails.length >= MAX_IP) {
    return { ok: false, error: "too many attempts from this network. wait 15 minutes." };
  }
  return { ok: true };
}

export function admitMutation(handle, ip) {
  const h = normalizeHandle(handle) || "anon";
  const now = Date.now();
  const doc = readJson(MUT, { handles: {}, ips: {} });
  doc.handles = doc.handles || {};
  doc.ips = doc.ips || {};
  const hRows = pruneFails(doc.handles[h], now, MUT_WINDOW);
  const iRows = pruneFails(doc.ips[ip || "local"], now, MUT_WINDOW);
  if (hRows.length >= MAX_MUT) {
    return { ok: false, error: "too many writes on this seat. wait 10 minutes." };
  }
  if (iRows.length >= MAX_MUT * 3) {
    return { ok: false, error: "too many writes from this network. wait 10 minutes." };
  }
  doc.handles[h] = [...hRows, { at: now }];
  doc.ips[ip || "local"] = [...iRows, { at: now, handle: h }];
  writeJson(MUT, doc);
  return { ok: true };
}

export const MUTATING_TOOLS = new Set([
  "kiln_write_file",
  "kiln_run",
  "kiln_remember",
  "kiln_harden",
  "kiln_mint_badge",
  "kiln_create_repo",
  "kiln_upload",
]);

export function isMutatingTool(name, args = {}) {
  if (MUTATING_TOOLS.has(name)) return true;
  if (name === "kiln_base") {
    const action = String(args.action || args.op || "");
    return ["insert", "update", "delete", "table", "rpc", "edge", "create_rpc", "sql", "tx", "put", "broadcast"].includes(action);
  }
  return false;
}

export function recordLogin({ handle, ip, ok, token, userAgent } = {}) {
  const h = normalizeHandle(handle);
  const now = Date.now();
  const fails = readJson(FAIL, { handles: {}, ips: {} });
  fails.handles = fails.handles || {};
  fails.ips = fails.ips || {};
  if (!ok) {
    fails.handles[h] = [...pruneFails(fails.handles[h], now), { at: now, ip: ip || "" }];
    fails.ips[ip || "local"] = [...pruneFails(fails.ips[ip || "local"], now), { at: now, handle: h }];
    writeJson(FAIL, fails);
    if (h) {
      const kit = loadKit(h);
      kit.failed = [...(kit.failed || []), { at: new Date().toISOString(), ip: ip || "" }].slice(-40);
      kit.events = [...(kit.events || []), { at: new Date().toISOString(), kind: "login_fail" }].slice(-80);
      saveKit(kit);
    }
    return { ok: false };
  }
  fails.handles[h] = [];
  writeJson(FAIL, fails);
  const kit = loadKit(h);
  const sid = token
    ? crypto.createHash("sha256").update(String(token)).digest("hex").slice(0, 16)
    : crypto.randomBytes(8).toString("hex");
  kit.sessions = [
    { id: sid, at: new Date().toISOString(), ip: ip || "", ua: String(userAgent || "").slice(0, 120), expHint: "30d" },
    ...(kit.sessions || []).filter((s) => s.id !== sid),
  ].slice(0, 20);
  kit.events = [...(kit.events || []), { at: new Date().toISOString(), kind: "login_ok", session: sid }].slice(-80);
  kit.updatedAt = new Date().toISOString();
  saveKit(kit);
  return { ok: true, session: sid };
}

export function noteEvent(handle, kind, extra = {}) {
  const h = normalizeHandle(handle);
  if (!h) return;
  const kit = loadKit(h);
  kit.events = [...(kit.events || []), { at: new Date().toISOString(), kind, ...extra }].slice(-80);
  kit.updatedAt = new Date().toISOString();
  saveKit(kit);
}

export function dropSessionRecord(handle, token) {
  const h = normalizeHandle(handle);
  if (!h || !token) return { ok: true };
  const sid = crypto.createHash("sha256").update(String(token)).digest("hex").slice(0, 16);
  const kit = loadKit(h);
  kit.sessions = (kit.sessions || []).filter((s) => s.id !== sid);
  kit.events = [...(kit.events || []), { at: new Date().toISOString(), kind: "logout", session: sid }].slice(-80);
  saveKit(kit);
  return { ok: true };
}

export function listSessions(handle) {
  const kit = loadKit(handle);
  return { ok: true, sessions: kit.sessions || [], security: publicKit(kit) };
}

export function resolveInside(root, rel = ".") {
  const rootR = path.resolve(root);
  const dest = path.resolve(rootR, String(rel || ".").replace(/^\/+/, ""));
  if (dest !== rootR && !dest.startsWith(rootR + path.sep)) return null;
  return dest;
}

const BIN = new Set(["ls", "pwd", "cat", "head", "tail", "wc", "file", "stat", "git"]);
const GIT_SUB = new Set(["log", "status", "rev-parse", "diff", "show"]);
const META = /[;&|`$<>(){}\n\r\\]/;

export function jailArgv(raw) {
  const s = String(raw || "").trim();
  if (!s) return { ok: false, error: "command required" };
  if (META.test(s)) return { ok: false, error: "command not allowed" };
  const parts = s.split(/\s+/).slice(0, 12);
  const bin = parts[0];
  if (!BIN.has(bin)) return { ok: false, error: "command not allowed" };
  if (bin === "git") {
    const sub = parts[1] || "";
    if (!GIT_SUB.has(sub)) return { ok: false, error: "git subcommand not allowed" };
    for (const a of parts.slice(1)) {
      if (/^--git-dir|^--work-tree|^--exec-path|^-c$/.test(a)) return { ok: false, error: "command not allowed" };
    }
  }
  for (const a of parts.slice(1)) {
    if (a.startsWith("-")) continue;
    if (a.startsWith("/") || a.includes("..")) return { ok: false, error: "bad path" };
  }
  return { ok: true, bin, args: parts.slice(1) };
}

export function runJailed(dir, raw) {
  const j = jailArgv(raw);
  if (!j.ok) return { ok: false, code: 127, out: j.error, err: "" };
  const root = resolveInside(dir, ".");
  if (!root) return { ok: false, code: 127, out: "bad tree", err: "" };
  const argv = [];
  for (const a of j.args) {
    if (a.startsWith("-") || j.bin === "git") {
      argv.push(a);
      continue;
    }
    const dest = resolveInside(root, a);
    if (!dest) return { ok: false, code: 127, out: "bad path", err: "" };
    argv.push(path.relative(root, dest) || ".");
  }
  const r = spawnSync(j.bin, argv, {
    cwd: root,
    encoding: "utf8",
    timeout: 8000,
    maxBuffer: 200_000,
    env: { PATH: "/usr/bin:/bin", HOME: root, LANG: "C" },
  });
  return {
    ok: r.status === 0,
    code: r.status,
    out: String(r.stdout || "").slice(0, 12_000),
    err: String(r.stderr || "").slice(0, 2000),
  };
}

function securityMarkdown(handle, repoId) {
  return `# Security · ${repoId}

This tree belongs to @${handle}. It is not a shared login.

## Isolation
- Handle-bound sessions. A secret verifies against this seat only.
- Wrong secret never opens another account. Timing-safe scrypt.
- Kiln origin OSS (\`kiln/*\`) is public. Private repos stay with the owner.
- Vault cipher: AES-256-GCM wrapped by ML-KEM-768 (FIPS 203). The vault key is derived from the secret and never stored.
- Wallet: ML-DSA-65 (FIPS 204) signs the seat. Address is a commitment to the PQ public keys.
- Sessions are hashed at rest. Raw bearer never hits disk.

## Sessions
- Bearer token, 30-day expiry, hashed in this kit (raw token is not written here).
- Sign out drops the unwrap and the session row.
- Rate limit: 8 failed logins per handle / 15 minutes, 24 per network.
- Writes: 80 mutations / 10 minutes per seat.

## Agents
Outside agents ingest this tree and speak MCP with the seat bearer.
They cannot mint another person's badge.
They cannot boot another person's computer.
They do not get a host shell. \`kiln_run\` is a jailed argv (ls, cat, git log/status).
Python/Node on this computer runs in a mount namespace. It cannot see \`data/\`, other computers, or the network.
Host exec and L1 post require a PQ attest when two-factor is on.
Unsigned is public-read. kiln/* is share-only.

## Harden
\`kiln_harden\` or POST /api/kiln/security { "action": "harden", "repoId": "${repoId}" } rewrites this kit onto the tree.
`;
}

export function twoFactorOn(handle) {
  return !!loadKit(handle).twoFactor;
}

export function setTwoFactor(handle, on) {
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, error: "signed out" };
  const kit = loadKit(h);
  kit.twoFactor = !!on;
  kit.events = [...(kit.events || []), { at: new Date().toISOString(), kind: on ? "two_factor_on" : "two_factor_off" }].slice(-80);
  kit.updatedAt = new Date().toISOString();
  saveKit(kit);
  return { ok: true, twoFactor: kit.twoFactor, security: publicKit(kit) };
}

export function hardenRepo(handle, repoId) {
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, error: "signed out" };
  const id = String(repoId || "");
  if (!ownsRepo(h, id) && !id.startsWith(h + "/")) {
    return { ok: false, error: "you can only harden your own trees" };
  }
  const dir = spaceHome(id);
  fs.mkdirSync(path.join(dir, ".kiln"), { recursive: true });
  fs.writeFileSync(path.join(dir, "SECURITY.md"), securityMarkdown(h, id));
  const kit = loadKit(h);
  const rec = {
    repoId: id,
    cipher: "AES-256-GCM+ML-KEM-768",
    wallet: "ML-DSA-65+ML-KEM-768",
    isolation: "handle-bound",
    rateLimit: true,
    ingest: "kiln-ingest/v1",
    shell: "jailed-argv",
    namespace: "unshare-mount-net",
    sessions: "hashed",
    twoFactor: !!kit.twoFactor,
    hardenedAt: new Date().toISOString(),
    owner: h,
  };
  fs.writeFileSync(path.join(dir, ".kiln", "SECURITY.json"), JSON.stringify(rec, null, 2));
  kit.hardened = [{ repoId: id, at: rec.hardenedAt }, ...(kit.hardened || []).filter((x) => x.repoId !== id)].slice(0, 40);
  kit.events = [...(kit.events || []), { at: rec.hardenedAt, kind: "harden", repoId: id }].slice(-80);
  kit.cipher = rec.cipher;
  saveKit(kit);
  return { ok: true, repoId: id, files: ["SECURITY.md", ".kiln/SECURITY.json"], security: publicKit(kit) };
}

export function readSecurity(handle) {
  const kit = loadKit(handle);
  if (!fs.existsSync(kitFile(handle))) ensureSecurity(handle);
  return { ok: true, security: publicKit(loadKit(handle)), sessions: (kit.sessions || []).map((s) => ({ id: s.id, at: s.at, ip: s.ip })) };
}
