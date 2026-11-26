import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { recallMemory, rememberSpace, spaceHome } from "./kiln-space.mjs";
import { sitComputer } from "./kiln-sit.mjs";

test("working memory is one task, and recall finds it", () => {
  const repoId = `memqa/sit-${process.pid}`;
  const first = rememberSpace({ repoId, kind: "working", text: "Keep the ledger pull-based" });
  const again = rememberSpace({ repoId, kind: "working", text: "Keep the ledger pull-based" });
  assert.equal(first.duplicate, false);
  assert.equal(again.duplicate, true);
  assert.equal(again.n, first.n);
  rememberSpace({ repoId, kind: "episodic", text: "Shipped the capsule" });
  const found = recallMemory({ repoId, q: "ledger" });
  assert.equal(found.hits[0].text.includes("ledger"), true);
  assert.equal(found.working.text, "Keep the ledger pull-based");
  const sit = sitComputer(repoId);
  assert.equal(sit.ok, true);
  assert.match(sit.text, /Working: Keep the ledger pull-based/);
  assert.match(sit.text, /Next: Keep the ledger pull-based/);
  fs.rmSync(spaceHome(repoId), { recursive: true, force: true });
});
