/**
 * Sealed machine kernel.
 *
 * KILN treats every Git tree as its own sealed machine —
 * shell, memory, models, preview domain, ledger.
 *
 * Isolation is the repo id. A bank, cwd, bound model, blob origin,
 * or ledger root belonging to kiln/kiln cannot be read as kiln/studio.
 * Nothing here is a shared box.
 */
import { A as MODELS, b as store, d as allRepos } from "./store-sx46DNi5.js";

export const FACETS = ["shell", "memory", "models", "domain", "ledger"];
export const BANKS = ["working", "episodic", "semantic", "procedural", "lattice", "folder"];
const STORAGE = "kiln-machines-v1";
const blobUrls = new Map();

function now() {
  return new Date().toISOString();
}

export async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function loadAll() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(all) {
  try {
    globalThis.localStorage?.setItem(STORAGE, JSON.stringify(all));
  } catch {
    /* quota */
  }
  globalThis.__KILN_MACHINES = all;
}

function putMachine(machine) {
  if (!machine?.repoId) return machine;
  const all = loadAll();
  all[machine.repoId] = machine;
  saveAll(all);
  return machine;
}

function hostOf(repo) {
  const slug = `${repo.owner}-${repo.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return `${slug}.kiln.app`;
}

function emptyBanks() {
  return Object.fromEntries(BANKS.map((k) => [k, []]));
}

function repoOf(id) {
  return allRepos(store.getState()).find((r) => r.id === id);
}

function catalogIds() {
  return (MODELS || []).map((m) => m.id);
}

function modelLabel(id) {
  const m = (MODELS || []).find((x) => x.id === id);
  return m?.label || id || "grok-4.6";
}

function shellTemplate(repo) {
  return {
    cwd: "/",
    env: {
      KILN_REPO: repo.id,
      KILN_OWNER: repo.owner,
      KILN_NAME: repo.name,
      KILN_ISOLATION: `kiln://${repo.id}.git`,
      MODEL: repo.modelId || "grok-4.6",
      DOMAIN: hostOf(repo),
      HOME: "/",
      PATH: "/bin:/usr/bin:/kiln/bin",
    },
    history: [],
    processes: [
      { pid: 1, name: "init", status: "running" },
      { pid: 2, name: "kiln-agentd", status: "running" },
      { pid: 3, name: "kiln-memoryd", status: "running" },
      { pid: 4, name: "kiln-edged", status: "running" },
      { pid: 5, name: "kiln-indexerd", status: "running" },
      { pid: 6, name: "kiln-ledgerd", status: "running" },
    ],
    ports: [
      { port: 443, service: "capsule", proto: "https" },
      { port: 7331, service: "mcp", proto: "mcp" },
      { port: 3000, service: "node", proto: "node" },
      { port: 7840, service: "webgpu", proto: "gpu" },
      { port: 8000, service: "python", proto: "python" },
      { port: 8443, service: "sealed-cloud", proto: "cloud" },
    ],
    bootAt: now(),
  };
}

function ledgerSlice(repo) {
  const s = store.getState();
  const commits = (s.userCommits || []).filter((c) => c.repoId === repo.id);
  const txs = (s.extraTxs || s.txs || []).filter((t) => t.repoId === repo.id);
  const files = repo.files || [];
  return {
    treeMerkle: repo.merkleRoot || "",
    commits: commits.slice(0, 48).map((c) => ({
      sha: c.sha,
      message: c.message,
      at: c.createdAt || c.timestamp,
    })),
    txs: txs.slice(0, 48).map((t) => ({
      hash: t.hash,
      type: t.type,
      memo: t.memo,
      merkleRoot: t.merkleRoot,
    })),
    files: files.length,
    commitCount: commits.length,
    txCount: txs.length,
  };
}

async function foldLedger(slice) {
  const leaves = [
    slice.treeMerkle || "",
    ...slice.commits.map((c) => c.sha || ""),
    ...slice.txs.map((t) => t.hash || ""),
    String(slice.files),
  ];
  const hex = await sha256hex(leaves.join("\n"));
  return `0x${hex.slice(0, 40)}`;
}

export function machineOf(repoId) {
  if (!repoId) return null;
  const all = loadAll();
  return all[repoId] || null;
}

