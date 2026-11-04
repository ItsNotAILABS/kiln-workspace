// ---------------------------------------------------------------------------
// Docker engine for the KILN operator console (/api/kiln/docker/*).
//
// Zero-dependency: every call drives the real docker CLI through
// child_process.execFile / spawn with ARGUMENT ARRAYS — never a shell
// string — so no argument can ever be reinterpreted by a shell. The
// binary is process.env.KILN_DOCKER_BIN || "docker".
//
// Honesty contract: when docker is absent or the daemon is down, probe()
// answers { available:false, reason } with the CLI's own words. Nothing
// here fabricates engine state.
// ---------------------------------------------------------------------------
import { execFile, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export class DockerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DockerError";
    this.code = code;
  }
}

// --- validation ------------------------------------------------------------
// Owner/repo mirror serve-original's public-route regexes exactly.
export const OWNER_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;
export const REPO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const CONTAINER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const IMAGE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/:@]{0,254}$/;
const NETWORK_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const PORT_MAP_RE = /^\d{1,5}:\d{1,5}$/;
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function fail(code, message) {
  throw new DockerError(code, message);
}

export function validateOwner(owner) {
  if (typeof owner !== "string" || !OWNER_RE.test(owner)) fail("BAD_OWNER", `invalid repo owner: ${JSON.stringify(owner)}`);
  return owner;
}

export function validateRepo(repo) {
  if (typeof repo !== "string" || !REPO_RE.test(repo)) fail("BAD_REPO", `invalid repo name: ${JSON.stringify(repo)}`);
  return repo;
}

export function validateRef(ref) {
  const r = ref === undefined || ref === null || ref === "" ? "HEAD" : String(ref);
  if (!REF_RE.test(r) || r.includes("..")) fail("BAD_REF", `invalid git ref: ${JSON.stringify(ref)}`);
  return r;
}

export function validateContainerId(id) {
  if (typeof id !== "string" || !CONTAINER_ID_RE.test(id)) fail("BAD_CONTAINER_ID", `invalid container id/name: ${JSON.stringify(id)}`);
  return id;
}

export function validateContainerName(name) {
  if (typeof name !== "string" || !NAME_RE.test(name)) fail("BAD_NAME", `invalid container name: ${JSON.stringify(name)}`);
  return name;
}

export function validateImageRef(image) {
  if (typeof image !== "string" || !IMAGE_RE.test(image) || image.includes("..")) {
    fail("BAD_IMAGE", `invalid image reference: ${JSON.stringify(image)}`);
  }
  return image;
}

export function validateNetwork(network) {
  if (typeof network !== "string" || !NETWORK_RE.test(network)) fail("BAD_NETWORK", `invalid network: ${JSON.stringify(network)}`);
  return network;
}

export function validatePortMapping(mapping) {
  if (typeof mapping !== "string" || !PORT_MAP_RE.test(mapping)) {
    fail("BAD_PORT", `invalid port mapping (want host:container): ${JSON.stringify(mapping)}`);
  }
  const [host, container] = mapping.split(":").map((n) => parseInt(n, 10));
  if (host < 1 || host > 65535 || container < 1 || container > 65535) {
    fail("BAD_PORT", `port out of range 1-65535: ${mapping}`);
  }
  return mapping;
}

export function validateEnvKey(key) {
  if (typeof key !== "string" || !ENV_KEY_RE.test(key)) fail("BAD_ENV_KEY", `invalid env key: ${JSON.stringify(key)}`);
  return key;
}

// A dockerfile path relative to a build context: confined, no escapes.
export function validateDockerfileRel(rel) {
  if (typeof rel !== "string" || !rel || path.isAbsolute(rel)) fail("BAD_DOCKERFILE", `invalid dockerfile path: ${JSON.stringify(rel)}`);
  const norm = path.normalize(rel);
  if (norm.startsWith("..") || norm.split(path.sep).includes("..")) fail("BAD_DOCKERFILE", `dockerfile path escapes the build context: ${JSON.stringify(rel)}`);
  return norm;
}

// --- CLI plumbing ----------------------------------------------------------

export function dockerBin() {
  return process.env.KILN_DOCKER_BIN || "docker";
}

function trimErr(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > 500 ? t.slice(0, 500) + "…" : t;
}

