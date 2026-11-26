/**
 * Muse-style space computers.
 * Each (handle, repo) is a real HOME on disk. Conductor memory is the main agent.
 * Spawned agents get their own HOME under .kiln/agents/<id>.
 * Jobs run on git worktrees so a crew never shares a dirty tree.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const COMPUTERS = path.join(ROOT, "computers");

function safe(id) {
  return String(id || "kiln/kiln")
    .replace(/[^a-zA-Z0-9._/-]+/g, "_")
    .replace(/\/+/g, "_")
    .slice(0, 80);
}

export function spaceHome(repoId) {
  const dir = path.join(COMPUTERS, safe(repoId));
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, ".kiln", "memory"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".kiln", "agents"), { recursive: true });
  return dir;
}

function writeIfMissing(file, body) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return true;
}

function listTreeFiles(dir, { withContent = true, maxFiles = 80, maxBytes = 16000 } = {}) {
  const out = [];
  function walk(d, prefix, depth) {
    if (depth > 8 || out.length >= maxFiles) return;
    let ents = [];
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    ents.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of ents) {
      if (out.length >= maxFiles) return;
      if (e.name === ".git" || e.name === "node_modules" || e.name === ".kiln" || e.name === "__pycache__") continue;
      const abs = path.join(d, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(abs, rel, depth + 1);
        continue;
      }
      let st;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      const rec = { path: rel, size: st.size };
      if (withContent && st.size <= maxBytes) {
        try {
          rec.content = fs.readFileSync(abs, "utf8");
        } catch {
          /* binary */
        }
      }
      out.push(rec);
    }
  }
  walk(dir, "", 0);
  return out;
}

export function listSpace(repoId, opts = {}) {
  const dir = spaceHome(repoId);
  return listTreeFiles(dir, {
    withContent: opts.withContent !== false,
    maxFiles: opts.maxFiles || 240,
    maxBytes: opts.maxBytes == null ? 65536 : opts.maxBytes,
  });
}

function gitCfg(dir) {
  spawnSync("git", ["config", "user.email", "kiln@local"], { cwd: dir, stdio: "ignore" });
  spawnSync("git", ["config", "user.name", "kiln"], { cwd: dir, stdio: "ignore" });
}

function ensureIgnore(dir) {
  const gi = path.join(dir, ".gitignore");
  let cur = "";
  try {
    cur = fs.readFileSync(gi, "utf8");
  } catch {
    cur = "";
  }
  const need = [".kiln/", "__pycache__/", "*.pyc", ".jobs/", "node_modules/"];
  let next = cur;
  for (const line of need) {
    if (!next.split(/\r?\n/).includes(line)) next = (next.replace(/\s*$/, "") + "\n" + line).replace(/^\n/, "");
  }
  if (next !== cur) fs.writeFileSync(gi, next.endsWith("\n") ? next : next + "\n");
}

function ensureGit(dir) {
  if (!fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["init"], { cwd: dir, stdio: "ignore" });
    gitCfg(dir);
    ensureIgnore(dir);
    spawnSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
    spawnSync(
      "git",
      ["-c", "user.email=kiln@local", "-c", "user.name=kiln", "commit", "-m", "seat this computer", "--allow-empty"],
      { cwd: dir, stdio: "ignore" },
    );
    return;
  }
  gitCfg(dir);
  ensureIgnore(dir);
}

