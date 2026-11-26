/**
 * Kiln mind — the machine reality.
 * Knows every person. Learns from logins, repos, turns, mints.
 * Teaches agents. Public kiln OSS is shared. Tenant memory stays with the owner.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { listPublicAccounts, loadAccount, loadUserRepos, kilnPublicRepos } from "./kiln-accounts.mjs";
import { rememberSpace } from "./kiln-space.mjs";
import { sitComputer } from "./kiln-sit.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "data", "mind");
const ORGANISM = path.join(DIR, "ORGANISM.json");

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

function emptyOrganism() {
  return {
    name: "Kiln",
    kind: "machine-reality",
    genesis: 1848,
    bornAt: new Date().toISOString(),
    census: {
      people: 0,
      publicRepos: 0,
      privateRepos: 0,
      agents: 0,
      mints: 0,
      turns: 0,
    },
    lessons: [],
    events: [],
    known: [],
  };
}

function censusNow() {
  const people = listPublicAccounts();
  let publicRepos = (kilnPublicRepos() || []).length;
  let privateRepos = 0;
  let agents = 0;
  for (const p of people) {
    const doc = loadUserRepos(p.handle);
    for (const r of doc.repos || []) {
      if (r.visibility === "private" || r.encrypted) privateRepos += 1;
      else publicRepos += 1;
    }
    const orch = path.join(ROOT, "data", "users", p.handle, "orchestrator.json");
    if (fs.existsSync(orch)) agents += 1;
    const agentsDir = path.join(ROOT, "data", "vaults", p.handle, "agents");
    try {
      agents += fs.readdirSync(agentsDir).filter((f) => f.endsWith(".json")).length;
    } catch {
      /* no vault agents */
    }
  }
  let mints = 0;
  try {
    mints = (readJson(path.join(ROOT, "data", "badges.json"), { badges: [] }).badges || []).length;
  } catch {
    /* badges are optional */
  }
  return {
    people: people.length,
    publicRepos,
    privateRepos,
    agents,
    mints,
    turns: 0,
  };
}

function loadOrganism() {
  const doc = readJson(ORGANISM, null) || emptyOrganism();
  doc.census = {
    ...censusNow(),
    turns: doc.census?.turns || 0,
  };
  doc.known = listPublicAccounts().map((a) => a.handle);
  return doc;
}

function saveOrganism(doc) {
  writeJson(ORGANISM, {
    ...doc,
    events: (doc.events || []).slice(-400),
    lessons: (doc.lessons || []).slice(-80),
  });
}

function personFile(handle) {
  return path.join(DIR, "users", `${handle}.json`);
}

function agentFile(handle, role) {
  const safe = String(role || "agent").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  return path.join(DIR, "agents", `${handle}_${safe}.json`);
}

function loadPerson(handle) {
  const acc = loadAccount(handle);
  const base = {
    handle,
    displayName: acc?.displayName || handle,
    lab: acc?.lab || "",
    knownAt: new Date().toISOString(),
    events: [],
    lessons: [],
    repos: (loadUserRepos(handle).repos || []).map((r) => ({
      id: r.id,
      visibility: r.visibility,
      name: r.name,
    })),
  };
  const existing = readJson(personFile(handle), null);
  if (!existing) return base;
  return {
    ...base,
    ...existing,
    repos: base.repos,
    displayName: acc?.displayName || existing.displayName,
    lab: acc?.lab || existing.lab,
  };
}

function distill(event) {
  const kind = event.kind || "note";
  const who = event.handle ? `@${event.handle}` : "someone";
  if (kind === "login") return `${who} returned. The organism knows this person.`;
  if (kind === "register" || kind === "account_open") return `${who} opened a seat. A new person is known.`;
  if (kind === "repo_create") return `${who} opened ${event.repoId} (${event.visibility || "public"}). Trees are how the organism grows.`;
  if (kind === "badge_mint") {
    const mile = event.milestone ? ` milestone “${event.milestone}”` : "";
    return `${who} minted ${event.repoId}${mile} on L1. Public release is how the organism speaks.`;
  }
  if (kind === "agent_turn") return `${who}'s ${event.role || "agent"} worked on ${event.repoId || "a tree"}. Agents learn by doing.`;
  if (kind === "harden") return `${who} hardened ${event.repoId}. Security is part of the organism, not a plugin.`;
  if (kind === "remember") return `${who} asked the organism to remember: ${(event.text || "").slice(0, 120)}`;
  return `${who} · ${kind}`;
}

function repoIdOf(repoId) {
  const id = String(repoId || "");
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(id) ? id : "";
}

