import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { shipComputer } from "./kiln-ship.mjs";
import { spaceHome, writeOnTree } from "./kiln-space.mjs";

test("ship refuses main and a failed check does not push", async () => {
  const missing = await shipComputer({ repoId: "shipqa/home", github: "FreddyCreates/kiln-agent-lane", branch: "main" });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not main/);

  const repoId = `shipqa/bad-${process.pid}`;
  const dir = spaceHome(repoId);
  writeOnTree(dir, "src/bad.js", "function (", "broken");
  const held = await shipComputer({ repoId, github: "FreddyCreates/kiln-agent-lane" });
  assert.equal(held.ok, false);
  assert.equal(held.error, "checks failed");
  assert.equal(held.github.ok, false);
  assert.equal(fs.existsSync(path.join(dir, ".kiln", "SHIP.json")), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
