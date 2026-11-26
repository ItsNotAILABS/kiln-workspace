/**
 * Long-horizon benches. A repo is not finished in one pass.
 * Each phase is a commit. The cursor lives in .kiln/bench.json.
 */
import fs from "node:fs";
import path from "node:path";
import { bootSpace, spaceHome, writeOnTree } from "./kiln-space.mjs";

export function inferKind(kind, prompt) {
  const given = String(kind || "").toLowerCase();
  if (given === "code" || given === "crypto" || given === "agent" || given === "model") return given;
  const n = String(prompt || "").toLowerCase();
  if (/\b(sol|solidity|defi|escrow|token|wallet|chain|ledger|crypto)\b/.test(n)) return "crypto";
  if (/\b(agent|crew|mcp|resident)\b/.test(n)) return "agent";
  if (/\b(model|weights|inference|lora)\b/.test(n)) return "model";
  return "code";
}

function slug(name, prompt) {
  const raw = String(name || prompt || "bench")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return raw || "bench";
}

const GENERIC = new Set([
  "escrow", "contract", "ledger", "backend", "that", "this", "with", "locks", "against", "issue",
  "the", "and", "for", "a", "an", "of", "to", "on", "in", "is", "it", "or", "be", "as", "by",
  "from", "into", "your", "our", "until", "horizon", "done", "keep", "going", "code", "agent",
  "model", "crypto", "which", "will", "have", "has", "are", "was", "not", "one", "its", "their",
]);

export function subjectOf(prompt) {
  const words = String(prompt || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !GENERIC.has(w));
  return (words.slice(0, 4).join(" ") || "bench").slice(0, 64);
}

export function contractName(subject) {
  const pascal = String(subject || "bench")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("")
    .replace(/[^A-Za-z0-9]/g, "");
  return (pascal || "Bench") + "Escrow";
}

function charter({ kind, name, prompt, phases, cursor }) {
  const lines = phases.map((p, i) => `- [${i < cursor ? "x" : " "}] ${i + 1}. ${p.title}`);
  return `# ${name}\n\nThis is a bench, not a one-shot.\nThe crew stops at the cursor and continues from it next time.\n\nKind: ${kind}\n\n## Brief\n\n${prompt}\n\n## Horizon\n\n${lines.join("\n")}\n\nA write is a git commit. Do not replace a finished phase.\n`;
}

function capsule({ kind, name, prompt, phases, cursor }) {
  const rows = phases
    .map((p, i) => {
      const mark = i < cursor ? "done" : i === cursor ? "now" : "later";
      return `<li><span>${mark}</span><span>${p.title}</span></li>`;
    })
    .join("");
  const crypto =
    kind === "crypto"
      ? `<p class="note">Backend: <code>node server/index.mjs</code> on 127.0.0.1:8787. <code>POST /deposit</code> and <code>POST /release</code> hit the same rules as <code>contracts/Escrow.sol</code>.</p>`
      : "";
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  :root{color-scheme:dark;--bg:#09090b;--fg:#ecece8;--muted:#9a9a96;--line:#2a2a2e;--seal:#c4a574}
  body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 "IBM Plex Sans",ui-sans-serif,system-ui,sans-serif}
  main{max-width:36rem;margin:0 auto;padding:12vh 1.25rem 4rem}
  p.kicker{margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--seal)}
  h1{margin:.35rem 0 0;font-family:Newsreader,Georgia,serif;font-weight:500;font-size:2.4rem;letter-spacing:-.03em}
  .brief{color:var(--muted);margin:.8rem 0 0}
  ul{list-style:none;padding:0;margin:1.4rem 0 0;border-top:1px solid var(--line)}
  li{display:flex;justify-content:space-between;gap:1rem;padding:.7rem 0;border-bottom:1px solid var(--line);font-family:ui-monospace,monospace;font-size:12px}
  .note{color:var(--muted);font-size:13px}
  code{color:var(--fg)}
</style>
<main>
  <p class="kicker">${kind} bench · phase ${Math.min(cursor + 1, phases.length)} / ${phases.length}</p>
  <h1>${name}</h1>
  <p class="brief">${prompt.replace(/</g, "")}</p>
  <ul>${rows}</ul>
  ${crypto}
