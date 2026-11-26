import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { reviewSeat } from "./kiln-review.mjs";

function git(dir, args) {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || args.join(" "));
}

function computer(root, repoId) {
  const dir = path.join(root, "computers", repoId.replace(/\//g, "_"));
  fs.mkdirSync(path.join(dir, ".kiln"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".kiln", "MACHINE.json"), JSON.stringify({ repoId }));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "review@kiln"]);
  git(dir, ["config", "user.name", "kiln"]);
  return dir;
}

test("a review quotes the file and does not invent a port", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-review-"));
  const home = computer(root, "seat/home");
  fs.writeFileSync(path.join(home, "STATUS.md"), "launchpad answers on the worker. The forge web is a separate port.\n");
  git(home, ["add", "--", "STATUS.md"]);
  git(home, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", "status beacon"]);
  const held = computer(root, "seat/horizon");
  fs.writeFileSync(path.join(held, "BENCH.md"), "hold\n");
  git(held, ["add", "--", "BENCH.md"]);
  git(held, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", "charter"]);
  fs.writeFileSync(path.join(held, ".kiln", "bench.json"), "{}");

  const out = await reviewSeat({
    handle: "seat",
    question: "where does launchpad answer",
    root,
    probe: async () => ({ name: "forge", port: 8080, ok: false }),
  });
  assert.equal(out.ok, true);
  assert.match(out.text, /Repos — 2, all under seat\//);
  assert.match(out.text, /Bench & scratch/);
  assert.match(out.text, /forge :8080 — still down/);
  assert.match(out.text, /STATUS.md: launchpad answers/);
  assert.equal(out.text.includes("8901"), false);
  assert.equal(out.text.includes("all ready"), false);
  const missed = await reviewSeat({
    handle: "seat",
    question: "autoscaling policy",
    root,
    probe: async () => ({ port: 8080, ok: true }),
  });
  assert.match(missed.text, /do not say/);
  assert.match(missed.text, /forge :8080 ✓/);
});
