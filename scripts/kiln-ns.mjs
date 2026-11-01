/**
 * Per-tree namespace. Python/Node on a computer cannot see another seat.
 * Mount namespace hides data/, computers/, scripts/, secrets. Network is off.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const ENTER = path.join(ROOT, "scripts", "kiln-ns-enter.sh");

export function runInNamespace(treeDir, bin, argv = [], { timeout = 8000, input } = {}) {
  const dir = path.resolve(treeDir);
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { ok: false, code: 127, out: "", err: "unknown tree", ns: true };
  }
  if (!fs.existsSync(ENTER)) {
    return { ok: false, code: 127, out: "", err: "namespace enter missing", ns: true };
  }
  try {
    fs.chmodSync(ENTER, 0o755);
  } catch {
    /* already executable */
  }
  const r = spawnSync(
    "unshare",
    ["--mount", "--propagation", "private", "--pid", "--fork", "--mount-proc", "--net", ENTER, dir, bin, ...argv.map(String)],
    {
      encoding: "utf8",
      timeout,
      maxBuffer: 200_000,
      input: input || undefined,
      env: {
        PATH: "/usr/local/bin:/usr/bin:/bin",
        LANG: "C",
        HOME: dir,
        TMPDIR: "/tmp",
      },
    },
  );
  if (r.error) {
    return { ok: false, code: 127, out: "", err: r.error.message, ns: true };
  }
  return {
    ok: r.status === 0,
    code: r.status,
    out: String(r.stdout || "").slice(0, 12_000),
    err: String(r.stderr || "").slice(0, 2000),
    ns: true,
  };
}
