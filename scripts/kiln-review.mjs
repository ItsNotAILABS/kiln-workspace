/**
 * The brief Auro printed, from this seat only.
 * Computers are grouped. One port is probed. A research
 * question is answered with quotes, or it says the files do not say.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { repoBoard } from "./kiln-board.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");

function line(row) {
  const age = row.age ? ` · ${row.age}` : "";
  const subject = row.subject ? ` · ${row.subject}` : "";
  const checks = row.checks ? (row.checks.ok ? " · checks pass" : " · checks fail") : "";
  return `- ${row.repo} — ${row.branch} @ ${row.head}${age}${subject}${checks}`;
}

function tokens(question) {
  const stop = new Set(["this", "that", "with", "from", "what", "when", "where", "your", "have", "does", "into", "about"]);
  return [...new Set(String(question || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !stop.has(word)))].slice(0, 8);
}

function probeForge() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:8080/", { timeout: 800 }, (res) => {
      res.resume();
      resolve({ name: "forge", port: 8080, ok: true, status: res.statusCode });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ name: "forge", port: 8080, ok: false });
    });
    req.on("error", () => resolve({ name: "forge", port: 8080, ok: false }));
  });
}

function walk(dir, base, hits, words, repo, left) {
  if (left.count <= 0) return;
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (left.count <= 0) return;
    if (name === ".git" || name === "node_modules") continue;
    const full = path.join(dir, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full, base, hits, words, repo, left);
      continue;
    }
    if (stat.size > 80_000 || !/\.(md|txt|js|mjs|ts|py|json|html|css)$/i.test(name)) continue;
    let text = "";
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const lower = text.toLowerCase();
    const at = words.map((word) => lower.indexOf(word)).find((i) => i >= 0);
    if (at == null || at < 0) continue;
    hits.push({
      repo,
      path: path.relative(base, full).replace(/\\/g, "/"),
      snippet: text.slice(Math.max(0, at - 40), at + 120).replace(/\s+/g, " ").trim(),
    });
    left.count -= 1;
  }
}

function quotes(root, rows, question) {
  const words = tokens(question);
  if (!words.length) return [];
  const hits = [];
  for (const row of rows) {
    if (words.some((word) => String(row.subject || "").toLowerCase().includes(word))) {
      hits.push({ repo: row.repo, path: "commit", snippet: row.subject });
    }
  }
  const left = { count: 6 };
  for (const row of rows) {
    if (left.count <= 0) break;
    const dir = path.join(root, "computers", row.repo.replace(/\//g, "_"));
    walk(dir, dir, hits, words, row.repo, left);
  }
  return hits.slice(0, 6);
}

export async function reviewSeat({ handle, question, repo, root, probe } = {}) {
  const base = root || ROOT;
  const board = repoBoard(handle, { root: base });
  if (!board.ok) return board;
  const rows = [...board.active, ...board.bench, ...board.scratch];
  const focus = String(repo || "").trim();
  if (focus && focus.split("/")[0] !== board.handle) return { ok: false, error: "not your computer" };
  const scoped = focus ? rows.filter((row) => row.repo === focus) : rows;
  const forge = probe ? await probe() : await probeForge();
  const asked = String(question || "").trim().slice(0, 240);
  const found = asked ? quotes(base, scoped, asked) : [];
  const total = rows.length;
  const lines = [
    `Repos — ${total}, all under ${board.handle}/`,
    "Active",
    ...(board.active.length ? board.active.map(line) : ["- none"]),
  ];
  const held = [...board.bench, ...board.scratch];
  if (held.length) {
    lines.push("", "Bench & scratch");
    lines.push(...held.map(line));
  }
  lines.push("", "Compute");
  lines.push(forge.ok ? `- forge :${forge.port} ✓` : `- forge :${forge.port} — still down`);
  lines.push("", "Honest limits");
  lines.push("- One forge port was probed. No other port was checked, so none is listed.");
  lines.push("- Checks appear only where this computer's tests wrote them.");
  if (asked) {
    lines.push("", `Research — ${asked}`);
    if (!found.length) lines.push("- The files and commit subjects I opened do not say.");
    else for (const hit of found) lines.push(`- ${hit.repo} ${hit.path}: ${hit.snippet}`);
    lines.push("- I did not run the programs. A quote is not a passing test.");
  }
  return {
    ok: true,
    handle: board.handle,
    repos: total,
    forge: { port: forge.port, up: !!forge.ok },
    quotes: found,
    text: lines.join("\n"),
    note: "Print text. Do not add a port, a check, or a sentence that is not in it.",
  };
}
