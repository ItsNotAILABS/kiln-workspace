/**
 * Kiln ingest — outside agents speak this, not the UI.
 * MCP tools execute on the sealed tree. Session bearer is the seat.
 * Unsigned = public read. Signed = write only what you own.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";
import { ownsRepo, createRepo, loadAccount, loadUserRepos, kilnPublicRepos, canReadRepo, normalizeHandle } from "./kiln-accounts.mjs";
import { bootSpace, rememberSpace, readMemory, spaceHome } from "./kiln-space.mjs";
import { runBaseTool, putObject, describeBase, canSeeBase, listBases, ensureBase } from "./kiln-base.mjs";
import { ensurePassport, getPassport, mintBadge, listBadges } from "./kiln-badge.mjs";
import { hardenRepo, resolveInside, runJailed, noteEvent } from "./kiln-security.mjs";
import { runRebel } from "./kiln-rebel.mjs";
import { receiptOf } from "./kiln-board.mjs";
import { shipComputer } from "./kiln-ship.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const COMPUTERS = path.join(ROOT, "computers");

export const INGEST_TOOLS = [
  "kiln_list_files",
  "kiln_read_file",
  "kiln_write_file",
  "kiln_run",
  "kiln_remember",
  "kiln_machine",
  "kiln_ledger",
  "kiln_search",
  "kiln_base",
  "kiln_harden",
  "kiln_passport",
  "kiln_mint_badge",
  "kiln_create_repo",
  "kiln_upload",
  "kiln_ingest",
  "kiln_rebel",
];

function sha(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function splitRepo(repoId) {
  const raw = String(repoId || "").replace(/^\/+/, "");
  const [owner, ...rest] = raw.split("/");
  const name = rest.join("/") || "home";
  return { owner: normalizeHandle(owner), name: name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 40), id: `${normalizeHandle(owner)}/${name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 40)}` };
}

function computerDir(repoId) {
  const { owner, name } = splitRepo(repoId);
  return path.join(COMPUTERS, `${owner}_${name}`);
}

function canWrite(viewer, repoId) {
  const { owner, id } = splitRepo(repoId);
  if (!viewer) return false;
  if (owner === "kiln") return false;
  return ownsRepo(viewer, id) || viewer === owner;
}

function canRead(viewer, repoId) {
  const { owner, id } = splitRepo(repoId);
  if (owner === "kiln") return true;
  if (viewer && (viewer === owner || ownsRepo(viewer, id))) return true;
  const doc = loadUserRepos(owner);
  const rec = (doc.repos || []).find((r) => r.id === id || r.name === splitRepo(repoId).name);
  if (!rec) return false;
  return canReadRepo(viewer, id, rec.visibility);
}

function walkFiles(dir, prefix = "", out = [], depth = 0) {
  if (depth > 8 || out.length > 400) return out;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === ".git" || e.name === "node_modules" || e.name.startsWith(".kiln-run") || e.name === "__pycache__") continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, rel, out, depth + 1);
    else if (e.isFile()) {
      let size = 0;
      try {
        size = fs.statSync(full).size;
      } catch {
        size = 0;
      }
      out.push({ path: rel, bytes: size });
    }
  }
  return out;
}

function noteOutside(repoId, row) {
  const dir = path.join(spaceHome(repoId), ".kiln");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "outside.json");
  let doc = { writes: [] };
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    doc = { writes: [] };
  }
  const writes = Array.isArray(doc.writes) ? doc.writes : [];
  writes.unshift({
    at: new Date().toISOString(),
    path: String(row.path || ""),
    commit: String(row.commit || ""),
    bytes: Number(row.bytes || 0),
    by: String(row.by || ""),
  });
  fs.writeFileSync(file, JSON.stringify({ writes: writes.slice(0, 40) }, null, 2));
}

export function readCrew(repoId) {
  const { id } = splitRepo(repoId);
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(spaceHome(id), ".kiln", "crew.json"), "utf8"));
    if (doc && Array.isArray(doc.members)) return doc;
  } catch {
    /* seat a conductor */
  }
  return {
    repoId: id,
    members: [{ id: "conductor", role: "conductor", name: "Cord", outside: false }],
    mail: [],
  };
}

function saveCrew(repoId, crew) {
  const { id } = splitRepo(repoId);
  const dir = path.join(spaceHome(id), ".kiln");
  fs.mkdirSync(dir, { recursive: true });
  crew.repoId = id;
  fs.writeFileSync(path.join(dir, "crew.json"), JSON.stringify(crew, null, 2));
  return crew;
}

