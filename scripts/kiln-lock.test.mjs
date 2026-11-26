import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  casPath,
  inspectLock,
  loadLock,
  restoreLock,
  sha256File,
} from "./kiln-lock.mjs";

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function sha(text) {
  return createHash("sha256").update(text).digest("hex");
}

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "kiln-lock-"));
  mkdirSync(join(root, "public", "freeze"), { recursive: true });
  mkdirSync(join(root, "public", "assets"), { recursive: true });
  mkdirSync(join(root, "cas", "sha256"), { recursive: true });
  return root;
}

function putCas(root, hash, body) {
  const dest = casPath(root, hash);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
}

test("loadLock refuses a missing or unsigned lock", () => {
  const root = makeRoot();
  assert.throws(() => loadLock(root), /missing lock file/);
  writeFileSync(join(root, "public", "freeze", "LOCK.json"), JSON.stringify({ spec: "nope", files: [] }));
  assert.throws(() => loadLock(root), /not kiln-lock\/v1/);
});

test("inspectLock reports ok, mismatch, and missing", () => {
  const root = makeRoot();
  const good = "studio ok\n";
  const hash = sha(good);
  writeFileSync(join(root, "public", "assets", "studio-tabs.js"), good);
  writeFileSync(
    join(root, "public", "freeze", "LOCK.json"),
    JSON.stringify({
      spec: "kiln-lock/v1",
      files: [
        { path: "public/assets/studio-tabs.js", sha256: hash, reason: "studio" },
        { path: "public/index.html", sha256: sha("<html/>"), reason: "shell" },
      ],
    }),
  );
  const rows = inspectLock(root, loadLock(root));
  assert.equal(rows[0].status, "ok");
  assert.equal(rows[1].status, "missing");
});

test("restoreLock copies CAS bytes over a mismatch and leaves matching files", () => {
  const root = makeRoot();
  const studio = "function AgentChat(){}\n";
  const html = "<!doctype html>KILN\n";
  const studioHash = sha(studio);
  const htmlHash = sha(html);
  writeFileSync(join(root, "public", "assets", "studio-tabs.js"), "OVERWRITTEN\n");
  writeFileSync(join(root, "public", "index.html"), html);
  putCas(root, studioHash, studio);
  putCas(root, htmlHash, html);
  writeFileSync(
    join(root, "public", "freeze", "LOCK.json"),
    JSON.stringify({
      spec: "kiln-lock/v1",
      files: [
        { path: "public/assets/studio-tabs.js", sha256: studioHash, reason: "studio" },
        { path: "public/index.html", sha256: htmlHash, reason: "shell" },
      ],
    }),
  );
  const result = restoreLock(root, loadLock(root));
  assert.deepEqual(result.restored, ["public/assets/studio-tabs.js"]);
  assert.deepEqual(result.ok, ["public/index.html"]);
  assert.equal(result.failed.length, 0);
  assert.equal(readFileSync(join(root, "public", "assets", "studio-tabs.js"), "utf8"), studio);
  assert.equal(sha256File(join(root, "public", "assets", "studio-tabs.js")), studioHash);
});

test("restoreLock fails closed when CAS is missing", () => {
  const root = makeRoot();
  writeFileSync(join(root, "public", "assets", "studio-tabs.js"), "gone\n");
  writeFileSync(
    join(root, "public", "freeze", "LOCK.json"),
    JSON.stringify({
      spec: "kiln-lock/v1",
      files: [{ path: "public/assets/studio-tabs.js", sha256: sha("real"), reason: "studio" }],
    }),
  );
  const result = restoreLock(root, loadLock(root));
  assert.equal(result.restored.length, 0);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].error, /missing cas/);
  assert.equal(readFileSync(join(root, "public", "assets", "studio-tabs.js"), "utf8"), "gone\n");
});

test("workspace lock file exists and names studio", () => {
  const lock = loadLock(TEMPLATE_ROOT);
  const paths = lock.files.map((f) => f.path);
  assert.ok(paths.includes("public/assets/studio-tabs.js"));
  assert.ok(paths.includes("public/assets/kiln-chat.css"));
  assert.ok(paths.includes("scripts/agent-turn.mjs"));
  assert.equal(
    paths.includes("public/assets/routes-BLZbLf8-.js"),
    false,
    "marketing routes stay unlocked",
  );
  assert.ok(existsSync(casPath(TEMPLATE_ROOT, lock.files[0].sha256)));
});
