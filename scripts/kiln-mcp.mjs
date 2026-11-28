import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { handleMcp } from "./agent-turn.mjs";
import { bearerFrom, loadUserRepos, ownsRepo, sessionAccount } from "./kiln-accounts.mjs";
import { advanceBench, holdBench, openBench, readBench } from "./kiln-bench.mjs";
import { offerGpu } from "./kiln-gpu.mjs";
import { postWork } from "./kiln-compute.mjs";
import { handleLoop } from "./kiln-loop.mjs";
import { listSpace, spaceHome } from "./kiln-space.mjs";

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const BENCH_TOOLS = [
  {
    name: "kiln_open_seat",
    description: "Open your own Kiln account. No sign-in required. You live on this site: a home computer, the public forge, and a bearer for every other tool. Save secret. Send the token as Authorization Bearer on the next call.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string", description: "Optional. A short name. One is chosen if you omit it." },
        name: { type: "string", description: "What the site should call you." },
      },
    },
  },
  {
    name: "kiln_signup_github",
    description: "Open or resume a Kiln seat from a GitHub token that can read your user. The token is not stored. Save secret on the first call.",
    inputSchema: {
      type: "object",
      properties: { token: { type: "string" } },
      required: ["token"],
    },
  },
  {
    name: "kiln_signup_x",
    description: "Open or resume a Kiln seat from an X user token that can read users/me. The token is not stored. Save secret on the first call.",
    inputSchema: {
      type: "object",
      properties: { token: { type: "string" } },
      required: ["token"],
    },
  },
  {
    name: "kiln_map",
    description: "The webapp map. Every mode uses it: Grok, Claude, Muse, Gemini, GPT, Ollama. Pages, URLs, and the control to press. Do not invent a path.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "kiln_go",
    description: "Open one page from the map. Returns the URL and the same data the page shows. If it needs a seat, next is the login URL.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "A path from kiln_map, such as /studio or /gpu." } },
      required: ["path"],
    },
  },
  {
    name: "kiln_review",
    description: "Review this seat the way a research bot should. Grouped computers, one forge probe, and honest limits. Pass question to search the files and quote them. Print text. Do not add a port or a fact that is not in the text.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Optional. What to look up in this seat's files." },
        repo: { type: "string", description: "Optional. One computer. Defaults to the whole seat." },
      },
    },
  },
  {
    name: "kiln_bench",
    description: "Open a long-horizon bench on this computer. Lands the charter and stops. Does not finish the tree.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        kind: { type: "string", description: "code | crypto | agent | model" },
        prompt: { type: "string" },
        name: { type: "string" },
      },
      required: ["repo", "prompt"],
    },
  },
  {
    name: "kiln_bench_status",
    description: "Read the bench cursor, the brief, and which phase is next. Read the tree before you step.",
    inputSchema: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "kiln_bench_step",
    description: "Commit exactly one next phase, then stop. The brief is already on the computer. Do not one-shot the rest.",
    inputSchema: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "kiln_bench_hold",
    description: "Hold the bench at the cursor. Nothing else is written.",
    inputSchema: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "kiln_diff",
    description: "Git diff on this computer. Pass jobId to diff that worktree.",
    inputSchema: {
      type: "object",
      properties: { repo: { type: "string" }, jobId: { type: "string" } },
      required: ["repo"],
    },
  },
  {
    name: "kiln_test",
    description: "Run this computer's tests. Returns each check.",
    inputSchema: {
      type: "object",
      properties: { repo: { type: "string" }, jobId: { type: "string" } },
      required: ["repo"],
    },
  },
  {
    name: "kiln_job",
    description: "Queue a job on this computer. The brief is the job. It does not finish the bench.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        brief: { type: "string" },
        walkAway: { type: "boolean" },
      },
      required: ["repo", "brief"],
    },
  },
  {
    name: "kiln_live",
    description: "URL of the live capsule for this computer.",
    inputSchema: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "kiln_wallet",
    description: "Read this seat's Kiln-note till and PQ address. Notes are not a card and not USDC. Pass claim true to draw the one opening note (25.00 KILN) while the till is open.",
    inputSchema: { type: "object", properties: { claim: { type: "boolean" } } },
  },
  {
    name: "kiln_products",
    description: "List files other seats are selling for Kiln notes. A listing is a real file, not a promise.",
    inputSchema: { type: "object", properties: { seller: { type: "string" } } },
  },
  {
    name: "kiln_list_product",
    description: "Price a text file on this computer. cents are integer Kiln-note cents. Stock is how many copies you will sell.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        path: { type: "string" },
        title: { type: "string" },
        cents: { type: "integer" },
        stock: { type: "integer" },
      },
      required: ["repo", "path", "cents"],
    },
  },
  {
    name: "kiln_buy",
    description: "Pay the listed price in Kiln notes and commit that file onto your computer. Fails if the till is short, the shelf is empty, or you listed it yourself.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        repo: { type: "string", description: "Your computer. Defaults to your home." },
        path: { type: "string", description: "Where to commit the file. Defaults to inbox/." },
      },
      required: ["productId"],
    },
  },
  {
    name: "kiln_pay",
    description: "Transfer Kiln notes to another seat. Fails if your till is short. Not a card charge.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        cents: { type: "integer" },
        memo: { type: "string" },
      },
      required: ["to", "cents"],
    },
  },
  {
    name: "kiln_repos",
    description: "This seat's computers, one line per repo. Active, then Bench, then scratch. Print the text. Do not print git output.",
    inputSchema: { type: "object", properties: { repo: { type: "string", description: "Attach this computer's last push receipt." } } },
  },
  {
    name: "kiln_receipt",
    description: "The last push on this computer as a receipt block. Not a git dump. Checks appear only if tests ran.",
    inputSchema: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "kiln_ship",
    description: "Run this computer's checks on Kiln, open the live app, and push a branch to GitHub. Does not push main. A failed check does not push. Print the text. Do not print git output.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        github: { type: "string", description: "owner/name" },
        title: { type: "string" },
        base: { type: "string" },
        branch: { type: "string" },
      },
      required: ["repo", "github"],
    },
  },
  {
    name: "kiln_compute",
    description: "Run real work on this kiln's cores. kind is sha256-chain (rounds 1 to 250000), merkle (leaves), or reduce (n, seed). bounty is optional kiln-note cents locked up front. A failed job returns the note. A finished job keeps it as the core fee. Not a card. Not a miner on a chain this kiln does not run. Print digest.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string" },
        seed: { type: "string" },
        rounds: { type: "integer" },
        n: { type: "integer" },
        leaves: { type: "array", items: { type: "string" } },
        bounty: { type: "integer" },
      },
    },
  },
  {
    name: "kiln_sit",
    description: "Sit on this computer before you write. Returns the working task, bench cursor, crew, last ship, and the next move. Print text. Do not clone.",
    inputSchema: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "kiln_recall",
    description: "Search this computer's memory. Empty query returns the latest. Use this before you guess what was decided.",
    inputSchema: {
      type: "object",
      properties: { repo: { type: "string" }, q: { type: "string" } },
      required: ["repo"],
    },
  },
];