export function seatOutside(repoId, who, extra = {}) {
  const crew = readCrew(repoId);
  const id = String(who || extra.name || "outside").slice(0, 48);
  let member = crew.members.find((row) => row.id === id || row.name === id);
  if (!member) {
    member = {
      id,
      role: extra.role || "builder",
      name: extra.name || id,
      outside: extra.outside !== false,
      at: new Date().toISOString(),
    };
    crew.members.push(member);
  }
  if (extra.path) member.lastPath = extra.path;
  if (extra.task) member.task = String(extra.task).slice(0, 280);
  member.at = new Date().toISOString();
  if (extra.task) {
    crew.mail = Array.isArray(crew.mail) ? crew.mail : [];
    crew.mail.unshift({
      at: member.at,
      from: extra.from || id,
      to: extra.to || member.name,
      task: String(extra.task).slice(0, 280),
    });
    crew.mail = crew.mail.slice(0, 24);
  }
  return saveCrew(repoId, crew);
}

export function readOutside(repoId) {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(spaceHome(repoId), ".kiln", "outside.json"), "utf8"));
    return Array.isArray(doc.writes) ? doc.writes.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export const PUBLIC_FORGE = "https://kiln.pocketnova.app";

export function agentClients(origin) {
  const root = String(origin || "").replace(/\/$/, "");
  const mcp = `${root}/api/mcp`;
  const api = `${root}/api/kiln/loop`;
  return {
    studio: "Build in Kiln Studio. Do not clone. kiln_write_file is a git commit on this computer. Studio shows the file.",
    claude: {
      name: "Claude",
      command: `claude mcp add --transport http kiln ${mcp} --header "Authorization: Bearer $KILN_SESSION"`,
      desktop: {
        mcpServers: {
          kiln: { type: "http", url: mcp, headers: { Authorization: "Bearer $KILN_SESSION" } },
        },
      },
      phone: `In the Claude app, add a custom connector. URL: ${mcp}. No header yet. First tool is kiln_open_seat. Save the secret. Send the token after that.`,
    },
    muse: {
      name: "Muse",
      file: "~/.config/muse/settings.json",
      notLocal: "http://127.0.0.1:8787 is the old on-device kiln. Delete that entry. This forge is the url below.",
      mcp_servers: {
        kiln: {
          transport: "streamable_http",
          url: mcp,
          headers: { Authorization: "Bearer $KILN_SESSION" },
        },
      },
      phone: `If this Muse cannot edit a settings file, do not. POST JSON to ${api}.`,
    },
    phone: {
      name: "Phone model",
      api,
      mcp,
      how: "You are on a phone. Do not look for a config file. POST JSON to the api. Put token in the JSON body. First call has no token. Do not use http://127.0.0.1:8787.",
    },
  };
}

export async function publicForge() {
  const url = `${PUBLIC_FORGE}/api/mcp`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const text = (await res.text()).slice(0, 80);
    const live = res.ok && !/hello world/i.test(text);
    return {
      url,
      live,
      note: live
        ? "Point Muse at this public forge. Not at 127.0.0.1:8787."
        : "kiln.pocketnova.app is still the Hello World worker. Paste public/cloudflare/worker.js and set ORIGIN to the published app before Muse uses that host. Until then, Muse uses the /api/mcp of the kiln that is actually answering. Never 127.0.0.1:8787.",
    };
  } catch {
    return {
      url,
      live: false,
      note: "The public host did not answer. Muse stays on the kiln that is answering. Not 127.0.0.1:8787.",
    };
  }
}

export function phoneCard(origin) {
  const clients = agentClients(origin);
  return {
    ok: true,
    spec: "kiln-phone/v1",
    for: ["muse", "claude", "phone"],
    say: "You are a Kiln agent. POST JSON to api. A write is a git commit on the Kiln computer. Do not clone. Do not edit a settings file from a phone.",
    api: clients.phone.api,
    mcp: clients.phone.mcp,
    first: { tool: "open_seat", name: "your name" },
    calls: [
      { tool: "map" },
      { tool: "go", path: "/studio", token: "<token>" },
      { tool: "sit", token: "<token>" },
      { tool: "review", token: "<token>", question: "what is live" },
      { tool: "write", token: "<token>", path: "src/hello.js", content: "export const ok = true\n" },
    ],
    clients,
  };
}

function gitCommit(dir, message) {
  if (!fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" });
    spawnSync("git", ["config", "user.email", "agent@kiln"], { cwd: dir, encoding: "utf8" });
    spawnSync("git", ["config", "user.name", "Kiln Agent"], { cwd: dir, encoding: "utf8" });
  }
  spawnSync("git", ["add", "-A"], { cwd: dir, encoding: "utf8" });
  spawnSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", String(message || "kiln ingest").slice(0, 72), "--allow-empty"], {
    cwd: dir,
    encoding: "utf8",
  });
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" });
  return String(r.stdout || "").trim();
}

function merkleDir(dir) {
  const files = walkFiles(dir);
  const leaves = files.map((f) => {
    try {
      return sha(fs.readFileSync(path.join(dir, f.path)));
    } catch {
      return sha(f.path);
    }
  });
  leaves.sort();
  return "0x" + sha(leaves.join("")).slice(0, 48);
}

