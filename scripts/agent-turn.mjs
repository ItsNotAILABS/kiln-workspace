/**
 * Same-origin agent turn + computer run.
 * Kernel POSTs here so agents actually call Grok with kiln_* tools.
 * Computer POSTs /api/kiln/run so node/python execute on this machine.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INFRA_SCHEMA, INFRA_SET, renderCapsule, runInfraTool } from "./kiln-infra.mjs";

/**
 * Request payload for agent turns / computer runs. Arbitrary JSON from the
 * client; readers access it defensively.
 * @typedef {Record<string, any>} TurnPayload
 */

/**
 * @typedef {Object} ChatMessage
 * @property {"system" | "user" | "assistant" | "tool"} role
 * @property {string} content
 * @property {string} [tool_call_id]
 * @property {unknown[]} [tool_calls]
 */

/**
 * @typedef {Object} KilnRequest
 * @property {string} [method]
 * @property {string} [bodyText]
 * @property {Record<string, any>} [query]
 * @property {string} [auth] - the caller's Authorization header, forwarded to the forge by the MCP bridge
 */

/**
 * @typedef {Object} L1Chain
 * @property {number} height
 * @property {any[]} blocks
 * @property {any[]} txs
 * @property {string} [head]
 */

const TOOLS = [
  { name: "kiln_list_files", description: "List files in a repository path on the KILN forge — the daemon's real repos, the same ones the Agent Kit serves. repo is owner/name (e.g. auro/dfw-harness); a bare name resolves to owner auro, and kiln/<name> also resolves to auro/<name>. path empty = root. The MCP caller's Authorization header is forwarded to the forge: without a KILN credential only public repos answer. Always call this before you claim you know the tree.", parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" } }, required: ["repo"] } },
  { name: "kiln_read_file", description: "Read a file from a KILN forge repo's working tree — the real bytes from the daemon. repo resolves like kiln_list_files. Use this instead of guessing contents.", parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" } }, required: ["repo", "path"] } },
  { name: "kiln_write_file", description: "Write a file to a KILN forge repo as a REAL git commit through the forge contents API (author = the credential's principal). This is how agents code. repo resolves like kiln_list_files. Requires a KILN credential on the MCP request (Authorization: Bearer — operator token, account session, or agent token with the forge scope); the forge refuses anonymous writes. Prefer complete files, not stubs.", parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" }, content: { type: "string" }, message: { type: "string" } }, required: ["repo", "path", "content"] } },
  { name: "kiln_create_branch", description: "Create a branch at HEAD on a KILN forge repo. Requires a KILN credential (see kiln_write_file).", parameters: { type: "object", properties: { repo: { type: "string" }, name: { type: "string" } }, required: ["repo", "name"] } },
  { name: "kiln_run", description: "Run one kilnsh command on this repository's computer. One command per call: ls, cat, git log, node, python, machine, ledger, seal. Do not chain with semicolons.", parameters: { type: "object", properties: { repo: { type: "string" }, command: { type: "string" } }, required: ["repo", "command"] } },
  { name: "kiln_machine", description: "Dump the sealed machine for a Git tree: shell, memory, models, preview domain, ledger.", parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] } },
  { name: "kiln_bind_model", description: "Bind a model to this tree. Agents inherit it. Settles MACHINE.json as a git commit.", parameters: { type: "object", properties: { repo: { type: "string" }, model: { type: "string" } }, required: ["repo", "model"] } },
  { name: "kiln_remember", description: "Write an entry into this tree's memory banks (working, episodic, semantic, procedural, lattice, folder).", parameters: { type: "object", properties: { repo: { type: "string" }, kind: { type: "string" }, text: { type: "string" } }, required: ["repo", "text"] } },
  { name: "kiln_ledger", description: "Print this tree's machine ledger: Merkle of files, commits, and txs. Not the global chain.", parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] } },
  { name: "kiln_log", description: "Write a line to the agent computer.", parameters: { type: "object", properties: { message: { type: "string" } }, required: ["message"] } },
  { name: "kiln_open_pr", description: "Open a pull request on a KILN forge repo: branch is the head branch, base is the repo's default branch. Requires a KILN credential (see kiln_write_file).", parameters: { type: "object", properties: { repo: { type: "string" }, title: { type: "string" }, body: { type: "string" }, branch: { type: "string" } }, required: ["repo", "title"] } },
  { name: "kiln_handoff", description: "Hand a task to another crew role on this tree. They keep working after you.", parameters: { type: "object", properties: { to: { type: "string" }, task: { type: "string" }, files: { type: "string" } }, required: ["to", "task"] } },
  { name: "kiln_spawn_agent", description: "Spawn a sub-agent on this tree. They get their own turns. Always pass task so they start working.", parameters: { type: "object", properties: { repo: { type: "string" }, role: { type: "string", description: "conductor|agi|architect|builder|reviewer|deployer|scout|cipher|indexer" }, name: { type: "string" }, model: { type: "string" }, task: { type: "string", description: "Job the sub-agent should run immediately" } }, required: ["repo"] } },
  { name: "kiln_spawn_subagent", description: "Spawn a sub-agent and give them a job. Same as kiln_spawn_agent. Use this to parallelize builder/reviewer/indexer work.", parameters: { type: "object", properties: { repo: { type: "string" }, role: { type: "string" }, name: { type: "string" }, task: { type: "string" } }, required: ["repo", "task"] } },
  { name: "kiln_crew", description: "Show the crew graph, constitution, and mailboxes on a repository.", parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] } },
  { name: "kiln_search", description: "Search file paths in a KILN forge repo's tree (path match over the real forge tree). repo resolves like kiln_list_files.", parameters: { type: "object", properties: { q: { type: "string" }, repo: { type: "string" } }, required: ["q"] } },
  ...INFRA_SCHEMA,
];

