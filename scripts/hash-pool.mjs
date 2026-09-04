#!/usr/bin/env node
/**
 * Content-addressed hash pools for KILN.
 *
 * Pools are named ledgers. Branches are frozen snapshots inside a pool.
 * Files are stored by SHA-256 in cas/sha256/<aa>/<hash> so a later
 * overwrite of an HTML entry cannot erase the bytes.
 *
 *   node scripts/hash-pool.mjs --pool kiln-original --branch recovered-20260903
 *   node scripts/hash-pool.mjs --pool kiln-build --branch auto --root .vercel/output/static
 *   node scripts/hash-pool.mjs --pool kiln-original --verify recovered-20260903
 *   node scripts/hash-pool.mjs --pool kiln-original --restore recovered-20260903
 *
 * Never rewrites hashed original chunks. It only records them.
 * The pickup pin `recovered-20260903` cannot be overwritten, even with --force.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PIN_BRANCH = "recovered-20260903";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function sha256Buf(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256File(file) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir).sort()) {
    if (name === "." || name === "..") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkFiles(p, acc);
    else if (st.isFile()) acc.push(p);
  }
  return acc;
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

function classify(fileRel) {
  if (fileRel.startsWith("public/assets/")) {
    const base = path.basename(fileRel);
    const orig = path.join(ROOT, "kiln-original/assets", base);
    if (fs.existsSync(orig)) {
      const a = sha256File(path.join(ROOT, fileRel));
      const b = sha256File(orig);
      return a === b ? "cdn-original" : "patched";
    }
    return "reconstructed";
  }
  if (fileRel.startsWith("public/marketing/")) return "media";
  if (
    fileRel === "public/index.html" ||
    fileRel === "public/favicon.svg" ||
    fileRel === "public/og.jpg" ||
    fileRel === "public/x-banner.jpg"
  ) {
    return "shell";
  }
  if (fileRel.startsWith("scripts/")) return "tool";
  if (fileRel.startsWith("python/kiln/")) return "tool";
  if (fileRel.startsWith("server/middleware/")) return "tool";
  if (fileRel === "startup.sh") return "tool";
  if (fileRel.startsWith("public/freeze/")) return "freeze";
  return "other";
}

function merkleRoot(hexes) {
  if (hexes.length === 0) return sha256Buf(Buffer.alloc(0));
  let layer = hexes.map((h) => Buffer.from(h, "hex"));
  while (layer.length > 1) {
    if (layer.length % 2 === 1) layer = layer.concat([layer[layer.length - 1]]);
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(createHash("sha256").update(layer[i]).update(layer[i + 1]).digest());
    }
    layer = next;
  }
  return layer[0].toString("hex");
}

function casPath(hash) {
  return path.join(ROOT, "cas", "sha256", hash.slice(0, 2), hash);
}

function putCas(hash, absFile) {
  const dest = casPath(hash);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) fs.copyFileSync(absFile, dest);
}

function collectFromRoot(scanRoot) {
  const abs = path.isAbsolute(scanRoot) ? scanRoot : path.join(ROOT, scanRoot);
  const files = [];
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    files.push(abs);
    return files;
  }
  return walkFiles(abs).filter((f) => {
    const r = rel(f);
    if (r.includes("/node_modules/")) return false;
    if (r.includes("/.git/")) return false;
    return true;
  });
}

function readPin(poolName) {
  const pinPath = path.join(ROOT, "pools", poolName, "PIN");
  if (fs.existsSync(pinPath)) return fs.readFileSync(pinPath, "utf8").trim();
  if (poolName === "kiln-original") return PIN_BRANCH;
  return null;
}

function writePin(poolName, branchName) {
  const pinPath = path.join(ROOT, "pools", poolName, "PIN");
  if (fs.existsSync(pinPath)) return;
  fs.mkdirSync(path.dirname(pinPath), { recursive: true });
  fs.writeFileSync(pinPath, branchName + "\n");
}

function loadManifest(poolName, branchName) {
  const manifestPath = path.join(ROOT, "pools", poolName, "branches", branchName, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

const pool = arg("--pool", "kiln-original");
let branch = arg("--branch", PIN_BRANCH);
if (branch === "auto") {
  const d = new Date();
  const iso = d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  branch = `build-${iso}`;
}

const restoreName = arg("--restore", "");
if (restoreName) {
  const man = loadManifest(pool, restoreName);
  if (!man) {
    console.error(`no such branch: ${pool}/${restoreName}`);
    process.exit(1);
  }
  let n = 0;
  for (const f of man.files) {
    const src = casPath(f.sha256);
    if (!fs.existsSync(src)) {
      console.error(`missing cas ${f.sha256} for ${f.path}`);
      process.exit(1);
    }
    const dest = path.join(ROOT, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    n += 1;
  }
  console.log(`restored ${n} files from ${pool}/${restoreName}`);
  console.log(`merkle=${man.merkle.root}`);
  process.exit(0);
}

const verifyName = arg("--verify", "");
if (verifyName) {
  const man = loadManifest(pool, verifyName);
  if (!man) {
    console.error(`no such branch: ${pool}/${verifyName}`);
    process.exit(1);
  }
  let ok = 0;
  const mismatch = [];
  const missing = [];
  for (const f of man.files) {
    const dest = path.join(ROOT, f.path);
    if (!fs.existsSync(dest)) {
      missing.push(f.path);
      continue;
    }
    const hash = sha256File(dest);
    if (hash === f.sha256) ok += 1;
    else mismatch.push({ path: f.path, kind: f.kind, expected: f.sha256, live: hash });
  }
  console.log(`verify ${pool}/${verifyName}`);
  console.log(`merkle=${man.merkle.root}`);
  console.log(`ok=${ok} mismatch=${mismatch.length} missing=${missing.length}`);
  for (const m of mismatch) {
    console.log(`MISMATCH ${m.kind} ${m.path}`);
    console.log(`  pin  ${m.expected}`);
    console.log(`  live ${m.live}`);
  }
  for (const p of missing) console.log(`MISSING ${p}`);
  process.exit(mismatch.length || missing.length ? 1 : 0);
}

const force = process.argv.includes("--force");
const existingBranch = path.join(ROOT, "pools", pool, "branches", branch, "manifest.json");
if (pool === "kiln-original" && branch === PIN_BRANCH && fs.existsSync(existingBranch)) {
  console.error(`PIN ${pool}/${PIN_BRANCH} is immutable. pick a new --branch.`);
  process.exit(1);
}
if (fs.existsSync(existingBranch) && !force) {
  console.error(`branch ${pool}/${branch} is frozen. pick a new --branch (or --force).`);
  process.exit(1);
}

const extraRoots = [];
process.argv.reduce((acc, v, i, arr) => {
  if (v === "--root" && arr[i + 1]) acc.push(arr[i + 1]);
  return acc;
}, extraRoots);

const defaultOriginalRoots = [
  "public/index.html",
  "public/favicon.svg",
  "public/og.jpg",
  "public/x-banner.jpg",
  "public/assets",
  "public/freeze/index.html",
  "public/freeze/KILN-WP-10.md",
  "public/freeze/KILN-WP-11.md",
  "public/freeze/KILN-WP-12.md",
  "public/freeze/KILN-WP-13.md",
  "public/freeze/KILN-WP-14.md",
  "public/freeze/KILN-WP-15.md",
  "public/freeze/KILN-WP-16.md",
  "public/freeze/KILN-WP-17.md",
  "public/freeze/KILN-WP-18.md",
  "public/freeze/KILN-WP-19.md",
  "public/freeze/KILN-WP-20.md",
  "public/freeze/LOCK.json",
  "public/marketing",
  "scripts/serve-original.mjs",
  "scripts/github-engine.mjs",
  "scripts/hash-pool.mjs",
  "scripts/kiln-account.mjs",
  "scripts/agent-turn.mjs",
  "scripts/kiln-lock.mjs",
  "scripts/kiln-infra.mjs",
  "python/kiln",
  "server/middleware/aa-kiln-github.ts",
  "server/middleware/aa-kiln-serverfn.ts",
  "server/middleware/zz-kiln-original.ts",
  "public/kiln-account.json",
  "startup.sh",
];

const scanList =
  extraRoots.length > 0
    ? extraRoots
    : pool === "kiln-original"
      ? defaultOriginalRoots
      : [".vercel/output/static"];

const absFiles = [];
const seen = new Set();
for (const r of scanList) {
  for (const f of collectFromRoot(r)) {
    const k = path.resolve(f);
    if (seen.has(k)) continue;
    seen.add(k);
    absFiles.push(k);
  }
}
absFiles.sort((a, b) => rel(a).localeCompare(rel(b)));

if (absFiles.length === 0) {
  console.error(`no files to freeze for pool=${pool} branch=${branch}`);
  process.exit(1);
}

const records = [];
let bytes = 0;
for (const abs of absFiles) {
  const st = fs.statSync(abs);
  const hash = sha256File(abs);
  const r = rel(abs);
  putCas(hash, abs);
  bytes += st.size;
  records.push({
    path: r,
    sha256: hash,
    size: st.size,
    kind: classify(r),
  });
}

const merkle = merkleRoot(records.map((x) => x.sha256));
const createdAt = new Date().toISOString();

const manifest = {
  spec: "kiln-hash-pool/v1",
  pool,
  branch,
  createdAt,
  alg: "sha256",
  merkle: {
    alg: "sha256-pairwise",
    root: merkle,
    note: "Binary merkle of SHA-256 leaves, leaves ordered by path. Odd nodes duplicated.",
  },
  entry: {
    html:
      records.find((x) => x.path === "public/index.html")?.sha256 ??
      records.find((x) => x.path.endsWith("/index.html") && x.kind === "shell")?.sha256 ??
      records.find((x) => /\/index\.html$/.test(x.path) && !x.path.includes("/freeze/"))?.sha256 ??
      null,
    script:
      records.find((x) => x.path.endsWith("assets/index-DkUKO55P.js"))?.sha256 ??
      records.find((x) => /assets\/index-.*\.js$/.test(x.path) && x.kind !== "other")?.sha256 ??
      null,
    css: records.find((x) => x.path.endsWith("assets/styles-A_fIl0Ci.css"))?.sha256 ?? null,
    store: records.find((x) => x.path.endsWith("assets/store-sx46DNi5.js"))?.sha256 ?? null,
  },
  counts: {
    files: records.length,
    bytes,
    byKind: records.reduce((acc, x) => {
      acc[x.kind] = (acc[x.kind] || 0) + 1;
      return acc;
    }, {}),
  },
  files: records,
};

const branchDir = path.join(ROOT, "pools", pool, "branches", branch);
fs.mkdirSync(branchDir, { recursive: true });
fs.writeFileSync(path.join(branchDir, "manifest.json"), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(ROOT, "pools", pool, "HEAD"), branch + "\n");
if (pool === "kiln-original") writePin(pool, PIN_BRANCH);

const refsPath = path.join(ROOT, "pools", pool, "refs.json");
let refs = { pool, HEAD: branch, branches: {} };
if (fs.existsSync(refsPath)) {
  try {
    refs = JSON.parse(fs.readFileSync(refsPath, "utf8"));
  } catch {
    /* keep empty */
  }
}
refs.pool = pool;
refs.HEAD = branch;
refs.PIN = readPin(pool);
refs.branches = refs.branches || {};
refs.branches[branch] = {
  merkle: merkle,
  createdAt,
  files: records.length,
  bytes,
};
fs.writeFileSync(refsPath, JSON.stringify(refs, null, 2));