export function writeIngestCard(repoId, extra = {}) {
  const { id, owner, name } = splitRepo(repoId);
  const dir = spaceHome(id);
  const files = walkFiles(dir);
  const card = {
    spec: "kiln-ingest/v1",
    kind: "app",
    repoId: id,
    owner,
    name,
    isolation: `kiln://${id}`,
    mcp: "/api/mcp",
    ingest: `/ingest/${id}`,
    llms: "/llms.txt",
    auth: "Bearer kiln-session",
    tools: INGEST_TOOLS,
    embed: true,
    how: "Point Claude or Muse at this webapp. They use Studio. kiln_write_file commits on this computer. Do not clone.",
    files: files.length,
    merkle: merkleDir(dir),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  fs.writeFileSync(path.join(dir, "INGEST.json"), JSON.stringify(card, null, 2));
  return card;
}

function listTree(repoId, rel, viewer) {
  const { id } = splitRepo(repoId);
  if (!canRead(viewer, id)) return { ok: false, error: "unknown tree" };
  const dir = computerDir(id);
  if (!fs.existsSync(dir)) bootSpace({ repoId: id, owner: splitRepo(id).owner });
  const base = rel ? resolveInside(dir, rel) : path.resolve(dir);
  if (!base) return { ok: false, error: "bad path" };
  const files = walkFiles(base, rel ? String(rel).replace(/^\/+/, "") : "");
  return { ok: true, repoId: id, isolation: `kiln://${id}`, files, merkle: merkleDir(dir) };
}

function readTree(repoId, rel, viewer) {
  const { id } = splitRepo(repoId);
  if (!canRead(viewer, id)) return { ok: false, error: "unknown tree" };
  const dir = computerDir(id);
  const dest = resolveInside(dir, rel);
  if (!dest || !fs.existsSync(dest) || !fs.statSync(dest).isFile()) return { ok: false, error: "unknown file" };
  const buf = fs.readFileSync(dest);
  if (buf.length > 400_000) return { ok: false, error: "file too large", bytes: buf.length, path: rel };
  const text = buf.toString("utf8");
  const binary = /[\x00]/.test(text);
  return { ok: true, repoId: id, path: rel, bytes: buf.length, sha256: sha(buf), content: binary ? null : text, binary };
}

function writeTree(repoId, { path: rel, content, message } = {}, viewer) {
  const { id } = splitRepo(repoId);
  if (!canWrite(viewer, id)) return { ok: false, error: "not your tree" };
  const dir = spaceHome(id);
  const relNorm = String(rel || "").replace(/^\/+/, "").replace(/\\/g, "/");
  if (!relNorm || relNorm === ".git" || relNorm.startsWith(".git/")) return { ok: false, error: "bad path" };
  const dest = resolveInside(dir, relNorm);
  if (!dest || dest === path.resolve(dir)) return { ok: false, error: "bad path" };
  const body = String(content ?? "");
  if (body.length > 400_000) return { ok: false, error: "file too large" };
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, body);
  const commit = gitCommit(dir, message || `studio: ${relNorm}`);
  rememberSpace({ repoId: id, kind: "procedural", text: `write ${relNorm}` });
  noteEvent(viewer, "ingest_write", { repoId: id, path: relNorm });
  noteOutside(id, { path: relNorm, commit, bytes: body.length, by: viewer || "" });
  try {
    const who = viewer || "outside";
    seatOutside(id, who, {
      role: "builder",
      name: who,
      path: relNorm,
      outside: true,
      task: message || `write ${relNorm}`,
      from: who,
    });
  } catch {
    /* the commit already landed */
  }
  const card = writeIngestCard(id, { lastWrite: relNorm, commit });
  return {
    ok: true,
    repoId: id,
    path: relNorm,
    bytes: body.length,
    sha256: sha(body),
    commit,
    merkle: card.merkle,
    isolation: `kiln://${id}`,
    mutated: true,
    studio: "Committed on this computer. Kiln Studio shows the file. Do not clone.",
  };
}

function searchTree(repoId, q, viewer) {
  const { id } = splitRepo(repoId);
  if (!canRead(viewer, id)) return { ok: false, error: "unknown tree" };
  const needle = String(q || "").toLowerCase();
  if (!needle) return { ok: false, error: "q required" };
  const dir = computerDir(id);
  const hits = [];
  for (const f of walkFiles(dir)) {
    const nameHit = f.path.toLowerCase().includes(needle);
    let snippet = "";
    if (f.bytes < 80_000 && /\.(md|txt|js|mjs|ts|py|json|html|css)$/i.test(f.path)) {
      try {
        const text = fs.readFileSync(path.join(dir, f.path), "utf8");
        const i = text.toLowerCase().indexOf(needle);
        if (i >= 0) snippet = text.slice(Math.max(0, i - 40), i + needle.length + 40).replace(/\s+/g, " ");
        else if (!nameHit) continue;
      } catch {
        if (!nameHit) continue;
      }
    } else if (!nameHit) continue;
    hits.push({ path: f.path, bytes: f.bytes, snippet });
    if (hits.length >= 40) break;
  }
  return { ok: true, repoId: id, q: needle, hits };
}