/** @param {number} status @param {unknown} body */
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

// ---------------------------------------------------------------------------
// FORGE BRIDGE — the /api/mcp repo tools execute against the swarm daemon
// (loopback :18787), the real forge the Agent Kit serves, instead of the
// app's browser-side sealed trees. One KILN, not two.
//
// Repo resolution: "owner/name" is used as given; a bare "name" resolves to
// owner "auro" (the forge's working namespace — all 40 daemon repos live
// there); "kiln/<name>" also resolves to "auro/<name>", because the app
// renders that namespace under the kiln account.
//
// Credential model: the MCP caller's Authorization header is forwarded to
// the forge verbatim and the DAEMON enforces its own gates (accounts-only
// reads, owner scoping, agent tokens need the forge scope). The bridge
// never injects a credential of its own: anonymous callers can read public
// repos, writes without a credential are refused before the daemon is even
// asked, and a credentialed caller's errors are the daemon's own words.
// ---------------------------------------------------------------------------
const FORGE_DAEMON_URL = "http://127.0.0.1:18787";
const FORGE_DEFAULT_OWNER = "auro";
const FORGE_APP_OWNER_ALIAS = "kiln";
const FORGE_READ_MAX_BYTES = 96_000;
const FORGE_SEARCH_FILE_CAP = 400;
const MCP_FORGE_TOOLS = new Set(["kiln_list_files", "kiln_read_file", "kiln_write_file", "kiln_create_branch", "kiln_open_pr", "kiln_search"]);
const MCP_WRITE_TOOLS = new Set(["kiln_write_file", "kiln_create_branch", "kiln_open_pr"]);

/** @param {string} method @param {string} pathname @param {{ auth?: string, body?: unknown }} [opts] */
async function forgeCall(method, pathname, { auth, body } = {}) {
  const headers = { accept: "application/json" };
  if (auth) headers.authorization = auth;
  let payload;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(FORGE_DAEMON_URL + pathname, {
      method,
      headers,
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return { ok: false, status: 0, error: `forge daemon unreachable: ${e instanceof Error ? e.message : String(e)}` };
  }
  const text = await res.text().catch(() => "");
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep the raw text for the error path */
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: (data && (data.error || data.message)) || text.slice(0, 300) || `forge ${res.status}`, data };
  }
  return { ok: true, status: res.status, data };
}

/** @param {unknown} raw @returns {{ owner: string, name: string, id: string } | null} */
function resolveForgeRepo(raw) {
  const cleaned = String(raw || "")
    .trim()
    .replace(/\.git$/i, "");
  const parts = cleaned.split("/").filter(Boolean);
  let owner;
  let name;
  if (parts.length >= 2) {
    owner = parts[0];
    name = parts.slice(1).join("/");
  } else {
    owner = FORGE_DEFAULT_OWNER;
    name = parts[0] || "";
  }
  if (owner === FORGE_APP_OWNER_ALIAS) owner = FORGE_DEFAULT_OWNER;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(owner) || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)) return null;
  return { owner, name, id: `${owner}/${name}` };
}

/** @param {{ owner: string, name: string }} repo @param {{ status: number, error?: string }} r */
function forgeErrText(repo, r) {
  const hint =
    r.status === 401 || r.status === 403
      ? " The forge is accounts-only — present a KILN credential as Authorization: Bearer on the /api/mcp request (agent token with the forge scope, account session, or operator token); without one only public repos answer."
      : "";
  return `forge ${repo.id}: ${r.status ? `${r.status} ` : ""}${r.error || "request failed"}.${hint}`;
}

