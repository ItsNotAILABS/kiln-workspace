import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claimOpening, tillView } from "./kiln-market.mjs";
import { boardCompute, claimWork, postWork, runPiece, submitWork, waitWork } from "./kiln-compute.mjs";

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kiln-compute-"));
}

function seat(name) {
  return `${name}${process.pid}`.slice(0, 24);
}

test("the same work has the same digest", () => {
  const chain = runPiece({ kind: "sha256-chain", seed: "kiln", rounds: 3 });
  assert.equal(chain.digest, runPiece({ kind: "sha256-chain", seed: "kiln", rounds: 3 }).digest);
  assert.equal(chain.digest.length, 64);
  const root = runPiece({ kind: "merkle", leaves: ["a", "b", "c"] });
  assert.equal(root.digest, runPiece({ kind: "merkle", leaves: ["a", "b", "c"] }).digest);
  assert.notEqual(root.digest, runPiece({ kind: "merkle", leaves: ["a", "b", "d"] }).digest);
  const sum = runPiece({ kind: "reduce", seed: 7, n: 1000 });
  assert.equal(sum.digest, runPiece({ kind: "reduce", seed: 7, n: 1000 }).digest);
});

test("a bounty locks a kiln note and a failed price does not", async () => {
  const dir = scratch();
  const who = seat("cp");
  claimOpening(who, { dir, capCents: 10_000, openingCents: 2500 });
  const broke = await postWork({ seat: who, kind: "sha256-chain", rounds: 2, bounty: 9000 }, { dir, inline: true });
  assert.equal(broke.ok, false);
  assert.equal(broke.error, "till is short");
  assert.equal(tillView(who, { dir }).cents, 2500);
  const ran = await postWork(
    { seat: who, kind: "merkle", leaves: ["dock", "note"], bounty: 400 },
    { dir, inline: true },
  );
  assert.equal(ran.ok, true);
  assert.equal(ran.job.status, "done");
  assert.equal(ran.job.digest, runPiece({ kind: "merkle", leaves: ["dock", "note"] }).digest);
  assert.equal(tillView(who, { dir }).cents, 2100);
  const bad = await postWork({ seat: who, kind: "sha256-chain", rounds: 0 }, { dir, inline: true });
  assert.equal(bad.ok, false);
});

test("the pool runs the work on a core and returns the digest", async () => {
  const dir = scratch();
  const who = seat("pl");
  const posted = await postWork({ seat: who, kind: "sha256-chain", seed: "pool", rounds: 20 }, { dir });
  assert.equal(posted.ok, true);
  assert.equal(posted.queued, true);
  assert.ok(posted.pool.cores >= 1);
  const done = await waitWork(posted.job.id, { dir });
  assert.equal(done.ok, true);
  assert.equal(done.job.digest, runPiece({ kind: "sha256-chain", seed: "pool", rounds: 20 }).digest);
  const board = boardCompute({ dir });
  assert.equal(board.jobs[0].status, "done");
  assert.match(board.not, /Not a bank/);
});

test("two seats must agree before the note moves", async () => {
  const dir = scratch();
  const poster = seat("po");
  const worker = seat("wo");
  const other = seat("ot");
  claimOpening(poster, { dir, capCents: 10_000, openingCents: 2500 });
  const opened = await postWork(
    { seat: poster, kind: "sha256-chain", seed: "net", rounds: 4, bounty: 500 },
    { dir, remote: true },
  );
  assert.equal(opened.open, true);
  assert.equal(opened.job.digest, "");
  assert.equal(tillView(poster, { dir }).cents, 2000);
  const self = claimWork({ id: opened.job.id, seat: poster }, { dir });
  assert.equal(self.ok, false);
  const claimed = claimWork({ id: opened.job.id, seat: worker }, { dir });
  assert.equal(claimed.ok, true);
  const digest = runPiece({ kind: "sha256-chain", seed: "net", rounds: 4 }).digest;
  const pending = submitWork({ id: opened.job.id, seat: worker, digest }, { dir });
  assert.equal(pending.pending, true);
  const clash = submitWork({ id: opened.job.id, seat: other, digest: "ab".repeat(32) }, { dir });
  assert.equal(clash.ok, false);
  assert.equal(clash.error, "digests disagree");
  assert.equal(tillView(poster, { dir }).cents, 2500);
});

test("matching digests pay the claimer and an expired claim returns the note", async () => {
  const dir = scratch();
  const poster = seat("pp");
  const worker = seat("ww");
  const other = seat("oo");
  claimOpening(poster, { dir, capCents: 10_000, openingCents: 2500 });
  const opened = await postWork(
    { seat: poster, kind: "merkle", leaves: ["a", "b"], bounty: 300 },
    { dir, remote: true },
  );
  claimWork({ id: opened.job.id, seat: worker }, { dir });
  const digest = runPiece({ kind: "merkle", leaves: ["a", "b"] }).digest;
  submitWork({ id: opened.job.id, seat: worker, digest }, { dir });
  const agreed = submitWork({ id: opened.job.id, seat: other, digest }, { dir });
  assert.equal(agreed.agreed, true);
  assert.equal(agreed.job.digest, digest);
  assert.equal(tillView(poster, { dir }).cents, 2200);
  assert.equal(tillView(worker, { dir }).cents, 300);
  const again = await postWork(
    { seat: poster, kind: "reduce", seed: 3, n: 20, bounty: 100 },
    { dir, remote: true },
  );
  claimWork({ id: again.job.id, seat: worker, claimMs: 20 }, { dir });
  await new Promise((r) => setTimeout(r, 40));
  const board = boardCompute({ dir });
  const row = board.jobs.find((job) => job.id === again.job.id);
  assert.equal(row.status, "expired");
  assert.equal(tillView(poster, { dir }).cents, 2200);
});