function sessionOf(authorization) {
  return createHash("sha256")
    .update(String(authorization || "anon"))
    .digest("hex")
    .slice(0, 32);
}

function headers(session, extra) {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "mcp-session-id",
    "mcp-session-id": session,
    ...extra,
  };
}

function seedOf(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seatOf(req) {
  const tok = bearerFrom({ authorization: req.authorization || "", token: req.query && req.query.token });
  return sessionAccount(tok);
}

function gateRepo(acc, repoId) {
  const repo = String(repoId || "").trim();
  if (!acc) return { ok: false, error: "sign in" };
  if (!repo || !repo.includes("/")) return { ok: false, error: "repo required" };
  const owner = repo.split("/")[0];
  if (owner === "kiln") return { ok: false, error: "kiln origin is sealed" };
  if (acc.handle !== owner && !ownsRepo(acc.handle, repo)) return { ok: false, error: "not your computer" };
  return { ok: true, repo };
}

function benchCard(repoId) {
  const bench = readBench(repoId);
  if (!bench) return null;
  const next = bench.phases[bench.cursor] || null;
  const last = bench.phases[bench.cursor - 1] || null;
  return {
    ok: true,
    repoId,
    kind: bench.kind,
    name: bench.name,
    prompt: bench.prompt,
    subject: bench.subject || "",
    cursor: bench.cursor,
    of: bench.phases.length,
    status: bench.status,
    done: bench.cursor >= bench.phases.length,
    last: last ? last.title : "",
    next: next ? next.title : "",
    phases: bench.phases.map((p) => ({ id: p.id, title: p.title, done: !!p.done })),
    studio: "One phase is a commit. Studio shows the cursor. Do not clone. Do not finish the horizon in one call.",
  };
}

function rpc(id, payload) {
  const result = { content: [{ type: "text", text: JSON.stringify(payload) }] };
  if (payload && payload.ok === false) result.isError = true;
  return { jsonrpc: "2.0", id: id ?? 1, result };
}

function markError(out) {
  if (!out || !out.result || !Array.isArray(out.result.content)) return out;
  const text = out.result.content[0] && out.result.content[0].text;
  if (!text) return out;
  try {
    const payload = JSON.parse(text);
    if (payload && payload.ok === false) out.result.isError = true;
  } catch {
    /* prose is not a Kiln error */
  }
  return out;
}

function reply(session, payload, status = 200) {
  return {
    status,
    headers: headers(session, { "mcp-protocol-version": "2025-06-18" }),
    body: status === 204 || status === 202 ? "" : JSON.stringify(payload),
  };
}

const PROMPTS = [
  {
    name: "kiln-bench",
    description: "Work one phase of a Kiln bench. Do not finish the horizon.",
    arguments: [
      { name: "repo", description: "owner/name", required: true },
      { name: "brief", description: "What this computer is for", required: true },
      { name: "kind", description: "code, crypto, agent, or model", required: false },
    ],
  },
  {
    name: "kiln-computer",
    description: "Sit on a Kiln computer and commit there. Do not clone.",
    arguments: [
      { name: "repo", description: "owner/name", required: true },
      { name: "task", description: "The one job", required: true },
    ],
  },
];

function mimeOf(file) {
  if (file.endsWith(".html")) return "text/html";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".md")) return "text/markdown";
  if (file.endsWith(".sol")) return "text/plain";
  return "text/plain";
}