const pub = path.join(ROOT, "public", "freeze");
fs.mkdirSync(pub, { recursive: true });
fs.writeFileSync(path.join(pub, `${pool}--${branch}.json`), JSON.stringify(manifest, null, 2));

const poolsRoot = path.join(ROOT, "pools");
const poolNames = fs.existsSync(poolsRoot)
  ? fs.readdirSync(poolsRoot).filter((n) => fs.statSync(path.join(poolsRoot, n)).isDirectory())
  : [pool];
const poolsIndex = poolNames.map((name) => {
  const rp = path.join(poolsRoot, name, "refs.json");
  if (fs.existsSync(rp)) return JSON.parse(fs.readFileSync(rp, "utf8"));
  return { pool: name, HEAD: null, PIN: readPin(name), branches: {} };
});
fs.writeFileSync(path.join(pub, "pools.json"), JSON.stringify({ spec: "kiln-hash-pool/v1", pools: poolsIndex }, null, 2));

const originalRefsPath = path.join(ROOT, "pools", "kiln-original", "refs.json");
const originalRefs = fs.existsSync(originalRefsPath)
  ? JSON.parse(fs.readFileSync(originalRefsPath, "utf8"))
  : null;
const pinName = readPin("kiln-original");
const pinMeta = pinName && originalRefs?.branches?.[pinName] ? originalRefs.branches[pinName] : null;
const originalHeadName = originalRefs?.HEAD || (pool === "kiln-original" ? branch : null);
const originalHeadMeta =
  originalHeadName && originalRefs?.branches?.[originalHeadName]
    ? originalRefs.branches[originalHeadName]
    : null;