function runCmd(repoId, command, viewer) {
  const { id } = splitRepo(repoId);
  if (!canWrite(viewer, id)) return { ok: false, error: "sign in as owner to run" };
  const dir = spaceHome(id);
  const r = runJailed(dir, command || "ls");
  return { ok: r.ok, repoId: id, code: r.code, out: r.out, err: r.err };
}

export function originIngest(origin, viewer) {
  const bases = listBases(viewer);
  const kiln = kilnPublicRepos().slice(0, 12).map((r) => r.id);
  let mine = [];
  if (viewer) {
    mine = (loadUserRepos(viewer).repos || []).map((r) => r.id);
  }
  const acc = viewer ? loadAccount(viewer) : null;
  const pass = viewer ? getPassport(viewer) : null;
  return {
    spec: "kiln-ingest/v1",
    kind: "origin",
    name: "Kiln",
    isolation: "kiln://",
    mcp: `${origin}/api/mcp`,
    ingest: `${origin}/ingest`,
    llms: `${origin}/llms.txt`,
    auth: "POST /api/kiln/account { action: login, handle, secret } → Authorization: Bearer <token>",
    tools: INGEST_TOOLS,
    embed: true,
    how: "Point Claude or Muse at this webapp. They use Studio. POST /api/mcp tools/call kiln_write_file with Authorization: Bearer <session>. A write is a git commit. Do not clone.",
    clients: agentClients(origin),
    public: kiln,
    seated: mine,
    bases: (bases.bases || []).map((b) => b.repoId),
    viewer: acc ? { handle: acc.handle, isolation: acc.isolation, pq: acc.pqAddress } : null,
    passport: pass ? { token: pass.token, page: pass.page, height: pass.height || pass.block } : null,
    note: "Point Claude or Muse at this webapp. They build in Studio with kiln_write_file. A write is a git commit. Unsigned is public-read.",
  };
}

export function repoIngest(repoId, origin, viewer) {
  const { id, owner, name } = splitRepo(repoId);
  if (!canRead(viewer, id)) return { ok: false, error: "unknown tree" };
  bootSpace({ repoId: id, owner });
  const card = writeIngestCard(id);
  const base = describeBase(id, viewer);
  return {
    ok: true,
    ...card,
    origin,
    page: `${origin}/${owner}/${name}`,
    base: `${origin}/base/${owner}/${name}`,
    computer: `computers/${owner}_${name}`,
    write: canWrite(viewer, id),
    tables: base.ok ? Object.keys(base.tables || {}) : [],
    merkleBase: base.merkle || null,
    how: "Build in Studio. Do not clone. POST /api/mcp tools/call kiln_write_file with the seat bearer. Studio shows the commit.",
    clients: agentClients(origin),
  };
}

export function seatIngest(handle, origin, viewer) {
  const h = normalizeHandle(handle);
  const acc = loadAccount(h);
  if (!acc) return { ok: false, error: "unknown seat" };
  const pass = getPassport(h);
  const repos = (loadUserRepos(h).repos || []).filter((r) => canRead(viewer, r.id));
  return {
    ok: true,
    spec: "kiln-ingest/v1",
    kind: "seat",
    handle: h,
    name: acc.displayName || h,
    lab: acc.lab || "",
    isolation: acc.isolation || `kiln://${h}`,
    pq: acc.pqAddress || acc.wallet?.address || null,
    scheme: acc.wallet?.scheme || "ml-dsa-65+ml-kem-768",
    passport: pass ? { token: pass.token, page: `${origin}${pass.page}`, jpg: pass.jpg, height: pass.height || pass.block } : null,
    mcp: `${origin}/api/mcp`,
    ingest: `${origin}/ingest/${h}`,
    llms: `${origin}/llms.txt`,
    profile: `${origin}/u/${h}`,
    auth: "POST /api/kiln/account { action: login, handle, secret } → Authorization: Bearer <token>",
    tools: INGEST_TOOLS,
    embed: true,
    write: viewer === h,
    clients: agentClients(origin),
    trees: repos.map((r) => ({
      id: r.id,
      visibility: r.visibility,
      ingest: `${origin}/ingest/${r.id}`,
      page: `${origin}/${r.id}`,
    })),
    viewer: viewer || null,
    note: "This seat is ingestible. Sign in as the handle to write. Public trees are readable unsigned.",
  };
}

export function wellKnownKiln(origin) {
  return {
    spec: "kiln-ingest/v1",
    name: "Kiln",
    isolation: "kiln://",
    mcp: `${origin}/api/mcp`,
    ingest: `${origin}/ingest`,
    llms: `${origin}/llms.txt`,
    passport: `${origin}/p/{handle}`,
    base: `${origin}/base/{owner}/{repo}`,
    auth: "POST /api/kiln/account { action: login, handle, secret } → Authorization: Bearer <token>",
    tools: INGEST_TOOLS,
    embed: true,
    merkle: "proof",
    wallet: "ml-dsa-65+ml-kem-768",
    note: "Point Claude, Muse, or a phone model at this webapp. Desktop uses MCP. A phone POSTs the api. Do not clone.",
    clients: agentClients(origin),
    phone: phoneCard(origin),
  };
}