</main>
</html>
`;
}

const LEDGER = `import fs from "node:fs";

export function openLedger(file) {
  const load = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return { deposits: {} };
    }
  };
  const save = (state) => fs.writeFileSync(file, JSON.stringify(state, null, 2));
  return {
    deposit({ id, from, amount }) {
      if (!id || !from) throw new Error("id and from required");
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) throw new Error("amount must be positive");
      const state = load();
      const row = state.deposits[id] || { id, from, amount: 0, released: false };
      if (row.released) throw new Error("already released");
      if (row.amount > 0 && row.from !== from) throw new Error("depositor mismatch");
      row.from = from;
      row.amount = row.amount + n;
      row.subject = "__KILN_SUBJECT__";
      state.deposits[id] = row;
      save(state);
      return row;
    },
    release({ id, to }) {
      if (!to) throw new Error("to required");
      const state = load();
      const row = state.deposits[id];
      if (!row || row.amount <= 0 || row.released) throw new Error("nothing locked");
      row.released = true;
      row.to = to;
      state.deposits[id] = row;
      save(state);
      return row;
    },
    get(id) {
      return load().deposits[id] || null;
    },
  };
}
`;

const LEDGER_SERVER = `import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openLedger } from "./ledger.mjs";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function createApp(file) {
  const ledger = openLedger(file);
  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const send = (code, body) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === "GET" && url.pathname === "/health") return send(200, { ok: true });
      if (req.method === "GET" && url.pathname === "/ledger") {
        const id = url.searchParams.get("id");
        return send(200, { ok: true, row: id ? ledger.get(id) : null });
      }
      if (req.method === "POST" && (url.pathname === "/deposit" || url.pathname === "/release")) {
        const body = await readBody(req);
        const row = url.pathname === "/deposit" ? ledger.deposit(body) : ledger.release(body);
        return send(200, { ok: true, row });
      }
      send(404, { ok: false, error: "not found" });
    } catch (e) {
      send(400, { ok: false, error: e instanceof Error ? e.message : "bad request" });
    }
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const file = path.resolve(process.env.LEDGER || "data/ledger.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  createApp(file).listen(8787, "127.0.0.1");
}
`;

const ESCROW = `// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// Pull-pattern escrow. The payer withdraws or names a payee.
/// Release never pushes ETH to an arbitrary caller.
contract __KILN_CONTRACT__ {
    struct Lock {
        address payer;
        uint256 amount;
        bool released;
    }

    address public arbiter;
    mapping(bytes32 => Lock) public locks;

    error NotPayer();
    error NothingLocked();
    error AlreadyReleased();

    event Deposited(bytes32 indexed id, address indexed payer, uint256 amount);
    event Released(bytes32 indexed id, address indexed to, uint256 amount);

    constructor(address arbiter_) {
        arbiter = arbiter_;
    }

    function deposit(bytes32 id) external payable {
        if (msg.value == 0) revert NothingLocked();
        Lock storage row = locks[id];
        if (row.released) revert AlreadyReleased();
        if (row.amount != 0 && row.payer != msg.sender) revert NotPayer();
        row.payer = msg.sender;
        row.amount += msg.value;
        emit Deposited(id, msg.sender, msg.value);
    }

    function release(bytes32 id, address payable to) external {
        Lock storage row = locks[id];
        if (row.amount == 0 || row.released) revert NothingLocked();
        if (msg.sender != row.payer && msg.sender != arbiter) revert NotPayer();
        if (to == address(0)) revert NothingLocked();
        uint256 amount = row.amount;
        row.released = true;
        row.amount = 0;
        emit Released(id, to, amount);
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
`;

const LEDGER_TEST = `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openLedger } from "../server/ledger.mjs";

test("deposit then release", () => {
  const file = path.join(os.tmpdir(), "kiln-ledger-" + process.pid + ".json");
  fs.rmSync(file, { force: true });
  const ledger = openLedger(file);
  const row = ledger.deposit({ id: "iss-1", from: "alice", amount: 3 });
  assert.equal(row.amount, 3);
  assert.equal(ledger.deposit({ id: "iss-1", from: "alice", amount: 2 }).amount, 5);
  assert.throws(() => ledger.deposit({ id: "iss-1", from: "bob", amount: 1 }), /mismatch/);
  const released = ledger.release({ id: "iss-1", to: "carol" });
  assert.equal(released.released, true);
  assert.throws(() => ledger.release({ id: "iss-1", to: "dave" }), /nothing locked/);
});
`;

const WORK = `export function createBoard() {
  const items = [];
  return {
    add(title) {
      const name = String(title || "").trim();
      if (!name) throw new Error("title required");
      const item = { id: items.length + 1, title: name, done: false, subject: "__KILN_SUBJECT__" };
      items.push(item);
      return item;
    },
    list() {
      return items.map((item) => ({ ...item }));
    },
    complete(id) {
      const item = items.find((row) => row.id === id);
      if (!item) throw new Error("missing");
      item.done = true;
      return { ...item };
    },
    restore(row) {
      if (!row || !String(row.title || "").trim()) return;
      items.push({
        id: items.length + 1,
        title: String(row.title).trim(),
        done: !!row.done,
      });
    },
  };
}
`;

const WORK_TEST = `import test from "node:test";
import assert from "node:assert/strict";
import { createBoard } from "../src/domain.mjs";

test("board add and complete", () => {
  const board = createBoard();
  const item = board.add("ship the backend");
  assert.equal(item.id, 1);
  assert.equal(board.complete(1).done, true);
  assert.throws(() => board.add("  "), /title required/);
  assert.throws(() => board.complete(9), /missing/);
});
`;

const STORE = `import fs from "node:fs";
import { createBoard } from "./domain.mjs";

export function openStore(file) {
  const board = createBoard();
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const row of saved.items || []) board.restore(row);
  } catch {
    /* new store */
  }
  const save = () => fs.writeFileSync(file, JSON.stringify({ items: board.list() }, null, 2));
  return {
    add(title) {
      const item = board.add(title);
      save();
      return item;
    },
    list() {
      return board.list();
    },
    complete(id) {
      const item = board.complete(id);
      save();
      return item;
    },
  };
}
`;

const STORE_TEST = `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openStore } from "../src/store.mjs";

