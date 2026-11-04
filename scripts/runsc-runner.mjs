#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Operator-context runner for runsc-direct containers (see
// scripts/docker-engine.mjs, "operator-context runner queue").
//
// Why this exists: on this host, runsc launches succeed from an
// operator shell context but fail from the KILN backend's systemd
// service context (the gofer's namespace setup is denied there — a
// sandbox namespace-layering property; same binary, same bundle, same
// flags). The engine therefore queues prepared OCI bundles under
// <state>/queue/pending and reports them as state "queued". This
// runner — started from any operator shell on the host — executes
// them for real and reports back under <state>/queue/results.
//
//   node scripts/runsc-runner.mjs           watch the queue (1s poll)
//   node scripts/runsc-runner.mjs --once    process the queue once, exit
//
// State dir resolution mirrors the engine exactly:
//   KILN_RUNSC_STATE || ~/.kiln-swarm/runsc
// runsc binary resolution mirrors the engine exactly:
//   KILN_RUNSC_BIN || /usr/local/bin/runsc (when it exists)
//
// The runner never deletes pending requests — the engine owns queue
// cleanup through its stop/remove paths. A result whose startedAt
// predates its pending's requestedAt is a stale record from an
// earlier generation of the same name and is re-executed; a current
// "failed" result is never retried automatically.
// ---------------------------------------------------------------------------
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ONCE = process.argv.includes("--once");
const POLL_MS = 1000;
const FRESH_RESULT_MS = 2000;

function logLine(message) {
  console.log(`[${new Date().toISOString()}] runsc-runner: ${message}`);
}

function runscBin() {
  if (process.env.KILN_RUNSC_BIN) return process.env.KILN_RUNSC_BIN;
  const candidate = "/usr/local/bin/runsc";
  return fs.existsSync(candidate) ? candidate : null;
}

function stateDir() {
  return process.env.KILN_RUNSC_STATE || path.join(os.homedir(), ".kiln-swarm", "runsc");
}

function rootDir() {
  return path.join(stateDir(), "root");
}

function pendingDir() {
  return path.join(stateDir(), "queue", "pending");
}

function resultsDir() {
  return path.join(stateDir(), "queue", "results");
}

function pendingPath(name) {
  return path.join(pendingDir(), `${name}.json`);
}

function resultPath(name) {
  return path.join(resultsDir(), `${name}.json`);
}

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeJsonAtomic(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2));
  fs.renameSync(tmp, file);
}

function trimErr(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > 500 ? t.slice(0, 500) + "…" : t;
}

function execRunsc(bin, args, timeoutMs = 30000) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        const detail = trimErr(stderr) || trimErr(err && err.message) || "runsc CLI failed";
        return rejectPromise(new Error(detail));
      }
      resolvePromise(String(stdout));
    });
  });
}

async function listRunsc(bin) {
  try {
    const stdout = await execRunsc(bin, ["--root", rootDir(), "list", "--format", "json"], 10000);
    const parsed = JSON.parse(stdout.trim() || "null");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // reconciliation is best-effort; a failed list changes nothing
  }
}

