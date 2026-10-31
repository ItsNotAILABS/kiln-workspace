/**
 * Per-account main agent. Not a crew role. REPL across every repo the handle owns.
 * Repo conductors stay per-tree. This one sits on {handle}/home and routes.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { bootSpace, rememberSpace, readMemory, spaceHome } from "./kiln-space.mjs";
import { ensureAccountVault, ensureAgentVault, sealBlob } from "./kiln-vault.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");

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

function orchFile(handle) {
  return path.join(ROOT, "data", "users", handle, "orchestrator.json");
}

export function seatOrchestrator(handle, { address, displayName, secret } = {}) {
  const h = String(handle || "").slice(0, 24);
  if (!h || h === "kiln") return { ok: false, error: "user handle required" };
  const homeId = `${h}/home`;
  bootSpace({ repoId: homeId, owner: h, agentId: "orchestrator", role: "orchestrator" });
  ensureAccountVault(h, { displayName, secret });
  ensureAgentVault(h, "orchestrator", { role: "orchestrator", repoId: homeId, secret });
  const dir = spaceHome(homeId);
  const rec = {
    agent: "orchestrator",
    kind: "main",
    role: "orchestrator",
    handle: h,
    displayName: displayName || h,
    address: address || "",
    repoId: homeId,
    home: dir,
    isolation: `kiln://${homeId}.git`,
    seatedAt: new Date().toISOString(),
    repl: [],
  };
  const existing = readJson(orchFile(h), null);
  if (existing?.repl) rec.repl = existing.repl;
  writeJson(orchFile(h), rec);
  writeIfMissing(
    path.join(dir, "ORCHESTRATOR.md"),
    `# Orchestrator · @${h}\n\nThis is the main agent for the account. Crew on each repo report here.\nREPL lives in .kiln/memory/orchestrator.json. Vault is AES-256-GCM.\n`,
  );
  rememberSpace({ repoId: homeId, agentId: "orchestrator", kind: "episodic", text: `orchestrator seated for @${h}` });
  return { ok: true, orchestrator: publicOrch(rec) };
}

function writeIfMissing(file, body) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return true;
}

function publicOrch(rec) {
  if (!rec) return null;
  return {
    agent: rec.agent,
    kind: rec.kind,
    role: rec.role,
    handle: rec.handle,
    displayName: rec.displayName,
    repoId: rec.repoId,
    isolation: rec.isolation || `kiln://${rec.repoId}.git`,
    seatedAt: rec.seatedAt,
    turns: (rec.repl || []).length,
  };
}

export function readOrchestrator(handle) {
  const rec = readJson(orchFile(handle), null);
  if (!rec) return { ok: false, error: "no orchestrator" };
  const mem = readMemory({ repoId: `${handle}/home`, agentId: "orchestrator" });
  return { ok: true, orchestrator: publicOrch(rec), repl: (rec.repl || []).slice(-40), memory: mem };
}

export function orchestratorRepl({ handle, text, secret } = {}) {
  const h = String(handle || "");
  if (!h) return { ok: false, error: "handle required" };
  let rec = readJson(orchFile(h), null);
  if (!rec) {
    const seated = seatOrchestrator(h, { secret });
    if (!seated.ok) return seated;
    rec = readJson(orchFile(h), null);
  }
  const line = String(text || "").trim().slice(0, 4000);
  if (!line) return { ok: true, orchestrator: publicOrch(rec), reply: "ready", repl: rec.repl.slice(-20) };
  const at = new Date().toISOString();
  rec.repl = rec.repl || [];
  rec.repl.push({ at, q: line });
  const reply = route(h, line);
  rec.repl[rec.repl.length - 1].a = reply.text;
  rec.repl = rec.repl.slice(-200);
  writeJson(orchFile(h), rec);
  rememberSpace({ repoId: `${h}/home`, agentId: "orchestrator", kind: "repl", text: `${line}\n→ ${reply.text}` });
  if (secret) {
    sealBlob({ handle: h, scope: "agent:orchestrator", plaintext: JSON.stringify(rec.repl.slice(-40)), secret });
  }
  return { ok: true, orchestrator: publicOrch(rec), reply: reply.text, routed: reply.routed || null, repl: rec.repl.slice(-20) };
}

function route(handle, line) {
  const lower = line.toLowerCase();
  const home = path.join(ROOT, "data", "users", handle, "repos.json");
  const repos = readJson(home, { repos: [] }).repos || [];
  const vault = readJson(path.join(ROOT, "data", "vaults", handle, "VAULT.json"), null);
  if (lower === "status" || lower === "help") {
    const scopes = Object.keys(vault?.scopes || {});
    return {
      text: `@${handle} orchestrator · ${repos.length} repos · ${scopes.length} vault scopes · home ${handle}/home. Commands: status, agents, repos, remember <text>, on <repo> <text>.`,
    };
  }
  if (lower === "repos") {
    const names = repos.map((r) => `${r.id} (${r.visibility || "public"})`).join(", ") || "none";
    return { text: names };
  }
  if (lower === "agents") {
    const agentsDir = path.join(ROOT, "data", "vaults", handle, "agents");
    let names = ["orchestrator"];
    try {
      names = fs.readdirSync(agentsDir).map((f) => f.replace(/\.json$/, ""));
    } catch {
      /* none */
    }
    return { text: names.join(", ") };
  }
  const rem = line.match(/^remember\s+(.+)$/i);
  if (rem) {
    rememberSpace({ repoId: `${handle}/home`, agentId: "orchestrator", kind: "episodic", text: rem[1] });
    return { text: "remembered", routed: `${handle}/home` };
  }
  const on = line.match(/^on\s+(\S+)\s+(.+)$/i);
  if (on) {
    const repoId = on[1].includes("/") ? on[1] : `${handle}/${on[1]}`;
    rememberSpace({ repoId, agentId: "orchestrator", kind: "repl", text: on[2] });
    return { text: `routed to ${repoId}`, routed: repoId };
  }
  rememberSpace({ repoId: `${handle}/home`, agentId: "orchestrator", kind: "repl", text: line });
  return { text: `noted. ${repos.length} repos under @${handle}.` };
}