test("store reloads completed items", () => {
  const file = path.join(os.tmpdir(), "kiln-store-" + process.pid + "-" + Date.now() + ".json");
  fs.rmSync(file, { force: true });
  const store = openStore(file);
  const item = store.add("keep the cursor");
  store.complete(item.id);
  const again = openStore(file);
  assert.equal(again.list().length, 1);
  assert.equal(again.list()[0].title, "keep the cursor");
  assert.equal(again.list()[0].done, true);
});
`;

const CODE_SERVER = `import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openStore } from "../src/store.mjs";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function createApp(file) {
  const store = openStore(file);
  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const send = (code, body) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === "GET" && url.pathname === "/health") return send(200, { ok: true });
      if (req.method === "GET" && url.pathname === "/items") return send(200, { ok: true, items: store.list() });
      if (req.method === "POST" && url.pathname === "/items") {
        const body = await readBody(req);
        return send(200, { ok: true, item: store.add(body.title) });
      }
      if (req.method === "POST" && url.pathname === "/complete") {
        const body = await readBody(req);
        return send(200, { ok: true, item: store.complete(Number(body.id)) });
      }
      send(404, { ok: false, error: "not found" });
    } catch (e) {
      send(400, { ok: false, error: e instanceof Error ? e.message : "bad request" });
    }
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const file = path.resolve(process.env.STORE || "data/board.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  createApp(file).listen(8787, "127.0.0.1");
}
`;

const CODE_HTTP_TEST = `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/index.mjs";