export function allMachines() {
  return loadAll();
}

export async function sealMachine(repo) {
  if (!repo?.id) {
    return {
      repoId: "",
      isolation: "",
      facets: FACETS,
      shell: { cwd: "/", history: [], processes: [], ports: [], env: {} },
      memory: { banks: emptyBanks() },
      models: { bound: "grok-4.6", label: "Grok 4.6" },
      domain: { host: "kiln.app", url: "https://kiln.app", status: "idle", origin: "none" },
      ledger: { root: "", treeMerkle: "", commits: [], txs: [], files: 0 },
    };
  }
  const all = loadAll();
  const prev = all[repo.id] || {};
  const shell = {
    ...shellTemplate(repo),
    ...(prev.shell || {}),
    env: { ...shellTemplate(repo).env, ...(prev.shell?.env || {}), MODEL: repo.modelId || prev.models?.bound || "grok-4.6", DOMAIN: hostOf(repo), KILN_REPO: repo.id },
    processes: prev.shell?.processes?.length ? prev.shell.processes : shellTemplate(repo).processes,
    ports: prev.shell?.ports?.length ? prev.shell.ports : shellTemplate(repo).ports,
  };
  const banks = emptyBanks();
  const prevBanks = prev.memory?.banks || {};
  for (const k of BANKS) banks[k] = Array.isArray(prevBanks[k]) ? prevBanks[k] : [];
  const bound = repo.modelId || prev.models?.bound || store.getState().defaultModelId || "grok-4.6";
  const slice = ledgerSlice(repo);
  const root = await foldLedger(slice);
  const latest = loadAll();
  const live = latest[repo.id] || prev;
  const liveBanks = live.memory?.banks || prevBanks;
  for (const k of BANKS) banks[k] = Array.isArray(liveBanks[k]) ? liveBanks[k] : banks[k];
  const host = hostOf(repo);
  const machine = {
    spec: "kiln-machine/v1",
    repoId: repo.id,
    isolation: `kiln://${repo.id}.git`,
    sealedAt: live.sealedAt || prev.sealedAt || now(),
    updatedAt: now(),
    facets: FACETS,
    cipher: repo.encrypted ? "AES-256-GCM" : "none",
    shell,
    memory: { banks, scopedTo: repo.id },
    models: { bound, label: modelLabel(bound), catalog: catalogIds().slice(0, 16) },
    domain: {
      host,
      url: `https://${host}`,
      kind: "kiln",
      status: "live",
      origin: live.domain?.origin || "blob",
      https: true,
      ...(live.domain?.blob ? { blob: live.domain.blob } : {}),
    },
    ledger: { ...slice, root },
  };
  putMachine(machine);
  try {
    const st = store.getState();
    if (typeof st.ensureDomain === "function") st.ensureDomain(repo.id);
    if (bound && repo.modelId !== bound && typeof st.updateRepo === "function") {
      st.updateRepo(repo.id, { modelId: bound });
    }
  } catch {
    /* store optional */
  }
  return machine;
}

export function persistShell(repoId, patch) {
  const all = loadAll();
  const cur = all[repoId];
  if (!cur) return null;
  cur.shell = { ...cur.shell, ...patch, env: { ...(cur.shell?.env || {}), ...(patch.env || {}) } };
  cur.updatedAt = now();
  return putMachine(cur);
}

export async function bindModel(repoId, modelId) {
  const repo = repoOf(repoId);
  if (!repo) throw new Error(`no machine for ${repoId}`);
  const id = String(modelId || "").trim() || "grok-4.6";
  const known = catalogIds();
  if (known.length && !known.includes(id)) {
    const fuzzy = known.find((k) => k.includes(id) || id.includes(k));
    if (!fuzzy) throw new Error(`unknown model ${id}`);
    modelId = fuzzy;
  } else {
    modelId = id;
  }
  const st = store.getState();
  if (typeof st.updateRepo === "function") st.updateRepo(repoId, { modelId });
  const live = repoOf(repoId) || { ...repo, modelId };
  const machine = await sealMachine(live);
  machine.models = { ...machine.models, bound: modelId, label: modelLabel(modelId) };
  persistShell(repoId, { env: { ...(machine.shell.env || {}), MODEL: modelId } });
  const saved = putMachine({ ...machine, models: { ...machine.models, bound: modelId, label: modelLabel(modelId) } });
  remember(repoId, "procedural", `bound ${modelId} on this tree`, { path: "MACHINE.json" });
  return saved;
}
/* ------------------------------------------------------------------
 * Restored 2026-10-29. The original file was deleted from
 * public/assets and the forge booted to a black page (this module is
 * a static import of kiln-forge.js). Everything above this note is
 * the original file, recovered verbatim from the kiln-account.json
 * capsule (its first 8000 chars, through bindModel). The functions
 * below were reconstructed to the contract in KILN-WP-14 and the
 * call sites in kiln-forge.js, studio-tabs.js, and the computer
 * chunk — same storage (kiln-machines-v1), same shapes, same laws:
 * isolation is the repo id, banks never cross trees.
 * ------------------------------------------------------------------ */

