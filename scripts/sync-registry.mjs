#!/usr/bin/env node
/**
 * Sync the canonical KILN project registry into the workspace.
 *
 * Source of truth: ItsNotAILABS/KILN → projects/registry.json
 * Vendored copy:   src/lib/kiln/registry.json
 *
 * The forge app must never invent its project list; it vendors the registry
 * the L1 repo owns. Re-run after the registry changes:
 *
 *   node scripts/sync-registry.mjs
 *
 * Looks for the KILN repo in the known workspace locations (Grok Build
 * sandbox, Windows dev machine, this repo's sibling clone).
 */
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, "..");
const dest = join(workspaceRoot, "src", "lib", "kiln", "registry.json");

const candidates = [
  // Sibling clone (Linux sandbox / CI)
  join(workspaceRoot, "..", "KILN", "projects", "registry.json"),
  // Grok Build sandbox
  join("/workspace", "repos", "KILN", "projects", "registry.json"),
  // Windows dev machine
  "E:\\repos\\KILN\\projects\\registry.json",
];

const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.error("registry source not found; checked:");
  for (const p of candidates) console.error("  " + p);
  process.exit(1);
}
copyFileSync(src, dest);
const n = JSON.parse(readFileSync(dest, "utf8")).projects.length;
console.log(`synced ${n} projects from ${src}`);
