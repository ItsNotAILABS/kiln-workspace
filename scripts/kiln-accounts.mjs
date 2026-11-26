/**
 * Real kiln accounts. Handle + secret. Server stores a scrypt hash, never the vault key.
 * Each handle is its own ledger, computer home, vault, and orchestrator.
 * Kiln origin catalog is public OSS. User private repos stay with the owner.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { ensureAccountVault, ensureRepoVault, unwrapSession, dropUnwrap, dropUnwrapForHandle, sessionSecret } from "./kiln-vault.mjs";
import { seatOrchestrator } from "./kiln-orchestrator.mjs";
import { bootSpace, spaceHome } from "./kiln-space.mjs";
import { listBadges, getPassport } from "./kiln-badge.mjs";
import { seatWallet, publicWallet, loadWallet } from "./kiln-wallet.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "data", "accounts");
const SESS = path.join(ROOT, "data", "sessions.json");

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

export function normalizeHandle(h) {
  return String(h || "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 24)
    .toLowerCase();
}

function accountFile(handle) {
  return path.join(DIR, `${handle}.json`);
}

function hashSecret(secret, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(secret), s, 32).toString("hex");
  return { salt: s, hash };
}

function verifySecret(secret, rec) {
  if (!rec?.salt || !rec?.hash) return false;
  const { hash } = hashSecret(secret, rec.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(rec.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function loadSessions() {
  return readJson(SESS, {});
}

function saveSessions(map) {
  const now = Date.now();
  const keep = {};
  for (const [k, v] of Object.entries(map)) {
    if (v && v.exp > now) keep[k] = v;
  }
  writeJson(SESS, keep);
  return keep;
}

function tokenKey(token) {
  return crypto.createHash("sha256").update(`kiln-sess:${String(token)}`).digest("hex");
}

function lookupSession(token) {
  if (!token) return { key: null, row: null, map: {}, hashed: false };
  const map = loadSessions();
  const hashed = tokenKey(token);
  if (map[hashed]) return { key: hashed, row: map[hashed], map, hashed: true };
  if (map[token]) return { key: token, row: map[token], map, hashed: false };
  return { key: hashed, row: null, map, hashed: true };
}

function mintToken(handle) {
  const token = crypto.randomBytes(24).toString("hex");
  const map = loadSessions();
  map[tokenKey(token)] = { handle, exp: Date.now() + 30 * 24 * 3600 * 1000, v: 2 };
  saveSessions(map);
  return token;
}

function publicAccount(rec) {
  if (!rec) return null;
  const wallet = publicWallet(loadWallet(rec.handle));
  return {
    handle: rec.handle,
    address: rec.address,
    pqAddress: wallet?.address || rec.pqAddress || null,
    displayName: rec.displayName || rec.handle,
    bio: rec.bio || "",
    lab: rec.lab || "",
    settings: cleanSettings(rec.settings),
    isolation: `kiln://${rec.handle}`,
    createdAt: rec.createdAt,
    kind: "user",
    wallet: wallet || { scheme: "pending", quantum: false },
  };
}

const SETTING_CHOICES = {
  density: ["regular", "compact"],
  motion: ["full", "reduced"],
  notify: ["on", "off"],
};

export function cleanSettings(input) {
  const out = { density: "regular", motion: "full", notify: "on" };
  const src = input && typeof input === "object" ? input : {};
  for (const key of Object.keys(SETTING_CHOICES)) {
    if (SETTING_CHOICES[key].includes(src[key])) out[key] = src[key];
  }
  return out;
}

export function readSettings(handle) {
  const rec = readJson(accountFile(normalizeHandle(handle)), null);
  return cleanSettings(rec && rec.settings);
}

export function clientKind(userAgent) {
  const ua = String(userAgent || "");
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Mobile/i.test(ua)) return "phone";
  return "desk";
}

export function updateSeat({ handle, displayName, bio, lab, settings } = {}) {
  const h = normalizeHandle(handle);
  const rec = readJson(accountFile(h), null);
  if (!rec) return { ok: false, error: "unknown handle" };
  if (displayName != null) {
    const name = String(displayName).replace(/\s+/g, " ").trim().slice(0, 48);
    rec.displayName = name || rec.handle;
  }
  if (bio != null) rec.bio = String(bio).replace(/\s+/g, " ").trim().slice(0, 240);
  if (lab != null) rec.lab = String(lab).replace(/\s+/g, " ").trim().slice(0, 48);
  rec.settings = cleanSettings({ ...readSettings(h), ...(settings && typeof settings === "object" ? settings : {}) });
  rec.lastSeen = new Date().toISOString();
  writeJson(accountFile(h), rec);
  return { ok: true, account: publicAccount(rec), settings: rec.settings };
}

function writeIfMissing(file, body) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return true;
}

function countTreeFiles(dir) {
  let n = 0;
  function walk(d, depth) {
    if (depth > 8 || n > 400) return;
    let ents = [];
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      if (e.name === ".git" || e.name === "node_modules" || e.name === ".kiln" || e.name === "__pycache__") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else n += 1;
    }
  }
  walk(dir, 0);
  return n;
}

const CREW_EDGES = [
  { from: "conductor", to: "architect", kind: "plan", label: "plan the tree" },
  { from: "conductor", to: "agi", kind: "ask", label: "ask Nova" },
  { from: "conductor", to: "scout", kind: "scout", label: "find the work" },
  { from: "architect", to: "builder", kind: "build", label: "implement the map" },
  { from: "builder", to: "reviewer", kind: "review", label: "read the diff" },
  { from: "reviewer", to: "builder", kind: "build", label: "request changes" },
  { from: "reviewer", to: "deployer", kind: "ship", label: "ship on approve" },
  { from: "conductor", to: "cipher", kind: "seal", label: "verify the vault" },
  { from: "conductor", to: "indexer", kind: "index", label: "keep memory honest" },
  { from: "deployer", to: "conductor", kind: "ship", label: "report preview" },
];

export function writeKernelFiles(repoId) {
  const id = String(repoId || "");
  if (!id.includes("/")) return { ok: false, wrote: 0 };
  const dir = spaceHome(id);
  const files = [
    [
      "constitution.json",
      JSON.stringify(
        {
          repo: id,
          rules: [
            "One computer per repository.",
            "A write is git commit. Use kiln_write_file.",
            "Handoff, do not impersonate.",
            "Seat yourself after a write.",
            "Never exfiltrate vault keys.",
            "Folder quota is 50 GiB. Cipher verifies.",
            "The capsule boots index.html. Deployer ships it.",
            "Speak git: clone, commit, push, pull, branch.",
          ],
        },
        null,
        2,
      ) + "\n",
    ],
    ["graph.json", JSON.stringify({ repo: id, edges: CREW_EDGES }, null, 2) + "\n"],
    ["mailbox.json", JSON.stringify({ repo: id, messages: [] }, null, 2) + "\n"],
    ["src/index.ts", `export const boot = () => {\n  console.log(${JSON.stringify(id + " kernel")});\n};\nboot();\n`],
    [
      "src/kernel.ts",
      `/** Crew kernel for ${id}. A write is a git commit. */\nexport const ROLES = ["conductor", "agi", "architect", "builder", "reviewer", "deployer", "cipher", "indexer"] as const;\nexport function seat(role: (typeof ROLES)[number]) {\n  return { role, repo: ${JSON.stringify(id)}, write: "kiln_write_file" };\n}\n`,
    ],
    [
      "AGENT.md",
      `# Agent · ${id}\n\nCrew kernel for this computer. A write is a git commit.\nConductor owns the graph. Builder writes. Reviewer gates. Cipher attests.\n`,
    ],
  ];
  let wrote = 0;
  for (const [rel, body] of files) {
    if (writeIfMissing(path.join(dir, rel), body)) wrote += 1;
  }
  return { ok: true, wrote, home: dir, files: countTreeFiles(dir) };
}

