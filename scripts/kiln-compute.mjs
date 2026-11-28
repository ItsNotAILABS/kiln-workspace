/**
 * Origin compute pool.
 * Work runs on this machine's cores. A receipt is the digest of that work.
 * A bounty is a kiln note locked in a box. It is not a card and not a chain fee
 * to a miner we do not operate. Failed work is returned. Finished work stays
 * in the box as the fee for the cores.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { Worker } from "node:worker_threads";
import { lockNote, releaseNote, tillView } from "./kiln-market.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIR = path.join(ROOT, "data", "backend");
const MAX_ROUNDS = 250_000;
const MAX_LEAVES = 4_096;
const MAX_N = 5_000_000;
const MAX_QUEUE = 32;

const waiting = [];
let busy = 0;

function cores() {
  const n = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(8, n);
}

function fail(error) {
  return { ok: false, error };
}

function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function stateFile(opts) {
  return path.join((opts && opts.dir) || DEFAULT_DIR, "compute.json");
}

function readState(opts) {
  try {
    const doc = JSON.parse(fs.readFileSync(stateFile(opts), "utf8"));
    return Array.isArray(doc.jobs) ? doc.jobs : [];
  } catch {
    return [];
  }
}

function writeState(jobs, opts) {
  const file = stateFile(opts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ jobs: jobs.slice(0, 80) }));
  fs.renameSync(tmp, file);
}

function isShort(piece) {
  if (piece.kind === "sha256-chain") return piece.rounds <= 20_000;
  if (piece.kind === "merkle") return piece.leaves.length <= 512;
  if (piece.kind === "reduce") return piece.n <= 200_000;
  return false;
}

function seatName(handle) {
  return String(handle || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);
}

function pieceFromJob(job) {
  return {
    kind: job.kind,
    seed: job.seed || "kiln",
    rounds: job.rounds || 0,
    leaves: job.taskLeaves || [],
    n: job.n || 0,
  };
}

function pub(job) {
  const open = job.status === "open" || job.status === "claimed" || job.status === "pending";
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    seat: job.seat,
    claimer: job.claimer || "",
    witness: job.witness || "",
    digest: job.status === "done" ? job.digest || "" : "",
    rounds: job.rounds || 0,
    leaves: job.leaves || 0,
    n: job.n || 0,
    seed: open ? job.seed || "" : "",
    taskLeaves: open ? job.taskLeaves || [] : [],
    bounty: job.bounty || 0,
    box: job.box || "",
    remote: !!job.remote,
    ms: job.ms || 0,
    error: job.error || "",
    at: job.at,
  };
}

export function runPiece(piece) {
  if (!piece || piece.kind === "sha256-chain") {
    const rounds = piece.rounds;
    let h = sha256(piece.seed);
    for (let i = 0; i < rounds; i++) h = sha256(h);
    return { digest: h, rounds };
  }
  if (piece.kind === "merkle") {
    let layer = piece.leaves.map((leaf) => sha256(leaf));
    if (!layer.length) layer = [sha256("")];
    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) next.push(sha256(layer[i] + (layer[i + 1] ?? layer[i])));
      layer = next;
    }
    return { digest: layer[0], leaves: piece.leaves.length };
  }
  if (piece.kind === "reduce") {
    let x = piece.seed >>> 0;
    let sum = 0;
    const n = piece.n;
    for (let i = 0; i < n; i++) {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      sum = (sum + (x & 65535)) >>> 0;
    }
    return { digest: sha256(String(sum)), n, sum };
  }
  throw new Error("unknown compute");
}

function pieceOf(input) {
  const kind = String(input.kind || "sha256-chain");
  if (kind === "sha256-chain") {
    const rounds = Number(input.rounds);
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > MAX_ROUNDS) return fail("rounds are an integer from 1 to 250000");
    return { ok: true, kind, seed: String(input.seed || "kiln").slice(0, 80), rounds };
  }
  if (kind === "merkle") {
    const raw = Array.isArray(input.leaves) ? input.leaves : [];
    if (raw.length < 1 || raw.length > MAX_LEAVES) return fail("merkle takes 1 to 4096 leaves");
    const leaves = raw.map((leaf) => String(leaf).slice(0, 256));
    return { ok: true, kind, leaves };
  }
  if (kind === "reduce") {
    const n = Number(input.n);
    const seed = Number(input.seed);
    if (!Number.isInteger(n) || n < 1 || n > MAX_N) return fail("reduce n is an integer from 1 to 5000000");
    if (!Number.isInteger(seed) || seed < 0) return fail("reduce seed is a non-negative integer");
    return { ok: true, kind, n, seed: seed >>> 0 };
  }
  return fail("kind is sha256-chain, merkle, or reduce");
}

function patch(id, opts, fn) {
  const jobs = readState(opts);
  const job = jobs.find((row) => row.id === id);
  if (!job) return null;
  fn(job);
  writeState(jobs, opts);
  return job;
}

function settleFail(job, opts, error) {
  if (job.bounty > 0) {
    releaseNote({ box: job.box, to: job.seat, cents: job.bounty, memo: "compute returned" }, { dir: opts.dir });
  }
  patch(job.id, opts, (row) => {
    row.status = "failed";
    row.error = String(error || "compute failed").slice(0, 160);
    row.ms = Date.now() - Date.parse(row.at);
  });
}

function settleOk(job, opts, out, started) {
  patch(job.id, opts, (row) => {
    row.status = "done";
    row.digest = out.digest;
    row.rounds = out.rounds || row.rounds || 0;
    row.leaves = out.leaves || row.leaves || 0;
    row.n = out.n || row.n || 0;
    row.ms = Date.now() - started;
    row.error = "";
  });
}

function kick(opts) {
  const limit = cores();
  while (busy < limit && waiting.length) {
    const task = waiting.shift();
    busy += 1;
    const started = Date.now();
    patch(task.job.id, task.opts, (row) => {
      row.status = "running";
    });
    const worker = new Worker(new URL("./kiln-compute-worker.mjs", import.meta.url), { workerData: task.piece });
    const done = (msg) => {
      busy = Math.max(0, busy - 1);
      if (!msg || msg.ok === false) settleFail(task.job, task.opts, msg && msg.error);
      else settleOk(task.job, task.opts, msg, started);
      kick(task.opts);
    };
    worker.once("message", done);
    worker.once("error", (err) => done({ ok: false, error: err.message }));
  }
}

export function poolView() {
  return { cores: cores(), busy, queued: waiting.length };
}

export function boardCompute(opts = {}) {
  sweep(opts);
  return {
    ok: true,
    rail: "kiln-note",
    not: "Not a bank, not a card, not a chain we do not run.",
    ...poolView(),
    jobs: readState(opts).slice(0, 24).map(pub),
  };
}

function sweep(opts) {
  const now = Date.now();
  for (const job of readState(opts)) {
    if (job.status !== "claimed" && job.status !== "pending") continue;
    if (!job.expires || now <= job.expires) continue;
    if (job.bounty > 0) {
      releaseNote({ box: job.box, to: job.seat, cents: job.bounty, memo: "compute expired" }, { dir: opts.dir });
    }
    patch(job.id, opts, (row) => {
      row.status = "expired";
      row.error = "claim expired";
    });
  }
}

function payWorker(job, opts, to) {
  if (job.bounty > 0) {
    const paid = releaseNote({ box: job.box, to, cents: job.bounty, memo: "compute paid" }, { dir: opts.dir });
    if (!paid.ok) return paid;
  }
  patch(job.id, opts, (row) => {
    row.status = "done";
    row.digest = job.digest1 || row.digest1 || "";
    row.ms = Date.now() - Date.parse(row.at);
    row.error = "";
  });
  return { ok: true };
}

export function claimWork({ id, seat, claimMs } = {}, opts = {}) {
  sweep(opts);
  const who = seatName(seat);
  if (!who || who === "kiln") return fail("not a seat");
  const jobs = readState(opts);
  const job = jobs.find((row) => row.id === id);
  if (!job) return fail("unknown job");
  if (!job.remote) return fail("this job runs on the origin");
  if (job.seat === who) return fail("you posted this");
  if (job.status !== "open") return fail("not open");
  const hold = Number(claimMs) > 0 ? Number(claimMs) : 120_000;
  patch(job.id, opts, (row) => {
    row.status = "claimed";
    row.claimer = who;
    row.expires = Date.now() + hold;
  });
  return { ok: true, job: pub(readState(opts).find((row) => row.id === id)) };
}

export function submitWork({ id, seat, digest } = {}, opts = {}) {
  sweep(opts);
  const who = seatName(seat);
  const hex = String(digest || "").toLowerCase();
  if (!who || who === "kiln") return fail("not a seat");
  if (!/^[a-f0-9]{64}$/.test(hex)) return fail("digest is 64 hex");
  const job = readState(opts).find((row) => row.id === id);
  if (!job) return fail("unknown job");
  if (!job.remote) return fail("this job runs on the origin");
  if (who === job.seat) return fail("you posted this");
  if (job.status === "claimed" && job.claimer === who) {
    if (!job.remote && isShort(pieceFromJob(job))) {
      const out = runPiece(pieceFromJob(job));
      if (out.digest !== hex) {
        settleFail(job, opts, "digest does not match");
        return fail("digest does not match");
      }
      patch(job.id, opts, (row) => {
        row.digest1 = hex;
      });
      const fresh = readState(opts).find((row) => row.id === id);
      const paid = payWorker(fresh, opts, who);
      if (!paid.ok) return paid;
      return { ok: true, job: pub(readState(opts).find((row) => row.id === id)) };
    }
    patch(job.id, opts, (row) => {
      row.status = "pending";
      row.digest1 = hex;
      row.witness = who;
      row.expires = Date.now() + (Number(opts.claimMs) > 0 ? Number(opts.claimMs) : 120_000);
    });
    return { ok: true, pending: true, job: pub(readState(opts).find((row) => row.id === id)) };
  }
  if (job.status === "pending" && who !== job.claimer) {
    if (hex !== job.digest1) {
      settleFail(job, opts, "digests disagree");
      return fail("digests disagree");
    }
    const paid = payWorker(job, opts, job.claimer);
    if (!paid.ok) return paid;
    return { ok: true, agreed: true, job: pub(readState(opts).find((row) => row.id === id)) };
  }
  return fail("not your claim");
}

export async function postWork(input = {}, opts = {}) {
  const piece = pieceOf(input);
  if (!piece.ok) return piece;
  const seat = seatName(input.seat);
  if (!seat || seat === "kiln") return fail("not a seat");
  const bounty = input.bounty == null || input.bounty === "" ? 0 : Number(input.bounty);
  if (!Number.isInteger(bounty) || bounty < 0 || bounty > 1_000_000) return fail("bounty is integer cents");
  const remote = opts.remote === true || !isShort(piece);
  const jobs = readState(opts);
  const open = jobs.filter((row) => row.status === "queued" || row.status === "running").length;
  if (!remote && !opts.inline && open + waiting.length >= MAX_QUEUE) return fail("compute queue is full");
  const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const box = `box-${id}`;
  if (bounty > 0) {
    const locked = lockNote({ from: seat, box, cents: bounty, memo: piece.kind }, { dir: opts.dir });
    if (!locked.ok) return locked;
  }
  const job = {
    id,
    kind: piece.kind,
    status: remote ? "open" : opts.inline ? "running" : "queued",
    remote,
    seat,
    seed: piece.seed || "",
    rounds: piece.rounds || 0,
    leaves: piece.leaves ? piece.leaves.length : 0,
    taskLeaves: piece.leaves || [],
    n: piece.n || 0,
    bounty,
    box: bounty > 0 ? box : "",
    digest: "",
    digest1: "",
    claimer: "",
    witness: "",
    expires: 0,
    ms: 0,
    error: "",
    at: new Date().toISOString(),
  };
  jobs.unshift(job);
  writeState(jobs, opts);
  if (remote) return { ok: true, open: true, job: pub(job) };
  if (opts.inline) {
    const started = Date.now();
    try {
      const out = runPiece(piece);
      settleOk(job, opts, out, started);
    } catch (e) {
      settleFail(job, opts, e instanceof Error ? e.message : "compute failed");
    }
    const done = readState(opts).find((row) => row.id === id);
    return { ok: done.status === "done", job: pub(done), till: tillView(seat, { dir: opts.dir }) };
  }
  waiting.push({ job, piece, opts });
  kick(opts);
  return { ok: true, queued: true, job: pub(job), pool: poolView() };
}

export function waitWork(id, opts = {}, timeout = 15000) {
  const want = String(id || "");
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const job = readState(opts).find((row) => row.id === want);
      if (job && (job.status === "done" || job.status === "failed")) {
        resolve({ ok: job.status === "done", job: pub(job) });
        return;
      }
      if (Date.now() - start > timeout) {
        resolve({ ok: false, error: "still running", job: job ? pub(job) : null });
        return;
      }
      setTimeout(tick, 25);
    };
    tick();
  });
}