function cliError(err, stderr) {
  if (err && err.code === "ENOENT") {
    return new DockerError("DOCKER_UNAVAILABLE", `docker CLI not found (${dockerBin()})`);
  }
  if (err && (err.killed || err.signal === "SIGTERM")) {
    return new DockerError("DOCKER_TIMEOUT", "docker CLI timed out");
  }
  const detail = trimErr(stderr) || trimErr(err && err.message) || "docker CLI failed";
  return new DockerError("DOCKER_FAILED", detail);
}

function execDocker(args, { timeoutMs = 15000, maxBuffer = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(dockerBin(), args, { timeout: timeoutMs, maxBuffer, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(cliError(err, stderr));
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

function parseJsonLines(text, what) {
  const out = [];
  for (const line of String(text).split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      throw new DockerError("DOCKER_BAD_OUTPUT", `unparseable ${what} line from docker CLI`);
    }
  }
  return out;
}

// --- engine surface --------------------------------------------------------

export async function probe() {
  let version;
  try {
    const { stdout } = await execDocker(["version", "--format", "{{json .}}"], { timeoutMs: 6000 });
    version = JSON.parse(stdout.trim());
  } catch (e) {
    if (e instanceof DockerError && (e.code === "DOCKER_UNAVAILABLE" || e.code === "DOCKER_TIMEOUT")) {
      return { available: false, reason: e.message };
    }
    return { available: false, reason: e instanceof Error ? e.message : "docker version failed" };
  }
  let info = null;
  try {
    const { stdout } = await execDocker(["info", "--format", "{{json .}}"], { timeoutMs: 6000 });
    info = JSON.parse(stdout.trim());
  } catch {
    info = null; // version answered; info detail is best-effort
  }
  return {
    available: true,
    clientVersion: version?.Client?.Version || null,
    serverVersion: version?.Server?.Version || null,
    apiVersion: version?.Server?.ApiVersion || null,
    os: version?.Server?.Os || info?.OperatingSystem || null,
    arch: version?.Server?.Arch || null,
    driver: info?.Driver || null,
    containers: typeof info?.Containers === "number" ? info.Containers : null,
    containersRunning: typeof info?.ContainersRunning === "number" ? info.ContainersRunning : null,
    images: typeof info?.Images === "number" ? info.Images : null,
  };
}

export async function listImages() {
  const { stdout } = await execDocker(["images", "--format", "{{json .}}"], { timeoutMs: 10000 });
  return parseJsonLines(stdout, "images").map((r) => ({
    id: r.ID || "",
    repository: r.Repository || "",
    tag: r.Tag || "",
    size: r.Size || "",
    createdAt: r.CreatedAt || "",
  }));
}

export async function listContainers(all = true) {
  const args = ["ps"];
  if (all) args.push("-a");
  args.push("--format", "{{json .}}");
  const { stdout } = await execDocker(args, { timeoutMs: 10000 });
  return parseJsonLines(stdout, "ps").map((r) => ({
    id: r.ID || "",
    name: r.Names || "",
    image: r.Image || "",
    state: r.State || "",
    status: r.Status || "",
    ports: r.Ports || "",
    labels: r.Labels || "",
    createdAt: r.CreatedAt || "",
  }));
}

export async function containerLogs(id, tail = 200) {
  validateContainerId(id);
  const t = Math.max(1, Math.min(5000, Math.floor(Number(tail) || 200)));
  const { stdout, stderr } = await execDocker(["logs", "--tail", String(t), id], { timeoutMs: 10000, maxBuffer: 4 * 1024 * 1024 });
  let logs = stdout + stderr;
  if (logs.length > 65536) logs = logs.slice(logs.length - 65536);
  return { id, tail: t, logs };
}

export async function inspectContainer(id) {
  validateContainerId(id);
  const { stdout } = await execDocker(["inspect", id], { timeoutMs: 10000 });
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new DockerError("DOCKER_BAD_OUTPUT", "unparseable inspect output from docker CLI");
  }
  const c = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!c) throw new DockerError("DOCKER_NOT_FOUND", `no such container: ${id}`);
  const ports = {};
  const rawPorts = c?.NetworkSettings?.Ports || {};
  for (const [containerPort, bindings] of Object.entries(rawPorts)) {
    ports[containerPort] = Array.isArray(bindings) ? bindings.map((b) => `${b.HostIp || ""}:${b.HostPort || ""}`) : [];
  }
  return {
    id: c.Id || "",
    name: String(c.Name || "").replace(/^\//, ""),
    image: c.Config?.Image || "",
    created: c.Created || "",
    state: c.State?.Status || "",
    running: !!c.State?.Running,
    labels: c.Config?.Labels || {},
    ports,
    env: Array.isArray(c.Config?.Env) ? c.Config.Env.map((e) => String(e).split("=")[0]) : [],
  };
}

export function buildImage({ contextDir, tag, dockerfile, onLine, timeoutMs = 600000 } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    let stat;
    try {
      validateImageRef(tag);
      stat = fs.statSync(contextDir || "");
    } catch (e) {
      rejectPromise(e instanceof DockerError ? e : new DockerError("BAD_CONTEXT", `invalid build context: ${JSON.stringify(contextDir)}`));
      return;
    }
    if (!stat.isDirectory()) {
      rejectPromise(new DockerError("BAD_CONTEXT", `build context is not a directory: ${contextDir}`));
      return;
    }
    const args = ["build", "-t", tag, "--label", "kiln.managed=1"];
    if (dockerfile) {
      try {
        args.push("-f", path.join(contextDir, validateDockerfileRel(dockerfile)));
      } catch (e) {
        rejectPromise(e);
        return;
      }
    }
    args.push(contextDir);
    let child;
    try {
      child = spawn(dockerBin(), args, { windowsHide: true });
    } catch (e) {
      rejectPromise(cliError(e, ""));
      return;
    }
    const tailLines = [];
    let buf = "";
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
    }, timeoutMs);
    const feed = (chunk) => {
      buf += chunk.toString("utf8");
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        tailLines.push(line);
        if (tailLines.length > 50) tailLines.shift();
        if (typeof onLine === "function") {
          try { onLine(line); } catch { /* a listener must not kill the build */ }
        }
      }
    };
    child.stdout.on("data", feed);
    child.stderr.on("data", feed);
    child.on("error", (err) => {
      clearTimeout(timer);
      rejectPromise(cliError(err, tailLines.join("\n")));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (buf.trim()) {
        tailLines.push(buf.trim());
        if (typeof onLine === "function") { try { onLine(buf.trim()); } catch { /* noop */ } }
      }
      if (code === 0) resolvePromise({ tag, ok: true });
      else rejectPromise(new DockerError("BUILD_FAILED", trimErr(tailLines.slice(-5).join(" | ")) || `docker build exited ${code}`));
    });
  });
}