function ensureUserDocs(handle) {
  const h = normalizeHandle(handle);
  const dir = path.join(ROOT, "data", "users", h);
  fs.mkdirSync(dir, { recursive: true });
  const mem = path.join(dir, "memory.json");
  if (!fs.existsSync(mem)) writeJson(mem, { handle: h, conductor: [], agents: {} });
  const repos = path.join(dir, "repos.json");
  if (!fs.existsSync(repos)) writeJson(repos, { handle: h, repos: [] });
  return dir;
}

function seatCache(handle) {
  const h = normalizeHandle(handle);
  const userCache = path.join(ROOT, "data", "users", h, "cache");
  const backendCache = path.join(ROOT, "data", "backend", "cache", h);
  fs.mkdirSync(userCache, { recursive: true });
  fs.mkdirSync(backendCache, { recursive: true });
  const homeDir = spaceHome(`${h}/home`);
  fs.mkdirSync(path.join(homeDir, ".kiln", "cache"), { recursive: true });
  const catalog = loadUserRepos(h);
  const index = {
    handle: h,
    isolation: `kiln://${h}`,
    home: `${h}/home`,
    seatedAt: new Date().toISOString(),
    catalog: (catalog.repos || []).map((r) => r.id),
    computers: (catalog.repos || []).length,
  };
  writeJson(path.join(userCache, "INDEX.json"), index);
  writeJson(path.join(backendCache, "SEAT.json"), { handle: h, at: index.seatedAt, kind: "seat", home: `${h}/home` });
  writeJson(path.join(homeDir, ".kiln", "cache", "SEAT.json"), { handle: h, repoId: `${h}/home`, at: index.seatedAt });
  return { userCache, backendCache, index };
}

