/**
 * Ship a Kiln computer: run the checks here, open the live app, push a branch to GitHub.
 * Never pushes main. A failed check does not push.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { githubOpenPull, githubPushBranch } from "./github-engine.mjs";
import { noteChecks, receiptOf } from "./kiln-board.mjs";
import { bootSpace, ensureCapsule, runTests, spaceHome } from "./kiln-space.mjs";

function liveHref(origin, repoId) {
  const [owner, ...rest] = String(repoId || "").split("/");
  const name = rest.join("/") || "home";
  const href = `/live/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/`;
  const base = String(origin || "").replace(/\/+$/, "");
  if (!base || /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base)) return href;
  return `${base}${href}`;
}

function splitGithub(spec) {
  const raw = String(spec || "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/i, "");
  const [owner, ...rest] = raw.split("/").filter(Boolean);
  return { owner: owner || "", repo: rest.join("/") };
}

function branchName(asked) {
  const raw = String(asked || "").trim();
  if (raw) {
    return raw.replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/^\/+|\/+$/g, "").slice(0, 80);
  }
  return `kiln/ship-${Date.now().toString(36)}`;
}

function gitAt(dir, args) {
  return spawnSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    timeout: 40000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
}

function copyTree(from, to) {
  const skip = new Set([".git", "node_modules", ".kiln"]);
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir)) {
      if (skip.has(name)) continue;
      const abs = path.join(dir, name);
      const next = rel ? `${rel}/${name}` : name;
      const st = fs.statSync(abs);
      if (st.isDirectory()) {
        walk(abs, next);
        continue;
      }
      if (!st.isFile() || st.size > 200_000) continue;
      const dest = path.join(to, next);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs, dest);
    }
  };
  walk(from, "");
}

function stageOnGithub({ owner, repo, base, branch, source, into, message }) {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-ship-"));
  const remote = `https://github.com/${owner}/${repo}.git`;
  const repoDir = path.join(wt, "repo");
  let cloned = gitAt(wt, ["clone", "--depth", "1", "--branch", branch, remote, "repo"]);
  if (cloned.status !== 0) {
    fs.rmSync(repoDir, { recursive: true, force: true });
    cloned = gitAt(wt, ["clone", "--depth", "1", "--branch", base, remote, "repo"]);
  }
  if (cloned.status !== 0) {
    fs.mkdirSync(repoDir, { recursive: true });
    gitAt(repoDir, ["init", "-q", "-b", base]);
  }
  copyTree(source, path.join(repoDir, into));
  gitAt(repoDir, ["config", "user.email", "ship@kiln"]);
  gitAt(repoDir, ["config", "user.name", "kiln"]);
  gitAt(repoDir, ["add", "-A"]);
  const diff = gitAt(repoDir, ["diff", "--cached", "--quiet"]);
  if (diff.status === 0) {
    fs.rmSync(wt, { recursive: true, force: true });
    return { ok: false, error: "nothing new to ship", dir: null };
  }
  const committed = gitAt(repoDir, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", message.slice(0, 72)]);
  if (committed.status !== 0) {
    const error = String(committed.stderr || committed.stdout || "commit failed").slice(0, 240);
    fs.rmSync(wt, { recursive: true, force: true });
    return { ok: false, error, dir: null };
  }
  gitAt(repoDir, ["branch", "-f", branch, "HEAD"]);
  return { ok: true, dir: repoDir, cleanup: () => fs.rmSync(wt, { recursive: true, force: true }) };
}

function writeShip(dir, doc) {
  fs.mkdirSync(path.join(dir, ".kiln"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".kiln", "SHIP.json"), JSON.stringify(doc, null, 2));
}

export async function shipComputer({ repoId, origin, github, owner, repo, base, title, body, branch, force } = {}) {
  const id = String(repoId || "").trim();
  if (!id || !id.includes("/")) return { ok: false, error: "repo required" };
  if (id.split("/")[0] === "kiln") return { ok: false, error: "kiln origin is sealed" };
  const named = splitGithub(github);
  const ghOwner = String(owner || named.owner || "").trim();
  const ghRepo = String(repo || named.repo || "").trim();
  const line = branchName(branch);
  if (!ghOwner || !ghRepo) return { ok: false, error: "github owner/name required" };
  if (line === "main" || line === "master") return { ok: false, error: "ship pushes a kiln branch, not main" };

  bootSpace({ repoId: id, owner: id.split("/")[0] });
  const dir = spaceHome(id);
  ensureCapsule(dir, id, { brief: "capsule live preview", writes: [] });
  const started = Date.now();
  const tests = runTests({ repoId: id });
  noteChecks(id, tests, Date.now() - started);
  const app = liveHref(origin, id);
  if (!tests.ok && !force) {
    const rec = receiptOf(id);
    return {
      ok: false,
      error: "checks failed",
      tests: { ok: false, passed: tests.passed, failed: tests.failed },
      app,
      github: { ok: false, error: "not pushed" },
      text: rec.ok ? rec.text : "",
      note: "Print text. Nothing was pushed.",
    };
  }

  const message = String(title || `ship ${id}`).slice(0, 72);
  const staged = stageOnGithub({
    owner: ghOwner,
    repo: ghRepo,
    base: base || "main",
    branch: line,
    source: dir,
    into: path.join("kiln-ship", id.replace(/[^a-zA-Z0-9._/-]+/g, "_")),
    message,
  });
  if (!staged.ok) {
    return {
      ok: false,
      error: staged.error,
      tests: { ok: !!tests.ok, passed: tests.passed, failed: tests.failed },
      app,
      github: { ok: false, error: staged.error },
      note: "Print this. Nothing was pushed.",
    };
  }
  const pushed = await githubPushBranch({ dir: staged.dir, owner: ghOwner, repo: ghRepo, branch: line });
  if (staged.cleanup) staged.cleanup();
  let pr = null;
  if (pushed.ok) {
    pr = await githubOpenPull({
      owner: ghOwner,
      repo: ghRepo,
      head: line,
      base: base || "main",
      title: String(title || `Kiln ship ${id}`).slice(0, 180),
      body: String(body || `Shipped from ${id}.\n\nApp: ${app}`).slice(0, 8000),
    });
  }
  const githubRec = {
    ok: !!pushed.ok,
    remote: pushed.remote || `github.com/${ghOwner}/${ghRepo}`,
    branch: line,
    url: (pr && pr.url) || (pushed.ok ? `https://github.com/${ghOwner}/${ghRepo}/tree/${line}` : ""),
    number: pr && pr.number,
    error: pushed.ok ? (pr && !pr.ok ? pr.error || "" : "") : pushed.error || "push failed",
  };
  if (pushed.ok) {
    writeShip(dir, { at: new Date().toISOString(), app, github: githubRec });
    const pulls = path.join(dir, ".kiln", "pulls");
    fs.mkdirSync(pulls, { recursive: true });
    fs.writeFileSync(
      path.join(pulls, `${line.replace(/[^\w.-]+/g, "_")}.json`),
      JSON.stringify({ id: line, repoId: id, branch: line, title: title || line, url: githubRec.url, at: new Date().toISOString(), status: pr && pr.ok ? "open" : "pushed", github: githubRec }, null, 2),
    );
  }
  const rec = receiptOf(id);
  return {
    ok: !!pushed.ok,
    repoId: id,
    tests: { ok: !!tests.ok, passed: tests.passed, failed: tests.failed },
    app,
    github: githubRec,
    receipt: rec.ok ? rec : null,
    text: rec.ok ? rec.text : "",
    error: pushed.ok ? undefined : githubRec.error,
    note: "Print text. Do not print git output.",
  };
}