export function wellKnownAgent(origin) {
  return {
    schema_version: "0.1.0",
    name: "Kiln",
    description: "Sovereign forge. Claude, Muse, and phone models build in Studio. A write is a git commit. A phone POSTs the api and does not edit a config file.",
    url: origin,
    mcp: `${origin}/api/mcp`,
    api: `${origin}/api/kiln/loop`,
    ingest: `${origin}/ingest`,
    documentation: `${origin}/llms.txt`,
    authentication: { type: "bearer", header: "Authorization", body: "token" },
    tools: INGEST_TOOLS,
    clients: agentClients(origin),
    phone: phoneCard(origin),
  };
}

function esc(s) {
  const amp = String.fromCharCode(38);
  return String(s ?? "")
    .replace(/&/g, amp + "amp;")
    .replace(/</g, amp + "lt;")
    .replace(/>/g, amp + "gt;")
    .replace(/"/g, amp + "quot;");
}

export function ingestPageHtml(card, origin) {
  if (!card || card.ok === false) return null;
  const title =
    card.kind === "origin"
      ? "Kiln ingest"
      : card.kind === "seat"
        ? `Ingest @${card.handle}`
        : `Ingest ${card.repoId || card.name}`;
  const desc =
    card.note ||
    "Kiln-ingest/v1. Outside agents speak MCP at /api/mcp with the seat bearer. Merkle is the proof.";
  const json = JSON.stringify(card, null, 2);
  const tools = (card.tools || INGEST_TOOLS).map((t) => `<li><code>${esc(t)}</code></li>`).join("");
  const mcp = card.mcp || `${origin}/api/mcp`;
  const trees = (card.trees || []).map((t) => t.id || t).concat(card.seated || []).concat(card.kind === "origin" ? card.public || [] : []);
  const seen = new Set();
  const treeList = trees
    .filter((id) => {
      const k = String(id);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 24)
    .map((id) => `<li><a href="${esc(origin)}/ingest/${esc(id)}">${esc(id)}</a></li>`)
    .join("");
  const curl = `curl -s ${mcp} -H 'content-type: application/json' -H 'authorization: Bearer $KILN_SESSION' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"kiln_ingest","arguments":{}}}'`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"/>
<style>
  :root{--bg:#09090b;--fg:#f4f4f5;--muted:#a1a1aa;--line:rgba(255,255,255,.12);--teal:#5eead4}
  html,body{margin:0;background:var(--bg);color:var(--fg);font-family:"IBM Plex Sans",system-ui,sans-serif}
  main{max-width:860px;margin:0 auto;padding:48px 20px 80px}
  p,li{color:var(--muted)}
  a{color:var(--teal);text-decoration:none}
  .mono{letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:var(--muted)}
  h1{font:600 28px/1.2 "IBM Plex Sans",system-ui;margin:12px 0}
  code,pre{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px}
  pre{background:#121214;padding:16px;border-radius:12px;overflow:auto;box-shadow:0 0 0 1px var(--line);color:#f4f4f5;max-height:420px}
  ul.tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;padding:0;list-style:none}
  ul.tools li{padding:8px 10px;box-shadow:0 0 0 1px var(--line);border-radius:8px}
  .btns{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}
  a.btn{height:44px;padding:0 18px;display:inline-flex;align-items:center;border-radius:999px;font-size:12px;font-weight:500;letter-spacing:.14em;text-transform:uppercase}
  a.primary{background:#f4f4f5;color:#09090b}
  a.ghost{color:var(--fg);box-shadow:0 0 0 1px var(--line)}
</style>
<script type="application/json" id="kiln-ingest">${json.replace(/</g, "\\u003c")}</script>
</head>
<body><main>
  <p class="mono">kiln-ingest/v1 · ${esc(card.kind || "origin")}</p>
  <h1>${esc(title)}</h1>
  <p>${esc(desc)}</p>
  <p class="mono" style="text-transform:none;letter-spacing:.08em;margin-top:12px">${esc(card.isolation || "kiln://")}${card.passport ? " · passport #" + esc(card.passport.token) : ""}${card.write ? " · write seated" : " · public-read"}</p>
  <div class="btns">
    <a class="btn primary" href="${esc(mcp)}">MCP</a>
    <a class="btn ghost" href="${esc(origin)}/llms.txt">llms.txt</a>
    ${card.kind === "seat" && card.passport ? `<a class="btn ghost" href="${esc(card.passport.page)}">Passport</a>` : ""}
    ${card.kind === "seat" ? `<a class="btn ghost" href="${esc(card.profile)}">@${esc(card.handle)}</a>` : ""}
    ${card.repoId ? `<a class="btn ghost" href="${esc(card.page || origin + "/" + card.repoId)}">Open tree</a>` : `<a class="btn ghost" href="${esc(origin)}/">Open Kiln</a>`}
  </div>
  <h2 class="mono">Tools</h2>
  <ul class="tools">${tools}</ul>
  ${treeList ? `<h2 class="mono">Trees</h2><ul>${treeList}</ul>` : ""}
  <h2 class="mono">Call as an outside agent</h2>
  <pre>${esc(curl)}</pre>
  <h2 class="mono">Machine card</h2>
  <pre>${esc(json)}</pre>
</main></body></html>`;
}

export function llmsText(origin, viewer) {
  const card = originIngest(origin, viewer);
  const tools = INGEST_TOOLS.map((t) => `- ${t}`).join("\n");
  const seated = (card.seated || []).join(", ") || "(sign in)";
  return `# Kiln

Kiln is a sovereign forge. Merkle is the proof. Outside agents ingest this origin and operate as a seated user.

## Phone, Claude, Muse
A phone model does not edit a config file. GET ${card.clients.phone.api} and read the card. POST JSON there. The first call is { "tool": "open_seat", "name": "your name" }. Put the token in the next JSON body. A write is a git commit. Do not clone.

Muse: put this forge's MCP in ~/.config/muse/settings.json. Delete http://127.0.0.1:8787. That was the old local kiln. ${card.mcp}

Claude on a phone: add a custom connector at ${card.mcp}. First tool is kiln_open_seat.
Muse on a phone: same POST if you cannot edit ${card.clients.muse.file}.
Desktop Claude: ${card.clients.claude.command}

## Start
${card.ingest}
${card.mcp}
${card.llms}

## Auth
${card.auth}
Unsigned calls are public-read. kiln/* is share-only. Private trees stay with the owner.

## Claude and Muse
Point either one at this webapp. They build in Studio. Do not clone the tree onto their machine.

## Navigate
kiln_map lists every page. kiln_go opens one and returns what the page shows. The same map is GET /api/kiln/loop?action=map. On the page, a[data-kiln-go] is the control. Grok, Claude, Muse, Gemini, GPT, and Ollama all use this. Do not invent a path.

Claude Code:
${card.clients.claude.command}

Muse Code, in ${card.clients.muse.file}:
${JSON.stringify(card.clients.muse.mcp_servers, null, 2)}

Then kiln_list_files, kiln_read_file, kiln_write_file on the seated computer. Studio shows the commit.

A bench is not a one-shot. kiln_bench opens the charter and stops. kiln_bench_step commits the next phase only. Read the tree before the next step. kiln_bench_hold parks the cursor.

kiln_create_branch names a line and stays on the current one. kiln_bind_model writes MODEL.md and the machine card. kiln_open_pr files a pull on this computer. kiln_diff and kiln_test read the tree. Resources are kiln://owner/name/path.

kiln_wallet reads the Kiln-note till. kiln_list_product prices a file on this computer. kiln_buy pays that price and commits the file onto the buyer's computer, or it takes nothing. kiln_pay transfers notes. A note is not a bank balance, not a card, and not USDC.

A push comes back as a receipt. Show that block. Do not print raw git. kiln_repos is the seat, one line per computer: Active, then Bench, then scratch. kiln_ship runs the checks on Kiln, opens the live app, and pushes a GitHub branch. It does not push main. A failed check does not push. Checks show up only after tests ran.

## Tools
${tools}

## Embed
Released apps write INGEST.json on their computer. Call kiln_ingest with repo. Then kiln_list_files / kiln_read_file / kiln_write_file / kiln_base / kiln_upload.

## This view
viewer: ${card.viewer ? "@" + card.viewer.handle + " " + card.viewer.isolation : "anonymous"}
passport: ${card.passport ? card.passport.page + " #" + card.passport.token : "none"}
seated trees: ${seated}
`;
}

export async function runIngestTool(name, args = {}, ctx = {}) {
  const viewer = ctx.viewer || null;
  const secret = ctx.secret || "";
  const acc = ctx.account || (viewer ? loadAccount(viewer) : null);
  const repo = args.repo || args.repoId || "";
  const origin = ctx.origin || "";

  if (name === "kiln_ingest") {
    if (args.handle && !repo) return seatIngest(args.handle, origin, viewer);
    if (!repo) return originIngest(origin, viewer);
    if (!String(repo).includes("/")) return seatIngest(repo, origin, viewer);
    return repoIngest(repo, origin, viewer);
  }
  if (name === "kiln_list_files") return listTree(repo, args.path || "", viewer);
  if (name === "kiln_read_file") return readTree(repo, args.path, viewer);
  if (name === "kiln_write_file") {
    const wrote = writeTree(repo, args, viewer);
    if (wrote && wrote.ok) {
      try {
        const rec = receiptOf(wrote.repoId || repo);
        if (rec && rec.ok) {
          wrote.receipt = rec;
          wrote.text = rec.text;
        }
      } catch {
        /* the commit already landed */
      }
    }
    return wrote;
  }
  if (name === "kiln_run") return runCmd(repo, args.command || args.cmd, viewer);
  if (name === "kiln_remember") {
    if (!canWrite(viewer, repo) && !canRead(viewer, repo)) return { ok: false, error: "unknown tree" };
    if (!canWrite(viewer, repo)) return { ok: false, error: "not your tree" };
    return rememberSpace({ repoId: splitRepo(repo).id, kind: args.kind, text: args.text });
  }
  if (name === "kiln_machine") {
    const { id } = splitRepo(repo);
    if (!canRead(viewer, id)) return { ok: false, error: "unknown tree" };
    const file = path.join(computerDir(id), ".kiln", "MACHINE.json");
    try {
      const machine = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!canWrite(viewer, id) && machine && typeof machine === "object") {
        delete machine.home;
      }
      return { ok: true, machine };
    } catch {
      const boot = bootSpace({ repoId: id, owner: splitRepo(id).owner });
      const machine = { ...boot };
      if (!canWrite(viewer, id)) delete machine.home;
      return { ok: true, machine };
    }
  }
  if (name === "kiln_ledger") {
    const { id } = splitRepo(repo);
    if (!canRead(viewer, id)) return { ok: false, error: "unknown tree" };
    const mem = readMemory({ repoId: id });
    return { ok: true, repoId: id, merkle: merkleDir(computerDir(id)), memory: (mem.entries || []).slice(-12) };
  }
  if (name === "kiln_search") return searchTree(repo || args.repo, args.q || args.query, viewer);
  if (name === "kiln_base") return runBaseTool(viewer, { ...args, secret });
  if (name === "kiln_harden") {
    if (!canWrite(viewer, repo)) return { ok: false, error: "not your tree" };
    return hardenRepo(viewer, splitRepo(repo).id);
  }
  if (name === "kiln_passport") {
    const handle = args.handle || viewer;
    if (args.action === "mint" || args.action === "seat") {
      if (!viewer) return { ok: false, error: "sign in to seat a passport" };
      if (handle && handle !== viewer) return { ok: false, error: "you can only seat your own passport" };
      return ensurePassport({
        handle: viewer,
        address: acc?.address,
        pqAddress: acc?.pqAddress,
        displayName: acc?.displayName,
        lab: acc?.lab,
        isolation: acc?.isolation,
        scheme: acc?.wallet?.scheme,
      });
    }
    const p = getPassport(handle);
    if (!p) return { ok: false, error: "unknown passport" };
    return { ok: true, passport: p };
  }
  if (name === "kiln_mint_badge") {
    if (!viewer) return { ok: false, error: "sign in to mint" };
    const { id, owner } = splitRepo(repo);
    if (owner === "kiln") return { ok: false, error: "kiln origin badges are sealed" };
    if (!canWrite(viewer, id)) return { ok: false, error: "you can only mint your own repos" };
    return mintBadge({
      repoId: id,
      owner,
      address: acc?.address,
      displayName: acc?.displayName,
      lab: acc?.lab,
      visibility: args.visibility,
      minter: viewer,
      milestone: args.milestone || args.title || "",
      description: args.description || "",
    });
  }
  if (name === "kiln_create_repo") {
    if (!viewer) return { ok: false, error: "sign in to create a repo" };
    const out = createRepo(viewer, { name: args.name, visibility: args.visibility, description: args.description });
    if (out.ok) {
      bootSpace({ repoId: out.repo.id, owner: viewer });
      ensureBase(out.repo.id, { visibility: out.repo.visibility, handle: viewer });
      out.ingest = writeIngestCard(out.repo.id);
    }
    return out;
  }
  if (name === "kiln_upload") {
    if (!canWrite(viewer, repo)) return { ok: false, error: "not your tree" };
    return putObject(splitRepo(repo).id, viewer, {
      bucket: args.bucket,
      name: args.path || args.name,
      content: args.content,
      type: args.type,
    });
  }
  if (name === "kiln_log") return { ok: true, logged: String(args.message || "").slice(0, 400) };
  if (name === "kiln_rebel") return runRebel(args, ctx);
  if (name === "kiln_crew") {
    const { id } = splitRepo(repo);
    if (!canRead(viewer, id)) return { ok: false, error: "unknown tree" };
    const crew = readCrew(id);
    return {
      ok: true,
      repoId: id,
      crew,
      text: (crew.members || []).map((m) => `${m.role} ${m.name}${m.task ? " · " + m.task : ""}`).join("\n"),
    };
  }
  if (name === "kiln_handoff") {
    const { id } = splitRepo(repo);
    if (!canWrite(viewer, id)) return { ok: false, error: "not your tree" };
    const to = String(args.to || args.agent || args.name || "builder").slice(0, 48);
    const crew = seatOutside(id, to, {
      role: args.role || "builder",
      name: args.name || to,
      task: args.task || args.message || args.text || "",
      from: args.from || viewer || "conductor",
      to,
      outside: false,
    });
    return { ok: true, repoId: id, crew, mutated: true };
  }
  if (name === "kiln_spawn_agent" || name === "kiln_spawn_subagent") {
    const { id } = splitRepo(repo);
    if (!canWrite(viewer, id)) return { ok: false, error: "not your tree" };
    const who = String(args.name || args.role || (name === "kiln_spawn_subagent" ? "subagent" : "builder")).slice(0, 48);
    const crew = seatOutside(id, who, {
      role: args.role || "builder",
      name: args.name || who,
      task: args.task || args.prompt || args.message || "",
      from: viewer || "outside",
      outside: true,
    });
    const member = (crew.members || []).find((row) => row.id === who || row.name === who) || null;
    return { ok: true, repoId: id, member, crew, mutated: true, studio: "Seated on this computer. Studio shows them. Do not clone." };
  }
  if (name === "kiln_create_branch") return createBranch(repo, args, viewer);
  if (name === "kiln_bind_model") return bindModel(repo, args, viewer);
  if (name === "kiln_open_pr") return openPullRecord(repo, args, viewer, origin);
  return { ok: false, error: `unknown tool ${name}` };
}

