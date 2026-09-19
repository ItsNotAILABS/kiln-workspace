/**
 * swarm-proxy tests: the server-side daemon proxy against a REAL stub HTTP
 * daemon (real HTTP, stub responses). Covers the honest down-state, auth,
 * plan validation, and every proxy method. Run:
 *   node --experimental-strip-types --test src/lib/kiln/swarm-proxy.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getDaemonStatus,
  listSwarmNodes,
  listSwarmJobs,
  submitSwarmJob,
  spawnSwarmNode,
  stopSwarmNode,
  getSwarmNodeLogs,
  verifySwarmReceipts,
  listGitRepos,
  SwarmDownError,
  SWARM_DOWN_FIX,
} from "./swarm-proxy.ts";

const TOKEN = "test-token-123";

const STUB_NODES = [
  {
    id: "abcdef0123456789",
    name: "stub-1",
    status: "idle",
    workerPid: 4242,
    caps: 15,
    capNames: ["commit", "release", "propose", "delegate"],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    expired: false,
    parent: null,
    mind: "script",
    repo: null,
  },
];

const STUB_JOBS = [
  { id: "job_stub1", name: "stub-job", status: "done", node: "abcdef0123456789", summary: "plan complete: 1/1 steps ok" },
];

let server: ReturnType<typeof createServer>;
let baseUrl = "";
let lastAuth = "";
let gitAuthSeen = "<unset>";

function json(res: ServerResponse<IncomingMessage>, code: number, obj: unknown) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(body);
}

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true, version: 1 });
    // /git is PUBLIC on the real daemon (no token needed, none expected)
    if (req.method === "GET" && url.pathname === "/git") {
      gitAuthSeen = req.headers.authorization || "";
      return json(res, 200, {
        repos: [{ owner: "auro", repo: "auro", createdAt: "2026-09-19T00:15:15.420Z" }],
      });
    }
    const auth = req.headers.authorization || "";
    lastAuth = auth;
    if (auth !== `Bearer ${TOKEN}`) return json(res, 401, { error: "unauthorized" });
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const b = body ? JSON.parse(body) : {};
      if (req.method === "GET" && url.pathname === "/nodes") return json(res, 200, { nodes: STUB_NODES });
      if (req.method === "POST" && url.pathname === "/nodes") {
        if (!b.name) return json(res, 400, { error: "name is required" });
        return json(res, 201, { id: "newnodeid123456", name: b.name });
      }
      if (req.method === "GET" && url.pathname === "/jobs") return json(res, 200, { jobs: STUB_JOBS });
      if (req.method === "POST" && url.pathname === "/jobs") {
        if (!b.plan || !Array.isArray(b.plan.steps)) return json(res, 400, { error: "plan.steps[] is required" });
        return json(res, 201, { id: "job_new1", name: b.name || "job" });
      }
      const stopM = url.pathname.match(/^\/nodes\/([^/]+)\/stop$/);
      if (req.method === "POST" && stopM) return json(res, 200, { ok: true });
      const logsM = url.pathname.match(/^\/nodes\/([^/]+)\/logs$/);
      if (req.method === "GET" && logsM) return json(res, 200, { stream: "stdout", tail: 50, log: "[stub] worker up\n" });
      if (req.method === "POST" && url.pathname === "/receipts/verify") {
        return json(res, 200, {
          results: [{ node: STUB_NODES[0].id, name: "stub-1", ok: true, count: 3, error: null }],
          allOk: true,
        });
      }
      return json(res, 404, { error: "not found" });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  const dir = mkdtempSync(join(tmpdir(), "kiln-proxy-test-"));
  writeFileSync(join(dir, "daemon.json"), JSON.stringify({ pid: process.pid, apiUrl: baseUrl, startedAt: new Date().toISOString() }));
  writeFileSync(join(dir, "api.token"), TOKEN);
  process.env.KILN_SWARM_DIR = dir;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("swarm-proxy against a stub daemon", () => {
  it("reports the daemon up with its pid", async () => {
    const s = await getDaemonStatus();
    assert.equal(s.up, true);
    assert.equal(s.pid, process.pid);
    assert.equal(s.fix, null);
  });

  it("lists nodes through the proxy", async () => {
    const nodes = await listSwarmNodes();
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].name, "stub-1");
    assert.deepEqual(nodes[0].capNames, ["commit", "release", "propose", "delegate"]);
  });

  it("sends the bearer token, never a guess", async () => {
    await listSwarmJobs();
    assert.equal(lastAuth, `Bearer ${TOKEN}`);
  });

  it("lists jobs with summaries", async () => {
    const jobs = await listSwarmJobs();
    assert.equal(jobs[0].id, "job_stub1");
    assert.match(jobs[0].summary || "", /plan complete/);
  });

  it("rejects a bad plan before any HTTP", async () => {
    await assert.rejects(() => submitSwarmJob({ plan: { steps: [] } }), /plan\.steps/);
    await assert.rejects(() => submitSwarmJob({ plan: { steps: [{ tool: "" }] } } as never), /tool name/);
  });

  it("submits a good plan", async () => {
    const r = await submitSwarmJob({ name: "t", plan: { steps: [{ tool: "fs.list", args: {} }] } });
    assert.equal(r.id, "job_new1");
  });

  it("spawns a node (name required)", async () => {
    await assert.rejects(() => spawnSwarmNode({ name: "  ", caps: 15 }), /name is required/);
    const r = await spawnSwarmNode({ name: "n1", caps: 9 });
    assert.equal(r.id, "newnodeid123456");
  });

  it("stops a node, reads logs, verifies receipts", async () => {
    await stopSwarmNode("abcdef0123456789");
    const logs = await getSwarmNodeLogs("abcdef0123456789");
    assert.match(logs.log, /worker up/);
    const v = await verifySwarmReceipts();
    assert.equal(v.allOk, true);
    assert.equal(v.results[0].count, 3);
  });

  it("lists KILN-native git repos without sending any token", async () => {
    gitAuthSeen = "<unset>";
    const repos = await listGitRepos();
    assert.equal(repos.length, 1);
    assert.equal(repos[0].owner, "auro");
    assert.equal(repos[0].repo, "auro");
    assert.equal(repos[0].cloneUrl, `${baseUrl}/git/auro/auro`);
    assert.equal(gitAuthSeen, "", "public /git must not carry an Authorization header");
  });

  it("is honest when the daemon is down: status says down + fix, calls throw SwarmDownError", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kiln-proxy-down-"));
    writeFileSync(join(dir, "daemon.json"), JSON.stringify({ pid: process.pid, apiUrl: "http://127.0.0.1:1" }));
    writeFileSync(join(dir, "api.token"), TOKEN);
    process.env.KILN_SWARM_DIR = dir;
    const s = await getDaemonStatus();
    assert.equal(s.up, false);
    assert.equal(s.fix, SWARM_DOWN_FIX);
    await assert.rejects(() => listSwarmNodes(), (e: unknown) => {
      assert.ok(e instanceof SwarmDownError);
      assert.equal((e as SwarmDownError).fix, SWARM_DOWN_FIX);
      return true;
    });
  });

  it("surfaces a 401 as a token problem, not a crash", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kiln-proxy-401-"));
    writeFileSync(join(dir, "daemon.json"), JSON.stringify({ pid: process.pid, apiUrl: baseUrl }));
    writeFileSync(join(dir, "api.token"), "wrong-token");
    process.env.KILN_SWARM_DIR = dir;
    await assert.rejects(() => listSwarmNodes(), /401/);
  });
});