const headDoc = {
  spec: "kiln-hash-pool/v1",
  pool: "kiln-original",
  pin: {
    pool: "kiln-original",
    branch: pinName,
    merkle: pinMeta?.merkle ?? null,
    manifest: pinName ? `/freeze/kiln-original--${pinName}.json` : null,
  },
  branch: originalHeadName,
  merkle: originalHeadMeta?.merkle ?? (pool === "kiln-original" ? merkle : null),
  createdAt: originalHeadMeta?.createdAt ?? createdAt,
  manifest: originalHeadName ? `/freeze/kiln-original--${originalHeadName}.json` : null,
  paper: "/papers/retrieval",
  paperMd: "/freeze/KILN-WP-10.md",
  paperImport: "/papers/import",
  paperImportMd: "/freeze/KILN-WP-11.md",
  paperStudio: "/papers/studio",
  paperStudioMd: "/freeze/KILN-WP-12.md",
  paperAccountMd: "/freeze/KILN-WP-13.md",
  paperMachine: "/papers/machine",
  paperMachineMd: "/freeze/KILN-WP-14.md",
  paperMedia: "/papers/media",
  paperMediaMd: "/freeze/KILN-WP-15.md",
  paperPublic: "/papers/public",
  paperPublicMd: "/freeze/KILN-WP-16.md",
  paperStudioKernelMd: "/freeze/KILN-WP-17.md",
  paperStudioVisibleMd: "/freeze/KILN-WP-18.md",
  paperLockMd: "/freeze/KILN-WP-19.md",
  paperPreviewMd: "/freeze/KILN-WP-20.md",
  explorer: "/freeze/",
  counts: pool === "kiln-original" ? manifest.counts : undefined,
  entry: pool === "kiln-original" ? manifest.entry : undefined,
  last: {
    pool,
    branch,
    merkle,
    createdAt,
    manifest: `/freeze/${pool}--${branch}.json`,
  },
};
if (pool === "kiln-original") {
  headDoc.counts = manifest.counts;
  headDoc.entry = manifest.entry;
  headDoc.merkle = merkle;
  headDoc.createdAt = createdAt;
  headDoc.manifest = `/freeze/${pool}--${branch}.json`;
}
fs.writeFileSync(path.join(pub, "HEAD.json"), JSON.stringify(headDoc, null, 2));
fs.writeFileSync(
  path.join(pub, "PIN.json"),
  JSON.stringify(
    {
      spec: "kiln-hash-pool/v1",
      pool: "kiln-original",
      branch: pinName,
      merkle: pinMeta?.merkle ?? null,
      manifest: pinName ? `/freeze/kiln-original--${pinName}.json` : null,
      note: "Pickup freeze. Immutable. Exactly how the original client was retrieved.",
    },
    null,
    2,
  ),
);

console.log(`pool=${pool} branch=${branch}`);
console.log(`files=${records.length} bytes=${bytes}`);
console.log(`merkle=${merkle}`);
console.log(`pin=${pinName || "—"}`);
console.log(`cas=cas/sha256  freeze=public/freeze/${pool}--${branch}.json`);

try {
  const { publishKilnAccount } = await import("./kiln-account.mjs");
  const published = await publishKilnAccount(manifest);
  console.log(`kiln-account ${published.account.handle} repos=${published.repos.map((r) => r.id).join(",")}`);
} catch (e) {
  console.log(`kiln-account skip ${e instanceof Error ? e.message : e}`);
}
