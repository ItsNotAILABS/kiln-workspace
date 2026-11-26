import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { advanceBench, holdBench, openBench, readBench } from "./kiln-bench.mjs";
import { spaceHome } from "./kiln-space.mjs";

function finish(repoId) {
  let guard = 0;
  while (guard < 12) {
    const step = advanceBench(repoId);
    if (!step.advanced) break;
    guard += 1;
  }
  return guard;
}

test("a bench does not finish on the first commit", () => {
  const repoId = "benches/hold-" + process.pid;
  openBench(repoId, { kind: "crypto", name: "escrow-bench", prompt: "Escrow with a ledger backend." });
  const first = advanceBench(repoId);
  assert.equal(first.advanced, true);
  assert.equal(first.done, false);
  assert.equal(readBench(repoId).cursor, 1);
  assert.equal(readBench(repoId).status, "working");
  holdBench(repoId);
  const held = advanceBench(repoId);
  assert.equal(held.advanced, false);
  assert.equal(held.held, true);
  const forced = advanceBench(repoId, { force: true });
  assert.equal(forced.advanced, true);
  assert.equal(forced.phase.id, "contract");
  assert.equal(readBench(repoId).status, "held");
  assert.equal(readBench(repoId).cursor, 2);
});

test("crypto bench commits a backend and its tests pass", () => {
  const repoId = "benches/horizon-" + process.pid;
  openBench(repoId, {
    kind: "crypto",
    name: "escrow-bench",
    prompt: "Escrow that locks against an issue and a backend that releases it.",
  });
  finish(repoId);
  const bench = readBench(repoId);
  assert.equal(bench.kind, "crypto");
  assert.equal(bench.status, "open");
  assert.equal(bench.cursor, bench.phases.length);
  assert.ok(bench.phases.every((phase) => phase.done));
  const run = spawnSync(process.execPath, ["--test"], { cwd: spaceHome(repoId), encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + "\n" + run.stderr);
});

test("code, agent, and model benches also finish a horizon", () => {
  for (const kind of ["code", "agent", "model"]) {
    const repoId = `benches/${kind}-` + process.pid;
    openBench(repoId, { kind, name: kind + "-bench", prompt: "Keep going until the horizon is done." });
    const first = advanceBench(repoId);
    assert.equal(first.done, false, kind);
    finish(repoId);
    const bench = readBench(repoId);
    assert.equal(bench.status, "open", kind);
    assert.equal(bench.cursor, bench.phases.length, kind);
    const run = spawnSync(process.execPath, ["--test"], { cwd: spaceHome(repoId), encoding: "utf8" });
    assert.equal(run.status, 0, kind + "\n" + run.stdout + "\n" + run.stderr);
  }
});

test("two briefs do not share an escrow", () => {
  const freight = "benches/freight-" + process.pid;
  const market = "benches/market-" + process.pid;
  openBench(freight, { kind: "crypto", name: "freight", prompt: "freight claim settlement for a carrier" });
  openBench(market, { kind: "crypto", name: "market", prompt: "marketplace listing deposit for a seller" });
  advanceBench(freight);
  advanceBench(market);
  advanceBench(freight);
  advanceBench(market);
  advanceBench(freight);
  advanceBench(market);
  const fa = fs.readFileSync(path.join(spaceHome(freight), "contracts/Escrow.sol"), "utf8");
  const fb = fs.readFileSync(path.join(spaceHome(market), "contracts/Escrow.sol"), "utf8");
  assert.notEqual(fa, fb);
  assert.match(fa, /contract FreightClaimSettlementCarrierEscrow/);
  assert.match(fb, /contract MarketplaceListingDepositSellerEscrow/);
  assert.match(fa, /brief: freight claim settlement carrier/);
  assert.match(fb, /brief: marketplace listing deposit seller/);
  const ledger = fs.readFileSync(path.join(spaceHome(freight), "server/ledger.mjs"), "utf8");
  assert.match(ledger, /row\.subject = "freight claim settlement carrier"/);
  const other = fs.readFileSync(path.join(spaceHome(market), "server/ledger.mjs"), "utf8");
  assert.match(other, /row\.subject = "marketplace listing deposit seller"/);
  assert.notEqual(ledger, other);
});