export function bootSpace({ repoId, owner, files, agentId, role } = {}) {
  const id = repoId || `${owner || "kiln"}/space`;
  const dir = spaceHome(id);
  const kiln = path.join(dir, ".kiln");
  const existed = fs.existsSync(path.join(kiln, "MACHINE.json"));
  const machine = {
    repoId: id,
    owner: owner || String(id).split("/")[0],
    home: dir,
    isolation: `kiln://${id}.git`,
    shells: ["wsl", "pwsh", "kilnsh"],
    bootAt: new Date().toISOString(),
    conductor: "conductor",
  };
  fs.writeFileSync(path.join(kiln, "MACHINE.json"), JSON.stringify(machine, null, 2));
  writeIfMissing(
    path.join(dir, "COMPUTER.md"),
    `# Computer on ${id}\n\nThis tree is a kiln. HOME is this folder. WSL · PowerShell · kilnsh.\nAgents git-commit here. The conductor remembers.\n`,
  );
  const condFile = path.join(kiln, "memory", "conductor.json");
  if (!fs.existsSync(condFile)) {
    fs.writeFileSync(
      condFile,
      JSON.stringify(
        {
          agent: "conductor",
          repoId: id,
          kind: "main",
          entries: [{ at: machine.bootAt, kind: "episodic", text: `conductor seated on ${id}` }],
        },
        null,
        2,
      ),
    );
  }
  if (agentId) {
    const aid = String(agentId).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48);
    const ahome = path.join(kiln, "agents", aid);
    fs.mkdirSync(ahome, { recursive: true });
    fs.writeFileSync(
      path.join(kiln, "memory", `${aid}.json`),
      JSON.stringify(
        {
          agent: aid,
          role: role || "builder",
          repoId: id,
          kind: "spawned",
          entries: [{ at: new Date().toISOString(), kind: "episodic", text: `${aid} spawned on ${id}` }],
        },
        null,
        2,
      ),
    );
  }
  if (Array.isArray(files)) {
    let n = 0;
    for (const f of files.slice(0, 80)) {
      const rel = String(f.path || "").replace(/^\/+/, "").replace(/\.\./g, "");
      if (!rel || typeof f.content !== "string") continue;
      const dest = path.join(dir, rel);
      if (!dest.startsWith(dir)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, f.content);
      n += 1;
    }
    machine.files = n;
  }
  const listed = listTreeFiles(dir);
  ensureGit(dir);
  return { ok: true, repoId: id, home: dir, isolation: machine.isolation, shells: machine.shells, conductor: true, created: !existed, files: listed, fileCount: listed.length };
}

export function rememberSpace({ repoId, agentId, kind, text } = {}) {
  const body = String(text || "").replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!body) return { ok: false, error: "nothing to remember" };
  const dir = spaceHome(repoId);
  const who = agentId ? String(agentId).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48) : "conductor";
  const file = path.join(dir, ".kiln", "memory", `${who}.json`);
  let doc = { agent: who, repoId, kind: who === "conductor" ? "main" : "spawned", entries: [] };
  try {
    doc = { ...doc, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    /* new bank */
  }
  if (!Array.isArray(doc.entries)) doc.entries = [];
  const bank = ["working", "episodic", "semantic", "procedural"].includes(kind) ? kind : "episodic";
  const last = doc.entries[doc.entries.length - 1];
  if (last && last.kind === bank && last.text === body) {
    return { ok: true, agent: who, n: doc.entries.length, duplicate: true, working: doc.working || null };
  }
  const row = { at: new Date().toISOString(), kind: bank, text: body };
  doc.entries.push(row);
  doc.entries = doc.entries.slice(-200);
  if (bank === "working") doc.working = row;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  return { ok: true, agent: who, n: doc.entries.length, duplicate: false, working: doc.working || null };
}

export function readMemory({ repoId, agentId } = {}) {
  const dir = spaceHome(repoId);
  const who = agentId ? String(agentId).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48) : "conductor";
  const file = path.join(dir, ".kiln", "memory", `${who}.json`);
  try {
    return { ok: true, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return { ok: true, agent: who, repoId, entries: [] };
  }
}