// Launch exactly the way the engine's launchRunsc does: same global
// flags, same detached run on the prepared bundle, stdout/stderr
// appended to the container's log file.
function launchBundle(bin, name, bundleDir, logFile) {
  return new Promise((resolvePromise) => {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const fd = fs.openSync(logFile, "a");
    let child;
    try {
      child = spawn(
        bin,
        ["--network=none", "--ignore-cgroups", "--root", rootDir(), "run", "--detach", "--bundle", bundleDir, name],
        { detached: true, stdio: ["ignore", fd, fd], windowsHide: true },
      );
    } catch (e) {
      fs.closeSync(fd);
      return resolvePromise({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    fs.closeSync(fd);
    child.on("error", (e) => resolvePromise({ ok: false, error: e.message }));
    child.on("exit", (code) => {
      child.unref();
      if (code === 0) return resolvePromise({ ok: true });
      let tail = "";
      try {
        tail = trimErr(fs.readFileSync(logFile, "utf8").slice(-2000));
      } catch { /* no log captured */ }
      resolvePromise({ ok: false, error: tail || `runsc exited ${code}` });
    });
  });
}

// A result belongs to the pending's generation when its startedAt is
// not older than the pending's requestedAt.
function isCurrentResult(result, pending) {
  if (!result) return false;
  if (!result.startedAt || !pending.requestedAt) return true;
  return String(result.startedAt) >= String(pending.requestedAt);
}

function resultAgeMs(result) {
  const stamp = result.updatedAt || result.startedAt;
  const parsed = stamp ? Date.parse(stamp) : NaN;
  return Number.isFinite(parsed) ? Date.now() - parsed : Infinity;
}

async function maybeLaunch(bin, pending) {
  const name = pending.name;
  if (typeof name !== "string" || !name) return;
  const result = readJson(resultPath(name));
  if (isCurrentResult(result, pending)) {
    // A current failed result is final — never retried automatically.
    // A fresh current result may belong to work still settling; skip.
    if (result.state === "failed") return;
    if (resultAgeMs(result) < FRESH_RESULT_MS) return;
    if (result.state === "running" || result.state === "exited") return;
  }
  const bundleDir = typeof pending.bundleDir === "string" ? pending.bundleDir : "";
  const logFile = typeof pending.logFile === "string" ? pending.logFile : "";
  const startedAt = new Date().toISOString();
  const meta = bundleDir ? readJson(path.join(bundleDir, "meta.json")) : null;
  if (!bundleDir || !logFile || !meta) {
    writeJsonAtomic(resultPath(name), {
      name,
      state: "failed",
      startedAt,
      updatedAt: startedAt,
      error: "bundle is incomplete (missing bundleDir, logFile or meta.json); cannot launch",
    });
    logLine(`${name}: marked failed — bundle incomplete`);
    return;
  }
  const launched = await launchBundle(bin, name, bundleDir, logFile);
  if (!launched.ok) {
    writeJsonAtomic(resultPath(name), {
      name,
      state: "failed",
      startedAt,
      updatedAt: new Date().toISOString(),
      error: launched.error || "runsc launch failed",
    });
    logLine(`${name}: launch failed — ${launched.error || "runsc launch failed"}`);
    return;
  }
  let pid;
  const entries = await listRunsc(bin);
  const entry = entries.find((e) => e && String(e.id) === name);
  if (entry && typeof entry.pid === "number") pid = entry.pid;
  writeJsonAtomic(resultPath(name), {
    name,
    state: "running",
    ...(pid !== undefined ? { pid } : {}),
    startedAt,
    updatedAt: new Date().toISOString(),
  });
  logLine(`${name}: running${pid !== undefined ? ` (pid ${pid})` : ""}`);
}

// Results marked running whose sandbox is gone (or no longer running)
// become "exited" so the listing tells the truth.
async function reconcile(bin) {
  let files = [];
  try {
    files = fs.readdirSync(resultsDir());
  } catch {
    return; // no results yet
  }
  const running = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const result = readJson(path.join(resultsDir(), f));
    if (result && result.state === "running" && typeof result.name === "string") running.push(result);
  }
  if (!running.length) return;
  const entries = await listRunsc(bin);
  const byId = new Map(entries.filter((e) => e && e.id).map((e) => [String(e.id), e]));
  for (const result of running) {
    const entry = byId.get(result.name);
    const status = entry ? String(entry.status || entry.state || "") : "";
    if (!entry || status !== "running") {
      writeJsonAtomic(resultPath(result.name), {
        ...result,
        state: "exited",
        updatedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      });
      logLine(`${result.name}: exited`);
    }
  }
}

async function tick(bin) {
  let files = [];
  try {
    files = fs.readdirSync(pendingDir());
  } catch {
    files = []; // queue not created yet
  }
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const pending = readJson(path.join(pendingDir(), f));
    if (pending) await maybeLaunch(bin, pending);
  }
  await reconcile(bin);
}

// --- single-instance guard ---------------------------------------------------

const pidFile = () => path.join(stateDir(), "runner.pid");

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function claimPidFile() {
  const file = pidFile();
  const existing = readJson(file) || (() => {
    try {
      const raw = fs.readFileSync(file, "utf8").trim();
      const pid = Number(raw);
      return Number.isFinite(pid) ? { pid } : null;
    } catch {
      return null;
    }
  })();
  if (existing && typeof existing.pid === "number" && existing.pid !== process.pid && pidAlive(existing.pid)) {
    logLine(`another runner (pid ${existing.pid}) already holds ${file}; refusing to start a second instance`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2));
}

function releasePidFile() {
  try {
    const raw = fs.readFileSync(pidFile(), "utf8");
    if (raw.includes(`"pid": ${process.pid}`) || raw.trim() === String(process.pid)) {
      fs.rmSync(pidFile(), { force: true });
    }
  } catch { /* already gone */ }
}

// --- main --------------------------------------------------------------------

let stopping = false;

async function main() {
  const bin = runscBin();
  if (!bin) {
    logLine("no runsc binary found (KILN_RUNSC_BIN unset and /usr/local/bin/runsc missing); exiting");
    process.exit(1);
  }
  claimPidFile();
  logLine(`watching ${pendingDir()} (state: ${stateDir()}, runsc: ${bin}${ONCE ? ", --once" : ""})`);
  if (ONCE) {
    try {
      await tick(bin);
    } finally {
      releasePidFile();
    }
    return;
  }
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    logLine(`received ${signal}; shutting down`);
    releasePidFile();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  for (;;) {
    if (stopping) return;
    try {
      await tick(bin);
    } catch (e) {
      logLine(`tick failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, POLL_MS));
  }
}

main().catch((e) => {
  logLine(`fatal: ${e instanceof Error ? e.message : String(e)}`);
  releasePidFile();
  process.exit(1);
});
