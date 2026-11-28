import { parentPort, workerData } from "node:worker_threads";
import { runPiece } from "./kiln-compute.mjs";

try {
  const out = runPiece(workerData);
  parentPort.postMessage({ ok: true, digest: out.digest, rounds: out.rounds, leaves: out.leaves, n: out.n });
} catch (e) {
  parentPort.postMessage({ ok: false, error: e instanceof Error ? e.message : "compute failed" });
}