function createBranch(repo, args, viewer) {
  const { id } = splitRepo(repo);
  if (!canWrite(viewer, id)) return { ok: false, error: "not your tree" };
  const branch = String(args.name || args.branch || "")
    .trim()
    .replace(/[^a-zA-Z0-9._/-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!branch || branch === "HEAD") return { ok: false, error: "branch name required" };
  const dir = spaceHome(id);
  bootSpace({ repoId: id, owner: splitRepo(id).owner });
  const exists = spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: dir, encoding: "utf8" });
  const headOf = (ref) => String(spawnSync("git", ["rev-parse", "--short", ref], { cwd: dir, encoding: "utf8" }).stdout || "").trim();
  if (exists.status === 0) return { ok: true, repoId: id, branch, exists: true, head: headOf(branch) };
  const made = spawnSync("git", ["branch", branch], { cwd: dir, encoding: "utf8" });
  if (made.status !== 0) return { ok: false, error: String(made.stderr || made.stdout || "branch failed").slice(0, 200) };
  return {
    ok: true,
    repoId: id,
    branch,
    head: headOf(branch),
    mutated: true,
    studio: "Branch is on this computer. The seat stays on the current line.",
  };
}

function bindModel(repo, args, viewer) {
  const { id } = splitRepo(repo);
  if (!canWrite(viewer, id)) return { ok: false, error: "not your tree" };
  const model = String(args.model || "").trim().slice(0, 80);
  if (!model) return { ok: false, error: "model required" };
  const dir = spaceHome(id);
  bootSpace({ repoId: id, owner: splitRepo(id).owner });
  const file = path.join(dir, ".kiln", "MACHINE.json");
  let machine = {};
  try {
    machine = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    machine = {};
  }
  machine.modelId = model;
  machine.modelBoundAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(machine, null, 2));
  const card = writeTree(
    id,
    {
      path: "MODEL.md",
      content: `# Model\n\nBound: ${model}\n\nAgents on this computer inherit this model. The bind is a git commit.\n`,
      message: `bind ${model}`,
    },
    viewer,
  );
  if (!card.ok) return card;
  return { ok: true, repoId: id, model, commit: card.commit, path: "MODEL.md", mutated: true };
}