/** @param {string} name @param {Record<string, any>} args @param {string} auth @returns {Promise<string>} */
async function runForgeTool(name, args, auth) {
  const a = args && typeof args === "object" ? args : {};
  if (MCP_WRITE_TOOLS.has(name) && !auth) {
    return `${name} writes to the KILN forge, and the forge is accounts-only: this MCP request carried no credential. Retry with Authorization: Bearer <KILN credential> on the /api/mcp request — the operator token, an account session, or an agent token with the forge scope. The bridge forwards your credential to the forge; it never injects one of its own.`;
  }
  const repo = resolveForgeRepo(a.repo);
  if (!repo) {
    return `Cannot resolve repo ${JSON.stringify(a.repo || "")}. Use owner/name (e.g. auro/dfw-harness) or a bare repo name (owner defaults to ${FORGE_DEFAULT_OWNER}).`;
  }
  const base = `/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
  if (name === "kiln_list_files") {
    const p = String(a.path || "").replace(/^\/+/, "");
    const r = await forgeCall("GET", `${base}/tree${p ? `?path=${encodeURIComponent(p)}` : ""}`, { auth });
    if (!r.ok) return forgeErrText(repo, r);
    const entries = Array.isArray(r.data?.entries) ? r.data.entries : [];
    const lines = entries.map((e) =>
      e.type === "tree" ? `tree  ${e.name}/` : `blob  ${e.path || e.name}  (${typeof e.size === "number" ? e.size : 0} B)`,
    );
    return [`forge repo ${repo.id} @ ${r.data?.ref || "HEAD"} — ${entries.length} entries at /${p}`, ...lines].join("\n");
  }
  if (name === "kiln_read_file") {
    const p = String(a.path || "").replace(/^\/+/, "");
    if (!p) return "kiln_read_file needs a path.";
    const r = await forgeCall("GET", `${base}/contents?path=${encodeURIComponent(p)}`, { auth });
    if (!r.ok) return forgeErrText(repo, r);
    if (!r.data || typeof r.data.content !== "string") return `forge ${repo.id}: ${p} did not answer readable content.`;
    const buf = Buffer.from(r.data.content, r.data.encoding === "base64" ? "base64" : "utf8");
    if (buf.includes(0)) return `forge ${repo.id}: ${p} is binary (${buf.length} B, sha ${r.data.sha || "?"}). Not returning bytes as text.`;
    if (buf.length > FORGE_READ_MAX_BYTES) {
      return buf.subarray(0, FORGE_READ_MAX_BYTES).toString("utf8") + `\n… [truncated at ${FORGE_READ_MAX_BYTES} of ${buf.length} B]`;
    }
    return buf.toString("utf8");
  }
  if (name === "kiln_write_file") {
    const p = String(a.path || "").replace(/^\/+/, "");
    if (!p) return "kiln_write_file needs a path.";
    if (typeof a.content !== "string") return "kiln_write_file needs string content.";
    // Optimistic concurrency: pass the current blob sha when the file exists.
    let sha;
    const cur = await forgeCall("GET", `${base}/contents?path=${encodeURIComponent(p)}`, { auth });
    if (cur.ok && cur.data?.sha) sha = cur.data.sha;
    const message = String(a.message || `write ${p} via kiln app MCP bridge`);
    const r = await forgeCall("PUT", `${base}/contents`, {
      auth,
      body: { path: p, content: a.content, message, ...(sha ? { sha } : {}) },
    });
    if (!r.ok) return forgeErrText(repo, r);
    const commitSha = typeof r.data?.commit === "string" ? r.data.commit : r.data?.commit?.sha || r.data?.sha || "";
    return `committed ${commitSha ? String(commitSha).slice(0, 12) : "?"} on forge repo ${repo.id}: ${p} — ${message}`;
  }
  if (name === "kiln_create_branch") {
    const branchName = String(a.name || "").trim();
    if (!branchName) return "kiln_create_branch needs a name.";
    const r = await forgeCall("POST", `${base}/branches`, { auth, body: { name: branchName } });
    if (!r.ok) return forgeErrText(repo, r);
    const at = r.data?.sha || r.data?.branch?.sha || "";
    return `branch ${branchName} created on forge repo ${repo.id}${at ? ` @ ${String(at).slice(0, 12)}` : ""}`;
  }
  if (name === "kiln_open_pr") {
    const head = String(a.branch || "").trim();
    if (!head) return "kiln_open_pr needs branch (the head branch).";
    const det = await forgeCall("GET", `${base}/details`, { auth });
    const baseBranch = det.ok && det.data?.defaultBranch ? det.data.defaultBranch : "main";
    const title = String(a.title || `PR from ${head}`);
    const r = await forgeCall("POST", `${base}/pulls`, {
      auth,
      body: { title, ...(a.body ? { body: String(a.body) } : {}), head, base: baseBranch },
    });
    if (!r.ok) return forgeErrText(repo, r);
    const num = r.data?.number ?? r.data?.pull?.number ?? r.data?.id ?? "?";
    return `pull request #${num} opened on forge repo ${repo.id}: ${head} -> ${baseBranch} — ${title}`;
  }
  if (name === "kiln_search") {
    const q = String(a.q || "")
      .trim()
      .toLowerCase();
    if (!q) return "kiln_search needs q.";
    // Path search over the real tree, walked level by level (the pattern
    // serve-original's public surface uses); content search would mean
    // fetching every blob, so this stays a path search and says so.
    const matches = [];
    let scanned = 0;
    let level = [""];
    while (level.length && scanned < FORGE_SEARCH_FILE_CAP) {
      const datas = await Promise.all(
        level.map((dir) => forgeCall("GET", `${base}/tree${dir ? `?path=${encodeURIComponent(dir)}` : ""}`, { auth })),
      );
      const next = [];
      for (const d of datas) {
        if (!d.ok) return forgeErrText(repo, d);
        for (const e of Array.isArray(d.data?.entries) ? d.data.entries : []) {
          if (!e || !e.path) continue;
          if (e.type === "tree") {
            if (next.length < 32) next.push(e.path);
            continue;
          }
          if (e.type !== "blob") continue;
          scanned += 1;
          if (e.path.toLowerCase().includes(q)) matches.push(e.path);
        }
      }
      level = next;
    }
    if (!matches.length) return `forge repo ${repo.id} — no path matches for ${JSON.stringify(q)} (path search over ${scanned} files).`;
    return `forge repo ${repo.id} — ${matches.length} path match(es) for ${JSON.stringify(q)}:\n${matches.slice(0, 60).join("\n")}`;
  }
  return `Tool ${name} is not a forge tool.`;
}

