import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { noteChecks, receiptOf, repoBoard } from "./kiln-board.mjs";

function git(dir, args) {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || args.join(" "));
}

function computer(root, repoId) {
  const dir = path.join(root, "computers", repoId.replace(/\//g, "_"));
  fs.mkdirSync(path.join(dir, ".kiln"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".kiln", "MACHINE.json"),
    JSON.stringify({ repoId, owner: repoId.split("/")[0] }),
  );
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "board@kiln"]);
  git(dir, ["config", "user.name", "kiln"]);
  return dir;
}

function commit(dir, name, body, message) {
  fs.writeFileSync(path.join(dir, name), body);
  git(dir, ["add", "--", name]);
  git(dir, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", message]);
}

test("a push is a receipt, and the board groups computers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-board-"));
  const opts = { root };
  const active = computer(root, "seat/minutely");
  commit(active, "a.txt", "one", "first");
  commit(active, "b.txt", "two", "Stream pillar: alerts go terminal-wide");
  const held = computer(root, "seat/horizon");
  commit(held, "BENCH.md", "hold", "charter");
  fs.writeFileSync(path.join(held, ".kiln", "bench.json"), JSON.stringify({ status: "held" }));
  const scratch = computer(root, "seat/agent-e2e");
  commit(scratch, "t.txt", "t", "probe");

  const rec = receiptOf("seat/minutely", opts);
  assert.equal(rec.ok, true);
  assert.match(rec.text, /KILN · seat\/minutely/);
  assert.match(rec.text, /main · [a-f0-9]{7} → [a-f0-9]{7}/);
  assert.match(rec.text, /Stream pillar/);
  assert.match(rec.text, /Destination: KILN-local/);
  assert.equal(rec.text.includes("diff --git"), false);
  assert.equal(rec.checks, null);

  const noted = noteChecks("seat/minutely", { ok: true, passed: 4, failed: 0 }, 2300, opts);
  assert.equal(noted.ok, true);
  const checked = receiptOf("seat/minutely", opts);
  assert.match(checked.text, /checks pass · 2\.3s/);
  assert.equal(checked.text.includes("CI"), false);

  const board = repoBoard("seat", opts);
  assert.equal(board.ok, true);
  assert.deepEqual(board.active.map((row) => row.repo), ["seat/minutely"]);
  assert.deepEqual(board.bench.map((row) => row.repo), ["seat/horizon"]);
  assert.deepEqual(board.scratch.map((row) => row.repo), ["seat/agent-e2e"]);
  assert.match(board.text, /^Active\n- seat\/minutely — main @ /);
  assert.match(board.text, /Scratch\nseat\/agent-e2e @ /);
  assert.equal(board.text.includes("diff --git"), false);
});
