#!/usr/bin/env node
/**
 * Restore protected product files from CAS if live bytes drift.
 *
 * Studio, Grok chat, kernel, and the original HTML entry cannot be
 * silently overwritten. Marketing routes are not in this lock.
 *
 *   node scripts/kiln-lock.mjs --check
 *   node scripts/kiln-lock.mjs --restore
 *
 * Hash-pool restore of the freeze branch still works if this script
 * itself is gutted. This is the boot-time belt; that is the suspenders.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const DEFAULT_ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");

export function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function casPath(root, hash) {
  return path.join(root, "cas", "sha256", hash.slice(0, 2), hash);
}

export function lockPath(root) {
  return path.join(root, "public", "freeze", "LOCK.json");
}

export function loadLock(root) {
  const p = lockPath(root);
  if (!fs.existsSync(p)) {
    throw new Error(`missing lock file: ${p}`);
  }
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!doc || doc.spec !== "kiln-lock/v1" || !Array.isArray(doc.files)) {
    throw new Error("LOCK.json is not kiln-lock/v1");
  }
  return doc;
}

export function inspectLock(root, lock) {
  const rows = [];
  for (const f of lock.files) {
    const dest = path.join(root, f.path);
    const cas = casPath(root, f.sha256);
    const liveExists = fs.existsSync(dest);
    const casExists = fs.existsSync(cas);
    const live = liveExists ? sha256File(dest) : null;
    const status = !liveExists
      ? "missing"
      : live === f.sha256
        ? "ok"
        : "mismatch";
    rows.push({
      path: f.path,
      reason: f.reason || "",
      expected: f.sha256,
      live,
      status,
      casExists,
    });
  }
  return rows;
}

export function restoreLock(root, lock, { copyFile = fs.copyFileSync } = {}) {
  const restored = [];
  const ok = [];
  const failed = [];
  for (const row of inspectLock(root, lock)) {
    if (row.status === "ok") {
      ok.push(row.path);
      continue;
    }
    const dest = path.join(root, row.path);
    const src = casPath(root, row.expected);
    if (!row.casExists) {
      failed.push({ path: row.path, error: `missing cas ${row.expected}` });
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    copyFile(src, dest);
    const after = sha256File(dest);
    if (after !== row.expected) {
      failed.push({ path: row.path, error: `restore wrote ${after}` });
      continue;
    }
    restored.push(row.path);
  }
  return { ok, restored, failed };
}

function printReport(rows, result, mode) {
  console.log(`kiln-lock ${mode}`);
  for (const row of rows) {
    const mark = row.status === "ok" ? "OK" : row.status.toUpperCase();
    console.log(`${mark} ${row.path}`);
    if (row.status !== "ok") {
      console.log(`  pin  ${row.expected}`);
      console.log(`  live ${row.live || "—"}`);
    }
  }
  if (result) {
    for (const p of result.restored) console.log(`RESTORED ${p}`);
    for (const f of result.failed) console.log(`FAILED ${f.path} ${f.error}`);
  }
}

function main(argv = process.argv.slice(2), root = DEFAULT_ROOT) {
  const restore = argv.includes("--restore");
  const check = argv.includes("--check") || !restore;
  const lock = loadLock(root);
  const rows = inspectLock(root, lock);
  if (restore) {
    const result = restoreLock(root, lock);
    printReport(inspectLock(root, lock), result, "restore");
    if (result.failed.length) process.exit(1);
    return;
  }
  if (check) {
    printReport(rows, null, "check");
    if (rows.some((r) => r.status !== "ok")) process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`[kiln-lock] ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