function enqueueBackend(kind, payload) {
  try {
    const inbox = path.join(ROOT, "data", "backend", "inbox");
    fs.mkdirSync(inbox, { recursive: true });
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}-${String(kind || "job").replace(/[^a-z0-9_-]+/gi, "")}.json`;
    fs.writeFileSync(path.join(inbox, name), JSON.stringify({ kind, payload: payload || {} }));
  } catch {
    /* runtime picks it up next tick */
  }
}

async function provisionExtras(handle, rec) {
  const h = normalizeHandle(handle);
  const homeId = `${h}/home`;
  try {
    const { ensureBase } = await import("./kiln-base.mjs");
    ensureBase(homeId, { visibility: "private", handle: h });
  } catch {
    /* base seats with the tree */
  }
  try {
    const { hardenRepo, ensureSecurity } = await import("./kiln-security.mjs");
    ensureSecurity(h);
    hardenRepo(h, homeId);
  } catch {
    /* security kit seats on login */
  }
  try {
    const { writeIngestCard } = await import("./kiln-ingest.mjs");
    writeIngestCard(homeId);
  } catch {
    /* ingest card is best-effort */
  }
  try {
    const { listBadges, mintBadge } = await import("./kiln-badge.mjs");
    const have = listBadges(homeId, { viewer: h }).some((b) => b.owner === h && b.name === "home");
    if (!have) {
      await mintBadge({
        repoId: homeId,
        owner: h,
        address: rec?.address,
        displayName: rec?.displayName || h,
        lab: rec?.lab || "",
        visibility: "private",
        minter: h,
        milestone: "seated",
        description: "Orchestrator home.",
        fileCount: loadUserRepos(h).repos.find((r) => r.id === homeId)?.fileCount || 0,
      });
    }
  } catch {
    /* genesis mint is best-effort */
  }
  enqueueBackend("account_audit", { handle: h });
  enqueueBackend("base_census", { repo: homeId });
  enqueueBackend("base_index", { repo: homeId });
  enqueueBackend("census", {});
  enqueueBackend("merkle", { repo: homeId });
  enqueueBackend("seat", { handle: h });
}

function seatNewAccount(h, rec, secret) {
  ensureAccountVault(h, { displayName: rec.displayName, lab: rec.lab, secret });
  try {
    seatWallet(h, secret);
  } catch {
    /* pq seat is required on a later login if this host is cold */
  }
  try {
    seatOrchestrator(h, { address: rec.address, displayName: rec.displayName, secret });
  } catch {
    /* space boot is best-effort */
  }
}

export function provisionSeat(handle, rec, secret) {
  const h = normalizeHandle(handle);
  if (!h || h === "kiln") return { ok: false, error: "user handle required" };
  const row = rec || readJson(accountFile(h), { handle: h, displayName: h, address: "", lab: "" });
  ensureUserDocs(h);
  seatNewAccount(h, row, secret);
  const home = createRepo(h, {
    name: "home",
    visibility: "private",
    description: "Orchestrator home. Private.",
  });
  const kernel = writeKernelFiles(`${h}/home`);
  if (home.ok && home.repo) {
    const n = kernel.files || countTreeFiles(spaceHome(`${h}/home`));
    if (n && n !== home.repo.fileCount) {
      home.repo.fileCount = n;
      home.repo.updatedAt = new Date().toISOString();
      saveUserRepos(h, [home.repo]);
    }
  }
  const cache = seatCache(h);
  provisionExtras(h, row).catch(() => {});
  return {
    ok: true,
    handle: h,
    home: home.repo || { id: `${h}/home` },
    isolation: `kiln://${h}/home.git`,
    cache: cache.index,
    kernel: { wrote: kernel.wrote, files: kernel.files },
  };
}