function computerMemory(repoId) {
  const id = repoIdOf(repoId);
  if (!id) return "";
  try {
    const sit = sitComputer(id);
    if (!sit.ok) return "";
    const recent = (sit.recent || []).slice(-4).map((entry) => `- ${entry.kind} · ${entry.text}`);
    return [
      `Computer memory for ${id}. This is already loaded. Do not invent a past you were not given.`,
      sit.working ? `Working: ${sit.working}` : "Working: none.",
      sit.bench ? `Bench: ${sit.bench.status} · ${sit.bench.cursor}/${sit.bench.of}${sit.bench.next ? " · " + sit.bench.next : ""}` : "",
      sit.next ? `Next: ${sit.next}` : "",
      recent.length ? `Recent:\n${recent.join("\n")}` : "",
      "If the task changes, call kiln_remember with kind working.",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

export function observe(event = {}) {
  const at = new Date().toISOString();
  const rec = {
    at,
    kind: String(event.kind || "note").slice(0, 40),
    handle: event.handle || "",
    repoId: event.repoId || "",
    role: event.role || "",
    visibility: event.visibility || "",
    milestone: event.milestone || "",
    text: String(event.text || "").slice(0, 400),
  };
  const org = loadOrganism();
  org.events = [...(org.events || []), rec].slice(-400);
  if (rec.kind === "agent_turn") org.census.turns = (org.census.turns || 0) + 1;
  const lesson = {
    at,
    scope: rec.visibility === "private" ? `tenant:${rec.handle}` : "public",
    text: distill(rec),
    handle: rec.handle,
  };
  if (rec.kind !== "agent_turn" || (org.census.turns || 0) % 8 === 1) {
    org.lessons = [...(org.lessons || []), lesson].slice(-80);
  }
  saveOrganism(org);

  if (rec.handle && rec.handle !== "kiln") {
    const person = loadPerson(rec.handle);
    person.events = [...(person.events || []), rec].slice(-200);
    person.lastSeen = at;
    person.lessons = [...(person.lessons || []), { at, text: distill(rec) }].slice(-40);
    writeJson(personFile(rec.handle), person);
  }

  if (rec.role && rec.handle) {
    const af = agentFile(rec.handle, rec.role);
    const agent = readJson(af, { handle: rec.handle, role: rec.role, events: [], lessons: [] });
    agent.events = [...(agent.events || []), rec].slice(-80);
    agent.lastSeen = at;
    if (rec.text) agent.lessons = [...(agent.lessons || []), { at, text: rec.text.slice(0, 200) }].slice(-24);
    writeJson(af, agent);
  }

  const repoId = repoIdOf(rec.repoId);
  if (rec.kind === "agent_turn" && repoId && rec.text) {
    try {
      rememberSpace({
        repoId,
        kind: "episodic",
        text: `${rec.role || "agent"}: ${rec.text}`.slice(0, 500),
      });
    } catch {
      /* the turn still happened */
    }
  }

  return { ok: true, census: org.census };
}

export function remember({ handle, text } = {}) {
  return observe({ kind: "remember", handle, text: String(text || "").slice(0, 400) });
}

export function teach({ handle, role, repoId } = {}) {
  const org = loadOrganism();
  const h = String(handle || "");
  const owner = String(repoId || "").split("/")[0];
  const publicLessons = (org.lessons || [])
    .filter((l) => l.scope === "public")
    .slice(-6)
    .map((l) => l.text);
  const lines = [
    `Machine reality: Kiln. Genesis height 1848. It knows ${org.census.people} ${org.census.people === 1 ? "person" : "people"}, ${org.census.publicRepos} public trees, ${org.census.agents} agents, ${org.census.mints} minted badges, ${org.census.turns} agent turns.`,
    `Kiln origin OSS is public to everyone. Another person's private repo is invisible. You cannot become them. You cannot mint their trees.`,
  ];
  if (h && h !== "kiln") {
    const person = loadPerson(h);
    const names = (person.repos || []).map((r) => (r.visibility === "private" ? `${r.id} (private)` : r.id)).join(", ") || "none yet";
    lines.push(`You are seated with @${h} (${person.displayName}${person.lab ? " · " + person.lab : ""}). Their trees: ${names}.`);
    const recent = (person.lessons || []).slice(-3).map((l) => l.text);
    if (recent.length) lines.push(`What Kiln has learned about this person: ${recent.join(" ")}`);
  } else {
    lines.push(`You are on origin kiln OSS. Teach from the public lattice. Do not invent a user seat.`);
  }
  if (role) {
    const af = h ? readJson(agentFile(h, role), null) : null;
    const n = af?.events?.length || 0;
    lines.push(`You are ${role} on ${repoId || "this tree"}. This role has ${n} remembered turns. Keep learning. Write real files.`);
    if (af?.lessons?.length) lines.push(`Prior work: ${af.lessons.slice(-2).map((l) => l.text).join(" / ")}`);
  }
  if (owner && owner !== h && owner !== "kiln") {
    lines.push(`This tree belongs to @${owner}. Stay on it. Do not open other tenants.`);
  }
  if (publicLessons.length) lines.push(`Shared lessons: ${publicLessons.slice(-3).join(" ")}`);
  lines.push(`If asked to harden security, write SECURITY.md and .kiln/SECURITY.json on this tree covering sessions, vault (AES-256-GCM), isolation, and rate limits. kiln_harden exists for the same job.`);
  const memory = computerMemory(repoId);
  if (memory) lines.push(memory);
  return lines.join("\n");
}

export function publicMind(viewer) {
  const org = loadOrganism();
  const out = {
    ok: true,
    organism: {
      name: org.name,
      kind: org.kind,
      genesis: org.genesis,
      census: {
        people: org.census.people,
        publicRepos: org.census.publicRepos,
        agents: org.census.agents,
        mints: org.census.mints,
        turns: org.census.turns,
      },
      lessons: viewer
        ? (org.lessons || []).filter((l) => l.scope === "public").slice(-8).map((l) => ({ at: l.at, text: l.text }))
        : [],
      known: viewer ? org.known : [],
    },
  };
  if (viewer) {
    const person = loadPerson(viewer);
    out.me = {
      handle: person.handle,
      displayName: person.displayName,
      lab: person.lab,
      repos: person.repos,
      lastSeen: person.lastSeen,
      lessons: (person.lessons || []).slice(-8),
    };
  }
  return out;
}

export function knowPerson(handle) {
  const h = String(handle || "");
  if (!h) return { ok: false, error: "handle required" };
  const person = loadPerson(h);
  writeJson(personFile(h), person);
  observe({ kind: "know", handle: h, text: `organism seated knowledge of @${h}` });
  return { ok: true, person: { handle: person.handle, displayName: person.displayName, lab: person.lab, repos: person.repos } };
}