export async function runContainer({ image, name, env, ports, memoryMb, cpus, network, cmd } = {}) {
  validateImageRef(image);
  const args = [
    "run", "-d",
    "--label", "kiln.managed=1",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
  ];
  if (name !== undefined && name !== null && name !== "") {
    args.push("--name", validateContainerName(name));
  }
  if (env && typeof env === "object") {
    for (const [key, value] of Object.entries(env)) {
      validateEnvKey(key);
      const v = String(value);
      if (/[\r\n\0]/.test(v)) fail("BAD_ENV_VALUE", `env value for ${key} contains a newline`);
      args.push("-e", `${key}=${v}`);
    }
  }
  if (Array.isArray(ports)) {
    for (const p of ports) args.push("-p", validatePortMapping(p));
  }
  if (memoryMb !== undefined && memoryMb !== null && memoryMb !== "") {
    const m = Math.floor(Number(memoryMb));
    if (!Number.isFinite(m) || m < 16 || m > 65536) fail("BAD_MEMORY", `memoryMb out of range 16-65536: ${JSON.stringify(memoryMb)}`);
    args.push("--memory", `${m}m`);
  }
  if (cpus !== undefined && cpus !== null && cpus !== "") {
    const c = Number(cpus);
    if (!Number.isFinite(c) || c <= 0 || c > 64) fail("BAD_CPUS", `cpus out of range (0, 64]: ${JSON.stringify(cpus)}`);
    args.push("--cpus", String(c));
  }
  if (network !== undefined && network !== null && network !== "") {
    args.push("--network", validateNetwork(network));
  }
  args.push(image);
  if (Array.isArray(cmd)) {
    for (const part of cmd) {
      const s = String(part);
      if (/[\0]/.test(s)) fail("BAD_CMD", "command argument contains a NUL byte");
      args.push(s);
    }
  }
  const { stdout } = await execDocker(args, { timeoutMs: 30000 });
  return { id: stdout.trim().split("\n").pop() || "", image };
}

export async function startContainer(id) {
  validateContainerId(id);
  await execDocker(["start", id], { timeoutMs: 30000 });
  return { id, state: "started" };
}

export async function stopContainer(id) {
  validateContainerId(id);
  await execDocker(["stop", id], { timeoutMs: 60000 });
  return { id, state: "stopped" };
}