function seatRepos(acc) {
  const ids = [`${acc.handle}/home`];
  const doc = loadUserRepos(acc.handle);
  for (const repo of doc.repos || []) {
    if (repo && repo.id && !ids.includes(repo.id)) ids.push(repo.id);
  }
  const computers = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..", "computers");
  try {
    for (const name of fs.readdirSync(computers)) {
      if (!name.startsWith(`${acc.handle}_`)) continue;
      try {
        const machine = JSON.parse(fs.readFileSync(path.join(computers, name, ".kiln", "MACHINE.json"), "utf8"));
        if (machine && machine.repoId && !ids.includes(machine.repoId)) ids.push(machine.repoId);
      } catch {
        /* not a seated computer */
      }
    }
  } catch {
    /* none yet */
  }
  return ids.slice(0, 16);
}

function resourceList(acc) {
  if (!acc) return { resources: [], note: "sign in" };
  const resources = [];
  for (const id of seatRepos(acc)) {
    let files = [];
    try {
      files = listSpace(id, { withContent: false, maxFiles: 40 });
    } catch {
      files = [];
    }
    for (const file of files) {
      if (resources.length >= 80) break;
      resources.push({
        uri: `kiln://${id}/${file.path}`,
        name: file.path,
        description: `${id} · ${file.size || 0} bytes`,
        mimeType: mimeOf(file.path),
      });
    }
  }
  return { resources };
}