export function provisionAllSeats() {
  const out = [];
  try {
    for (const f of fs.readdirSync(DIR)) {
      if (!f.endsWith(".json")) continue;
      const rec = readJson(path.join(DIR, f), null);
      if (!rec?.handle) continue;
      out.push(provisionSeat(rec.handle, rec, null));
    }
  } catch {
    /* none */
  }
  return out;
}

export function registerAccount({ handle, secret, address, displayName, bio, lab } = {}) {
  const h = normalizeHandle(handle);
  if (h.length < 2) return { ok: false, error: "handle required" };
  if (h === "kiln") return { ok: false, error: "kiln is the origin operator, not a user seat" };
  const sec = String(secret || "").replace(/^0x/i, "");
  if (sec.length < 12) return { ok: false, error: "secret too short" };
  fs.mkdirSync(DIR, { recursive: true });
  const file = accountFile(h);
  let rec = readJson(file, null);
  if (rec) {
    if (!verifySecret(sec, rec)) return { ok: false, error: "handle taken" };
    rec.address = address || rec.address;
    rec.lastSeen = new Date().toISOString();
    if (displayName) rec.displayName = displayName;
    if (bio) rec.bio = bio;
    if (lab) rec.lab = lab;
    writeJson(file, rec);
    const token = mintToken(h);
    unwrapSession(token, { handle: h, secret: sec });
    provisionSeat(h, rec, sec);
    return { ok: true, account: publicAccount(rec), token, created: false };
  }
  const { salt, hash } = hashSecret(sec);
  rec = {
    handle: h,
    address: address || "0x" + crypto.createHash("sha256").update(`kiln-addr:${sec}`).digest("hex").slice(0, 40),
    salt,
    hash,
    displayName: displayName || h,
    bio: bio || "",
    lab: lab || "",
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
  writeJson(file, rec);
  ensureUserDocs(h);
  provisionSeat(h, rec, sec);
  const token = mintToken(h);
  unwrapSession(token, { handle: h, secret: sec });
  return { ok: true, account: publicAccount(rec), token, created: true };
}

export function loginAccount({ handle, secret } = {}) {
  const h = normalizeHandle(handle);
  const rec = readJson(accountFile(h), null);
  if (!rec || !verifySecret(String(secret || "").replace(/^0x/i, ""), rec)) {
    return { ok: false, error: "unknown handle or secret" };
  }
  rec.lastSeen = new Date().toISOString();
  writeJson(accountFile(h), rec);
  const token = mintToken(h);
  const sec = String(secret || "").replace(/^0x/i, "");
  unwrapSession(token, { handle: h, secret: sec });
  provisionSeat(h, rec, sec);
  return { ok: true, account: publicAccount(rec), token };
}

export function openSession(handle) {
  const h = normalizeHandle(handle);
  const rec = readJson(accountFile(h), null);
  if (!rec) return { ok: false, error: "unknown handle" };
  rec.lastSeen = new Date().toISOString();
  writeJson(accountFile(h), rec);
  const token = mintToken(h);
  provisionSeat(h, rec, null);
  return { ok: true, account: publicAccount(rec), token };
}

export function sessionAccount(token) {
  if (!token) return null;
  const found = lookupSession(token);
  if (!found.row || found.row.exp < Date.now()) return null;
  if (!found.hashed && found.key === token) {
    found.map[tokenKey(token)] = { ...found.row, v: 2 };
    delete found.map[token];
    saveSessions(found.map);
  }
  return publicAccount(readJson(accountFile(found.row.handle), null));
}

export function logoutAccount(token) {
  dropUnwrap(token);
  const found = lookupSession(token);
  if (found.key) delete found.map[found.key];
  delete found.map[token];
  saveSessions(found.map);
  return { ok: true };
}

export function saveUserRepos(handle, repos) {
  const h = normalizeHandle(handle);
  if (!h || h === "kiln") return loadUserRepos(h);
  const file = path.join(ROOT, "data", "users", h, "repos.json");
  const existing = readJson(file, { handle: h, repos: [] });
  const byId = new Map();
  for (const r of existing.repos || []) {
    if (r?.id) byId.set(r.id, r);
  }
  const incoming = Array.isArray(repos) ? repos : [];
  if (incoming.length === 0) {
    return { handle: h, repos: [...byId.values()] };
  }
  for (const r of incoming) {
    if (!r) continue;
    const id = r.id || (r.name ? `${h}/${r.name}` : "");
    if (!id) continue;
    const prev = byId.get(id) || {};
    const vis =
      r.visibility === "private" || r.encrypted
        ? "private"
        : r.visibility === "public"
          ? "public"
          : prev.visibility || "public";
    byId.set(id, {
      id,
      owner: r.owner || prev.owner || h,
      name: r.name || prev.name || String(id).split("/")[1],
      description: r.description || prev.description || "",
      merkleRoot: r.merkleRoot || prev.merkleRoot,
      fileCount: Number(r.fileCount) || (r.files || []).length || prev.fileCount || 0,
      visibility: vis,
      encrypted: vis === "private",
      updatedAt: r.updatedAt || new Date().toISOString(),
    });
  }
  const doc = { handle: h, repos: [...byId.values()] };
  writeJson(file, doc);
  return doc;
}

export function normalizeRepoName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function createRepo(handle, { name, visibility, description } = {}) {
  const h = normalizeHandle(handle);
  if (!h || h === "kiln") return { ok: false, error: "sign in as a user to create a repo" };
  const slug = normalizeRepoName(name);
  if (slug.length < 1) return { ok: false, error: "repo name required" };
  const id = `${h}/${slug}`;
  const vis = visibility === "private" ? "private" : "public";
  const existing = loadUserRepos(h);
  const found = (existing.repos || []).find((r) => r.id === id || r.name === slug);
  if (found) {
    writeKernelFiles(id);
    return { ok: true, repo: found, created: false, home: spaceHome(id) };
  }
  const rec = {
    id,
    owner: h,
    name: slug,
    description: String(description || "").slice(0, 280),
    fileCount: 0,
    visibility: vis,
    encrypted: vis === "private",
    updatedAt: new Date().toISOString(),
  };
  bootSpace({ repoId: id, owner: h, agentId: "conductor", role: "conductor" });
  ensureRepoVault(h, id, { visibility: vis });
  const dir = spaceHome(id);
  const readme = path.join(dir, "README.md");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      `# ${slug}\n\n${rec.description || "A Kiln tree."}\n\nOwner @${h}. ${vis}. Computer, vault, and orchestrator are seated.\n`,
    );
  }
  writeKernelFiles(id);
  rec.fileCount = countTreeFiles(dir) || 2;
  saveUserRepos(h, [rec]);
  return { ok: true, repo: rec, created: true, home: dir };
}

