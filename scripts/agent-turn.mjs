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

const TOOLS = [
  { name: "kiln_list_files", description: "List files in a repository path. Always call this before you claim you know the tree. path empty = root.", parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" } }, required: ["repo"] } },
  { name: "kiln_read_file", description: "Read a file from the working tree. You will see the real bytes. Use this instead of guessing contents.", parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" } }, required: ["repo", "path"] } },
  { name: "kiln_write_file", description: "Write a file and settle a git commit on this repository. This is how agents code. Prefer complete files, not stubs.", parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" }, content: { type: "string" }, message: { type: "string" } }, required: ["repo", "path", "content"] } },
  { name: "kiln_create_branch", description: "Create a branch at HEAD.", parameters: { type: "object", properties: { repo: { type: "string" }, name: { type: "string" } }, required: ["repo", "name"] } },
  { name: "kiln_run", description: "Run one kilnsh command on this repository's computer. One command per call: ls, cat, git log, node, python, machine, ledger, seal. Do not chain with semicolons.", parameters: { type: "object", properties: { repo: { type: "string" }, command: { type: "string" } }, required: ["repo", "command"] } },
  { name: "kiln_machine", description: "Dump the sealed machine for a Git tree: shell, memory, models, preview domain, ledger.", parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] } },
  { name: "kiln_bind_model", description: "Bind a model to this tree. Agents inherit it. Settles MACHINE.json as a git commit.", parameters: { type: "object", properties: { repo: { type: "string" }, model: { type: "string" } }, required: ["repo", "model"] } },
  { name: "kiln_remember", description: "Write an entry into this tree's memory banks (working, episodic, semantic, procedural, lattice, folder).", parameters: { type: "object", properties: { repo: { type: "string" }, kind: { type: "string" }, text: { type: "string" } }, required: ["repo", "text"] } },
  { name: "kiln_ledger", description: "Print this tree's machine ledger: Merkle of files, commits, and txs. Not the global chain.", parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] } },
  { name: "kiln_log", description: "Write a line to the agent computer.", parameters: { type: "object", properties: { message: { type: "string" } }, required: ["message"] } },
  { name: "kiln_open_pr", description: "Open a pull request.", parameters: { type: "object", properties: { repo: { type: "string" }, title: { type: "string" }, body: { type: "string" }, branch: { type: "string" } }, required: ["repo", "title"] } },
  { name: "kiln_handoff", description: "Hand a task to another crew role on this tree. They keep working after you.", parameters: { type: "object", properties: { to: { type: "string" }, task: { type: "string" }, files: { type: "string" } }, required: ["to", "task"] } },
  { name: "kiln_spawn_agent", description: "Spawn a sub-agent on this tree. They get their own turns. Always pass task so they start working.", parameters: { type: "object", properties: { repo: { type: "string" }, role: { type: "string", description: "conductor|agi|architect|builder|reviewer|deployer|scout|cipher|indexer" }, name: { type: "string" }, model: { type: "string" }, task: { type: "string", description: "Job the sub-agent should run immediately" } }, required: ["repo"] } },
  { name: "kiln_spawn_subagent", description: "Spawn a sub-agent and give them a job. Same as kiln_spawn_agent. Use this to parallelize builder/reviewer/indexer work.", parameters: { type: "object", properties: { repo: { type: "string" }, role: { type: "string" }, name: { type: "string" }, task: { type: "string" } }, required: ["repo", "task"] } },
  { name: "kiln_crew", description: "Show the crew graph, constitution, and mailboxes on a repository.", parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] } },
  { name: "kiln_search", description: "Search file paths and contents on a repository.", parameters: { type: "object", properties: { q: { type: "string" }, repo: { type: "string" } }, required: ["q"] } },
  ...INFRA_SCHEMA,
];

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

function mapMessages(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const m of raw.slice(-120)) {
    const role = m.role === "tool" ? "tool" : m.role === "assistant" ? "assistant" : "user";
    const msg = { role, content: typeof m.content === "string" ? m.content : m.content == null ? "" : String(m.content) };
    if (role === "tool" && m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    if (role === "assistant" && Array.isArray(m.tool_calls)) msg.tool_calls = m.tool_calls;
    out.push(msg);
  }
  return out;
}

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

export async function runAgentTurnStream(data = {}, write) {
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

export async function handleMcp(body) {
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

const COMPUTER_ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "computers");

function safeRepoDir(repoId) {
  const safe = String(repoId || "kiln/kiln")
    .replace(/[^a-zA-Z0-9._/-]+/g, "_")
    .replace(/\/+/g, "_")
    .slice(0, 80);
  const dir = path.join(COMPUTER_ROOT, safe);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

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
    let data = {};
    try {
      data = JSON.parse(req.bodyText || "{}");
    } catch {
      data = {};
    }
    try {
      return json(200, await handleMcp(data));
    } catch (e) {
      return json(500, { jsonrpc: "2.0", error: { code: -32603, message: e instanceof Error ? e.message : "mcp failed" } });
    }
  }
  if (pathname === "/api/kiln/agent-turn" && (req.method === "POST" || req.method === "PUT")) {
    let data = {};
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
    let chain = { height: 0, blocks: [], txs: [] };
    try {
      chain = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      /* genesis */
    }
    if (req.method === "GET") return json(200, { ok: true, ...chain, height: chain.blocks?.length || chain.height || 0 });
    let data = {};
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
    let data = {};
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
    let data = {};
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
    let data = {};
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