test("board speaks http", async () => {
  const file = path.join(os.tmpdir(), "kiln-board-" + process.pid + "-" + Date.now() + ".json");
  fs.rmSync(file, { force: true });
  const server = createApp(file);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const post = async (p, body) => {
    const res = await fetch("http://127.0.0.1:" + port + p, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };
  try {
    const added = await post("/items", { title: "phase two" });
    assert.equal(added.ok, true);
    assert.equal(added.item.title, "phase two");
    const done = await post("/complete", { id: added.item.id });
    assert.equal(done.item.done, true);
    const listed = await fetch("http://127.0.0.1:" + port + "/items");
    const body = await listed.json();
    assert.equal(body.items.length, 1);
    const bad = await post("/items", { title: "  " });
    assert.equal(bad.ok, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
`;

const JOURNAL = `export function appendJournal(journal, entry) {
  const next = Array.isArray(journal) ? journal.slice() : [];
  next.push({
    at: entry && entry.at ? String(entry.at) : new Date().toISOString(),
    phase: String((entry && entry.phase) || ""),
    note: String((entry && entry.note) || "").slice(0, 280),
  });
  return next;
}
`;

const RUNNER = `import { closePhase, nextPhase } from "./loop.mjs";
import { appendJournal } from "./journal.mjs";

export function runOnce(bench, journal, note) {
  const phase = nextPhase(bench);
  if (!phase) return { bench, journal: journal || [], advanced: false };
  closePhase(bench, phase.id, note);
  return {
    bench,
    journal: appendJournal(journal, { phase: phase.id, note }),
    advanced: true,
    phase,
  };
}
`;

const RUNNER_TEST = `import test from "node:test";
import assert from "node:assert/strict";
import { runOnce } from "../agent/runner.mjs";

test("runner closes one phase and leaves the rest", () => {
  const bench = { phases: [{ id: "a", done: false }, { id: "b", done: false }] };
  const once = runOnce(bench, [], "charter landed");
  assert.equal(once.advanced, true);
  assert.equal(once.phase.id, "a");
  assert.equal(once.journal.length, 1);
  assert.equal(bench.phases[1].done, false);
  const again = runOnce(bench, once.journal, "loop landed");
  assert.equal(again.phase.id, "b");
  assert.equal(runOnce(bench, again.journal, "nope").advanced, false);
});
`;

const REPORT = `import { score } from "./score.mjs";

export function report(card, cases) {
  const rows = (Array.isArray(cases) ? cases : []).map((row) => ({
    id: row && row.id ? String(row.id) : "",
    ...score(card, row && row.text),
  }));
  const mean = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : 0;
  return { mean, rows };
}
`;

const REPORT_TEST = `import test from "node:test";
import assert from "node:assert/strict";
import { report } from "../model/report.mjs";

test("report averages case scores", () => {
  const card = { intent: "escrow ledger" };
  const out = report(card, [
    { id: "hit", text: "escrow ledger" },
    { id: "miss", text: "unrelated" },
  ]);
  assert.equal(out.rows.length, 2);
  assert.equal(out.rows[0].score, 1);
  assert.equal(out.rows[1].score, 0);
  assert.equal(out.mean, 0.5);
});
`;

const HTTP_LEDGER_TEST = `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/index.mjs";

test("deposit and release over http", async () => {
  const file = path.join(os.tmpdir(), "kiln-http-" + process.pid + "-" + Date.now() + ".json");
  fs.rmSync(file, { force: true });
  const server = createApp(file);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const post = async (p, body) => {
    const res = await fetch("http://127.0.0.1:" + port + p, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };
  try {
    const dep = await post("/deposit", { id: "iss-9", from: "alice", amount: 4 });
    assert.equal(dep.ok, true);
    assert.equal(dep.row.amount, 4);
    const rel = await post("/release", { id: "iss-9", to: "bob" });
    assert.equal(rel.row.released, true);
    const bad = await post("/deposit", { id: "iss-9", from: "alice", amount: 1 });
    assert.equal(bad.ok, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
`;


const AGENT_LOOP = `export function nextPhase(bench) {
  return (bench.phases || []).find((phase) => !phase.done) || null;
}

export function closePhase(bench, id, note) {
  const phase = (bench.phases || []).find((row) => row.id === id);
  if (!phase) throw new Error("unknown phase");
  if (phase.done) return bench;
  phase.done = true;
  phase.note = String(note || "").slice(0, 280);
  return bench;
}
`;

const AGENT_TEST = `import test from "node:test";
import assert from "node:assert/strict";
import { closePhase, nextPhase } from "../agent/loop.mjs";

test("closes one phase and moves the cursor", () => {
  const bench = { phases: [{ id: "a", done: false }, { id: "b", done: false }] };
  assert.equal(nextPhase(bench).id, "a");
  closePhase(bench, "a", "charter landed");
  assert.equal(nextPhase(bench).id, "b");
  assert.throws(() => closePhase(bench, "nope", ""), /unknown phase/);
});
`;

const SCORE = `export function score(card, text) {
  const words = new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const keys = String((card && card.intent) || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const hits = keys.filter((key) => words.has(key));
  return { score: keys.length ? hits.length / keys.length : 0, hits: hits.length, of: keys.length };
}
`;

const SCORE_TEST = `import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../model/score.mjs";

test("score counts overlapping intent words", () => {
  const card = { intent: "escrow backend ledger" };
  const hit = score(card, "the escrow ledger is the backend");
  assert.equal(hit.hits, 3);
  assert.equal(hit.score, 1);
  assert.equal(score(card, "unrelated").hits, 0);
});
`;

const INFER = `import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { score } from "../model/score.mjs";

export function createInfer(cardPath) {
  const card = JSON.parse(fs.readFileSync(cardPath, "utf8"));
  return createServer(async (req, res) => {
    if (req.method !== "POST" || new URL(req.url || "/", "http://127.0.0.1").pathname !== "/score") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const result = score(card, body.text || "");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...result }));
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  createInfer(path.resolve("model/card.json")).listen(8788, "127.0.0.1");
}
`;

function runbook(spec, cursor) {
  const run =
    spec.kind === "crypto" || spec.kind === "code"
      ? "node server/index.mjs"
      : spec.kind === "model"
        ? "node server/infer.mjs"
        : "node --test";
  return `# ${spec.name}\n\nThis computer is a bench. It is not a one-shot.\nCursor ${cursor} of ${spec.phases.length}. A write is a git commit. Stop at the cursor.\n\nKind: ${spec.kind}\n\n\`\`\`\nnode --test\n${run}\n\`\`\`\n\n${spec.prompt}\n`;
}

function pkg(name, start) {
  const scripts = { test: "node --test" };
  if (start) scripts.start = start;
  return JSON.stringify({ name, private: true, type: "module", scripts }, null, 2) + "\n";
}

function kilnJson(spec) {
  return (
    JSON.stringify(
      {
        name: spec.name,
        kind: spec.kind,
        bench: true,
        oneshot: false,
        horizon: spec.phases.map((p) => p.id),
        prompt: spec.prompt.slice(0, 280),
      },
      null,
      2,
    ) + "\n"
  );
}

export function planBench({ kind, prompt, name }) {
  const k = inferKind(kind, prompt);
  const title = slug(name, prompt);
  const brief = String(prompt || "Continue this bench.").trim().slice(0, 800);
  const spec = { kind: k, name: title, prompt: brief, subject: subjectOf(brief), seen: "", phases: [] };
  if (k === "crypto") {
    spec.phases = [
      { id: "charter", title: "Charter the bench", files: ["BENCH.md", "index.html", "kiln.json", "README.md"] },
      { id: "contract", title: "Escrow contract", files: ["contracts/Escrow.sol"] },
      { id: "ledger", title: "Ledger", files: ["server/ledger.mjs"] },
      { id: "http", title: "Ledger HTTP API", files: ["server/index.mjs", "package.json"] },
      { id: "ledger-tests", title: "Ledger tests", files: ["test/ledger.test.mjs"] },
      { id: "http-tests", title: "HTTP tests", files: ["test/http.test.mjs"] },
    ];
  } else if (k === "agent") {
    spec.phases = [
      { id: "charter", title: "Charter the bench", files: ["BENCH.md", "index.html", "kiln.json", "README.md", "AGENT.md"] },
      { id: "loop", title: "Phase loop", files: ["agent/loop.mjs"] },
      { id: "journal", title: "Journal", files: ["agent/journal.mjs"] },
      { id: "runner", title: "One-phase runner", files: ["agent/runner.mjs"] },
      { id: "tests", title: "Runner tests", files: ["test/loop.test.mjs", "test/runner.test.mjs", "package.json"] },
    ];
  } else if (k === "model") {
    spec.phases = [
      { id: "charter", title: "Charter the bench", files: ["BENCH.md", "index.html", "kiln.json", "README.md"] },
      { id: "card", title: "Model card and score", files: ["model/card.json", "model/score.mjs"] },
      { id: "server", title: "Score server", files: ["server/infer.mjs", "package.json"] },
      { id: "tests", title: "Score tests", files: ["test/score.test.mjs"] },
      { id: "report", title: "Eval report", files: ["model/eval.json", "model/report.mjs", "test/report.test.mjs"] },
    ];
  } else {
    spec.phases = [
      { id: "charter", title: "Charter the bench", files: ["BENCH.md", "index.html", "kiln.json", "README.md"] },
      { id: "domain", title: "Domain", files: ["src/domain.mjs"] },
      { id: "store", title: "Durable store", files: ["src/store.mjs"] },
      { id: "http", title: "HTTP API", files: ["server/index.mjs", "package.json"] },
      { id: "domain-tests", title: "Domain tests", files: ["test/domain.test.mjs"] },
      { id: "store-tests", title: "Store tests", files: ["test/store.test.mjs"] },
      { id: "http-tests", title: "HTTP tests", files: ["test/http.test.mjs"] },
    ];
  }
  return spec;
}

function stampFile(rel, body, spec) {
  if (!body) return "";
  const subject = spec.subject || subjectOf(spec.prompt || "");
  const safe = String(subject).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let next = String(body).replaceAll("__KILN_SUBJECT__", safe).replaceAll("__KILN_CONTRACT__", contractName(subject));
  const mark = `// brief: ${subject}\n// tree: ${spec.seen || ""}\n`;
  if (/\.(mjs|js|sol)$/.test(rel) && !next.includes("// brief:")) {
    if (next.startsWith("// SPDX")) {
      const nl = next.indexOf("\n");
      next = next.slice(0, nl + 1) + mark + next.slice(nl + 1);
    } else next = mark + next;
  }
  return next;
}

function fileBody(spec, rel, cursor) {
  return stampFile(rel, unstamped(spec, rel, cursor), spec);
}

function unstamped(spec, rel, cursor) {
  if (rel === "BENCH.md") return charter({ ...spec, cursor });
  if (rel === "index.html") return capsule({ ...spec, cursor });
  if (rel === "kiln.json") return kilnJson(spec);
  if (rel === "README.md") return runbook(spec, cursor);
  if (rel === "contracts/Escrow.sol") return ESCROW;
  if (rel === "server/ledger.mjs") return LEDGER;
  if (rel === "server/index.mjs") return spec.kind === "crypto" ? LEDGER_SERVER : CODE_SERVER;
  if (rel === "test/ledger.test.mjs") return LEDGER_TEST;
  if (rel === "test/http.test.mjs") return spec.kind === "crypto" ? HTTP_LEDGER_TEST : CODE_HTTP_TEST;
  if (rel === "package.json") {
    const start = spec.kind === "crypto" || spec.kind === "code" ? "node server/index.mjs" : spec.kind === "model" ? "node server/infer.mjs" : "";
    return pkg(spec.name, start);
  }
  if (rel === "src/domain.mjs") return WORK;
  if (rel === "src/store.mjs") return STORE;
  if (rel === "test/domain.test.mjs") return WORK_TEST;
  if (rel === "test/store.test.mjs") return STORE_TEST;
  if (rel === "agent/loop.mjs") return AGENT_LOOP;
  if (rel === "agent/journal.mjs") return JOURNAL;
  if (rel === "agent/runner.mjs") return RUNNER;
  if (rel === "test/loop.test.mjs") return AGENT_TEST;
  if (rel === "test/runner.test.mjs") return RUNNER_TEST;
  if (rel === "AGENT.md") {
    return `# Agent ${spec.name}\n\nThis repository is the agent.\nRead BENCH.md. Close one phase. Commit. Stop.\nDo not one-shot the rest of the horizon.\n`;
  }
  if (rel === "model/score.mjs") return SCORE;
  if (rel === "model/report.mjs") return REPORT;
  if (rel === "test/score.test.mjs") return SCORE_TEST;
  if (rel === "test/report.test.mjs") return REPORT_TEST;
  if (rel === "server/infer.mjs") return INFER;
  if (rel === "model/eval.json") {
    return JSON.stringify({ cases: [{ id: "brief", text: spec.prompt }] }, null, 2) + "\n";
  }
  if (rel === "model/card.json") {
    return JSON.stringify({ name: spec.name, intent: spec.prompt, kind: "bench-card" }, null, 2) + "\n";
  }
  return "";
}

export function phaseFiles(spec, index) {
  const phase = spec.phases[index];
  if (!phase) return [];
  const cursor = index + 1;
  const names = new Set(phase.files);
  if (index > 0) {
    names.add("BENCH.md");
    names.add("index.html");
    names.add("README.md");
  }
  return [...names].map((rel) => ({ path: rel, content: fileBody(spec, rel, cursor) }));
}

function benchPath(repoId) {
  return path.join(spaceHome(repoId), ".kiln", "bench.json");
}

export function readBench(repoId) {
  try {
    return JSON.parse(fs.readFileSync(benchPath(repoId), "utf8"));
  } catch {
    return null;
  }
}

function saveBench(repoId, bench) {
  fs.mkdirSync(path.dirname(benchPath(repoId)), { recursive: true });
  fs.writeFileSync(benchPath(repoId), JSON.stringify(bench, null, 2));
}

export function openBench(repoId, input) {
  bootSpace({ repoId, owner: String(repoId).split("/")[0] });
  const existing = readBench(repoId);
  if (existing) return existing;
  const spec = planBench(input || {});
  const bench = {
    id: "b" + Date.now().toString(36),
    repoId,
    kind: spec.kind,
    name: spec.name,
    prompt: spec.prompt,
    cursor: 0,
    status: "working",
    phases: spec.phases.map((p) => ({ id: p.id, title: p.title, done: false })),
    openedAt: new Date().toISOString(),
  };
  saveBench(repoId, bench);
  return bench;
}

export function holdBench(repoId) {
  const bench = readBench(repoId);
  if (!bench) return null;
  bench.status = "held";
  bench.updatedAt = new Date().toISOString();
  saveBench(repoId, bench);
  return bench;
}

export function resumeBench(repoId) {
  const bench = readBench(repoId);
  if (!bench) return null;
  if (bench.cursor < bench.phases.length) bench.status = "working";
  else bench.status = "open";
  bench.updatedAt = new Date().toISOString();
  saveBench(repoId, bench);
  return bench;
}

function treeGlance(dir) {
  const names = [];
  function walk(d, prefix, depth) {
    if (depth > 6 || names.length >= 40) return;
    let ents = [];
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    ents.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of ents) {
      if (names.length >= 40) return;
      if (e.name === ".git" || e.name === ".kiln" || e.name === "node_modules") continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), rel, depth + 1);
      else names.push(rel);
    }
  }
  walk(dir, "", 0);
  return names.join(" ");
}

export function advanceBench(repoId, opts) {
  const force = !!(opts && opts.force);
  const bench = readBench(repoId);
  if (!bench) return { ok: false, error: "no bench" };
  if (bench.cursor >= bench.phases.length) {
    if (bench.status !== "open") {
      bench.status = "open";
      saveBench(repoId, bench);
    }
    return { ok: true, advanced: false, done: true, bench, files: [] };
  }
  if (bench.status === "held" && !force) {
    return { ok: true, advanced: false, held: true, done: false, bench, files: [] };
  }
  const wasHeld = bench.status === "held";
  const spec = planBench(bench);
  spec.seen = treeGlance(spaceHome(repoId));
  const index = bench.cursor;
  const files = phaseFiles(spec, index);
  const dir = spaceHome(repoId);
  const writes = [];
  for (const file of files) {
    const out = writeOnTree(dir, file.path, file.content, `bench ${bench.phases[index].id}: ${file.path}`);
    if (out.ok) writes.push({ path: out.path, bytes: out.bytes, commit: out.commit });
  }
  bench.phases[index].done = true;
  bench.phases[index].at = new Date().toISOString();
  bench.subject = spec.subject;
  bench.seen = spec.seen;
  bench.cursor = index + 1;
  bench.updatedAt = bench.phases[index].at;
  if (bench.cursor >= bench.phases.length) bench.status = "open";
  else if (wasHeld) bench.status = "held";
  else bench.status = bench.status === "held" ? "held" : "working";
  saveBench(repoId, bench);
  return {
    ok: true,
    advanced: true,
    done: bench.cursor >= bench.phases.length,
    phase: bench.phases[index],
    bench,
    files,
    writes,
  };
}