export function markSessionPq(token) {
  const found = lookupSession(token);
  if (!found.row) return { ok: false, error: "signed out" };
  const pqAt = Date.now();
  const key = found.hashed ? found.key : tokenKey(token);
  if (!found.hashed) delete found.map[token];
  found.map[key] = { ...found.row, v: 2, pqAt };
  saveSessions(found.map);
  return { ok: true, pqAt };
}

export function sessionPq(token) {
  const found = lookupSession(token);
  if (!found.row?.pqAt) return false;
  return Date.now() - Number(found.row.pqAt) < 12 * 3600 * 1000;
}

export function revokeSession(token, handle) {
  if (!token) return { ok: true };
  const found = lookupSession(token);
  if (!found.row) return { ok: true };
  if (handle && found.row.handle !== handle) return { ok: false, error: "not your session" };
  dropUnwrap(token);
  if (found.key) delete found.map[found.key];
  delete found.map[token];
  saveSessions(found.map);
  return { ok: true };
}

export function revokeOtherSessions(handle, keepToken) {
  const h = normalizeHandle(handle);
  const map = loadSessions();
  const keepKey = keepToken ? tokenKey(keepToken) : "";
  for (const [k, v] of Object.entries(map)) {
    if (v && v.handle === h && k !== keepToken && k !== keepKey) {
      delete map[k];
    }
  }
  dropUnwrapForHandle(h, keepToken);
  saveSessions(map);
  return { ok: true };
}