export function remember(repoId, kind, text, opts = {}) {
  const machine = machineOf(repoId);
  if (!machine) return null;
  const bank = BANKS.includes(kind) ? kind : "working";
  const banks = machine.memory?.banks || emptyBanks();
  const entry = {
    id: `mem_${Date.now().toString(36)}${(banks[bank] || []).length}`,
    kind: bank,
    text: String(text ?? ""),
    path: opts.path || "",
    at: now(),
  };
  banks[bank] = [...(banks[bank] || []), entry];
  machine.memory = { ...(machine.memory || {}), banks, scopedTo: repoId };
  machine.updatedAt = now();
  putMachine(machine);
  return entry;
}

export function bankSummary(repoId) {
  const machine = machineOf(repoId);
  if (!machine) return "machine not sealed";
  const banks = machine.memory?.banks || {};
  const lines = BANKS.map((k) => `${k.padEnd(11)} ${(banks[k] || []).length}`);
  const total = BANKS.reduce((n, k) => n + (banks[k] || []).length, 0);
  return [`memory on ${repoId} — ${total} entries, scoped to this tree`, ...lines].join("\n");
}

export function searchBanks(repoId, q) {
  const machine = machineOf(repoId);
  if (!machine) return [];
  const needle = String(q || "").toLowerCase();
  if (!needle) return [];
  const banks = machine.memory?.banks || {};
  const hits = [];
  for (const kind of BANKS) {
    const entries = banks[kind] || [];
    entries.forEach((entry, i) => {
      const text = String(entry?.text || "");
      if (text.toLowerCase().includes(needle)) {
        hits.push({
          kind,
          path: entry.path || `memory/${kind}`,
          line: i + 1,
          snippet: text.slice(0, 160),
        });
      }
    });
    if (hits.length >= 40) break;
  }
  return hits.slice(0, 40);
}

export async function constitution(repo) {
  if (!repo?.id) return "# Sealed machine\n\nNo repository.\n";
  const machine = machineOf(repo.id) || (await sealMachine(repo));
  const lines = [
    `# Sealed machine — ${repo.id}`,
    ``,
    `Isolation is the repo id. This tree is a machine, not a folder on a shared box.`,
    ``,
    `Five facets:`,
    ``,
    `1. Shell — kilnsh, cwd ${machine.shell?.cwd || "/"}, env KILN_REPO=${repo.id}`,
    `2. Memory — ${BANKS.join(" / ")}, scoped to this tree`,
    `3. Models — bound ${machine.models?.bound || "grok-4.6"} (${machine.models?.label || ""}), agents inherit, MACHINE.json is a commit`,
    `4. Preview domain — ${machine.domain?.host || hostOf(repo)} + blob origin, sandbox without allow-same-origin`,
    `5. Ledger — root ${machine.ledger?.root || ""}, Merkle of this tree's files, commits, and txs`,
    ``,
    `    / % machine`,
    `    / % model`,
    `    / % memory banks`,
    `    / % domain`,
    `    / % ledger`,
    `    / % seal`,
    ``,
    `Sealed ${machine.sealedAt || now()} · spec kiln-machine/v1`,
  ];
  return lines.join("\n") + "\n";
}

const MIME = {
  html: "text/html", htm: "text/html", js: "text/javascript", mjs: "text/javascript",
  css: "text/css", json: "application/json", md: "text/markdown", txt: "text/plain",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", ico: "image/x-icon", wasm: "application/wasm",
};

