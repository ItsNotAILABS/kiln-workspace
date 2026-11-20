// Contract test for the public repo record (ENTERPRISE-PLAN §3/§4.1).
//
// The defect this pins: the daemon's repo details carry `pages` and
// `paper`; three hand-written builders each re-decided the record's
// fields and silently dropped them, so repo pages could never link a
// repo's own Site or Paper. This test feeds fixture daemon details
// through every hop that shaping passes through and fails if a declared
// field is dropped at any of them:
//
//   daemon details ─► publicRepoRecord / forgeRepoRecordShape
//                       (scripts/public-repo-record.mjs — the module
//                        serve-original.mjs imports)
//                  ─► buildPublicRepo (public/assets/kiln-public.js —
//                       the shipped client function, evaluated verbatim)
//
// The store merges downstream (kiln-forge.js mergeRepos, kiln-public.js
// repair*) spread records rather than rebuilding them, so a field that
// survives buildPublicRepo reaches the views; the About rows' rendering
// is gated by the load-sim + live checks, not by this unit contract.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";
import { publicRepoRecord, forgeRepoRecordShape, surfaceFields } from "./public-repo-record.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

const DETAILS_ON = {
  description: "fixture",
  topics: ["a"],
  visibility: "public",
  createdAt: "2026-01-01T00:00:00.000Z",
  commitCount: 3,
  fileCount: 2,
  pages: { enabled: true, branch: "main", path: "site" },
  paper: { enabled: true },
};
const DETAILS_SITE_ONLY = { ...DETAILS_ON, paper: { enabled: false } };
const DETAILS_OFF = { ...DETAILS_ON, pages: { enabled: false, branch: "", path: "" }, paper: { enabled: false } };
const DETAILS_ABSENT = { description: "fixture", topics: [], visibility: "public", createdAt: null };

const PARTS = {
  owner: "auro",
  repo: "fixture",
  name: "fixture",
  branch: "main",
  commits: [],
  files: [],
  fileCountFallback: 0,
  readme: "# fixture",
  languages: {},
  language: "",
  tip: null,
};

test("surfaceFields: enabled surfaces pass through, branch never published", () => {
  const on = surfaceFields(DETAILS_ON);
  assert.deepEqual(on, { pages: { enabled: true, path: "site" }, paper: { enabled: true } });
  assert.equal("branch" in on.pages, false);
});

test("surfaceFields: disabled and absent both normalize to explicit disabled", () => {
  assert.deepEqual(surfaceFields(DETAILS_OFF), { pages: { enabled: false, path: "" }, paper: { enabled: false } });
  assert.deepEqual(surfaceFields(DETAILS_ABSENT), { pages: { enabled: false, path: "" }, paper: { enabled: false } });
  assert.deepEqual(surfaceFields(null), { pages: { enabled: false, path: "" }, paper: { enabled: false } });
});

test("publicRepoRecord carries pages/paper for every fixture state", () => {
  assert.equal(publicRepoRecord(DETAILS_ON, PARTS).pages.enabled, true);
  assert.equal(publicRepoRecord(DETAILS_ON, PARTS).paper.enabled, true);
  const siteOnly = publicRepoRecord(DETAILS_SITE_ONLY, PARTS);
  assert.equal(siteOnly.pages.enabled, true);
  assert.equal(siteOnly.paper.enabled, false);
  const absent = publicRepoRecord(DETAILS_ABSENT, PARTS);
  assert.equal(absent.pages.enabled, false);
  assert.equal(absent.paper.enabled, false);
});

test("forgeRepoRecordShape carries pages/paper for every fixture state", () => {
  assert.equal(forgeRepoRecordShape(DETAILS_ON, PARTS).pages.enabled, true);
  assert.equal(forgeRepoRecordShape(DETAILS_ON, PARTS).paper.enabled, true);
  const siteOnly = forgeRepoRecordShape(DETAILS_SITE_ONLY, PARTS);
  assert.equal(siteOnly.pages.enabled, true);
  assert.equal(siteOnly.paper.enabled, false);
  const absent = forgeRepoRecordShape(DETAILS_ABSENT, PARTS);
  assert.equal(absent.pages.enabled, false);
  assert.equal(absent.paper.enabled, false);
});

// --- client hop: evaluate the shipped buildPublicRepo verbatim ----------

function loadBuildPublicRepo() {
  const src = fs.readFileSync(path.join(ROOT, "public", "assets", "kiln-public.js"), "utf8");
  const start = src.indexOf("export function buildPublicRepo");
  assert.notEqual(start, -1, "buildPublicRepo not found in kiln-public.js");
  let depth = 0;
  let end = -1;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert.notEqual(end, -1, "buildPublicRepo body not closed");
  const fnSrc = src.slice(start, end).replace(/^export\s+/, "");
  const ctx = vm.createContext({});
  vm.runInContext(`${fnSrc}\nthis.__f = buildPublicRepo;`, ctx);
  return ctx.__f;
}

test("client buildPublicRepo passes pages/paper through, and invents neither", () => {
  const buildPublicRepo = loadBuildPublicRepo();
  const serverRec = publicRepoRecord(DETAILS_ON, PARTS);
  const clientRec = buildPublicRepo(serverRec, undefined);
  assert.equal(clientRec.pages?.enabled, true);
  assert.equal(clientRec.pages?.path, "site");
  assert.equal(clientRec.paper?.enabled, true);

  const off = buildPublicRepo(publicRepoRecord(DETAILS_OFF, PARTS), undefined);
  assert.equal(off.pages?.enabled, false);
  assert.equal(off.paper?.enabled, false);

  const legacy = { ...serverRec };
  delete legacy.pages;
  delete legacy.paper;
  const legacyOut = buildPublicRepo(legacy, undefined);
  assert.equal(legacyOut.pages?.enabled, false, "client must not fabricate an enabled Site for a legacy record");
  assert.equal(legacyOut.paper?.enabled, false, "client must not fabricate an enabled Paper for a legacy record");
});