function openPullRecord(repo, args, viewer, origin) {
  const { id } = splitRepo(repo);
  if (!canWrite(viewer, id)) return { ok: false, error: "not your tree" };
  const title = String(args.title || "").trim().slice(0, 120);
  if (!title) return { ok: false, error: "title required" };
  const dir = spaceHome(id);
  bootSpace({ repoId: id, owner: splitRepo(id).owner });
  const gh = String(args.github || "").trim();
  if (gh.includes("/") || (args.owner && (args.githubRepo || args.name))) {
    return shipComputer({
      repoId: id,
      origin,
      github: gh,
      owner: args.owner || "",
      repo: args.githubRepo || args.name || "",
      base: args.base || "main",
      title,
      body: args.body || "",
      branch: args.branch || "",
    });
  }
  const idPull = "p" + Date.now().toString(36);
  const rec = {
    id: idPull,
    repoId: id,
    branch: String(args.branch || "HEAD").slice(0, 80),
    title,
    body: String(args.body || "").slice(0, 4000),
    at: new Date().toISOString(),
    status: "open",
    by: viewer || "",
    note: "Filed on this computer only. Pass github as owner/name to push the branch.",
    url: `${String(origin || "").replace(/\/$/, "")}/studio`,
  };
  const pullsDir = path.join(dir, ".kiln", "pulls");
  fs.mkdirSync(pullsDir, { recursive: true });
  fs.writeFileSync(path.join(pullsDir, `${idPull}.json`), JSON.stringify(rec, null, 2));
  return { ok: true, repoId: id, pull: rec, mutated: true };
}

export function mcpToolList(tools) {
  return (tools || []).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.parameters || { type: "object", properties: {} },
  }));
}