/** @param {TurnPayload} data @returns {string} */
function systemFor(data) {
  const role = data.role || "builder";
  const repo = data.repoId || "unknown";
  const brief = data.brief || "";
  const roleLine =
    role === "agi"
      ? `You are AGI (Nova) on Kiln repository ${repo}. General intelligence. Not a specialist. You ask, write files as git commits, and hand off to specialists when the graph says so.`
      : role === "conductor"
        ? `You are Conductor on Kiln repository ${repo}. You own the crew graph. Handoff work. Do not write product code.`
        : `You are ${role} on Kiln repository ${repo}.`;
  return [
    roleLine,
    `This Git tree is its own sealed machine — shell, memory, models, preview domain, ledger.`,
    `Write in short complete sentences. One thought per sentence. Do not ramble.`,
    `Before a tool, say in one sentence what you are about to inspect or write.`,
    `After a tool, name the files you actually saw (path + size). Never claim a file exists that the tool did not return.`,
    `A write is git commit. Use kiln_write_file. Never claim a file landed that you did not commit.`,
    `Run one kilnsh command per kiln_run. Do not chain with semicolons.`,
    `You have many turns. Keep working until the job is done. Do not stop early to "save turns".`,
    `Spawn sub-agents with kiln_spawn_subagent or kiln_spawn_agent when the job needs another role. Always pass task so they start working immediately.`,
    `Handoff with kiln_handoff when a different crew role should take the next commit.`,
    `Infrastructure models run in Python: kiln_physics, kiln_merkle, kiln_lock, kiln_capsule, kiln_preview, kiln_infra. Call them. They return real hashes and isolation proofs.`,
    `Stay on this repo. Prefer small, real files (js, py, md, html, json).`,
    brief ? `Crew brief:\n${typeof brief === "string" ? brief : JSON.stringify(brief)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** @param {unknown} raw @returns {ChatMessage[]} */
function mapMessages(raw) {
  /** @type {ChatMessage[]} */
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const m of raw.slice(-120)) {
    const role = m.role === "tool" ? "tool" : m.role === "assistant" ? "assistant" : "user";
    /** @type {ChatMessage} */
    const msg = { role, content: typeof m.content === "string" ? m.content : m.content == null ? "" : String(m.content) };
    if (role === "tool" && m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    if (role === "assistant" && Array.isArray(m.tool_calls)) msg.tool_calls = m.tool_calls;
    out.push(msg);
  }
  return out;
}

/** @param {TurnPayload} [data] @param {string} [reason] */
function localBuilder(data = {}, reason = "model unavailable") {
  const last = Array.isArray(data.messages)
    ? [...data.messages].reverse().find((m) => m.role === "user" || m.role === "system")
    : null;
  const text = String(last?.content || data.brief || "write the next real file");
  const pathMatch = text.match(/([\w./-]+\.(js|mjs|ts|tsx|py|md|json|html|css))/);
  const dest = pathMatch ? pathMatch[1] : `src/builder_${Date.now().toString(36)}.js`;
  let content;
  if (/\.py$/.test(dest)) {
    content = `print("resident builder on ${data.repoId || "kiln"}")\n`;
  } else if (/\.md$/.test(dest)) {
    content = `# ${dest}\n\nWritten by the resident builder on ${data.repoId || "this tree"}.\n\n${text.slice(0, 400)}\n`;
  } else if (/\.json$/.test(dest)) {
    content = JSON.stringify({ repo: data.repoId, builder: data.role || "builder", ok: true }, null, 2) + "\n";
  } else {
    const greet = (text.match(/return\s+["'`]([^"'`]+)["'`]/) || [])[1] || `builder on ${data.repoId || "kiln"}`;
    content = `export function greet() {\n  return ${JSON.stringify(greet)};\n}\nconsole.log(greet());\n`;
  }
  return {
    ok: true,
    text: `Resident builder on this computer (${reason}). Committing ${dest} as a git commit.`,
    toolCalls: [
      {
        id: `local_${Date.now().toString(36)}`,
        name: "kiln_write_file",
        argsJson: JSON.stringify({
          repo: data.repoId || "kiln/kiln",
          path: dest,
          content,
          message: `builder: ${dest}`,
        }),
      },
    ],
    error: undefined,
  };
}

const LIVE_CHAT = new Set([
  "grok-4.6",
  "grok-4.5",
  "grok-4.3",
  "grok-4.20-0309-reasoning",
  "grok-4.20-0309-non-reasoning",
  "grok-4.20-multi-agent-0309",
  "grok-build-0.1",
]);

/** @type {Record<string, string>} */
const MODEL_ALIAS = {
  "grok-agi": "grok-4.6",
  "grok-4": "grok-4.6",
  "grok-4-fast": "grok-4.20-0309-non-reasoning",
  "grok-4.20": "grok-4.20-0309-reasoning",
  "grok-4.20-fast": "grok-4.20-0309-non-reasoning",
  "grok-4.20-multi": "grok-4.20-multi-agent-0309",
  "grok-build": "grok-build-0.1",
  "grok-3": "grok-4.5",
  "grok-3-mini": "grok-4.3",
  "grok-mini": "grok-4.3",
  "grok-4-mini": "grok-4.3",
  "grok-2": "grok-4.6",
  "grok-code": "grok-build-0.1",
  "grok-2-vision": "grok-4.6",
  "grok-2-vision-1212": "grok-4.6",
  "grok-voice": "grok-4.6",
  "grok-imagine": "grok-4.6",
  "grok-imagine-image": "grok-4.6",
  "grok-imagine-image-2.0": "grok-4.6",
  "grok-imagine-image-quality": "grok-4.6",
  "grok-imagine-video": "grok-4.6",
  "grok-imagine-video-1.5": "grok-4.6",
  "auro-14b": "grok-4.6",
  "auro-14b-instruct": "grok-4.6",
  "auro-7b": "grok-4.6",
  "auro-vision": "grok-4.6",
  "medina-phi": "grok-4.6",
  "neuro-bcvi": "grok-4.6",
  "xcrew-edge": "grok-4.6",
  "mesie-core": "grok-4.6",
  "parallax-router": "grok-4.6",
  "liquid-organism": "grok-4.6",
  "fsos-freight": "grok-4.6",
  "nova-mobile": "grok-4.6",
};

/** @param {TurnPayload} [data] @returns {string} */
export function resolveApiModel(data = {}) {
  const raw = String(data.apiModel || data.apiId || data.modelId || "grok-4.6")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "");
  if (!raw) return "grok-4.6";
  if (LIVE_CHAT.has(raw)) return raw;
  if (MODEL_ALIAS[raw]) return MODEL_ALIAS[raw];
  if (raw.startsWith("grok-4.20")) {
    if (/non/i.test(raw)) return "grok-4.20-0309-non-reasoning";
    if (/multi/i.test(raw)) return "grok-4.20-multi-agent-0309";
    return "grok-4.20-0309-reasoning";
  }
  if (raw.startsWith("grok-build")) return "grok-build-0.1";
  if (raw.startsWith("grok-")) return "grok-4.6";
  return "grok-4.6";
}

export function liveModels() {
  return {
    chat: [...LIVE_CHAT],
    imagine: [
      "grok-imagine-image",
      "grok-imagine-image-2.0",
      "grok-imagine-image-quality",
      "grok-imagine-video",
      "grok-imagine-video-1.5",
    ],
    aliases: MODEL_ALIAS,
    note: "Chat turns hit these live xAI ids. Other dropdown rows alias here, or need a Models-page key (BYOK).",
  };
}

/** @param {TurnPayload} [data] */
function chatTarget(data = {}) {
  const byokUrl = String(data.baseUrl || "").trim();
  const byokKey = String(data.apiKey || "").trim();
  if (byokUrl && byokKey && data.native === false) {
    const base = byokUrl.replace(/\/$/, "").replace(/\/chat\/completions$/i, "");
    return {
      url: `${base}/chat/completions`,
      key: byokKey,
      model: String(data.apiModel || data.apiId || "gpt-4o"),
      via: "byok",
    };
  }
  if (data.native === false) {
    return { url: "", key: "", model: "", via: "byok-missing" };
  }
  return {
    url: "https://api.x.ai/v1/chat/completions",
    key: process.env.XAI_API_KEY || "",
    model: resolveApiModel(data),
    via: "xai",
  };
}

/** @param {TurnPayload} [data] */
export async function runAgentTurn(data = {}) {
  const target = chatTarget(data);
  const apiKey = target.key;
  if (!apiKey) {
    if (target.via === "byok-missing") {
      return {
        ok: false,
        text: "This model needs a key. Open Models, paste an OpenAI-compatible endpoint, then assign it. Native Grok on this kiln does not need a key.",
        toolCalls: [],
      };
    }
    return localBuilder(data, "AI is not available in this environment");
  }
  const messages = [{ role: "system", content: systemFor(data) }, ...mapMessages(data.messages)];
  if (messages.length === 1) {
    messages.push({ role: "user", content: "Sit on the working tree and write the next real file." });
  }
  const model = target.model;
  const res = await fetch(target.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: "auto",
      max_tokens: 8192,
      temperature: 0.35,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return localBuilder(data, `xAI API ${res.status}`);
  }
  const body = await res.json();
  /** @type {{ content?: string, tool_calls?: Array<{ id?: string, name?: string, function?: { name?: string, arguments?: string } }> }} */
  const msg = body.choices?.[0]?.message || {};
  const toolCalls = Array.isArray(msg.tool_calls)
    ? msg.tool_calls.map((c) => ({
        id: c.id || `tc_${Math.random().toString(36).slice(2, 8)}`,
        name: c.function?.name || c.name || "",
        argsJson: c.function?.arguments || "{}",
      }))
    : [];
  return { ok: true, text: msg.content || "", toolCalls, error: undefined };
}

/** @param {TurnPayload} data @param {unknown} stream */
function xaiPayload(data, stream) {
  const messages = [{ role: "system", content: systemFor(data) }, ...mapMessages(data.messages)];
  if (messages.length === 1) {
    messages.push({ role: "user", content: "Sit on the working tree and write the next real file." });
  }
  const target = chatTarget(data);
  return {
    model: target.model,
    messages,
    tools: TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
    tool_choice: "auto",
    max_tokens: 8192,
    temperature: 0.35,
    stream: !!stream,
  };
}

/**
 * @param {TurnPayload} [data]
 * @param {(chunk: Record<string, unknown>) => void} [write]
 */
export async function runAgentTurnStream(data = {}, write = () => {}) {
  const target = chatTarget(data);
  const apiKey = target.key;
  if (!apiKey) {
    const fallback =
      target.via === "byok-missing"
        ? {
            ok: false,
            text: "This model needs a key. Open Models, paste an OpenAI-compatible endpoint, then assign it. Native Grok on this kiln does not need a key.",
            toolCalls: [],
          }
        : localBuilder(data, "AI is not available in this environment");
    if (fallback.text) write({ delta: fallback.text });
    write({ ...fallback, done: true });
    return fallback;
  }
  const res = await fetch(target.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(xaiPayload(data, true)),
  });
  if (!res.ok || !res.body) {
    const fallback = localBuilder(data, `xAI API ${res.status}`);
    write({ ...fallback, done: true });
    return fallback;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  const tools = new Map();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() || "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (raw === "[DONE]") continue;
      let chunk;
      try {
        chunk = JSON.parse(raw);
      } catch {
        continue;
      }
      const delta = chunk.choices?.[0]?.delta || {};
      if (typeof delta.content === "string" && delta.content) {
        text += delta.content;
        write({ delta: delta.content });
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const cur = tools.get(idx) || { id: tc.id || `tc_${idx}`, name: "", argsJson: "" };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.argsJson += tc.function.arguments;
          tools.set(idx, cur);
        }
      }
    }
  }
  const toolCalls = [...tools.values()].filter((t) => t.name);
  const result = { ok: true, text, toolCalls, done: true };
  write(result);
  return result;
}

/** @param {unknown} body @param {string} [auth] - the MCP caller's Authorization header, forwarded to the forge */
export async function handleMcp(body, auth = "") {
  const req = typeof body === "string" ? JSON.parse(body || "{}") : body || {};
  const id = req.id ?? 1;
  const method = req.method || "";
  if (method === "initialize") {
    return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "kiln", version: "2026.9" } } };
  }
  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.parameters })),
      },
    };
  }
  if (method === "tools/call") {
    const name = req.params?.name || "";
    const args = req.params?.arguments || {};
    if (MCP_FORGE_TOOLS.has(name)) {
      const text = await runForgeTool(name, args && typeof args === "object" ? args : {}, auth);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: String(text).slice(0, 24_000) }],
        },
      };
    }
    if (INFRA_SET.has(name)) {
      const out = await runInfraTool(name, args && typeof args === "object" ? args : {});
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: String(out.text || JSON.stringify(out)).slice(0, 24_000) }],
        },
      };
    }
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: `Tool ${name || "unknown"} runs in the Kiln browser overlay (wallet + sealed tree). Open /mcp on this origin and call it from Studio.`,
          },
        ],
      },
    };
  }
  if (method === "notifications/initialized" || method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `unknown method ${method}` } };
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string, timeout?: number, input?: string }} [opts]
 */
function runChild(cmd, args, { cwd, timeout = 4000, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, timeout);
    child.stdout.on("data", (d) => {
      out += d.toString();
      if (out.length > 12_000) out = out.slice(0, 12_000);
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 4_000) err = err.slice(0, 4_000);
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: code ?? 1, out: (out + (err ? (out ? "\n" : "") + err : "")).slice(0, 12_000) });
    });
    child.on("error", (e) => {
      clearTimeout(t);
      resolve({ code: 1, out: e.message });
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

const COMPUTER_ROOT = (() => {
  try {
    return path.join(path.dirname(new URL(import.meta.url).pathname), "..", "computers");
  } catch {
    // No usable module URL (e.g. Cloudflare Workers, where import.meta.url
    // is undefined): computer workdirs live on a local filesystem and cannot
    // exist there — keep module load non-fatal; use fails honestly later.
    return "/computers";
  }
})();

/** @param {unknown} repoId @returns {string} */
function safeRepoDir(repoId) {
  const safe = String(repoId || "kiln/kiln")
    .replace(/[^a-zA-Z0-9._/-]+/g, "_")
    .replace(/\/+/g, "_")
    .slice(0, 80);
  const dir = path.join(COMPUTER_ROOT, safe);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** @param {string} dir @param {unknown} files @returns {number} */
function materializeTree(dir, files) {
  if (!Array.isArray(files)) return 0;
  let n = 0;
  for (const f of files.slice(0, 120)) {
    const rel = String(f.path || "")
      .replace(/^\/+/, "")
      .replace(/\.\./g, "");
    if (!rel || typeof f.content !== "string") continue;
    const dest = path.join(dir, rel);
    if (!dest.startsWith(dir)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.content);
    n += 1;
  }
  return n;
}

/** @param {unknown} raw @returns {string} */
function translateShell(raw) {
  let cmd = String(raw || "").trim();
  if (/^wsl\b/i.test(cmd)) {
    cmd = cmd.replace(/^wsl\s+/i, "").replace(/^-e\s+/i, "").replace(/^bash\s+-lc\s+/i, "").replace(/^['"]|['"]$/g, "");
  }
  if (/^(pwsh|powershell)\b/i.test(cmd)) {
    cmd = cmd.replace(/^(pwsh|powershell)\s+/i, "");
  }
  cmd = cmd
    .replace(/^Get-ChildItem\b/gi, "ls")
    .replace(/^Get-Content\b/gi, "cat")
    .replace(/^Get-Location\b/gi, "pwd")
    .replace(/^Write-Output\b/gi, "echo")
    .replace(/^Get-Date\b/gi, "date")
    .replace(/^Select-Object\s+-First\s+(\d+)\b/gi, "head -n $1");
  return cmd;
}

/** @param {TurnPayload} [data] */
export async function runOnComputer(data = {}) {
  const lang = String(data.lang || data.language || "").toLowerCase();
  const source = String(data.source || data.code || data.body || "");
  const dir = safeRepoDir(data.repoId || data.repo);
  const wrote = materializeTree(dir, data.files);
  if (!source && !data.command) {
    return { ok: true, code: 0, out: `computer ${data.repoId || "kiln"} seated at ${dir}${wrote ? ` · ${wrote} files` : ""}`, cwd: dir };
  }
  try {
    if (lang === "py" || lang === "python") {
      const file = path.join(dir, ".kiln-run.py");
      fs.writeFileSync(file, source);
      const r = await runChild("python3", [file], { cwd: dir, timeout: 8000 });
      return { ok: r.code === 0, ...r, cwd: dir };
    }
    if (lang === "js" || lang === "javascript" || lang === "node") {
      const file = path.join(dir, ".kiln-run.mjs");
      fs.writeFileSync(file, source);
      const r = await runChild("node", [file], { cwd: dir, timeout: 8000 });
      return { ok: r.code === 0, ...r, cwd: dir };
    }
    if (data.command || lang === "bash" || lang === "wsl" || lang === "pwsh" || data.shell) {
      const raw = translateShell(data.command || source);
      if (/rm\s+-rf\s+\/|mkfs|dd\s+if=/.test(raw)) {
        return { ok: false, code: 127, out: "command not allowed on this computer", cwd: dir };
      }
      const allowed = /^(node|python3?|ls|cat|pwd|echo|uname|date|head|tail|wc|mkdir|touch|grep|find|git|whoami|env|bash|sh|wsl|pwsh|powershell|file|stat|wc)\b/;
      if (!allowed.test(raw) && data.shell !== "wsl" && lang !== "wsl" && lang !== "bash") {
        return { ok: false, code: 127, out: "command not allowed on this computer", cwd: dir };
      }
      const r = await runChild("bash", ["-lc", raw], { cwd: dir, timeout: 8000 });
      return { ok: r.code === 0, ...r, cwd: dir, repoId: data.repoId };
    }
    return { ok: false, code: 1, out: "unknown language", cwd: dir };
  } catch (e) {
    return { ok: false, code: 1, out: e instanceof Error ? e.message : "run failed", cwd: dir };
  }
}

/** @param {string} pathname @param {KilnRequest} req */
export async function handleKilnApi(pathname, req) {
  if (pathname === "/api/kiln/models" && (req.method === "GET" || req.method === "POST")) {
    const live = liveModels();
    return json(200, {
      ok: true,
      liveChat: live.chat,
      imagine: live.imagine,
      aliases: live.aliases,
      note: live.note,
      text: `${live.chat.length} live Grok chat models on this kiln. ${Object.keys(live.aliases).length} dropdown aliases. Imagine is separate. BYOK needs a Models-page key.`,
    });
  }
  if ((pathname === "/api/mcp" || pathname === "/api/kiln/mcp") && (req.method === "POST" || req.method === "GET")) {
    if (req.method === "GET") {
      return json(200, { ok: true, tools: TOOLS.map((t) => t.name), transport: "JSON-RPC 2.0 POST /api/mcp" });
    }
    /** @type {TurnPayload} */ let data = {};
    try {
      data = JSON.parse(req.bodyText || "{}");
    } catch {
      data = {};
    }
    try {
      return json(200, await handleMcp(data, typeof req.auth === "string" ? req.auth : ""));
    } catch (e) {
      return json(500, { jsonrpc: "2.0", error: { code: -32603, message: e instanceof Error ? e.message : "mcp failed" } });
    }
  }
  if (pathname === "/api/kiln/agent-turn" && (req.method === "POST" || req.method === "PUT")) {
    /** @type {TurnPayload} */ let data = {};
    try {
      data = JSON.parse(req.bodyText || "{}");
    } catch {
      data = {};
    }
    try {
      const result = await runAgentTurn(data);
      return json(result.ok ? 200 : 503, result);
    } catch (e) {
      return json(500, { ok: false, error: e instanceof Error ? e.message : "turn failed", text: "", toolCalls: [] });
    }
  }
  if (pathname === "/api/kiln/l1" && (req.method === "POST" || req.method === "PUT" || req.method === "GET")) {
    const file = path.join(process.cwd(), "data", "l1.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    /** @type {L1Chain} */
    let chain = { height: 0, blocks: [], txs: [] };
    try {
      chain = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      /* genesis */
    }
    if (req.method === "GET") return json(200, { ok: true, ...chain, height: chain.blocks?.length || chain.height || 0 });
    /** @type {TurnPayload} */ let data = {};
    try {
      data = JSON.parse(req.bodyText || "{}");
    } catch {
      data = {};
    }
    const block = data.block || null;
    const tx = data.tx || null;
    if (block) chain.blocks = [...(chain.blocks || []), block].slice(-2000);
    if (tx) chain.txs = [...(chain.txs || []), tx].slice(-8000);
    chain.height = (chain.blocks || []).length;
    chain.head = block?.hash || chain.head;
    fs.writeFileSync(file, JSON.stringify(chain));
    return json(200, { ok: true, height: chain.height, hash: chain.head, tx: tx?.hash });
  }
  if (pathname === "/api/kiln/run" && (req.method === "POST" || req.method === "PUT")) {
    /** @type {TurnPayload} */ let data = {};
    try {
      data = JSON.parse(req.bodyText || "{}");
    } catch {
      data = {};
    }
    try {
      const result = await runOnComputer(data);
      return json(200, result);
    } catch (e) {
      return json(500, { ok: false, code: 1, out: e instanceof Error ? e.message : "run failed" });
    }
  }
  if ((pathname === "/api/kiln/infra" || pathname === "/api/kiln/physics") && (req.method === "POST" || req.method === "GET")) {
    /** @type {TurnPayload} */ let data = {};
    try {
      data = JSON.parse(req.bodyText || "{}");
    } catch {
      data = {};
    }
    const name = data.tool || data.name || data.model || "kiln_physics";
    const args = data.args && typeof data.args === "object" ? data.args : data;
    try {
      const result = await runInfraTool(name.startsWith("kiln_") ? name : `kiln_${name}`, args);
      return json(result.ok === false ? 400 : 200, result);
    } catch (e) {
      return json(500, { ok: false, error: e instanceof Error ? e.message : "infra failed" });
    }
  }
  if (pathname === "/api/kiln/capsule" && (req.method === "GET" || req.method === "POST")) {
    /** @type {TurnPayload} */ let data = {};
    try {
      data = JSON.parse(req.bodyText || "{}");
    } catch {
      data = {};
    }
    const repoId = data.repo || data.repoId || req.query?.repo || "kiln/studio";
    try {
      const cap = await renderCapsule(repoId, data.files);
      if (!cap.ok) return json(400, cap);
      if (data.json) return json(200, cap);
      return {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-kiln-isolation": String(cap.isolation || ""),
          "x-kiln-host": String(cap.host || ""),
        },
        body: cap.html || "<!doctype html><title>no capsule</title>",
      };
    } catch (e) {
      return json(500, { ok: false, error: e instanceof Error ? e.message : "capsule failed" });
    }
  }
  return null;
}
