import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isFixtureRepo, displayStars, displayForks, chainState, displayChain, type LiveRepoStats } from "./provenance.ts";
import type { Repo } from "./types.ts";

const live: LiveRepoStats = {
  stars: 42,
  forks: 7,
  watchers: 3,
  openIssues: 1,
  description: "live description",
  language: "TypeScript",
  topics: ["live"],
  license: "MIT",
  pushedAt: "2026-09-09T00:00:00Z",
  defaultBranch: "main",
  fetchedAt: "2026-09-10T00:00:00Z",
};

// Pinned classification of the forge seed (owner → fixture?).
// If the seed gains a repo, extend this table.
const SEED_OWNERS: [string, string, boolean][] = [
  ["kiln-labs/protocol", "kiln-labs", true],
  ["kiln-labs/cli", "kiln-labs", true],
  ["kiln-labs/sealed-fs", "kiln-labs", true],
  ["meridian/escrow", "meridian", true],
  ["atlas/enclave", "atlas", true],
  ["harbor/bridge", "harbor", true],
  ["northwind/git-seal", "northwind", true],
  ["lumen/zk-diff", "lumen", true],
  ["itsnotailabs/medina", "itsnotailabs", false],
  ["itsnotailabs/neuroemergence", "itsnotailabs", false],
  ["itsnotailabs/xcrew", "itsnotailabs", false],
  ["itsnotailabs/vlaptop", "itsnotailabs", false],
  ["itsnotailabs/pocket", "itsnotailabs", false],
  ["itsnotailabs/pocket-mailbox", "itsnotailabs", false],
  ["itsnotailabs/kiln-workspace", "itsnotailabs", false],
  ["itsnotailabs/auro14b", "itsnotailabs", false],
  ["itsnotailabs/capsula", "itsnotailabs", false],
  ["freddycreates/sovereign", "freddycreates", false],
  ["freddycreates/sovereign-engine", "freddycreates", false],
];

describe("isFixtureRepo", () => {
  it("matches the pinned seed classification", () => {
    for (const [id, owner, expected] of SEED_OWNERS) {
      assert.equal(isFixtureRepo({ owner } as Repo), expected, id);
    }
  });

  it("is case-insensitive on owner", () => {
    assert.ok(isFixtureRepo({ owner: "Kiln-Labs" } as Repo));
    assert.ok(!isFixtureRepo({ owner: "ItsNotAILABS" } as Repo));
  });

  it("keeps at least 9 real repos", () => {
    const real = SEED_OWNERS.filter(([, , f]) => !f);
    assert.ok(real.length >= 9, `expected at least 9 real repos, got ${real.length}`);
  });
});

describe("chain anchoring", () => {
  it("no repo is anchored until a registry deployment is recorded", () => {
    for (const [id, owner] of SEED_OWNERS) {
      const s = chainState({ owner } as Repo);
      assert.equal(s.anchored, false, id);
      assert.equal(displayChain({ owner } as Repo), "not anchored");
    }
  });
});
describe("display stats", () => {
  const repo = { stars: 11, forks: 1 } as Repo;

  it("prefers live stats over the seed fallback", () => {
    assert.equal(displayStars(repo, live), 42);
    assert.equal(displayForks(repo, live), 7);
  });

  it("falls back to seed numbers when live is missing", () => {
    assert.equal(displayStars(repo, undefined), 11);
    assert.equal(displayForks(repo, undefined), 1);
  });
});
