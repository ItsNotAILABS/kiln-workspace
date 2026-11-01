/**
 * Server-side G-WebGPU plane. A bench or a browser can offer a SAXPY job.
 * Any node on the origin can claim it and post a receipt.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const FILE = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..", "data", "backend", "gpu-plane.json");

function load() {
  try {
    const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(doc.jobs) ? doc.jobs : [];
  } catch {
    return [];
  }
}

function save(jobs) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ jobs: jobs.slice(0, 40) }, null, 2));
}

export function offerGpu({ seed, n, from, repoId, brief } = {}) {
  const jobs = load();
  let width = Number(n);
  if (!Number.isFinite(width) || width <= 0 || width > 1 << 20) width = 1 << 16;
  const job = {
    id: "g" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36),
    seed: Number(seed) >>> 0,
    n: width,
    from: String(from || "bench").slice(0, 80),
    repoId: String(repoId || "").slice(0, 80),
    brief: String(brief || "").slice(0, 180),
    status: "open",
    at: new Date().toISOString(),
  };
  jobs.unshift(job);
  save(jobs);
  return { ok: true, job };
}

export function claimGpu({ id, node } = {}) {
  const jobs = load();
  const job = id ? jobs.find((row) => row.id === id && row.status === "open") : jobs.find((row) => row.status === "open");
  if (!job) return { ok: true, job: null };
  if (node && job.from === node) return { ok: true, job: null };
  job.status = "claimed";
  job.node = String(node || "").slice(0, 80);
  job.claimedAt = new Date().toISOString();
  save(jobs);
  return { ok: true, job };
}

export function receiptGpu({ id, receipt } = {}) {
  const jobs = load();
  const job = jobs.find((row) => row.id === id);
  if (!job) return { ok: false, error: "unknown job" };
  job.status = "done";
  job.receipt = {
    checksum: receipt && receipt.checksum,
    agree: !!(receipt && receipt.agree),
    via: receipt && receipt.via,
    ms: receipt && receipt.ms,
    node: receipt && receipt.node,
  };
  job.doneAt = new Date().toISOString();
  save(jobs);
  return { ok: true, job };
}

export function boardGpu() {
  return { ok: true, jobs: load().slice(0, 24) };
}