export async function restartContainer(id) {
  validateContainerId(id);
  await execDocker(["restart", id], { timeoutMs: 60000 });
  return { id, state: "restarted" };
}

export async function removeContainer(id, { force = false } = {}) {
  validateContainerId(id);
  const args = ["rm"];
  if (force) args.push("-f");
  args.push(id);
  await execDocker(args, { timeoutMs: 30000 });
  return { id, removed: true };
}

// --- build contexts from the forge -----------------------------------------

export function gitRootDir() {
  return process.env.KILN_SWARM_GIT_DIR || path.join(os.homedir(), ".kiln-swarm", "git");
}

// Materialize a KILN repo (bare repo under ~/.kiln-swarm/git/<owner>/<repo>.git)
// into a fresh temp dir via `git archive`. Returns { dir, cleanup() }.
export async function resolveBuildContext(owner, repo, ref) {
  validateOwner(owner);
  validateRepo(repo);
  const treeish = validateRef(ref);
  const root = path.resolve(gitRootDir());
  const gitDir = path.resolve(root, owner, `${repo}.git`);
  if (!gitDir.startsWith(root + path.sep)) fail("BAD_REPO", "repo path escapes the forge git root");
  let stat;
  try {
    stat = fs.statSync(gitDir);
  } catch {
    fail("REPO_NOT_FOUND", `no such forge repo: ${owner}/${repo}`);
  }
  if (!stat.isDirectory()) fail("REPO_NOT_FOUND", `no such forge repo: ${owner}/${repo}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-docker-build-"));
  try {
    await new Promise((resolvePromise, rejectPromise) => {
      const git = spawn("git", ["--git-dir", gitDir, "archive", "--format=tar", treeish], { windowsHide: true });
      const tar = spawn("tar", ["-x", "-C", dir], { windowsHide: true });
      let gitErr = "";
      let tarErr = "";
      git.stderr.on("data", (d) => { gitErr += d.toString("utf8"); });
      tar.stderr.on("data", (d) => { tarErr += d.toString("utf8"); });
      git.stdout.pipe(tar.stdin);
      let gitCode = null;
      let tarCode = null;
      const done = () => {
        if (gitCode === null || tarCode === null) return;
        if (gitCode !== 0) rejectPromise(new DockerError("ARCHIVE_FAILED", trimErr(gitErr) || `git archive exited ${gitCode} (bad ref ${treeish}?)`));
        else if (tarCode !== 0) rejectPromise(new DockerError("ARCHIVE_FAILED", trimErr(tarErr) || `tar exited ${tarCode}`));
        else resolvePromise();
      };
      git.on("error", (e) => { gitCode = -1; gitErr = e.message; done(); });
      tar.on("error", (e) => { tarCode = -1; tarErr = e.message; done(); });
      git.on("close", (c) => { gitCode = c; done(); });
      tar.on("close", (c) => { tarCode = c; done(); });
    });
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  return {
    dir,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// The Dockerfile a build will use: <contextDir>/Dockerfile, or a confined
// relative path inside the context. Throws a typed NO_DOCKERFILE error.
export function requireDockerfile(contextDir, rel) {
  const relPath = rel ? validateDockerfileRel(rel) : "Dockerfile";
  const abs = path.resolve(contextDir, relPath);
  const rootAbs = path.resolve(contextDir);
  if (!abs.startsWith(rootAbs + path.sep) && abs !== rootAbs) fail("BAD_DOCKERFILE", "dockerfile path escapes the build context");
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    fail("NO_DOCKERFILE", rel ? `no dockerfile at ${relPath} in the build context` : "no Dockerfile at the repository root");
  }
  return abs;
}

// --- operator gate -----------------------------------------------------------
// Constant-time Bearer comparison against the operator token file. The
// token is never logged and never returned. Any failure (missing file,
// empty token, malformed header) is simply false.
export function authorizeDocker(authHeader, tokenFilePath) {
  try {
    if (typeof authHeader !== "string") return false;
    const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (!m) return false;
    const presented = Buffer.from(m[1].trim(), "utf8");
    if (!presented.length) return false;
    const expectedRaw = fs.readFileSync(tokenFilePath, "utf8").trim();
    if (!expectedRaw) return false;
    const expected = Buffer.from(expectedRaw, "utf8");
    if (presented.length !== expected.length) {
      crypto.timingSafeEqual(expected, expected); // keep the timing shape flat
      return false;
    }
    return crypto.timingSafeEqual(presented, expected);
  } catch {
    return false;
  }
}
