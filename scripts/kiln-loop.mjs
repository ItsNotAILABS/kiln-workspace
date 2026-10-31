/**
 * Studio loop: one surface for job → worktree → diff → tests → live → pull.
 * Crew writes land on a worktree. Merge is gated. Live is a real origin.
 * Walk-away jobs run without the seat staying open.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { sessionAccount, bearerFrom, ownsRepo, loadUserRepos, canReadRepo, sessionSecret, updateSeat, clientKind } from "./kiln-accounts.mjs";
import {
  spaceHome,
  bootSpace,
  rememberSpace,
  openWorktree,
  dropWorktree,
  writeOnTree,
  gitDiff,
  gitStatus,
  runTests,
  mergeWorktree,
  livePath,
  listLive,
  gitRev,
  worktreeDir,
  ensureCapsule,
  isHtmlCapsule,
} from "./kiln-space.mjs";
import { runAgentTurn } from "./agent-turn.mjs";
import { githubOpenPull, githubPushBranch } from "./github-engine.mjs";
import { domainOrigin } from "./kiln-domain.mjs";
import { advanceBench, holdBench, openBench, readBench, resumeBench } from "./kiln-bench.mjs";
import { readOutside, readCrew, runIngestTool, phoneCard, publicForge } from "./kiln-ingest.mjs";
import { listSpace, recallMemory } from "./kiln-space.mjs";
import { sitComputer } from "./kiln-sit.mjs";
import { boardGpu, claimGpu, offerGpu, receiptGpu } from "./kiln-gpu.mjs";
import { buyProduct, catalog, claimOpening, listProduct, tillView, transferNote } from "./kiln-market.mjs";
import { loadWallet, signLedger } from "./kiln-wallet.mjs";
import { noteChecks, receiptOf, repoBoard } from "./kiln-board.mjs";
import { shipComputer } from "./kiln-ship.mjs";
import { allowSignup, openAgentSeat, seatFromProvider } from "./kiln-signup.mjs";
import { openPage, siteMap } from "./kiln-nav.mjs";
import { reviewSeat } from "./kiln-review.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const QUEUE = path.join(ROOT, "data", "backend", "loop-queue.json");
const running = new Set();
const benchChains = new Set();

const LIVE_MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".py": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

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

function parseBody(req) {
  try {
    return JSON.parse(req.bodyText || "{}");
  } catch {
    return {};
  }
}

function accOf(req) {
  const tok = bearerFrom({ authorization: req.authorization, token: req.query?.token || parseBody(req).token });
  return { tok, acc: sessionAccount(tok) };
}

function repoOf(data, acc) {
  const raw = String(data.repoId || data.repo || "").trim();
  if (raw) return raw;
  if (acc && acc.handle) return `${acc.handle}/home`;
  return "";
}

function gateWrite(acc, repoId) {
  if (!acc) return { ok: false, status: 401, error: "sign in" };
  if (!repoId) return { ok: false, status: 400, error: "repo required" };
  const owner = String(repoId).split("/")[0];
  if (owner === "kiln") return { ok: false, status: 403, error: "kiln origin is sealed" };
  if (!ownsRepo(acc.handle, repoId) && acc.handle !== owner) {
    return { ok: false, status: 403, error: "not your computer" };
  }
  return { ok: true };
}

function visibilityOf(repoId) {
  const owner = String(repoId).split("/")[0];
  const doc = loadUserRepos(owner);
  const rec = (doc.repos || []).find((r) => r.id === repoId || r.name === String(repoId).split("/").slice(1).join("/"));
  if (!rec) return "private";
  return rec.visibility === "public" ? "public" : "private";
}

function jobsDir(repoId) {
  const dir = path.join(spaceHome(repoId), ".kiln", "jobs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function jobFile(repoId, id) {
  return path.join(jobsDir(repoId), `${id}.json`);
}

function loadJob(repoId, id) {
  return readJson(jobFile(repoId, id), null);
}

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    repoId: job.repoId,
    handle: job.handle,
    brief: job.brief,
    status: job.status,
    branch: job.branch,
    commit: job.commit,
    walkAway: !!job.walkAway,
    writes: job.writes || [],
    filesChanged: job.filesChanged || [],
    tests: job.tests
      ? { ok: job.tests.ok, passed: job.tests.passed, failed: job.tests.failed }
      : null,
    pull: job.pull || null,
    live: job.live || null,
    turn: job.turn ? { ok: job.turn.ok, text: String(job.turn.text || "").slice(0, 400) } : null,
    error: job.error || null,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    mergedAt: job.mergedAt || null,
  };
}

function saveJob(job) {
  writeJson(jobFile(job.repoId, job.id), job);
  const indexFile = path.join(jobsDir(job.repoId), "index.json");
  const idx = readJson(indexFile, { repoId: job.repoId, jobs: [] });
  const row = {
    id: job.id,
    status: job.status,
    brief: String(job.brief || "").slice(0, 140),
    commit: job.commit || null,
    queuedAt: job.queuedAt,
    walkAway: !!job.walkAway,
  };
  idx.jobs = [row, ...(idx.jobs || []).filter((j) => j.id !== job.id)].slice(0, 80);
  writeJson(indexFile, idx);
  const q = readJson(QUEUE, { jobs: [] });
  const qrow = { id: job.id, repoId: job.repoId, status: job.status, walkAway: !!job.walkAway, queuedAt: job.queuedAt };
  q.jobs = [qrow, ...(q.jobs || []).filter((j) => !(j.id === job.id && j.repoId === job.repoId))].slice(0, 200);
  writeJson(QUEUE, q);
  return job;
}

function newJobId() {
  return "j" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function twinOf(repoId, extra) {
  const dir = spaceHome(repoId);
  const fromDisk = readJson(path.join(dir, ".kiln", "github.json"), null);
  const owner = extra?.owner || fromDisk?.owner || "";
  const repo = extra?.repo || extra?.name || fromDisk?.repo || fromDisk?.name || "";
  if (owner && repo) return { owner, repo, defaultBranch: extra?.base || fromDisk?.defaultBranch || "main" };
  return null;
}

function saveTwin(repoId, twin) {
  if (!twin || !twin.owner || !twin.repo) return;
  writeJson(path.join(spaceHome(repoId), ".kiln", "github.json"), {
    owner: twin.owner,
    repo: twin.repo,
    defaultBranch: twin.defaultBranch || "main",
    at: new Date().toISOString(),
  });
}

function applyToolCalls(treeDir, toolCalls, repoId) {
  const writes = [];
  let commit = gitRev(treeDir);
  const list = Array.isArray(toolCalls) ? toolCalls : [];
  for (const tc of list) {
    const name = tc.name || tc.function?.name || "";
    let args = {};
    try {
      args = typeof tc.argsJson === "string" ? JSON.parse(tc.argsJson || "{}") : tc.args || tc.arguments || {};
    } catch {
      args = {};
    }
    if (name !== "kiln_write_file" && name !== "write_file") continue;
    const rel = args.path || args.file || args.dest;
    if (!rel || typeof args.content !== "string") continue;
    const out = writeOnTree(treeDir, rel, args.content, args.message || `job: ${rel}`);
    if (out.ok) {
      writes.push({ path: out.path, commit: out.commit, bytes: out.bytes });
      commit = out.commit;
    }
  }
  return { writes, commit, repoId };
}

async function runJob(job) {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  saveJob(job);
  const wt = openWorktree({ repoId: job.repoId, jobId: job.id });
  if (!wt.ok) {
    job.status = "error";
    job.error = wt.error;
    saveJob(job);
    return job;
  }
  job.branch = wt.branch;
  job.worktree = wt.worktree;
  saveJob(job);
  let turn;
  try {
    turn = await runAgentTurn({
      repoId: job.repoId,
      handle: job.handle,
      role: "builder",
      messages: [{ role: "user", content: job.brief }],
    });
  } catch (e) {
    job.status = "error";
    job.error = e instanceof Error ? e.message : "turn failed";
    saveJob(job);
    return job;
  }
  job.turn = { ok: turn.ok, text: String(turn.text || "").slice(0, 2000) };
  const applied = applyToolCalls(wt.worktree, turn.toolCalls || [], job.repoId);
  const repaired = ensureCapsule(wt.worktree, job.repoId, { brief: job.brief, writes: applied.writes });
  job.writes = repaired.writes || applied.writes;
  job.commit = (job.writes || []).at(-1)?.commit || applied.commit;
  const diff = gitDiff({ repoId: job.repoId, jobId: job.id });
  job.filesChanged = (diff.files || []).map((f) => f.path);
  const tests = runTests({ repoId: job.repoId, jobId: job.id });
  job.tests = tests;
  job.status = tests.ok ? "needs_review" : "tests_failed";
  job.finishedAt = new Date().toISOString();
  saveJob(job);
  rememberSpace({
    repoId: job.repoId,
    kind: "procedural",
    text: `job ${job.id} ${job.status} · ${(job.writes || []).length} writes`,
  });
  return job;
}

function kick(job) {
  if (!job || running.has(job.id)) return;
  running.add(job.id);
  setImmediate(() => {
    runJob(job)
      .catch((e) => {
        job.status = "error";
        job.error = e instanceof Error ? e.message : "job failed";
        saveJob(job);
      })
      .finally(() => running.delete(job.id));
  });
}

function resumeQueued() {
  const q = readJson(QUEUE, { jobs: [] });
  for (const row of q.jobs || []) {
    if (!row.walkAway) continue;
    if (row.status !== "queued" && row.status !== "running") continue;
    const job = loadJob(row.repoId, row.id);
    if (!job) continue;
    if (job.status === "queued" || job.status === "running") kick(job);
  }
}

function liveUrl(origin, repoId, { jobId, token } = {}) {
  const [owner, ...rest] = String(repoId).split("/");
  const name = rest.join("/") || "home";
  const custom = owner ? domainOrigin(owner) : "";
  const base = (custom || origin || "").replace(/\/+$/, "");
  let href = `${base}/live/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/`;
  const q = [];
  if (jobId) q.push("job=" + encodeURIComponent(jobId));
  if (token) q.push("token=" + encodeURIComponent(token));
  if (q.length) href += "?" + q.join("&");
  return href;
}

function listingHtml(repoId, files, origin, { jobId } = {}) {
  const [owner, ...rest] = String(repoId).split("/");
  const name = rest.join("/") || "home";
  const iso = `kiln://${repoId}`;
  const rows = (files || [])
    .slice(0, 80)
    .map((f) => {
      const href = `${origin.replace(/\/+$/, "")}/live/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${String(f.path).split("/").map(encodeURIComponent).join("/")}${jobId ? "?job=" + encodeURIComponent(jobId) : ""}`;
      return `<li><a href="${href}">${f.path}</a><span>${f.size || 0}</span></li>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${iso}</title>
<style>
  :root{color-scheme:dark;--bg:#0b0b0d;--fg:#e7e7ea;--muted:#8a8a93;--line:#26262f;--surface:#141418}
  html,body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
  main{max-width:40rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}
  h1{margin:0 0 .35rem;font-size:1.15rem;font-weight:600;letter-spacing:-.02em}
  p{margin:0 0 1.25rem;color:var(--muted);font-size:12px}
  ul{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
  li{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0;border-bottom:1px solid var(--line)}
  a{color:var(--fg);text-decoration:none}
  a:hover{text-decoration:underline}
  span{color:var(--muted);font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
</style>
<main>
  <h1>${iso}</h1>
  <p>Live capsule on this computer${jobId ? " · job " + jobId : ""}. A write is a git commit.</p>
  <ul>${rows || "<li>Empty tree.</li>"}</ul>
</main>
</html>`;
}

function rewriteHtml(html, baseHref) {
  const body = String(html || "");
  if (/<base\s/i.test(body)) return body;
  if (/<head[^>]*>/i.test(body)) return body.replace(/<head[^>]*>/i, (m) => `${m}<base href="${baseHref}">`);
  if (/<html[^>]*>/i.test(body)) return body.replace(/<html[^>]*>/i, (m) => `${m}<head><base href="${baseHref}"></head>`);
  return `<!doctype html><head><base href="${baseHref}"></head>${body}`;
}

function wallHtml(repoId) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>private computer</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0b0b0d;color:#e7e7ea;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;display:grid;min-height:100dvh;place-items:center;padding:2rem}main{max-width:22rem}h1{font-size:1.05rem;font-weight:600;margin:0 0 .4rem}p{margin:0;color:#8a8a93;font-size:13px}a{color:#e7e7ea}</style>
<main><h1>This computer is private</h1><p>Sign in as the owner to open <code>kiln://${repoId}</code>. <a href="/login">Enter your seat</a>.</p></main></html>`;
}

export async function serveLive(req) {
  const pathname = String(req.pathname || "");
  const m = pathname.match(/^\/live\/([^/]+)\/([^/]+)\/?(.*)$/);
  if (!m) {
    return json(400, { ok: false, error: "live path is /live/{owner}/{name}/" });
  }
  const owner = decodeURIComponent(m[1]);
  const name = decodeURIComponent(m[2]);
  const rest = decodeURIComponent(m[3] || "");
  const repoId = `${owner}/${name}`;
  const jobId = String(req.query?.job || "").replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 48) || "";
  const { acc } = accOf(req);
  const vis = visibilityOf(repoId);
  if (!canReadRepo(acc?.handle || null, repoId, vis)) {
    return {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      body: wallHtml(repoId),
    };
  }
  bootSpace({ repoId, owner });
  const origin = req.origin || "";
  const baseHref = `${origin.replace(/\/+$/, "")}/live/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/`;
  let found = livePath(repoId, rest || "index.html", { jobId: jobId || undefined });
  if ((!found || !found.file) && jobId) found = livePath(repoId, rest || "index.html", {});
  if (found && found.file && ( !rest || rest === "index.html") && path.extname(found.file).toLowerCase() === ".html") {
    try {
      const peek = fs.readFileSync(found.file, "utf8");
      if (!isHtmlCapsule(peek)) found = { ...found, file: null };
    } catch {
      found = { ...found, file: null };
    }
  }
  const headersBase = {
    "cache-control": "no-store",
    "x-kiln-isolation": `kiln://${repoId}`,
    "content-security-policy": "sandbox allow-scripts allow-forms allow-same-origin; default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
    "access-control-allow-origin": "*",
  };
  if (found && found.file) {
    const ext = path.extname(found.file).toLowerCase();
    const mime = LIVE_MIME[ext] || "application/octet-stream";
    let body = fs.readFileSync(found.file);
    if (ext === ".html") {
      body = rewriteHtml(body.toString("utf8"), baseHref);
      return { status: 200, headers: { ...headersBase, "content-type": mime }, body };
    }
    return { status: 200, headers: { ...headersBase, "content-type": mime, "content-length": body.length }, body };
  }
  const files = listLive(repoId, { jobId: jobId || undefined });
  return {
    status: 200,
    headers: { ...headersBase, "content-type": "text/html; charset=utf-8" },
    body: listingHtml(repoId, files, origin, { jobId }),
  };
}

function queueJob({ acc, repoId, brief, walkAway, origin, token }) {
  const id = newJobId();
  bootSpace({ repoId, owner: acc.handle });
  const wt = openWorktree({ repoId, jobId: id });
  if (!wt.ok) return { ok: false, error: wt.error };
  const job = {
    id,
    repoId,
    handle: acc.handle,
    brief: String(brief || "write the next real file").slice(0, 4000),
    status: walkAway ? "queued" : "running",
    walkAway: !!walkAway,
    branch: wt.branch,
    worktree: wt.worktree,
    commit: wt.head,
    writes: [],
    filesChanged: [],
    live: liveUrl(origin || "", repoId, { jobId: id }),
    queuedAt: new Date().toISOString(),
  };
  saveJob(job);
  rememberSpace({ repoId, kind: "episodic", text: `queued job ${id}` });
  if (walkAway) kick(job);
  return { ok: true, job: publicJob(job), worktree: { branch: wt.branch, reused: wt.reused } };
}

const BENCH_BEAT_MS = 4000;

function scheduleBench(repoId) {
  if (benchChains.has(repoId)) return;
  benchChains.add(repoId);
  const step = () => {
    let out;
    try {
      const cur = readBench(repoId);
      if (!cur || cur.status !== "working") {
        benchChains.delete(repoId);
        return;
      }
      out = advanceBench(repoId);
    } catch {
      benchChains.delete(repoId);
      return;
    }
    if (!out || !out.ok || !out.advanced || out.bench?.status !== "working") {
      benchChains.delete(repoId);
      return;
    }
    setTimeout(step, BENCH_BEAT_MS);
  };
  setTimeout(step, BENCH_BEAT_MS);
}

function benchPayload(bench) {
  return {
    id: bench.id,
    repoId: bench.repoId,
    kind: bench.kind,
    name: bench.name,
    prompt: bench.prompt,
    cursor: bench.cursor,
    status: bench.status || "working",
    done: bench.cursor >= bench.phases.length,
    phases: bench.phases,
  };
}

function benchView(repoId) {
  const bench = readBench(repoId);
  if (!bench) return null;
  const files = listSpace(repoId).filter((file) => typeof file.content === "string");
  return { ok: true, bench: benchPayload(bench), files };
}

async function openPull({ acc, job, origin, github, title, body }) {
  const twin = twinOf(job.repoId, github);
  if (twin) saveTwin(job.repoId, twin);
  const dir = spaceHome(job.repoId);
  const branch = job.branch || `kiln/job-${job.id}`;
  const pullTitle = title || String(job.brief || branch).slice(0, 72);
  const pullBody = body || `Kiln job ${job.id} on ${job.repoId}\n\n${job.brief || ""}\n\nLive: ${job.live || liveUrl(origin || "", job.repoId, { jobId: job.id })}`;
  const rec = {
    id: job.id,
    repoId: job.repoId,
    branch,
    title: pullTitle,
    body: pullBody,
    at: new Date().toISOString(),
    status: "open",
  };
  if (twin) {
    const pushed = await githubPushBranch({ dir, owner: twin.owner, repo: twin.repo, branch });
    rec.push = pushed;
    if (pushed.ok) {
      const gh = await githubOpenPull({
        owner: twin.owner,
        repo: twin.repo,
        head: branch,
        base: twin.defaultBranch || "main",
        title: pullTitle,
        body: pullBody,
      });
      rec.github = gh;
      if (gh.ok) rec.url = gh.url;
    }
    rec.compareUrl = `https://github.com/${twin.owner}/${twin.repo}/compare/${twin.defaultBranch || "main"}...${branch}?expand=1`;
    if (!rec.url) rec.url = rec.compareUrl;
  } else {
    rec.note = "No GitHub twin on this computer. Import a tree or pass owner/repo. Pull is filed here.";
    rec.url = `${origin.replace(/\/+$/, "")}/studio`;
  }
  const pullsDir = path.join(dir, ".kiln", "pulls");
  fs.mkdirSync(pullsDir, { recursive: true });
  writeJson(path.join(pullsDir, `${job.id}.json`), rec);
  job.pull = { id: rec.id, url: rec.url, compareUrl: rec.compareUrl, github: rec.github || null, note: rec.note || null };
  saveJob(job);
  rememberSpace({ repoId: job.repoId, kind: "procedural", text: `pull ${job.id}` });
  return rec;
}

function listPulls(repoId) {
  const dir = path.join(spaceHome(repoId), ".kiln", "pulls");
  const out = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const rec = readJson(path.join(dir, f), null);
      if (rec) out.push(rec);
    }
  } catch {
    /* none */
  }
  out.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return out.slice(0, 24);
}

