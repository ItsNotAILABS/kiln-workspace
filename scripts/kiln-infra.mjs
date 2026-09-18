/**
 * Run a Python infrastructure model and return JSON.
 *
 *   node scripts/kiln-infra.mjs kiln_physics '{"repo":"kiln/studio"}'
 */
import { spawn } from "node:child_process";
import path from "node:path";
import url from "node:url";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PY = path.join(ROOT, "python");

export const INFRA_TOOLS = [
  "kiln_merkle",
  "kiln_lock",
  "kiln_machine",
  "kiln_capsule",
  "kiln_preview",
  "kiln_physics",
  "kiln_infra",
];

export const INFRA_SET = new Set(INFRA_TOOLS);

export const INFRA_SCHEMA = [
  {
    name: "kiln_merkle",
    description: "SHA-256 pairwise merkle of a repository tree. Real hashes. Call this to seal or verify a tree during a build.",
    parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "kiln_lock",
    description: "Inspect the kiln lock. Studio, Grok chat, kernel, and the original HTML cannot silently drift. Returns ok/mismatch/missing per protected path.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "kiln_capsule",
    description: "Assemble the isolated capsule for a Git tree. Unique origin, not the forge origin. Returns host, merkle, sandbox.",
    parameters: { type: "object", properties: { repo: { type: "string" }, html: { type: "boolean" } }, required: ["repo"] },
  },
  {
    name: "kiln_preview",
    description: "Live preview domain for a repository capsule. Same physics as the Studio Preview tab.",
    parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "kiln_physics",
    description: "Run kiln conservation laws on a tree: hash conservation, odd-leaf merkle, write moves the root, isolation of blob origins. Failures are real.",
    parameters: { type: "object", properties: { repo: { type: "string" }, other: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "kiln_infra",
    description: "Call a Python infrastructure model by name: merkle, lock, machine, capsule, preview, physics.",
    parameters: {
      type: "object",
      properties: { model: { type: "string", description: "merkle|lock|machine|capsule|preview|physics" }, repo: { type: "string" } },
      required: ["model"],
    },
  },
];

function runPython(payload, timeout = 8000) {
  return new Promise((resolve) => {
    const child = spawn("python3", ["-m", "kiln.tools"], {
      cwd: ROOT,
      env: { ...process.env, PYTHONPATH: PY },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, timeout);
    child.stdout.on("data", (d) => {
      out += d.toString();
      if (out.length > 200_000) out = out.slice(0, 200_000);
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 8_000) err = err.slice(0, 8_000);
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: code ?? 1, out, err });
    });
    child.on("error", (e) => {
      clearTimeout(t);
      resolve({ code: 1, out: "", err: e.message });
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function runInfraTool(name, args = {}) {
  const tool = INFRA_SET.has(name) ? name : `kiln_${name}`;
  const r = await runPython({ tool, args });
  if (!r.out.trim()) {
    return { ok: false, error: r.err || `python exited ${r.code}`, text: r.err || `python exited ${r.code}` };
  }
  try {
    const parsed = JSON.parse(r.out);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.text !== "string") parsed.text = JSON.stringify(parsed, null, 2);
      return parsed;
    }
  } catch {
    return { ok: false, error: "infra model returned non-json", text: (r.out || r.err).slice(0, 4000) };
  }
  return { ok: false, error: "empty infra result", text: r.err || "empty infra result" };
}

export async function renderCapsule(repoId, files) {
  const out = await runInfraTool("kiln_capsule", { repo: repoId, files, html: true });
  return out;
}

export function htmlResponse(html, status = 200) {
  return {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "content-security-policy": "sandbox allow-scripts allow-forms",
    },
    body: html,
  };
}

if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const name = process.argv[2] || "kiln_physics";
  let args = {};
  if (process.argv[3]) {
    try {
      args = JSON.parse(process.argv[3]);
    } catch {
      args = { repo: process.argv[3] };
    }
  }
  const out = await runInfraTool(name, args);
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(out.ok === false ? 2 : 0);
}