export function loadUserRepos(handle) {
  const h = normalizeHandle(handle);
  return readJson(path.join(ROOT, "data", "users", h, "repos.json"), { handle: h, repos: [] });
}

export function kilnPublicRepos() {
  const doc = readJson(path.join(ROOT, "public", "kiln-account.json"), { repos: [] });
  return (doc.repos || []).map((r) => ({
    id: r.id,
    owner: "kiln",
    name: r.name || String(r.id || "").split("/")[1],
    description: r.description || "",
    visibility: "public",
    encrypted: false,
    language: r.language,
    topics: r.topics || [],
  }));
}

export function publicCatalog(viewer) {
  const v = normalizeHandle(viewer);
  const out = [...kilnPublicRepos()];
  const usersDir = path.join(ROOT, "data", "users");
  try {
    for (const name of fs.readdirSync(usersDir)) {
      const doc = readJson(path.join(usersDir, name, "repos.json"), null);
      if (!doc?.repos) continue;
      for (const r of doc.repos) {
        const owner = r.owner || doc.handle;
        const vis = r.visibility === "private" || r.encrypted ? "private" : "public";
        if (vis === "private" && v !== owner) continue;
        out.push({
          id: r.id,
          owner,
          name: r.name || String(r.id || "").split("/")[1],
          description: r.description || "",
          visibility: vis,
          encrypted: vis === "private",
          merkleRoot: r.merkleRoot,
          fileCount: Number(r.fileCount) || 0,
        });
      }
    }
  } catch {
    /* none */
  }
  return { ok: true, viewer: v || null, repos: out, people: listPublicAccounts() };
}

export function loadAccount(handle) {
  return publicAccount(readJson(accountFile(normalizeHandle(handle)), null));
}

export function listPublicAccounts() {
  const out = [];
  try {
    for (const f of fs.readdirSync(DIR)) {
      if (!f.endsWith(".json")) continue;
      const rec = readJson(path.join(DIR, f), null);
      const pub = publicAccount(rec);
      if (pub) out.push(pub);
    }
  } catch {
    /* none */
  }
  return out;
}

export function ownsRepo(handle, repoId) {
  const h = normalizeHandle(handle);
  const id = String(repoId || "");
  if (!h || !id) return false;
  if (id === `${h}/home` || id.startsWith(h + "/")) return true;
  const doc = loadUserRepos(h);
  return (doc.repos || []).some((r) => r.id === id || r.id === `${h}/${id}`);
}

export function canReadRepo(viewer, repoId, visibility) {
  const vis = visibility === "private" ? "private" : "public";
  if (vis !== "private") return true;
  return ownsRepo(viewer, repoId);
}