function mimeOf(path) {
  const ext = String(path || "").split(".").pop()?.toLowerCase() || "";
  return MIME[ext] || "text/plain";
}

export async function isolatePreview(repo) {
  if (!repo?.id) throw new Error("no repository to preview");
  const machine = machineOf(repo.id) || (await sealMachine(repo));
  const prev = blobUrls.get(repo.id);
  if (prev) {
    for (const u of prev) { try { URL.revokeObjectURL(u); } catch { /* already gone */ } }
  }
  const urls = [];
  const fileUrls = new Map();
  for (const f of repo.files || []) {
    if (typeof f?.content !== "string" || !f.path) continue;
    const u = URL.createObjectURL(new Blob([f.content], { type: mimeOf(f.path) }));
    fileUrls.set(f.path.replace(/^\.\//, ""), u);
    urls.push(u);
  }
  const entry = (repo.files || []).find((f) => /(^|\/)index\.html?$/i.test(f.path || ""))
    || (repo.files || []).find((f) => /\.html?$/i.test(f.path || ""));
  let html = entry && typeof entry.content === "string"
    ? entry.content
    : `<!doctype html><meta charset="utf-8"><title>${repo.id}</title><body style="font-family:system-ui;background:#09090b;color:#e4e4e7;padding:2rem"><h1>${repo.id}</h1><p>Sealed capsule. Files on this tree:</p><ul>${(repo.files || []).map((f) => `<li>${f.path}</li>`).join("")}</ul></body>`;
  html = html.replace(/(src|href)=["']([^"']+)["']/gi, (m, attr, ref) => {
    if (/^(https?:|data:|blob:|#|\/)/i.test(ref)) return m;
    const key = ref.replace(/^\.\//, "");
    const u = fileUrls.get(key);
    return u ? `${attr}="${u}"` : m;
  });
  const kilnGlobal = { repo: repo.id, isolation: machine.isolation, model: machine.models?.bound, domain: machine.domain?.host, ledger: machine.ledger?.root };
  const inject = `<script>window.Kiln = ${JSON.stringify(kilnGlobal)};</script>`;
  html = html.includes("</head>") ? html.replace("</head>", `${inject}</head>`) : inject + html;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  urls.push(url);
  blobUrls.set(repo.id, urls);
  const sealed = { ...machine, domain: { ...(machine.domain || {}), origin: "blob", blob: url } };
  putMachine(sealed);
  return { host: machine.domain?.host || hostOf(repo), url, sandbox: "allow-scripts allow-forms", machine: sealed };
}

function bankIds(machine) {
  const banks = machine?.memory?.banks || {};
  const ids = new Set();
  for (const k of BANKS) for (const e of banks[k] || []) if (e?.id) ids.add(e.id);
  return ids;
}

export function compareMachines(aId, bId) {
  const a = machineOf(aId);
  const b = machineOf(bId);
  if (!a) return { error: `machine not sealed: ${aId}` };
  if (!b) return { error: `machine not sealed: ${bId}` };
  const aIds = bankIds(a);
  const shared = [...bankIds(b)].filter((id) => aIds.has(id));
  const checks = [
    { facet: "shell", name: "env.KILN_REPO", a: a.shell?.env?.KILN_REPO || "", b: b.shell?.env?.KILN_REPO || "", pass: a.shell?.env?.KILN_REPO !== b.shell?.env?.KILN_REPO },
    { facet: "memory", name: "bank entry ids", a: `${aIds.size} ids`, b: `${bankIds(b).size} ids`, pass: shared.length === 0, note: shared.length ? `shared: ${shared.slice(0, 3).join(", ")}` : "" },
    { facet: "domain", name: "host", a: a.domain?.host || "", b: b.domain?.host || "", pass: a.domain?.host !== b.domain?.host },
    { facet: "ledger", name: "root", a: a.ledger?.root || "", b: b.ledger?.root || "", pass: a.ledger?.root !== b.ledger?.root },
    { facet: "machine", name: "isolation", a: a.isolation || "", b: b.isolation || "", pass: a.isolation !== b.isolation },
  ];
  return { aId, bId, ok: checks.every((c) => c.pass), checks };
}

export function probeIsolation(repoId, otherId) {
  const token = `seal-probe:${repoId}:${Date.now().toString(36)}`;
  const planted = remember(repoId, "working", token, { path: "probe" });
  const count = (m) => {
    if (!m) return 0;
    const banks = m.memory?.banks || {};
    let n = 0;
    for (const k of BANKS) for (const e of banks[k] || []) if (String(e?.text || "").includes(token)) n++;
    return n;
  };
  const sourceHits = count(machineOf(repoId));
  const otherHits = count(machineOf(otherId));
  if (planted) {
    const machine = machineOf(repoId);
    if (machine?.memory?.banks?.working) {
      machine.memory.banks.working = machine.memory.banks.working.filter((e) => e.id !== planted.id);
      putMachine(machine);
    }
  }
  return { token, sourceHits, otherHits, pass: sourceHits >= 1 && otherHits === 0 };
}

export function isolationProof(repoId) {
  const machine = machineOf(repoId);
  if (!machine) return "machine not sealed";
  const all = allMachines();
  const others = Object.keys(all).filter((id) => id !== repoId);
  const lines = [
    `seal     ${repoId}`,
    `sealed   ${Object.keys(all).length} machine(s) on this forge`,
    `cwd      ${machine.shell?.cwd || "/"}`,
    `model    ${machine.models?.bound || ""}`,
    `host     ${machine.domain?.host || ""}`,
    `ledger   ${machine.ledger?.root || ""}`,
    `banks    ${BANKS.map((k) => `${k}:${(machine.memory?.banks?.[k] || []).length}`).join("  ")}`,
  ];
  let leaks = 0;
  for (const id of others) {
    const report = compareMachines(repoId, id);
    if (report.error) continue;
    for (const c of report.checks) if (!c.pass) { leaks++; lines.push(`LEAK     ${id} — ${c.facet}.${c.name}`); }
  }
  lines.push(leaks === 0 ? `verdict  ISOLATED — no facet shared with ${others.length} other tree(s)` : `verdict  LEAK — ${leaks} shared facet(s)`);
  return lines.join("\n");
}

export function facetView(machine, facet) {
  if (!machine) return "machine not sealed";
  switch (facet) {
    case "shell": {
      const sh = machine.shell || {};
      return [
        `shell on ${machine.repoId}`,
        `cwd      ${sh.cwd || "/"}`,
        `boot     ${sh.bootAt || ""}`,
        `env      ${Object.entries(sh.env || {}).map(([k, v]) => `${k}=${v}`).join("  ")}`,
        `procs    ${(sh.processes || []).map((p) => `${p.pid}:${p.name}`).join("  ")}`,
        `ports    ${(sh.ports || []).map((p) => `${p.port}/${p.service}`).join("  ")}`,
      ].join("\n");
    }
    case "memory":
      return bankSummary(machine.repoId);
    case "models":
      return [
        `models on ${machine.repoId}`,
        `bound    ${machine.models?.bound || ""} (${machine.models?.label || ""})`,
        `catalog  ${(machine.models?.catalog || []).join("  ")}`,
      ].join("\n");
    case "domain": {
      const d = machine.domain || {};
      return [
        `domain on ${machine.repoId}`,
        `host     ${d.host || ""}`,
        `url      ${d.url || ""}`,
        `status   ${d.status || ""}`,
        `origin   ${d.origin || ""}`,
      ].join("\n");
    }
    case "ledger": {
      const l = machine.ledger || {};
      return [
        `ledger on ${machine.repoId}`,
        `root     ${l.root || ""}`,
        `tree     ${l.treeMerkle || ""}`,
        `files    ${l.files ?? 0}  commits ${l.commitCount ?? 0}  txs ${l.txCount ?? 0}`,
      ].join("\n");
    }
    default:
      return dumpMachine(machine);
  }
}

export function dumpMachine(machine) {
  if (!machine) return "machine not sealed";
  return [
    `machine  ${machine.repoId}  (${machine.spec || "kiln-machine/v1"})`,
    `isolation ${machine.isolation || ""}`,
    `sealed   ${machine.sealedAt || ""}  updated ${machine.updatedAt || ""}`,
    ...FACETS.map((f) => facetView(machine, f)),
  ].join("\n");
}