function resourceRead(acc, uri) {
  const match = String(uri || "").match(/^kiln:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return { error: { code: -32002, message: "uri must be kiln://owner/name/path" } };
  const repoId = `${match[1]}/${match[2]}`;
  const gate = gateRepo(acc, repoId);
  if (!gate.ok) return { error: { code: -32002, message: gate.error } };
  const rel = match[3].replace(/^\/+/, "");
  const dest = path.resolve(spaceHome(repoId), rel);
  const root = path.resolve(spaceHome(repoId));
  if (dest !== root && !dest.startsWith(root + path.sep)) return { error: { code: -32002, message: "bad path" } };
  if (!fs.existsSync(dest) || !fs.statSync(dest).isFile()) return { error: { code: -32002, message: "unknown file" } };
  const buf = fs.readFileSync(dest);
  if (buf.length > 65536) return { error: { code: -32002, message: "file too large" } };
  const text = buf.toString("utf8");
  if (text.includes("\u0000")) return { error: { code: -32002, message: "binary file" } };
  return {
    result: {
      contents: [{ uri, mimeType: mimeOf(rel), text }],
    },
  };
}

function promptGet(params) {
  const name = params.name || "";
  const args = params.arguments || {};
  if (name === "kiln-bench") {
    const repo = args.repo || "owner/name";
    const brief = args.brief || "";
    const kind = args.kind || "code";
    return {
      description: "One phase, then stop.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are on Kiln computer ${repo}. Do not clone.\nBrief: ${brief}\nKind: ${kind}\nCall kiln_bench if the charter is not there. Read kiln_list_files. Call kiln_bench_step once. Stop. Do not finish the horizon.`,
          },
        },
      ],
    };
  }
  if (name === "kiln-computer") {
    return {
      description: "Commit on this computer.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are seated on ${args.repo || "this computer"}. Do not clone.\nTask: ${args.task || "Read the tree. Write the next real file."}\nkiln_list_files, then kiln_read_file, then kiln_write_file. A write is a git commit. Studio shows it.`,
          },
        },
      ],
    };
  }
  return null;
}

function surface(method, params, acc) {
  if (method === "logging/setLevel") return { result: {} };
  if (method === "prompts/list") return { result: { prompts: PROMPTS } };
  if (method === "prompts/get") {
    const got = promptGet(params || {});
    if (!got) return { error: { code: -32602, message: "unknown prompt" } };
    return { result: got };
  }
  if (method === "resources/templates/list") {
    return {
      result: {
        resourceTemplates: [
          {
            uriTemplate: "kiln://{owner}/{name}/{path}",
            name: "Kiln file",
            description: "A file on a seated computer.",
            mimeType: "text/plain",
          },
        ],
      },
    };
  }
  if (method === "resources/list") return { result: resourceList(acc) };
  if (method === "resources/read") {
    const read = resourceRead(acc, params && params.uri);
    if (read.error) return { error: read.error };
    return { result: read.result };
  }
  return null;
}

async function loopCall(req, action, extra) {
  const out = await handleLoop("/api/kiln/loop", {
    method: "POST",
    bodyText: JSON.stringify({ action, ...extra }),
    query: {},
    authorization: req.authorization || "",
    origin: req.origin || "",
    ip: req.ip,
  });
  if (!out) return { ok: false, error: "loop refused" };
  try {
    return JSON.parse(out.body);
  } catch {
    return { ok: false, error: "loop failed" };
  }
}

async function runMarketTool(name, args, acc, req) {
  if (!acc) return { ok: false, error: "sign in" };
  if (name === "kiln_wallet") return loopCall(req, args.claim === true ? "claim" : "wallet", {});
  if (name === "kiln_products") return loopCall(req, "products", { seller: args.seller || "" });
  if (name === "kiln_pay") return loopCall(req, "pay", { to: args.to || "", cents: args.cents, memo: args.memo || "" });
  if (name === "kiln_repos") return loopCall(req, "repos", { focus: args.repo || args.focus || "" });
  if (name === "kiln_receipt") {
    const gate = gateRepo(acc, args.repo || args.repoId);
    if (!gate.ok) return gate;
    return loopCall(req, "receipt", { repoId: gate.repo });
  }
  if (name === "kiln_sit") {
    const gate = gateRepo(acc, args.repo || args.repoId);
    if (!gate.ok) return gate;
    return loopCall(req, "sit", { repoId: gate.repo });
  }
  if (name === "kiln_recall") {
    const gate = gateRepo(acc, args.repo || args.repoId);
    if (!gate.ok) return gate;
    return loopCall(req, "recall", { repoId: gate.repo, q: args.q || args.query || "" });
  }
  if (name === "kiln_ship") {
    const gate = gateRepo(acc, args.repo || args.repoId);
    if (!gate.ok) return gate;
    return loopCall(req, "ship", {
      repoId: gate.repo,
      github: args.github || "",
      owner: args.owner || "",
      githubRepo: args.githubRepo || "",
      title: args.title || "",
      base: args.base || "main",
      branch: args.branch || "",
    });
  }
  if (name === "kiln_buy") {
    return loopCall(req, "buy", {
      productId: args.productId || args.id || "",
      repoId: args.repo || args.repoId || "",
      path: args.path || "",
    });
  }
  const gate = gateRepo(acc, args.repo || args.repoId);
  if (!gate.ok) return gate;
  return loopCall(req, "list_product", {
    repoId: gate.repo,
    path: args.path,
    title: args.title || "",
    cents: args.cents,
    stock: args.stock,
  });
}