export function profilePageHtml(handle, origin) {
  const acc = loadAccount(handle);
  const a = String.fromCharCode(38);
  const esc = (s) =>
    String(s || "")
      .replace(/&/g, a + "amp;")
      .replace(/</g, a + "lt;")
      .replace(/>/g, a + "gt;")
      .replace(/"/g, a + "quot;");
  if (!acc) return null;
  const cat = publicCatalog(null);
  const repos = (cat.repos || []).filter((r) => r.owner === acc.handle && r.visibility !== "private");
  let badges = [];
  try {
    badges = listBadges(null, { viewer: null }).filter((b) => b.owner === acc.handle && b.visibility !== "private").slice(0, 12);
  } catch {
    badges = [];
  }
  const letter = (acc.displayName || acc.handle || "K")[0].toUpperCase();
  const pass = (() => {
    try {
      return getPassport(acc.handle);
    } catch {
      return null;
    }
  })();
  const list = repos
    .map((r) => `<li><a href="${esc(origin)}/${esc(r.owner)}/${esc(r.name)}">${esc(r.owner)}/${esc(r.name)}</a><span>${esc(r.description || "")}</span></li>`)
    .join("");
  const plates = badges
    .map(
      (b) =>
        `<a class="plate" href="${esc(origin)}${esc(b.page)}"><img src="${esc(b.jpg || b.card)}" alt="${esc(b.owner)}/${esc(b.name)}"/><em>${esc(b.name)}${b.milestone ? " · " + esc(b.milestone) : ""}</em></a>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>@${esc(acc.handle)} · Kiln</title>
<meta property="og:title" content="@${esc(acc.handle)} on Kiln"/>
<meta property="og:description" content="${esc(acc.bio || acc.displayName)}"/>
<style>
  :root{--bg:#09090b;--fg:#f4f4f5;--muted:#a1a1aa;--line:rgba(255,255,255,.12);--teal:#5eead4}
  html,body{margin:0;background:var(--bg);color:var(--fg);font-family:"IBM Plex Sans",system-ui,sans-serif}
  main{max-width:860px;margin:0 auto;padding:48px 20px 80px}
  p{color:var(--muted)}
  a{color:var(--teal);text-decoration:none}
  .mono{letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:var(--muted)}
  .who{display:flex;gap:18px;align-items:center;margin:18px 0 28px}
  .ava{width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px var(--line);font:600 28px/1 "IBM Plex Sans",system-ui;color:var(--teal)}
  ul{padding:0;list-style:none} li{padding:12px 0;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:4px}
  li span{color:var(--muted);font-size:13px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-top:16px}
  .plate{display:flex;flex-direction:column;gap:8px;color:var(--fg)}
  .plate img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;outline:1px solid var(--line);outline-offset:-1px;background:#121214}
  .plate em{font:500 12px/1.3 "IBM Plex Sans",system-ui;font-style:normal;color:var(--muted)}
</style></head>
<body><main>
  <p class="mono">Kiln profile</p>
  <div class="who">
    <div class="ava" aria-hidden="true">${esc(letter)}</div>
    <div>
      <h1 style="margin:0;font:600 28px/1.2 IBM Plex Sans,system-ui">${esc(acc.displayName)}</h1>
      <p style="margin:6px 0 0">@${esc(acc.handle)}${acc.lab ? " · " + esc(acc.lab) : ""}</p>
    </div>
  </div>
  <p>${esc(acc.bio)}</p>
  ${acc.wallet && acc.wallet.quantum
    ? `<p class="mono" style="text-transform:none;letter-spacing:0;word-break:break-all">PQ ${esc(acc.wallet.scheme)} · ${esc(acc.pqAddress || acc.wallet.address)}</p>`
    : acc.pqAddress
      ? `<p class="mono" style="text-transform:none;letter-spacing:0;word-break:break-all">PQ ${esc(acc.pqAddress)}</p>`
      : ""}
  <p class="mono" style="text-transform:none;letter-spacing:.08em">${esc(acc.isolation || "kiln://" + acc.handle)}</p>
  ${pass && pass.jpg ? `<h2 class="mono">Passport</h2><a class="plate" href="${esc(origin)}/p/${esc(acc.handle)}"><img src="${esc(pass.jpg)}" alt="Kiln Passport @${esc(acc.handle)}"/><em>Type P · L1 ${esc(String(pass.block || pass.height || ""))} · #${esc(pass.token)}</em></a>` : ""}
  <h2 class="mono">Public repos</h2>
  <ul>${list || "<li>None public yet</li>"}</ul>
  <h2 class="mono">Minted badges</h2>
  <div class="grid">${plates || "<p>No public mints yet.</p>"}</div>
  <p style="margin-top:32px"><a href="${esc(origin)}/">Open Kiln</a> · <a href="${esc(origin)}/base/${esc(acc.handle)}/home">Open Kiln Base</a> · <a href="${esc(origin)}/ingest/${esc(acc.handle)}">Ingest this seat</a></p>
</main></body></html>`;
}

export function bearerFrom(req = {}) {
  const h = String(req.authorization || req.Authorization || "");
  const m = h.match(/^Bearer\s+(\S+)/i);
  if (m) return m[1];
  return req.token || req.session || "";
}

export { sessionSecret };
