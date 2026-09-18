import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test("public browser assets contain no KILN operator secret", () => {
  const publicRoot = path.join(ROOT, "public");
  const offenders = [];
  for (const file of walk(publicRoot)) {
    if (!/\.(?:js|mjs|html|json|css|txt|md)$/i.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (/kiln-operator-secret-v1|__KILN_SECRET|export\s+const\s+KILN_SECRET/.test(text)) {
      offenders.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(offenders, [], `operator secret material leaked into public files: ${offenders.join(", ")}`);
});

test("operator boot fails closed when no authenticated wallet exists", () => {
  const text = fs.readFileSync(path.join(ROOT, "public/assets/kiln-forge.js"), "utf8");
  assert.match(text, /authenticate\/connect a wallet first/);
  assert.doesNotMatch(text, /s\.connect\(KILN_HANDLE\s*,/);
});

test("CAS lock cannot restore the operator browser boot", () => {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "public/freeze/LOCK.json"), "utf8"));
  assert.equal(lock.files.some((f) => f.path === "public/assets/kiln-forge.js"), false);
});
