import test from "node:test";
import assert from "node:assert/strict";
import { cleanSettings, clientKind } from "./kiln-accounts.mjs";

test("a phone is recognized and settings stay on the allowed set", () => {
  assert.equal(clientKind("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "phone");
  assert.equal(clientKind("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"), "tablet");
  assert.equal(clientKind("Mozilla/5.0 (Macintosh)"), "desk");
  assert.deepEqual(cleanSettings({ density: "compact", motion: "reduced", notify: "off", theme: "hot" }), {
    density: "compact",
    motion: "reduced",
    notify: "off",
  });
  assert.deepEqual(cleanSettings({ density: "huge" }), { density: "regular", motion: "full", notify: "on" });
});
