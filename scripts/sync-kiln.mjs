#!/usr/bin/env node
/**
 * Sync the canonical KILN sources of truth into the workspace app.
 *
 * KILN is ONE app across two repos. The contracts repo (ItsNotAILABS/KILN)
 * owns the truth; this app vendors committed snapshots. This script is run by
 * a developer after the contracts repo changes — committed snapshots are
 * what ships, never a live fetch at deploy time.
 *
 * Copies (source -> vendored copy):
 *   projects/registry.json          -> src/lib/kiln/registry.json
 *   deployments/chain.json          -> src/lib/kiln/chain.json
 *                                      (missing source: writes {deployments:{}} —
 *                                      app honestly reports "not anchored")
 *   abi/KilnOwnershipRegistry.json  -> src/lib/kiln/abi/KilnOwnershipRegistry.json
 *                                      (missing source: keeps any existing copy,
 *                                      warns loudly; calldata encoding falls back
 *                                      to the verified canonical fragments)
 *
 * Fails LOUDLY if the KILN checkout itself is absent, or if the registry
 * source is missing. Never silently keeps stale copies when the source exists.
 *
 * Usage: npm run sync:kiln
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, "..");
const kilnDir = join(workspaceRoot, "..", "KILN");
const kilnLib = join(workspaceRoot, "src", "lib", "kiln");

function fail(msg) {
  console.error("sync:kiln FAILED: " + msg);
  process.exit(1);
}

// Hard rule: the KILN checkout must exist. No checkout, no sync — stale
// vendored copies are worse than no vendored copies.
if (!existsSync(kilnDir) || !existsSync(join(kilnDir, "contracts", "KilnOwnershipRegistry.sol"))) {
  fail(
    `KILN checkout not found at ${kilnDir} (expected contracts/KilnOwnershipRegistry.sol). ` +
      "Clone ItsNotAILABS/KILN as a sibling of kiln-workspace and re-run."
  );
}

// 1. Project registry — required. A missing source is a hard failure; the app
//    must never invent its project list.
const registrySrc = join(kilnDir, "projects", "registry.json");
if (!existsSync(registrySrc)) {
  fail(`registry source missing: ${registrySrc}`);
}
const registryDest = join(kilnLib, "registry.json");
copyFileSync(registrySrc, registryDest);
let parsed;
try {
  parsed = JSON.parse(readFileSync(registryDest, "utf8"));
} catch (e) {
  fail(`vendored registry.json is not valid JSON: ${e.message}`);
}
if (parsed.schema !== "kiln.project-registry.v1" || !Array.isArray(parsed.projects)) {
  fail(`registry source failed schema check (schema=${parsed.schema}, projects=${typeof parsed.projects})`);
}
console.log(`registry: synced ${parsed.projects.length} projects from ${registrySrc}`);

// 2. Chain deployments — optional. Missing source means "not anchored", which
//    is honest, not an error. Write an explicit empty snapshot so provenance
//    always has a file to read.
const chainSrc = join(kilnDir, "deployments", "chain.json");
const chainDest = join(kilnLib, "chain.json");
if (existsSync(chainSrc)) {
  try {
    const chain = JSON.parse(readFileSync(chainSrc, "utf8"));
    if (typeof chain !== "object" || chain === null || typeof chain.deployments === "undefined") {
      fail(`chain source ${chainSrc} has no "deployments" key`);
    }
    copyFileSync(chainSrc, chainDest);
    const n = Array.isArray(chain.deployments)
      ? chain.deployments.length
      : Object.keys(chain.deployments).length;
    console.log(`chain: synced ${n} deployment(s) from ${chainSrc}`);
  } catch (e) {
    fail(`chain source ${chainSrc} is not valid JSON: ${e.message}`);
  }
} else {
  writeFileSync(chainDest, JSON.stringify({ deployments: {} }, null, 2) + "\n");
  console.log(`chain: no deployments/chain.json in KILN checkout — wrote empty snapshot (app will report "not anchored")`);
}

// 3. Registry ABI — optional. Copy when present so calldata encoding uses the
//    real artifact; keep the existing committed copy and warn when absent.
const abiSrc = join(kilnDir, "abi", "KilnOwnershipRegistry.json");
const abiDestDir = join(kilnLib, "abi");
const abiDest = join(abiDestDir, "KilnOwnershipRegistry.json");
if (existsSync(abiSrc)) {
  try {
    const artifact = JSON.parse(readFileSync(abiSrc, "utf8"));
    const abi = artifact.abi ?? artifact;
    const names = new Set((Array.isArray(abi) ? abi : []).filter((e) => e.type === "function").map((e) => e.name));
    for (const required of ["authorizeAgent", "delegateGrant", "revokeAuthorization", "getAgentGrant"]) {
      if (!names.has(required)) fail(`ABI artifact ${abiSrc} is missing required function ${required}`);
    }
    mkdirSync(abiDestDir, { recursive: true });
    copyFileSync(abiSrc, abiDest);
    console.log(`abi: synced KilnOwnershipRegistry.json from ${abiSrc}`);
  } catch (e) {
    fail(`ABI source ${abiSrc} is not valid JSON: ${e.message}`);
  }
} else if (existsSync(abiDest)) {
  console.warn(`abi: no abi/KilnOwnershipRegistry.json in KILN checkout — keeping committed copy at ${abiDest}`);
} else {
  console.warn(
    "abi: no abi/KilnOwnershipRegistry.json in KILN checkout and no committed copy — " +
      "calldata encoding will use the verified canonical fragments only"
  );
}

console.log("sync:kiln OK");