export function recallMemory({ repoId, agentId, q, limit } = {}) {
  const doc = readMemory({ repoId, agentId });
  const words = String(q || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .slice(0, 8);
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  const ranked = entries
    .map((entry, index) => {
      const text = String(entry.text || "").toLowerCase();
      const score = words.reduce((n, word) => n + (text.includes(word) ? 1 : 0), 0);
      return { entry, index, score };
    })
    .filter((row) => !words.length || row.score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index);
  const cap = Math.max(1, Math.min(12, Number(limit) || 8));
  const hits = ranked.slice(0, cap).map((row) => ({
    at: row.entry.at,
    kind: row.entry.kind,
    text: String(row.entry.text || "").slice(0, 280),
  }));
  return {
    ok: true,
    repoId,
    working: doc.working ? { at: doc.working.at, text: String(doc.working.text || "").slice(0, 280) } : null,
    hits,
    n: ranked.length,
  };
}

export function gitRun(dir, args, { timeout = 20000 } = {}) {
  const r = spawnSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    timeout,
    maxBuffer: 2_000_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return {
    ok: r.status === 0,
    code: r.status == null ? 1 : r.status,
    out: String(r.stdout || ""),
    err: String(r.stderr || ""),
  };
}

export function headBranch(dir) {
  const r = gitRun(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const b = String(r.out || "").trim();
  return b && b !== "HEAD" ? b : "master";
}

export function gitRev(dir) {
  const r = gitRun(dir, ["rev-parse", "HEAD"]);
  return String(r.out || "").trim();
}

export function jobsRoot(repoId) {
  const dir = path.join(COMPUTERS, ".jobs", safe(repoId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function worktreeDir(repoId, jobId) {
  const id = String(jobId || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "")
    .slice(0, 48);
  return path.join(jobsRoot(repoId), id);
}

export function openWorktree({ repoId, jobId } = {}) {
  const id = String(jobId || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "")
    .slice(0, 48);
  if (!repoId || !id) return { ok: false, error: "repo and job required" };
  const dir = spaceHome(repoId);
  ensureGit(dir);
  ensureIgnore(dir);
  gitCfg(dir);
  const wt = worktreeDir(repoId, id);
  const branch = `kiln/job-${id}`;
  if (fs.existsSync(wt) && (fs.existsSync(path.join(wt, ".git")) || fs.existsSync(path.join(wt, "COMPUTER.md")))) {
    return { ok: true, repoId, jobId: id, home: dir, worktree: wt, branch, reused: true, head: gitRev(wt) };
  }
  gitRun(dir, ["worktree", "prune"]);
  fs.mkdirSync(path.dirname(wt), { recursive: true });
  if (fs.existsSync(wt) && !fs.existsSync(path.join(wt, ".git"))) {
    try {
      fs.rmSync(wt, { recursive: true, force: true });
    } catch {
      /* retry add */
    }
  }
  let r = gitRun(dir, ["worktree", "add", "-b", branch, wt, "HEAD"]);
  if (!r.ok) {
    r = gitRun(dir, ["worktree", "add", wt, branch]);
  }
  if (!r.ok) {
    return { ok: false, error: (r.err || r.out || "worktree failed").trim().slice(0, 400) };
  }
  gitCfg(wt);
  return { ok: true, repoId, jobId: id, home: dir, worktree: wt, branch, reused: false, head: gitRev(wt) };
}

export function dropWorktree({ repoId, jobId } = {}) {
  const dir = spaceHome(repoId);
  const wt = worktreeDir(repoId, jobId);
  gitRun(dir, ["worktree", "remove", "--force", wt]);
  gitRun(dir, ["worktree", "prune"]);
  try {
    fs.rmSync(wt, { recursive: true, force: true });
  } catch {
    /* gone */
  }
  return { ok: true };
}

function resolveIn(root, rel) {
  const rootR = path.resolve(root);
  const dest = path.resolve(rootR, String(rel || ".").replace(/^\/+/, "").replace(/\\/g, "/"));
  if (dest !== rootR && !dest.startsWith(rootR + path.sep)) return null;
  return dest;
}

export function writeOnTree(treeDir, rel, content, message) {
  const relNorm = String(rel || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\.\./g, "");
  if (!relNorm || relNorm === ".git" || relNorm.startsWith(".git/")) return { ok: false, error: "bad path" };
  const dest = resolveIn(treeDir, relNorm);
  if (!dest || dest === path.resolve(treeDir)) return { ok: false, error: "bad path" };
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const body = String(content ?? "");
  if (body.length > 800_000) return { ok: false, error: "file too large" };
  fs.writeFileSync(dest, body);
  gitCfg(treeDir);
  gitRun(treeDir, ["add", "--", relNorm]);
  const msg = String(message || `job: ${relNorm}`).slice(0, 72);
  gitRun(treeDir, ["-c", "commit.gpgsign=false", "commit", "-m", msg, "--allow-empty"]);
  return { ok: true, path: relNorm, commit: gitRev(treeDir), bytes: body.length };
}

export function gitDiff({ repoId, jobId, against } = {}) {
  const dir = spaceHome(repoId);
  ensureGit(dir);
  const base = against || headBranch(dir);
  let cwd = dir;
  let range = "";
  if (jobId) {
    const wt = worktreeDir(repoId, jobId);
    if (fs.existsSync(wt)) {
      cwd = wt;
      const branch = `kiln/job-${String(jobId).replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 48)}`;
      range = `${base}...HEAD`;
      const named = gitRun(cwd, ["rev-parse", "--verify", branch]);
      if (named.ok) range = `${base}...${branch}`;
    }
  }
  const stat = gitRun(cwd, range ? ["diff", "--stat", range] : ["diff", "--stat"]);
  const patch = gitRun(cwd, range ? ["diff", "--no-color", range] : ["diff", "--no-color"]);
  const names = gitRun(cwd, range ? ["diff", "--name-status", range] : ["diff", "--name-status"]);
  const files = String(names.out || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([A-Z])\s+(.*)$/);
      return m ? { status: m[1], path: m[2] } : { status: "M", path: l };
    });
  const status = gitRun(cwd, ["status", "--porcelain"]);
  return {
    ok: true,
    repoId,
    jobId: jobId || null,
    base,
    head: gitRev(cwd),
    stat: String(stat.out || "").trim(),
    patch: String(patch.out || ""),
    files,
    dirty: String(status.out || "").trim(),
  };
}

export function gitStatus({ repoId, jobId } = {}) {
  const dir = jobId ? worktreeDir(repoId, jobId) : spaceHome(repoId);
  ensureGit(spaceHome(repoId));
  const r = gitRun(dir, ["status", "--porcelain=v1", "-b"]);
  const log = gitRun(dir, ["log", "-5", "--oneline"]);
  return {
    ok: r.ok,
    repoId,
    jobId: jobId || null,
    branch: headBranch(dir),
    head: gitRev(dir),
    porcelain: String(r.out || "").trim(),
    log: String(log.out || "").trim(),
  };
}

export function runTests({ repoId, jobId } = {}) {
  const dir = jobId ? worktreeDir(repoId, jobId) : spaceHome(repoId);
  if (!fs.existsSync(dir)) return { ok: false, error: "no tree", checks: [] };
  const checks = [];
  function run(cmd, args, label, timeout = 20000) {
    const r = spawnSync(cmd, args, {
      cwd: dir,
      encoding: "utf8",
      timeout,
      maxBuffer: 400_000,
      env: { ...process.env, PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin" },
    });
    const rec = {
      label,
      ok: r.status === 0,
      code: r.status == null ? 1 : r.status,
      out: String(r.stdout || "").slice(0, 4000),
      err: String(r.stderr || "").slice(0, 1500),
    };
    checks.push(rec);
    return rec;
  }
  run("git", ["diff", "--check"], "git diff --check");
  const files = listTreeFiles(dir, { withContent: false, maxFiles: 60 });
  let js = 0;
  let py = 0;
  for (const f of files) {
    if (js < 12 && /\.(js|mjs)$/.test(f.path) && !f.path.includes("node_modules")) {
      run("node", ["--check", f.path], `syntax ${f.path}`);
      js += 1;
    }
    if (py < 12 && /\.py$/.test(f.path)) {
      run("python3", ["-m", "py_compile", f.path], `syntax ${f.path}`);
      py += 1;
    }
  }
  const pkgFile = path.join(dir, "package.json");
  if (fs.existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
      if (pkg && pkg.scripts && typeof pkg.scripts.test === "string" && pkg.scripts.test.trim()) {
        run("npm", ["test", "--silent"], "npm test", 25000);
      }
    } catch {
      /* skip */
    }
  }
  const html = files.find((f) => f.path === "index.html" || f.path.endsWith("/index.html"));
  if (html) {
    try {
      const body = fs.readFileSync(path.join(dir, html.path), "utf8");
      const ok = /<html|<!doctype html/i.test(body);
      checks.push({ label: `capsule ${html.path}`, ok, code: ok ? 0 : 1, out: ok ? "html capsule" : "missing html root", err: "" });
    } catch (e) {
      checks.push({ label: `capsule ${html.path}`, ok: false, code: 1, out: "", err: e instanceof Error ? e.message : "read failed" });
    }
  }
  const failed = checks.filter((c) => !c.ok);
  return {
    ok: failed.length === 0,
    repoId,
    jobId: jobId || null,
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
  };
}

export function mergeWorktree({ repoId, jobId, message } = {}) {
  const dir = spaceHome(repoId);
  ensureGit(dir);
  gitCfg(dir);
  const id = String(jobId || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "")
    .slice(0, 48);
  const branch = `kiln/job-${id}`;
  const wt = worktreeDir(repoId, id);
  const verify = gitRun(dir, ["rev-parse", "--verify", branch]);
  if (!verify.ok) return { ok: false, error: `no branch ${branch}` };
  const msg = String(message || `merge ${branch}`).slice(0, 72);
  const r = gitRun(dir, ["merge", "--no-ff", "--no-edit", "-m", msg, branch]);
  if (!r.ok) {
    gitRun(dir, ["merge", "--abort"]);
    return { ok: false, error: (r.err || r.out || "merge failed").trim().slice(0, 400), conflict: true };
  }
  gitRun(dir, ["worktree", "remove", "--force", wt]);
  gitRun(dir, ["worktree", "prune"]);
  try {
    fs.rmSync(wt, { recursive: true, force: true });
  } catch {
    /* gone */
  }
  const listed = listTreeFiles(dir);
  return { ok: true, repoId, jobId: id, branch, commit: gitRev(dir), files: listed, fileCount: listed.length };
}

export function livePath(repoId, file, { jobId } = {}) {
  const dir = jobId ? worktreeDir(repoId, jobId) : spaceHome(repoId);
  const rel = String(file || "index.html")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\.\./g, "");
  const name = !rel || rel.endsWith("/") ? `${rel}index.html` : rel;
  const dest = resolveIn(dir, name);
  if (!dest) return null;
  try {
    if (fs.existsSync(dest) && fs.statSync(dest).isFile()) return { dir, file: dest, rel: name };
  } catch {
    return null;
  }
  return { dir, file: null, rel: name };
}

export function isHtmlCapsule(body) {
  return /<!doctype\s+html|<html[\s>]/i.test(String(body || ""));
}

export function capsuleHtml(repoId, { files } = {}) {
  const iso = `kiln://${repoId || "kiln/home"}`;
  const owner = String(repoId || "").split("/")[0] || "kiln";
  const rows = (files || [])
    .filter((f) => f && f.path && f.path !== "index.html")
    .slice(0, 18)
    .map((f) => {
      const name = String(f.path).replace(/[<>&]/g, "");
      const size = Number(f.size) || 0;
      return `<li><span>${name}</span><span>${size}</span></li>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${iso}</title>
<style>
  :root{color-scheme:dark;--bg:#0b0b0d;--fg:#e7e7ea;--muted:#8a8a93;--line:#26262f}
  html,body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 "IBM Plex Sans",ui-sans-serif,system-ui,sans-serif}
  main{max-width:34rem;margin:0 auto;padding:clamp(2.2rem,16vh,8rem) 1.25rem 4rem}
  .iso{font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  h1{font-family:Newsreader,Georgia,serif;font-weight:500;font-size:clamp(1.7rem,4vw,2.2rem);letter-spacing:-.03em;margin:.45rem 0 .7rem}
  p{margin:0 0 1.4rem;color:var(--muted);max-width:28rem}
  ul{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
  li{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0;border-bottom:1px solid var(--line);font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
  li span:last-child{color:var(--muted)}
</style>
<main>
  <div class="iso">${iso}</div>
  <h1>This computer is live.</h1>
  <p>Owned by @${owner}. A write is a git commit. Isolation is the origin.</p>
  <ul>${rows || "<li><span>Empty tree.</span><span>0</span></li>"}</ul>
</main>
</html>
`;
}

export function ensureCapsule(treeDir, repoId, { brief, writes } = {}) {
  const mentioned = /index\.html|\bcapsule\b|\bpreview\b|\blive origin\b/i.test(String(brief || ""));
  const wrote = (writes || []).some((w) => /(?:^|\/)index\.html$/.test(w.path));
  if (!mentioned && !wrote) return { ok: true, repaired: false, writes: writes || [] };
  const dest = path.join(treeDir, "index.html");
  let body = "";
  try {
    body = fs.readFileSync(dest, "utf8");
  } catch {
    body = "";
  }
  if (isHtmlCapsule(body)) return { ok: true, repaired: false, writes: writes || [] };
  const files = listTreeFiles(treeDir, { withContent: false, maxFiles: 40 });
  const out = writeOnTree(treeDir, "index.html", capsuleHtml(repoId, { files }), "job: index.html capsule");
  if (!out.ok) return { ok: false, error: out.error, writes: writes || [] };
  return {
    ok: true,
    repaired: true,
    writes: [...(writes || []), { path: out.path, commit: out.commit, bytes: out.bytes }],
  };
}

export function listLive(repoId, { jobId } = {}) {
  const dir = jobId ? worktreeDir(repoId, jobId) : spaceHome(repoId);
  if (!fs.existsSync(dir)) return [];
  return listTreeFiles(dir, { withContent: false, maxFiles: 120 });
}
