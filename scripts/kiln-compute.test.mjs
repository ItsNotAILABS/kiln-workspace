import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claimOpening, tillView } from "./kiln-market.mjs";
import { boardCompute, postWork, runPiece, waitWork } from "./kiln-compute.mjs";

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
