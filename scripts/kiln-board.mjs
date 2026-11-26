/**
 * Seat board and push receipts.
 * A receipt is the commit. It is not a git dump.
 * Checks are recorded only when this computer's tests actually ran.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { loadUserRepos } from "./kiln-accounts.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");

function computersDir(opts) {
  return path.join((opts && opts.root) || ROOT, "computers");
}

function safe(id) {
  return String(id || "")
    .replace(/[^a-zA-Z0-9._/-]+/g, "_")
    .replace(/\/+/g, "_")
    .slice(0, 80);
}

function dirOf(repoId, opts) {
  return path.join(computersDir(opts), safe(repoId));
}

function git(dir, args) {
  const r = spawnSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    timeout: 8000,
    maxBuffer: 200_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return r.status === 0 ? String(r.stdout || "").trim() : "";
}

function short(sha) {
  return String(sha || "").replace(/[^a-f0-9]/gi, "").slice(0, 7);
}

function ageOf(iso) {
  const t = Date.parse(iso);
  if (!t) return "";
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 36) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function msOf(ms) {
  const n = Number(ms) || 0;
  if (n < 1000) return `${n}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

function readChecks(dir) {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, ".kiln", "checks.json"), "utf8"));
    if (!doc || typeof doc.ok !== "boolean") return null;
    return {
      ok: doc.ok,
      passed: Number(doc.passed) || 0,
      failed: Number(doc.failed) || 0,
      ms: Number(doc.ms) || 0,
      at: doc.at || "",
    };
  } catch {
    return null;
  }
}

function readShip(dir) {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, ".kiln", "SHIP.json"), "utf8"));
    const lines = [];
    if (doc.app) lines.push(`App: ${doc.app}`);
    if (doc.github && doc.github.ok && doc.github.url) lines.push(`GitHub: ${doc.github.url}`);
    else if (doc.github && doc.github.ok && doc.github.remote) lines.push(`GitHub: ${doc.github.remote} ${doc.github.branch || ""}`.trim());
    return lines;
  } catch {
    return [];
  }
}

function oneLine(row) {
  const checks = row.checks ? (row.checks.ok ? " · checks pass" : " · checks fail") : "";
  const subject = row.subject ? ` · ${row.subject}` : "";
  const age = row.age ? ` · ${row.age}` : "";
  return `${row.repo} — ${row.branch} @ ${row.head}${age}${subject}${checks}`;
}

export function noteChecks(repoId, tests, ms, opts = {}) {
  const dir = dirOf(repoId, opts);
  if (!fs.existsSync(dir)) return { ok: false, error: "no computer" };
  const rec = {
    at: new Date().toISOString(),
    ok: !!(tests && tests.ok),
    passed: Number(tests && tests.passed) || 0,
    failed: Number(tests && tests.failed) || 0,
    ms: Math.max(0, Number(ms) || 0),
  };
  fs.mkdirSync(path.join(dir, ".kiln"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".kiln", "checks.json"), JSON.stringify(rec));
  return { ok: true, checks: rec };
}

export function receiptOf(repoId, opts = {}) {
  const id = String(repoId || "").trim();
  const dir = dirOf(id, opts);
  if (!id || !id.includes("/") || !fs.existsSync(path.join(dir, ".git"))) {
    return { ok: false, error: "no computer" };
  }
  const raw = git(dir, ["log", "-1", "--format=%H%x1f%P%x1f%s%x1f%cI"]);
  if (!raw) return { ok: false, error: "no commits" };
  const [hash, parents, subjectRaw, at] = raw.split("\x1f");
  const to = short(hash);
  const from = short(String(parents || "").split(/\s+/)[0] || "");
  const branch = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]) || "main";
  const subject = String(subjectRaw || "").replace(/\s+/g, " ").trim().slice(0, 96);
  const checks = readChecks(dir);
  const move = from ? `${short(from)} → ${to}` : to;
  const lines = [`KILN · ${id}`, `${branch} · ${move}`];
  if (checks) lines.push(`${checks.ok ? "checks pass" : "checks fail"} · ${msOf(checks.ms)}`);
  if (subject) lines.push(subject);
  const shipped = readShip(dir);
  if (shipped.length) lines.push(...shipped);
  else lines.push("Destination: KILN-local");
  return {
    ok: true,
    kind: "receipt",
    repo: id,
    branch,
    from: from || "",
    to,
    subject,
    at: at || "",
    age: ageOf(at),
    destination: shipped.length ? shipped.join(" · ") : "KILN-local",
    app: shipped.find((line) => line.startsWith("App: "))?.slice(5) || "",
    githubUrl: shipped.find((line) => line.startsWith("GitHub: "))?.slice(8) || "",
    checks,
    text: lines.join("\n"),
    note: "Print text. Do not print git output.",
  };
}

function groupOf(name, subject, hasBench) {
  if (hasBench) return "bench";
  if (/(e2e|dbg|scratch|workshop|keeptest|quickverify|probe|^tmp$)/i.test(name)) return "scratch";
  if (name === "home" && /^(init|boot|conductor|computer|genesis)\b/i.test(subject || "")) return "scratch";
  return "active";
}

function rowOf(repoId, opts) {
  const dir = dirOf(repoId, opts);
  if (!fs.existsSync(path.join(dir, ".git"))) return null;
  const rec = receiptOf(repoId, opts);
  if (!rec.ok) return null;
  const name = repoId.split("/").slice(1).join("/") || repoId;
  const hasBench = fs.existsSync(path.join(dir, ".kiln", "bench.json"));
  return {
    repo: repoId,
    branch: rec.branch,
    head: rec.to,
    at: rec.at,
    age: rec.age,
    subject: rec.subject,
    checks: rec.checks,
    group: groupOf(name, rec.subject, hasBench),
  };
}

function collect(handle, opts) {
  const ids = [];
  const push = (id) => {
    const repo = String(id || "").trim();
    if (!repo || !repo.includes("/") || repo.split("/")[0] !== handle) return;
    if (!ids.includes(repo)) ids.push(repo);
  };
  push(`${handle}/home`);
  try {
    const doc = loadUserRepos(handle);
    for (const repo of doc.repos || []) push(repo && repo.id);
  } catch {
    /* seat may have computers and no repos file */
  }
  try {
    for (const name of fs.readdirSync(computersDir(opts))) {
      if (!name.startsWith(`${handle}_`)) continue;
      try {
        const machine = JSON.parse(fs.readFileSync(path.join(computersDir(opts), name, ".kiln", "MACHINE.json"), "utf8"));
        push(machine && machine.repoId);
      } catch {
        /* not a seated computer */
      }
    }
  } catch {
    /* none */
  }
  return ids.slice(0, 32);
}

export function repoBoard(handle, opts = {}) {
  const h = String(handle || "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 24)
    .toLowerCase();
  if (!h) return { ok: false, error: "sign in" };
  const active = [];
  const bench = [];
  const scratch = [];
  for (const id of collect(h, opts)) {
    const row = rowOf(id, opts);
    if (!row) continue;
    if (row.group === "bench") bench.push(row);
    else if (row.group === "scratch") scratch.push(row);
    else active.push(row);
  }
  const byTime = (a, b) => String(b.at || "").localeCompare(String(a.at || ""));
  active.sort(byTime);
  bench.sort(byTime);
  const lines = ["Active"];
  if (!active.length) lines.push("- none");
  else for (const row of active) lines.push("- " + oneLine(row));
  if (bench.length) {
    lines.push("", "Bench");
    for (const row of bench) lines.push("- " + oneLine(row));
  }
  if (scratch.length) {
    lines.push("", "Scratch");
    lines.push(scratch.map((row) => `${row.repo} @ ${row.head}`).join(" · "));
  }
  return {
    ok: true,
    handle: h,
    active,
    bench,
    scratch,
    text: lines.join("\n"),
    note: "One line per computer. Print text. Do not print git output.",
  };
}