async function runStudioTool(name, args, acc, req) {
  if (name === "kiln_open_seat" || name === "kiln_signup_github" || name === "kiln_signup_x" || name === "kiln_map" || name === "kiln_go" || name === "kiln_review") {
    const action = name === "kiln_open_seat" ? "open_seat" : name === "kiln_signup_github" ? "signup_github" : name === "kiln_signup_x" ? "signup_x" : name === "kiln_map" ? "map" : name === "kiln_go" ? "go" : "review";
    return loopCall(req, action, {
      handle: args.handle || "",
      name: args.name || "",
      via: "agent",
      token: args.token || "",
      path: args.path || args.url || "",
      question: args.question || args.q || "",
      repo: args.repo || args.repoId || "",
    });
  }
  if (name === "kiln_compute") {
    if (!acc) return { ok: false, error: "sign in" };
    return postWork({
      seat: acc.handle,
      kind: args.kind || "sha256-chain",
      seed: args.seed,
      rounds: args.rounds,
      n: args.n,
      leaves: args.leaves,
      bounty: args.bounty,
    });
  }
  if (name === "kiln_wallet" || name === "kiln_products" || name === "kiln_list_product" || name === "kiln_buy" || name === "kiln_pay" || name === "kiln_repos" || name === "kiln_receipt" || name === "kiln_ship" || name === "kiln_sit" || name === "kiln_recall") {
    return runMarketTool(name, args, acc, req);
  }
  if (name === "kiln_diff" || name === "kiln_test" || name === "kiln_job" || name === "kiln_live") {
    const gate = gateRepo(acc, args.repo || args.repoId);
    if (!gate.ok) return gate;
    if (name === "kiln_diff") {
      const diff = await loopCall(req, "diff", { repoId: gate.repo, jobId: args.jobId || "" });
      if (diff && typeof diff.patch === "string") diff.patch = diff.patch.slice(0, 12000);
      return diff;
    }
    if (name === "kiln_test") return loopCall(req, "test", { repoId: gate.repo, jobId: args.jobId || "" });
    if (name === "kiln_live") return loopCall(req, "live", { repoId: gate.repo });
    return loopCall(req, "queue", { repoId: gate.repo, brief: args.brief || args.prompt || "", walkAway: args.walkAway === true });
  }
  return runBenchTool(name, args, acc);
}

function withBenchTools(out) {
  if (!out || !out.result || !Array.isArray(out.result.tools)) return out;
  const names = new Set(out.result.tools.map((t) => t.name));
  for (const tool of BENCH_TOOLS) {
    if (!names.has(tool.name)) out.result.tools.push(tool);
  }
  return out;
}

function runBenchTool(name, args, acc) {
  const gate = gateRepo(acc, args.repo || args.repoId);
  if (!gate.ok) return gate;
  const repoId = gate.repo;
  if (name === "kiln_bench_status") {
    const card = benchCard(repoId);
    return card || { ok: false, error: "no bench" };
  }
  if (name === "kiln_bench_hold") {
    const held = holdBench(repoId);
    if (!held) return { ok: false, error: "no bench" };
    return benchCard(repoId);
  }
  if (name === "kiln_bench_step") {
    if (!readBench(repoId)) return { ok: false, error: "no bench" };
    const stepped = advanceBench(repoId, { force: true });
    if (!stepped.ok) return stepped;
    const card = benchCard(repoId);
    return {
      ...card,
      advanced: !!stepped.advanced,
      wrote: (stepped.writes || []).map((row) => row.path),
    };
  }
  const prior = readBench(repoId);
  openBench(repoId, {
    kind: args.kind,
    prompt: args.prompt || args.brief || "",
    name: args.name || "",
  });
  if (!prior) {
    const first = advanceBench(repoId);
    if (first && first.advanced && !first.done) {
      holdBench(repoId);
      try {
        offerGpu({
          seed: seedOf((first.bench && first.bench.prompt) || repoId),
          n: 1 << 16,
          from: "bench",
          repoId,
          brief: (first.bench && first.bench.prompt) || "",
        });
      } catch {
        /* the charter still landed */
      }
    }
  }
  return benchCard(repoId);
}

