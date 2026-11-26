import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { observe, teach } from "./kiln-mind.mjs";
import { readMemory, rememberSpace, spaceHome } from "./kiln-space.mjs";

test("the agent is handed the computer memory, and a turn is written back", () => {
  const repoId = `memagent/turn-${process.pid}`;
  rememberSpace({ repoId, kind: "working", text: "Keep the ledger pull-based" });
  const taught = teach({ handle: "memagent", role: "builder", repoId });
  assert.match(taught, /Computer memory for memagent\/turn-/);
  assert.match(taught, /Working: Keep the ledger pull-based/);
  observe({
    kind: "agent_turn",
    handle: "memagent",
    role: "builder",
    repoId,
    text: "The ledger stays pull-based.",
  });
  const memory = readMemory({ repoId });
  const last = memory.entries[memory.entries.length - 1];
  assert.equal(last.kind, "episodic");
  assert.match(last.text, /builder: The ledger stays pull-based/);
  const again = teach({ handle: "memagent", role: "builder", repoId });
  assert.match(again, /The ledger stays pull-based/);
  fs.rmSync(spaceHome(repoId), { recursive: true, force: true });
});