export async function handleLoop(pathname, req) {
  if (!(pathname === "/api/kiln/loop" || pathname.startsWith("/api/kiln/loop/"))) return null;
  const data = { ...(req.query || {}), ...parseBody(req) };
  const action = String(data.action || data.tool || req.query?.action || req.query?.tool || (req.method === "GET" ? "phone" : "queue"));
  const { acc, tok } = accOf(req);
  const origin = req.origin || "";

  if (action === "open_seat" || action === "signup" || action === "signup_github" || action === "signup_x") {
    const gate = allowSignup(req.ip);
    if (!gate.ok) return json(429, gate);
    if (action === "signup_github" || action === "signup_x") {
      const out = await seatFromProvider({
        provider: action === "signup_github" ? "github" : "x",
        token: data.token || data.accessToken || "",
      });
      return json(out.ok ? 200 : 400, out);
    }
    const out = openAgentSeat({ handle: data.handle, name: data.name || data.displayName, via: data.via || "site" });
    return json(out.ok ? 200 : 400, out);
  }

  if (action === "map") return json(200, siteMap(origin));
  if (action === "go") {
    return json(200, openPage({ path: data.path || data.url || "/", origin, handle: acc && acc.handle }));
  }
  if (action === "phone" || action === "agent") {
    const card = phoneCard(origin);
    card.publicForge = await publicForge();
    card.client = clientKind(req.userAgent);
    return json(200, card);
  }

  if (action === "profile") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const out = updateSeat({
      handle: acc.handle,
      displayName: data.displayName,
      bio: data.bio,
      lab: data.lab,
      settings: data.settings,
    });
    if (out.ok) out.client = clientKind(req.userAgent);
    return json(out.ok ? 200 : 400, out);
  }

  if (action === "review" || action === "research") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const out = await reviewSeat({
      handle: acc.handle,
      question: data.question || data.q || "",
      repo: data.repo || data.repoId || "",
    });
    return json(out.ok ? 200 : 400, out);
  }

  if (action === "gpuBoard") return json(200, boardGpu());
  if (action === "gpuOffer") {
    return json(200, offerGpu({
      seed: data.seed,
      n: data.n,
      from: data.from || data.node || "plane",
      repoId: data.repoId || "",
      brief: data.brief || data.prompt || "",
    }));
  }
  if (action === "gpuClaim") return json(200, claimGpu({ id: data.id, node: data.node || data.from }));
  if (action === "gpuReceipt") return json(200, receiptGpu({ id: data.id, receipt: data.receipt || {} }));

  if (action === "board") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    bootSpace({ repoId, owner: acc.handle });
    const idx = readJson(path.join(jobsDir(repoId), "index.json"), { jobs: [] });
    const jobs = (idx.jobs || [])
      .slice(0, 40)
      .map((row) => publicJob(loadJob(repoId, row.id)))
      .filter(Boolean);
    const status = gitStatus({ repoId });
    return json(200, {
      ok: true,
      repoId,
      live: liveUrl(origin, repoId, { token: visToken(repoId, tok) }),
      isolation: `kiln://${repoId}`,
      status,
      jobs,
      pulls: listPulls(repoId).slice(0, 8),
    });
  }

  if (action === "queue" || action === "enqueue" || action === "run") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const walkAway = action === "run" || data.walkAway === true || data.walk === true;
    const brief = data.brief || data.job || data.text || data.prompt || "";
    const out = queueJob({ acc, repoId, brief, walkAway, origin, token: tok });
    if (!out.ok) return json(400, out);
    return json(200, out);
  }

  if (action === "bench" || action === "benchStatus" || action === "benchHold" || action === "benchStep" || action === "benchWork") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    if (action === "benchHold") {
      holdBench(repoId);
      benchChains.delete(repoId);
      const view = benchView(repoId);
      if (!view) return json(404, { ok: false, error: "no bench" });
      return json(200, view);
    }
    if (action === "benchStep") {
      const stepped = advanceBench(repoId, { force: true });
      if (!stepped.ok) return json(404, stepped);
      const view = benchView(repoId);
      return json(200, { ...view, advanced: stepped.advanced, files: view ? view.files : stepped.files });
    }
    if (action === "benchWork") {
      const resumed = resumeBench(repoId);
      if (!resumed) return json(404, { ok: false, error: "no bench" });
      if (resumed.status === "working") scheduleBench(repoId);
      return json(200, benchView(repoId));
    }
    if (action === "bench") {
      const prior = readBench(repoId);
      openBench(repoId, {
        kind: data.kind,
        prompt: data.prompt || data.brief || "",
        name: data.name || "",
      });
      let first = null;
      if (!prior) {
        first = advanceBench(repoId);
        if (first && first.advanced && first.bench && !first.done) {
          holdBench(repoId);
          try {
            const brief = first.bench.prompt || data.prompt || "";
            let seed = 2166136261;
            for (let i = 0; i < brief.length; i++) seed = Math.imul(seed ^ brief.charCodeAt(i), 16777619);
            offerGpu({ seed: seed >>> 0, n: 1 << 16, from: "bench", repoId, brief });
          } catch {
            /* the charter still landed */
          }
        }
      }
      const view = benchView(repoId);
      return json(200, { ...view, advanced: !!(first && first.advanced), files: (view && view.files) || [] });
    }
    const view = benchView(repoId);
    if (!view) return json(404, { ok: false, error: "no bench" });
    return json(200, view);
  }

  if (action === "outside") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    return json(200, { ok: true, repoId, writes: readOutside(repoId) });
  }

  if (action === "tree") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    bootSpace({ repoId, owner: acc.handle });
    return json(200, { ok: true, repoId, files: listSpace(repoId) });
  }

  if (action === "write") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const out = await runIngestTool(
      "kiln_write_file",
      { repo: repoId, path: data.path, content: data.content, message: data.message || "" },
      { viewer: acc.handle, origin },
    );
    return json(out && out.ok ? 200 : 400, out || { ok: false, error: "write failed" });
  }

  if (action === "crew") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    return json(200, { ok: true, repoId, crew: readCrew(repoId) });
  }

  if (action === "branch" || action === "model" || action === "pr") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const tool = action === "branch" ? "kiln_create_branch" : action === "model" ? "kiln_bind_model" : "kiln_open_pr";
    const out = await runIngestTool(
      tool,
      {
        repo: repoId,
        name: data.name || data.branch,
        branch: data.branch || data.name,
        model: data.model,
        title: data.title,
        body: data.body,
      },
      { viewer: acc.handle, origin },
    );
    return json(out.ok ? 200 : 400, out);
  }

  if (action === "wallet" || action === "claim") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    let minted = false;
    if (action === "claim") {
      const claimed = claimOpening(acc.handle);
      if (!claimed.ok) return json(400, claimed);
      minted = !!claimed.minted;
    }
    const view = tillView(acc.handle);
    const w = loadWallet(acc.handle);
    return json(200, { ...view, minted, address: (w && w.address) || "", scheme: (w && w.scheme) || "" });
  }

  if (action === "products") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    return json(200, catalog({ seller: data.seller || "" }));
  }

  if (action === "list_product") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const out = listProduct({
      seller: acc.handle,
      repoId,
      path: data.path,
      title: data.title,
      cents: data.cents,
      stock: data.stock,
    });
    return json(out.ok ? 200 : 400, out);
  }

  if (action === "buy") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const dest = String(data.dest || data.repoId || data.repo || `${acc.handle}/home`).trim();
    const gate = gateWrite(acc, dest);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const out = buyProduct({
      buyer: acc.handle,
      productId: data.productId || data.id,
      destRepo: dest,
      destPath: data.path || "",
    });
    if (out.ok) {
      try {
        const secret = sessionSecret(tok);
        if (secret) {
          const signed = signLedger(secret, {
            type: "buy",
            from: acc.handle,
            repoId: out.receipt.repoId,
            merkleRoot: out.receipt.sha256,
            memo: out.receipt.productId,
            timestamp: Date.parse(out.receipt.at) || Date.now(),
          });
          out.receipt.sig = signed.sig;
          out.receipt.address = signed.address;
        }
      } catch {
        /* the file and the note already moved */
      }
    }
    return json(out.ok ? 200 : 400, out);
  }

  if (action === "pay") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const out = transferNote({ from: acc.handle, to: data.to, cents: data.cents, memo: data.memo || "" });
    return json(out.ok ? 200 : 400, out);
  }

  if (action === "repos") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const board = repoBoard(acc.handle);
    const focus = String(data.focus || data.repoId || "").trim();
    if (focus && (focus.split("/")[0] === acc.handle || ownsRepo(acc.handle, focus))) {
      const rec = receiptOf(focus);
      if (rec.ok) board.receipt = rec;
    }
    return json(200, board);
  }

  if (action === "receipt") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const rec = receiptOf(repoId);
    return json(rec.ok ? 200 : 404, rec);
  }

  if (action === "sit") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    return json(200, sitComputer(repoId));
  }

  if (action === "recall") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    return json(200, recallMemory({ repoId, q: data.q || data.query || "", limit: data.limit }));
  }

  if (action === "ship") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const out = await shipComputer({
      repoId,
      origin,
      github: data.github || "",
      owner: data.owner || "",
      repo: data.githubRepo || data.name || "",
      base: data.base || "main",
      title: data.title || "",
      body: data.body || "",
      branch: data.branch || "",
      force: data.force === true,
    });
    return json(out.ok ? 200 : 400, out);
  }

  if (action === "status") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const job = loadJob(repoId, data.jobId || data.id);
    if (!job) return json(404, { ok: false, error: "unknown job" });
    if (job.handle !== acc.handle && !ownsRepo(acc.handle, repoId)) return json(403, { ok: false, error: "not your job" });
    return json(200, { ok: true, job: publicJob(job) });
  }

  if (action === "diff") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const jobId = data.jobId || data.id || "";
    const diff = gitDiff({ repoId, jobId: jobId || undefined });
    return json(200, { ok: true, ...diff, patch: String(diff.patch || "").slice(0, 80_000) });
  }

  if (action === "apply") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const job = loadJob(repoId, data.jobId || data.id);
    if (!job) return json(404, { ok: false, error: "unknown job" });
    const wt = openWorktree({ repoId, jobId: job.id });
    if (!wt.ok) return json(400, wt);
    const applied = applyToolCalls(wt.worktree, data.toolCalls || [], repoId);
    if (Array.isArray(data.files)) {
      for (const f of data.files.slice(0, 40)) {
        if (!f || !f.path || typeof f.content !== "string") continue;
        const out = writeOnTree(wt.worktree, f.path, f.content, f.message || `job: ${f.path}`);
        if (out.ok) applied.writes.push({ path: out.path, commit: out.commit, bytes: out.bytes });
      }
    }
    job.writes = [...(job.writes || []), ...applied.writes];
    const repaired = ensureCapsule(wt.worktree, repoId, { brief: job.brief, writes: job.writes });
    job.writes = repaired.writes || job.writes;
    job.commit = (job.writes || []).at(-1)?.commit || applied.commit || job.commit;
    job.branch = wt.branch;
    job.finishedAt = new Date().toISOString();
    const diff = gitDiff({ repoId, jobId: job.id });
    job.filesChanged = (diff.files || []).map((f) => f.path);
    const tests = runTests({ repoId, jobId: job.id });
    job.tests = tests;
    job.status = tests.ok ? "needs_review" : "tests_failed";
    saveJob(job);
    return json(200, { ok: true, job: publicJob(job), writes: job.writes, repaired: !!repaired.repaired });
  }

  if (action === "test") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const jobId = data.jobId || data.id || "";
    const started = Date.now();
    const tests = runTests({ repoId, jobId: jobId || undefined });
    try {
      noteChecks(repoId, tests, Date.now() - started);
    } catch {
      /* the checks still return */
    }
    if (jobId) {
      const job = loadJob(repoId, jobId);
      if (job) {
        job.tests = tests;
        if (!tests.ok) job.status = "tests_failed";
        else if (job.status === "tests_failed" || job.status === "needs_review") job.status = "needs_review";
        saveJob(job);
      }
    }
    return json(200, tests);
  }

  if (action === "merge") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const job = loadJob(repoId, data.jobId || data.id);
    if (!job) return json(404, { ok: false, error: "unknown job" });
    const tests = runTests({ repoId, jobId: job.id });
    job.tests = tests;
    if (!tests.ok && !data.force) {
      job.status = "tests_failed";
      saveJob(job);
      return json(409, { ok: false, error: "tests failed — fix the worktree or force merge", tests, job: publicJob(job) });
    }
    const merged = mergeWorktree({ repoId, jobId: job.id, message: data.message || `merge ${job.id}: ${String(job.brief || "").slice(0, 40)}` });
    if (!merged.ok) {
      job.status = "error";
      job.error = merged.error;
      saveJob(job);
      return json(400, { ...merged, job: publicJob(job) });
    }
    job.status = "merged";
    job.commit = merged.commit;
    job.mergedAt = new Date().toISOString();
    job.live = liveUrl(origin, repoId);
    saveJob(job);
    rememberSpace({ repoId, kind: "procedural", text: `merged ${job.id} @ ${merged.commit}` });
    return json(200, { ok: true, job: publicJob(job), commit: merged.commit, fileCount: merged.fileCount, live: job.live });
  }

  if (action === "live") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const jobId = data.jobId || data.id || "";
    const href = liveUrl(origin, repoId, { jobId: jobId || undefined, token: visToken(repoId, tok) });
    return json(200, { ok: true, repoId, url: href, isolation: `kiln://${repoId}` });
  }

  if (action === "pull") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    let job = loadJob(repoId, data.jobId || data.id);
    if (!job) {
      const idx = readJson(path.join(jobsDir(repoId), "index.json"), { jobs: [] });
      const last = (idx.jobs || []).find((j) => j.status === "needs_review" || j.status === "merged" || j.status === "running");
      job = last ? loadJob(repoId, last.id) : null;
    }
    if (!job) return json(404, { ok: false, error: "queue a job first" });
    const rec = await openPull({
      acc,
      job,
      origin,
      github: data.github || { owner: data.owner, repo: data.repo || data.name, base: data.base },
      title: data.title,
      body: data.body,
    });
    return json(200, { ok: true, pull: rec, job: publicJob(job) });
  }

  if (action === "abandon") {
    if (!acc) return json(401, { ok: false, error: "sign in" });
    const repoId = repoOf(data, acc);
    const gate = gateWrite(acc, repoId);
    if (!gate.ok) return json(gate.status, { ok: false, error: gate.error });
    const job = loadJob(repoId, data.jobId || data.id);
    if (!job) return json(404, { ok: false, error: "unknown job" });
    dropWorktree({ repoId, jobId: job.id });
    job.status = "abandoned";
    job.finishedAt = new Date().toISOString();
    saveJob(job);
    return json(200, { ok: true, job: publicJob(job) });
  }

  return json(400, { ok: false, error: "unknown loop action" });
}

function visToken(repoId, tok) {
  if (visibilityOf(repoId) === "public") return "";
  return tok || "";
}

resumeQueued();