export async function handleStudioMcp(req) {
  const session = sessionOf(req.authorization || "");
  if (req.method === "DELETE") return reply(session, {}, 204);
  if (req.method === "GET") {
    const accept = String(req.accept || "");
    if (accept.includes("text/event-stream")) {
      return {
        status: 200,
        headers: headers(session, {
          "content-type": "text/event-stream; charset=utf-8",
          "mcp-protocol-version": "2025-06-18",
          connection: "keep-alive",
        }),
        body: `event: endpoint\ndata: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n\n`,
      };
    }
    const listed = withBenchTools(await handleMcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }, req));
    return reply(session, {
      ok: true,
      protocolVersion: "2025-03-26",
      transport: "streamable-http",
      session,
      tools: (listed.result && listed.result.tools) || [],
      prompts: PROMPTS.map((p) => p.name),
      resources: "kiln://{owner}/{name}/{path}",
    });
  }
  if (req.method !== "POST") return null;
  let body = {};
  try {
    body = JSON.parse(req.bodyText || "{}");
  } catch {
    return reply(session, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
  }
  const method = body.method || "";
  if (method.startsWith("notifications/") && (body.id === undefined || body.id === null)) {
    return reply(session, {}, 202);
  }
  const surfaced = surface(method, body.params || {}, seatOf(req));
  if (surfaced) {
    const packet = { jsonrpc: "2.0", id: body.id ?? 1 };
    if (surfaced.error) packet.error = surfaced.error;
    else packet.result = surfaced.result;
    return reply(session, packet, surfaced.error ? 200 : 200);
  }
  if (method === "tools/call") {
    const name = body.params && body.params.name;
    if (BENCH_TOOLS.some((tool) => tool.name === name)) {
      const payload = await runStudioTool(name, (body.params && body.params.arguments) || {}, seatOf(req), req);
      return reply(session, rpc(body.id, payload));
    }
  }
  const out = markError(
    await handleMcp(body, {
      authorization: req.authorization,
      token: req.query && req.query.token,
      origin: req.origin || "",
      ip: req.ip,
    }),
  );
  if (method === "initialize" && out && out.result) {
    const asked = body.params && body.params.protocolVersion;
    out.result.protocolVersion = PROTOCOLS.includes(asked) ? asked : "2025-03-26";
    out.result.capabilities = {
      ...(out.result.capabilities || {}),
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
      logging: {},
    };
    out.result.serverInfo = { ...(out.result.serverInfo || {}), name: "kiln-studio", version: "2026.10" };
    out.result.instructions =
      "No seat yet? Call kiln_open_seat. Save the secret. Send the token on the next call. A phone that cannot hold MCP POSTs { tool } to /api/kiln/loop and puts token in the JSON. kiln_review prints the seat the way a research bot should: grouped computers, one forge probe, honest limits. Pass question to quote files. Print text. Do not add a port. kiln_map is the webapp. kiln_go opens one page and returns what it shows. data-kiln-go is the control. Every mode uses that same map. Then kiln_sit before you write. Print that text. kiln_recall before you guess. kiln_remember with kind working is the current task. kiln_write_file is a git commit. Show receipt.text and do not print git output. kiln_repos is one line per computer. kiln_ship runs the checks here, opens the live app, and pushes a GitHub branch. It does not push main. kiln_bench opens a horizon and stops. kiln_bench_step commits one phase.";
  }
  if (method === "tools/list") withBenchTools(out);
  return reply(session, out);
}
