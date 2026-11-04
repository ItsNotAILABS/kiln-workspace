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
//
// One labeled exception to "docker or nothing": on hosts where the
// daemon answers but container start through the containerd shim is
// blocked by the sandbox (see the runsc-direct section below), run and
// COPY-only build operations fall back to a gVisor runsc path — and
// every result says so (runtime:"runsc-direct", buildMethod:
// "import-assembly"). A fallback is never dressed as a docker result.
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

// --- runsc-direct fallback ---------------------------------------------------
// On hosts where dockerd answers but container START through the
// containerd shim is blocked by the sandbox — here: setns into the
// libnetwork-owned netns in the OCI spec is denied, and runc/crun die
// on a session-keyring EPERM inside the container's fresh namespaces —
// gVisor's runsc invoked DIRECTLY on an OCI bundle still runs real,
// isolated containers (proven on this host: alpine, uid=0). When a
// docker run fails with that failure class and a runsc binary exists,
// the engine falls back to runsc and labels the result
// runtime:"runsc-direct" — never as a plain docker run. Runs in this
// mode publish no ports and enforce no resource limits
// (--network=none --ignore-cgroups: no cgroup controllers are
// delegated to this sandbox); the labels say what actually ran.
//
// One level deeper still: the launch itself can fail when the
// CALLER's context is restricted (the backend's systemd service
// context hits the gofer's namespace denial even for a sound bundle,
// while an operator shell launches the same bundle fine). That class
// is handed to the operator-context runner queue below, and the run
// reports state "queued" until a runner actually starts it.

const RUN_FALLBACK_RE = /namespace|keyring|SetNetworkArgs|sandbox exited|loopback|operation not permitted/i;

export function runscBin() {
  if (process.env.KILN_RUNSC_BIN) return process.env.KILN_RUNSC_BIN;
  const candidate = "/usr/local/bin/runsc";
  return fs.existsSync(candidate) ? candidate : null;
}

export function runscStateDir() {
  return process.env.KILN_RUNSC_STATE || path.join(os.homedir(), ".kiln-swarm", "runsc");
}

function runscRootDir() {
  return path.join(runscStateDir(), "root");
}

function runscBundleDir(name) {
  return path.join(runscStateDir(), "bundles", name);
}

function runscLogPath(name) {
  return path.join(runscStateDir(), "logs", `${name}.log`);
}

function runscMetaPath(name) {
  return path.join(runscBundleDir(name), "meta.json");
}

function readRunscMeta(name) {
  try {
    const meta = JSON.parse(fs.readFileSync(runscMetaPath(name), "utf8"));
    return meta && typeof meta === "object" ? meta : null;
  } catch {
    return null;
  }
}

function isRunscContainer(id) {
  return !!readRunscMeta(id);
}

function isNoSuchContainer(err) {
  return err instanceof Error && /no such container/i.test(err.message);
}

// --- operator-context runner queue -------------------------------------------
// A direct runsc launch can still fail when the CALLER runs in a
// restricted context (on this host: the backend's systemd service
// context, where the gofer's namespace setup is denied even though the
// identical bundle launches fine from an operator shell). For that
// failure class the engine does not give up and does not fake a start:
// it writes a pending request into <state>/queue/pending and waits
// briefly for an operator-context runner (scripts/runsc-runner.mjs) to
// execute it and report back in <state>/queue/results. With no runner
// answering, the run reports state "queued" — the honest state — and
// the container listing keeps showing it as queued until the runner
// executes it or it is stopped/removed (which clears the records).

const RUN_QUEUE_RE = /namespace|SetNetworkArgs|sandbox exited|loopback|operation not permitted/i;

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function runnerWaitMs() {
  const n = Number(process.env.RUNSC_RUNNER_WAIT_MS);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 4000;
}

function runscQueuePendingPath(name) {
  return path.join(runscStateDir(), "queue", "pending", `${name}.json`);
}

function runscQueueResultPath(name) {
  return path.join(runscStateDir(), "queue", "results", `${name}.json`);
}

function readQueueJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readQueuePending(name) {
  return readQueueJson(runscQueuePendingPath(name));
}

function readQueueResult(name) {
  return readQueueJson(runscQueueResultPath(name));
}

function hasQueueRecord(name) {
  return fs.existsSync(runscQueuePendingPath(name)) || fs.existsSync(runscQueueResultPath(name));
}

// The result that belongs to the CURRENT pending request: a result
// written for an earlier generation of the same name (its startedAt
// predates the pending's requestedAt) is stale and does not count.
function currentQueueResult(name, pending) {
  const result = readQueueResult(name);
  if (!result) return null;
  if (pending && result.startedAt && pending.requestedAt && String(result.startedAt) < String(pending.requestedAt)) return null;
  return result;
}

function writeQueuePending(name, { image, requestedAt } = {}) {
  const file = runscQueuePendingPath(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const record = {
    name,
    image: image !== undefined && image !== null ? String(image) : (readRunscMeta(name)?.image || null),
    bundleDir: runscBundleDir(name),
    logFile: runscLogPath(name),
    requestedAt: requestedAt || new Date().toISOString(),
  };
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2));
  fs.renameSync(tmp, file);
  return record;
}

function clearQueueRecords(name) {
  fs.rmSync(runscQueuePendingPath(name), { force: true });
  fs.rmSync(runscQueueResultPath(name), { force: true });
}

// Queue the prepared bundle for the operator-context runner and wait
// a short window for the runner to report. Returns { queued:false }
// once the runner reports the container started (running, or already
// exited — the start did happen), { queued:true } when no runner
// answered in the window; throws RUN_FAILED when the runner reports
// the launch itself failed.
async function queueForRunner(name, image) {
  const requestedAt = new Date().toISOString();
  writeQueuePending(name, { image, requestedAt });
  const deadline = Date.now() + runnerWaitMs();
  for (;;) {
    const result = readQueueResult(name);
    if (
      result && typeof result.state === "string"
      && (!result.startedAt || String(result.startedAt) >= requestedAt)
    ) {
      if (result.state === "failed") {
        throw new DockerError("RUN_FAILED", `runsc runner failed to start container ${name}${result.error ? `: ${trimErr(result.error)}` : ""}`);
      }
      return { queued: false };
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { queued: true };
    await sleep(Math.min(250, remaining));
  }
}

function runscCliError(err, stderr) {
  if (err && err.code === "ENOENT") {
    return new DockerError("RUNSC_UNAVAILABLE", `runsc binary not found (${runscBin()})`);
  }
  if (err && (err.killed || err.signal === "SIGTERM")) {
    return new DockerError("DOCKER_TIMEOUT", "runsc CLI timed out");
  }
  const detail = trimErr(stderr) || trimErr(err && err.message) || "runsc CLI failed";
  return new DockerError("RUNSC_FAILED", detail);
}

function execRunsc(args, { timeoutMs = 30000, maxBuffer = 8 * 1024 * 1024, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const bin = runscBin();
    if (!bin) return reject(new DockerError("RUNSC_UNAVAILABLE", "runsc binary not available on this host"));
    execFile(bin, args, { timeout: timeoutMs, maxBuffer, windowsHide: true, cwd }, (err, stdout, stderr) => {
      if (err) return reject(runscCliError(err, stderr));
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

function runscStateArgs() {
  return ["--root", runscRootDir()];
}

function executionInfo() {
  if (runscBin()) {
    return {
      runscDirect: true,
      note: "containers may execute via runsc-direct (gVisor) when the daemon's start path is blocked on this host",
    };
  }
  return { runscDirect: false };
}

// Stream `docker export <tmpName>` into a tar extraction at destDir —
// the image's rootfs without ever starting the container.
function pipeDockerExport(tmpName, destDir) {
  return new Promise((resolvePromise, rejectPromise) => {
    const docker = spawn(dockerBin(), ["export", tmpName], { windowsHide: true });
    const tar = spawn("tar", ["-x", "-C", destDir], { windowsHide: true });
    let dockerErr = "";
    let tarErr = "";
    docker.stderr.on("data", (d) => { dockerErr += d.toString("utf8"); });
    tar.stderr.on("data", (d) => { tarErr += d.toString("utf8"); });
    docker.stdout.pipe(tar.stdin);
    let dockerCode = null;
    let tarCode = null;
    const done = () => {
      if (dockerCode === null || tarCode === null) return;
      if (dockerCode !== 0) rejectPromise(new DockerError("DOCKER_FAILED", trimErr(dockerErr) || `docker export exited ${dockerCode}`));
      else if (tarCode !== 0) rejectPromise(new DockerError("DOCKER_FAILED", trimErr(tarErr) || `tar exited ${tarCode}`));
      else resolvePromise();
    };
    docker.on("error", (e) => { dockerCode = -1; dockerErr = e.message; done(); });
    tar.on("error", (e) => { tarCode = -1; tarErr = e.message; done(); });
    docker.on("close", (c) => { dockerCode = c; done(); });
    tar.on("close", (c) => { tarCode = c; done(); });
  });
}

async function exportImageRootfs(image, destDir) {
  const tmpName = `kiln-export-${crypto.randomBytes(6).toString("hex")}`;
  try {
    await execDocker(["create", "--name", tmpName, image], { timeoutMs: 30000 });
  } catch (e) {
    // An image with no entrypoint/cmd in its config (e.g. a plain
    // `docker import` product) makes create refuse without a command.
    // The container is never started — it exists only to export its
    // rootfs and is removed below — so a placeholder command is exact.
    if (!/no command specified/i.test(e instanceof Error ? e.message : "")) throw e;
    await execDocker(["create", "--name", tmpName, image, "/bin/sh"], { timeoutMs: 30000 });
  }
  try {
    await pipeDockerExport(tmpName, destDir);
  } finally {
    await execDocker(["rm", tmpName], { timeoutMs: 30000 }).catch(() => {});
  }
}

async function readImageConfig(image) {
  const { stdout } = await execDocker(["inspect", "--format", "{{json .Config}}", image], { timeoutMs: 10000 });
  let cfg;
  try {
    cfg = JSON.parse(stdout.trim());
  } catch {
    throw new DockerError("DOCKER_BAD_OUTPUT", "unparseable image inspect output from docker CLI");
  }
  if (!cfg || typeof cfg !== "object") throw new DockerError("DOCKER_BAD_OUTPUT", "image inspect returned no config");
  return {
    cmd: Array.isArray(cfg.Cmd) ? cfg.Cmd.map(String) : null,
    entrypoint: Array.isArray(cfg.Entrypoint) ? cfg.Entrypoint.map(String) : null,
    env: Array.isArray(cfg.Env) ? cfg.Env.map(String) : [],
    workingDir: typeof cfg.WorkingDir === "string" ? cfg.WorkingDir : "",
  };
}

// Start (or restart) the sandbox for an already-assembled bundle.
// Container stdout/stderr append to the runsc log file for the name.
// Resolves { queued:false } when the sandbox started here. When the
// launch fails with the host-context class (the caller's context —
// e.g. the backend's systemd service — cannot perform the gofer's
// namespace setup even though the bundle is sound), the bundle is
// handed to the operator-context runner queue instead: resolves
// { queued:true } if no runner answered in the wait window, or
// { queued:false } once a runner reports the start. Any other failure
// throws RUN_FAILED with the captured log tail.
async function launchRunsc(name, image) {
  const bundleDir = runscBundleDir(name);
  const logPath = runscLogPath(name);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const fd = fs.openSync(logPath, "a");
  let child;
  try {
    child = spawn(
      runscBin(),
      ["--network=none", "--ignore-cgroups", ...runscStateArgs(), "run", "--detach", "--bundle", bundleDir, name],
      { detached: true, stdio: ["ignore", fd, fd], windowsHide: true },
    );
  } finally {
    fs.closeSync(fd);
  }
  const code = await new Promise((resolvePromise) => {
    child.on("error", () => resolvePromise(-1));
    child.on("exit", (c) => resolvePromise(c === null ? -1 : c));
  });
  child.unref();
  if (code !== 0) {
    let tail = "";
    try {
      tail = trimErr(fs.readFileSync(logPath, "utf8").slice(-2000));
    } catch { /* no log captured */ }
    const failure = new DockerError("RUN_FAILED", `runsc failed to start container ${name}${tail ? `: ${tail}` : ""}`);
    if (RUN_QUEUE_RE.test(failure.message)) {
      return queueForRunner(name, image);
    }
    throw failure;
  }
  return { queued: false };
}

async function runViaRunsc({ image, name, env, cmd, entrypoint } = {}) {
  validateImageRef(image);
  if (!runscBin()) fail("RUNSC_UNAVAILABLE", "runsc binary not available on this host");
  const cname = name !== undefined && name !== null && name !== ""
    ? validateContainerName(name)
    : `kiln-${crypto.randomBytes(6).toString("hex")}`;
  const bundleDir = runscBundleDir(cname);
  const rootfsDir = path.join(bundleDir, "rootfs");
  fs.mkdirSync(rootfsDir, { recursive: true });
  await exportImageRootfs(image, rootfsDir);
  const cfg = await readImageConfig(image);
  const entry = entrypoint !== undefined && entrypoint !== null
    ? (Array.isArray(entrypoint) ? entrypoint.map(String) : [String(entrypoint)])
    : cfg.entrypoint;
  const command = cmd !== undefined && cmd !== null ? cmd.map(String) : cfg.cmd;
  const args = [...(entry || []), ...(command || [])];
  if (!args.length) {
    fail("RUN_FAILED", `no command to run for image ${image}: the image sets no entrypoint/cmd and none was given`);
  }
  const envMap = new Map();
  for (const line of cfg.env) {
    const eq = line.indexOf("=");
    if (eq > 0) envMap.set(line.slice(0, eq), line.slice(eq + 1));
  }
  if (env && typeof env === "object") {
    for (const [key, value] of Object.entries(env)) {
      validateEnvKey(key);
      const v = String(value);
      if (/[\r\n\0]/.test(v)) fail("BAD_ENV_VALUE", `env value for ${key} contains a newline`);
      envMap.set(key, v);
    }
  }
  // An image whose config carries no PATH at all (e.g. a plain
  // `docker import` product) leaves bare command names unresolvable
  // for runsc; seed the standard default PATH docker itself applies.
  if (!envMap.has("PATH")) envMap.set("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
  // Generate the OCI spec with runsc itself (the host-proven shape),
  // then patch in the image's real command, env and working dir.
  await execRunsc(["spec"], { cwd: bundleDir, timeoutMs: 10000 });
  const specPath = path.join(bundleDir, "config.json");
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  } catch {
    fail("RUN_FAILED", "runsc spec did not produce a readable config.json");
  }
  spec.process = spec.process || {};
  spec.process.terminal = false;
  spec.process.args = args;
  spec.process.env = [...envMap.entries()].map(([k, v]) => `${k}=${v}`);
  spec.process.cwd = cfg.workingDir || "/";
  spec.root = { ...(spec.root || {}), path: rootfsDir, readonly: false };
  spec.hostname = cname;
  if (spec.linux && Array.isArray(spec.linux.namespaces)) {
    // A namespace PATH in the spec is what the daemon's shim chokes on
    // here; runsc's own spec carries none — keep it that way.
    for (const ns of spec.linux.namespaces) {
      if (ns && typeof ns === "object") delete ns.path;
    }
  }
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  fs.writeFileSync(runscMetaPath(cname), JSON.stringify({
    name: cname,
    image,
    runtime: "runsc-direct",
    createdAt: new Date().toISOString(),
  }, null, 2));
  const launched = await launchRunsc(cname, image);
  if (launched && launched.queued) {
    return {
      id: cname,
      name: cname,
      image,
      state: "queued",
      runtime: "runsc-direct",
      ports: [],
      note: "queued for an operator-context runner (scripts/runsc-runner.mjs); the service context cannot start sandboxes on this host",
    };
  }
  return { id: cname, name: cname, image, state: "running", runtime: "runsc-direct", ports: [] };
}

async function listRunscContainers() {
  if (!runscBin()) return [];
  let parsed;
  try {
    const { stdout } = await execRunsc([...runscStateArgs(), "list", "--format", "json"], { timeoutMs: 10000 });
    parsed = JSON.parse(stdout.trim() || "null");
  } catch {
    return []; // runsc state is best-effort; docker state is the floor
  }
  if (!Array.isArray(parsed)) return [];
  const out = [];
  for (const e of parsed) {
    if (!e || typeof e !== "object" || !e.id) continue;
    const id = String(e.id);
    const meta = readRunscMeta(id);
    out.push({
      id,
      name: id,
      image: meta && meta.image ? String(meta.image) : "(runsc)",
      state: String(e.status || e.state || ""),
      status: String(e.status || e.state || ""),
      ports: [],
      labels: "",
      runtime: "runsc-direct",
      createdAt: e.created ? String(e.created) : "",
    });
  }
  return out;
}

// Containers known only through the runner queue: a pending request
// the runner has not executed yet reads "queued"; a current result
// reports its own state (running / exited / failed) until
// removeContainer clears the records.
function listQueueContainers() {
  const names = new Set();
  for (const dir of [path.join(runscStateDir(), "queue", "pending"), path.join(runscStateDir(), "queue", "results")]) {
    let files = [];
    try {
      files = fs.readdirSync(dir);
    } catch { /* queue not created yet */ }
    for (const f of files) {
      if (f.endsWith(".json")) names.add(f.slice(0, -".json".length));
    }
  }
  const out = [];
  for (const name of names) {
    const pending = readQueuePending(name);
    const result = currentQueueResult(name, pending);
    const meta = readRunscMeta(name);
    const state = result && typeof result.state === "string" ? result.state : "queued";
    out.push({
      id: name,
      name,
      image: meta && meta.image ? String(meta.image) : (pending && pending.image ? String(pending.image) : "(runsc)"),
      state,
      status: state,
      ports: [],
      labels: "",
      runtime: "runsc-direct",
      createdAt: meta && meta.createdAt ? String(meta.createdAt) : (pending && pending.requestedAt ? String(pending.requestedAt) : ""),
    });
  }
  return out;
}

// Best-effort teardown of a runsc container's runtime state (its
// bundle survives until removeContainer, so start/restart can relaunch).
async function deleteRunscState(id, { force = false } = {}) {
  const args = [...runscStateArgs(), "delete"];
  if (force) args.push("--force");
  args.push(id);
  try {
    await execRunsc(args, { timeoutMs: 30000 });
  } catch (e) {
    if (isNoSuchContainer(e) || /no such|not found|does not exist|unknown container/i.test(e instanceof Error ? e.message : "")) return;
    throw e;
  }
}

// --- engine surface --------------------------------------------------------

export async function probe() {
  let version;
  try {
    const { stdout } = await execDocker(["version", "--format", "{{json .}}"], { timeoutMs: 6000 });
    version = JSON.parse(stdout.trim());
  } catch (e) {
    if (e instanceof DockerError && (e.code === "DOCKER_UNAVAILABLE" || e.code === "DOCKER_TIMEOUT")) {
      return { available: false, reason: e.message, execution: executionInfo() };
    }
    return { available: false, reason: e instanceof Error ? e.message : "docker version failed", execution: executionInfo() };
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
    execution: executionInfo(),
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
  const dockerEntries = parseJsonLines(stdout, "ps").map((r) => ({
    id: r.ID || "",
    name: r.Names || "",
    image: r.Image || "",
    state: r.State || "",
    status: r.Status || "",
    ports: r.Ports || "",
    labels: r.Labels || "",
    runtime: "docker",
    createdAt: r.CreatedAt || "",
  }));
  // runsc-direct containers live outside the daemon; merge them after
  // the docker entries, labeled. Name-clash priority: docker >
  // runsc-live > runner queue.
  const seen = new Set(dockerEntries.map((c) => c.name));
  const merged = [...dockerEntries];
  try {
    for (const c of await listRunscContainers()) {
      if (!seen.has(c.name)) {
        seen.add(c.name);
        merged.push(c);
      }
    }
  } catch { /* runsc listing is best-effort; docker state is the floor */ }
  try {
    for (const c of listQueueContainers()) {
      if (!seen.has(c.name)) {
        seen.add(c.name);
        merged.push(c);
      }
    }
  } catch { /* queue listing is best-effort too */ }
  return merged;
}

function readRunscLogTail(id, t) {
  const lines = fs.readFileSync(runscLogPath(id), "utf8").split("\n");
  let logs = lines.slice(-t).join("\n");
  if (logs.length > 65536) logs = logs.slice(logs.length - 65536);
  return logs;
}

export async function containerLogs(id, tail = 200) {
  validateContainerId(id);
  const t = Math.max(1, Math.min(5000, Math.floor(Number(tail) || 200)));
  try {
    const { stdout, stderr } = await execDocker(["logs", "--tail", String(t), id], { timeoutMs: 10000, maxBuffer: 4 * 1024 * 1024 });
    let logs = stdout + stderr;
    if (logs.length > 65536) logs = logs.slice(logs.length - 65536);
    return { id, tail: t, logs };
  } catch (e) {
    // A runsc-direct container has no docker logs; its output was
    // captured to the runsc log file at launch. Serve that, labeled.
    const logPath = runscLogPath(id);
    if (fs.existsSync(logPath) && (isRunscContainer(id) || isNoSuchContainer(e))) {
      return { id, tail: t, logs: readRunscLogTail(id, t), runtime: "runsc-direct" };
    }
    // A queued container may have no log file yet (nothing has run).
    // Answer with its queue state, honestly, instead of docker's
    // "no such container".
    const pending = readQueuePending(id);
    const result = currentQueueResult(id, pending);
    if (pending || result) {
      if (fs.existsSync(logPath)) {
        return { id, tail: t, logs: readRunscLogTail(id, t), runtime: "runsc-direct" };
      }
      let logs;
      if (result && result.state === "failed") {
        logs = result.error ? String(result.error) : "the operator-context runner failed to start this container";
      } else if (result && result.state === "exited") {
        logs = "(the container exited; no output was captured)";
      } else {
        logs = "queued — waiting for an operator-context runner";
      }
      return { id, tail: t, logs, runtime: "runsc-direct" };
    }
    throw e;
  }
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

function dockerBuildImage({ contextDir, tag, dockerfile, onLine, timeoutMs = 600000 } = {}) {
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

// Build an image: docker build first. On hosts where the daemon's
// build path is blocked (buildkit needs the same netns operations the
// sandbox denies), a COPY-only Dockerfile can still be assembled for
// real — export the base image's rootfs, apply the COPY/ADD steps to
// it, and `docker import` the result with the Dockerfile's ENV / CMD /
// ENTRYPOINT / WORKDIR as image config. That result is labeled
// buildMethod:"import-assembly". A Dockerfile with RUN steps cannot be
// assembled this way and fails with the reason stated, never silently.
export async function buildImage(opts = {}) {
  try {
    const out = await dockerBuildImage(opts);
    return { ...out, buildMethod: "docker" };
  } catch (e) {
    return importAssemblyBuild(opts, e);
  }
}

// Parse just enough Dockerfile for import-assembly: FROM, COPY/ADD,
// ENV, WORKDIR, CMD, ENTRYPOINT. Anything assembly cannot reproduce
// faithfully is recorded in `unsupported` rather than faked; other
// instructions (EXPOSE, LABEL, USER, ...) have no assembly equivalent
// here and are ignored. COPY destinations are resolved against the
// WORKDIR in effect at that line, as docker resolves them.
export function parseDockerfile(text) {
  const joined = String(text).replace(/\\\r?\n/g, " ");
  const out = { from: null, fromCount: 0, copies: [], env: [], workdir: "", cmd: null, entrypoint: null, unsupported: [] };
  const stages = new Set();
  let workdirAbs = "/";
  let sawWorkdir = false;
  for (const rawLine of joined.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([A-Za-z]+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const instr = m[1].toUpperCase();
    const rest = m[2].trim();
    if (instr === "FROM") {
      out.fromCount += 1;
      const tokens = rest.split(/\s+/).filter((t) => !t.startsWith("--"));
      const ref = tokens[0] || "";
      if (out.fromCount > 1) {
        out.unsupported.push("multi-stage Dockerfile (more than one FROM)");
        continue;
      }
      if (/^scratch$/i.test(ref)) {
        out.unsupported.push("FROM scratch has no base image to assemble from");
        continue;
      }
      if (stages.has(ref.toLowerCase())) {
        out.unsupported.push(`FROM ${ref} refers to an earlier build stage`);
        continue;
      }
      out.from = ref;
      const asIdx = tokens.findIndex((t) => /^as$/i.test(t));
      if (asIdx >= 0 && tokens[asIdx + 1]) stages.add(tokens[asIdx + 1].toLowerCase());
      continue;
    }
    if (instr === "COPY" || instr === "ADD") {
      let r = rest;
      const flags = [];
      while (r.startsWith("--")) {
        const sp = r.indexOf(" ");
        if (sp === -1) break;
        flags.push(r.slice(0, sp));
        r = r.slice(sp + 1).trim();
      }
      if (flags.length) {
        out.unsupported.push(`${instr} ${flags[0]} is not supported by import-assembly`);
        continue;
      }
      let parts;
      if (r.startsWith("[")) {
        try {
          parts = JSON.parse(r);
        } catch {
          out.unsupported.push(`${instr} with an unparseable JSON array form`);
          continue;
        }
        if (!Array.isArray(parts) || parts.length < 2) {
          out.unsupported.push(`${instr} needs at least one source and a destination`);
          continue;
        }
        parts = parts.map(String);
      } else {
        parts = r.split(/\s+/).filter(Boolean);
      }
      if (parts.length < 2) {
        out.unsupported.push(`${instr} needs at least one source and a destination`);
        continue;
      }
      if (instr === "ADD" && parts.slice(0, -1).some((s) => /^https?:\/\//i.test(s))) {
        out.unsupported.push("ADD from a remote URL is not supported by import-assembly");
        continue;
      }
      const rawDest = parts[parts.length - 1];
      const destAbs = (rawDest.startsWith("/") ? path.posix.normalize(rawDest) : path.posix.join(workdirAbs, rawDest)).replace(/\/+$/, "") || "/";
      out.copies.push({
        sources: parts.slice(0, -1),
        dest: destAbs,
        destIsDir: rawDest.endsWith("/") || rawDest === "." || rawDest.endsWith("/.") || parts.length > 2,
      });
      continue;
    }
    if (instr === "ENV") {
      const tokens = rest.split(/\s+/);
      if (tokens[0] && tokens[0].includes("=")) {
        for (const t of tokens) {
          const eq = t.indexOf("=");
          if (eq > 0) out.env.push([t.slice(0, eq), t.slice(eq + 1)]);
        }
      } else if (tokens[0]) {
        out.env.push([tokens[0], rest.slice(tokens[0].length).trim()]);
      }
      continue;
    }
    if (instr === "WORKDIR") {
      const w = rest.split(/\s+/)[0];
      if (w) {
        workdirAbs = w.startsWith("/") ? path.posix.normalize(w) : path.posix.join(workdirAbs, w);
        sawWorkdir = true;
        out.workdir = workdirAbs;
      }
      continue;
    }
    if (instr === "CMD" || instr === "ENTRYPOINT") {
      let value;
      if (rest.startsWith("[")) {
        try {
          value = JSON.parse(rest).map(String);
        } catch {
          value = ["/bin/sh", "-c", rest];
        }
      } else {
        value = ["/bin/sh", "-c", rest];
      }
      if (instr === "CMD") out.cmd = value;
      else out.entrypoint = value;
      continue;
    }
    // RUN is rejected by the caller before parsing; every other
    // instruction is ignored rather than faked.
  }
  if (!sawWorkdir) out.workdir = "";
  return out;
}

function applyImportCopy(contextDir, rootfsDir, copy) {
  const destAbs = path.resolve(rootfsDir, `.${copy.dest}`);
  if (destAbs !== rootfsDir && !destAbs.startsWith(rootfsDir + path.sep)) {
    fail("BAD_DOCKERFILE", `COPY destination escapes the image rootfs: ${copy.dest}`);
  }
  for (const src of copy.sources) {
    if (/[*?[]/.test(src)) fail("BUILD_UNSUPPORTED", `COPY source ${JSON.stringify(src)} uses a wildcard, which import-assembly does not expand`);
    const srcAbs = path.resolve(contextDir, src);
    if (srcAbs !== path.resolve(contextDir) && !srcAbs.startsWith(path.resolve(contextDir) + path.sep)) {
      fail("BAD_DOCKERFILE", `COPY source escapes the build context: ${src}`);
    }
    let stat;
    try {
      stat = fs.statSync(srcAbs);
    } catch {
      fail("BUILD_FAILED", `COPY source not found in the build context: ${src}`);
    }
    if (stat.isDirectory()) {
      // docker copies a directory's CONTENTS into the destination.
      fs.mkdirSync(destAbs, { recursive: true });
      fs.cpSync(srcAbs, destAbs, { recursive: true });
    } else {
      const destIsDir = copy.destIsDir || (fs.existsSync(destAbs) && fs.statSync(destAbs).isDirectory());
      const target = destIsDir ? path.join(destAbs, path.basename(srcAbs)) : destAbs;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(srcAbs, target);
    }
  }
}

function tarCreate(rootfsDir, tarPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile("tar", ["-cf", tarPath, "-C", rootfsDir, "."], { timeout: 120000, windowsHide: true }, (err, _stdout, stderr) => {
      if (err) return rejectPromise(new DockerError("BUILD_FAILED", trimErr(stderr) || `tar exited ${err.code}`));
      resolvePromise();
    });
  });
}

async function importAssemblyBuild(opts, originalError) {
  const { contextDir, tag, dockerfile, onLine } = opts || {};
  const emit = (line) => {
    if (typeof onLine === "function") {
      try { onLine(line); } catch { /* a listener must not kill the build */ }
    }
  };
  let dfText;
  try {
    const dfPath = dockerfile ? path.join(contextDir, validateDockerfileRel(dockerfile)) : path.join(contextDir, "Dockerfile");
    dfText = fs.readFileSync(dfPath, "utf8");
  } catch {
    throw originalError; // no readable Dockerfile: the docker error is the honest one
  }
  if (/^\s*RUN\s/im.test(dfText)) {
    const note = "RUN steps cannot execute on this host yet (sandbox blocks container start through the daemon); COPY-only builds are supported";
    if (originalError instanceof DockerError) throw new DockerError(originalError.code, `${originalError.message} — ${note}`);
    throw new DockerError("BUILD_FAILED", `${originalError instanceof Error ? originalError.message : "docker build failed"} — ${note}`);
  }
  const parsed = parseDockerfile(dfText);
  if (!parsed.from || parsed.unsupported.length) {
    const why = parsed.unsupported[0] || "no FROM instruction to assemble from";
    throw new DockerError("BUILD_UNSUPPORTED", `import-assembly cannot build this Dockerfile: ${why} (docker build said: ${originalError instanceof Error ? originalError.message : "docker build failed"})`);
  }
  validateImageRef(parsed.from);
  emit(`kiln: docker build could not run on this host (${trimErr(originalError instanceof Error ? originalError.message : "")}); assembling ${tag} by import instead (COPY-only Dockerfile)`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-import-assembly-"));
  const rootfsDir = path.join(tmpDir, "rootfs");
  fs.mkdirSync(rootfsDir, { recursive: true });
  try {
    await exportImageRootfs(parsed.from, rootfsDir);
    for (const copy of parsed.copies) applyImportCopy(contextDir, rootfsDir, copy);
    const changes = [];
    if (parsed.workdir) changes.push(`WORKDIR ${parsed.workdir}`);
    for (const [k, v] of parsed.env) {
      validateEnvKey(k);
      changes.push(`ENV ${k}=${v}`);
    }
    if (parsed.cmd) changes.push(`CMD ${JSON.stringify(parsed.cmd)}`);
    if (parsed.entrypoint) changes.push(`ENTRYPOINT ${JSON.stringify(parsed.entrypoint)}`);
    const tarPath = path.join(tmpDir, "rootfs.tar");
    await tarCreate(rootfsDir, tarPath);
    const importArgs = ["import"];
    for (const c of changes) importArgs.push("-c", c);
    importArgs.push(tarPath, tag);
    await execDocker(importArgs, { timeoutMs: 120000 });
    emit(`kiln: assembled ${tag} from ${parsed.from} via import-assembly (${parsed.copies.length} copy step${parsed.copies.length === 1 ? "" : "s"})`);
    return { tag, ok: true, buildMethod: "import-assembly" };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function runContainer({ image, name, env, ports, memoryMb, cpus, network, cmd, entrypoint } = {}) {
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
  let stdout;
  try {
    ({ stdout } = await execDocker(args, { timeoutMs: 30000 }));
  } catch (e) {
    // The daemon's start path is blocked on this host class (netns /
    // keyring class failures): fall back to runsc-direct, LABELED.
    // Any other docker failure propagates untouched. Ports, memory,
    // cpus and network from the request cannot be honored by the
    // fallback and are NOT silently claimed: the result carries
    // ports: [] and the runsc-direct runtime label.
    if (runscBin() && e instanceof DockerError && RUN_FALLBACK_RE.test(e.message)) {
      // A failed `docker run --name` leaves a created-state namesake
      // behind that would shadow the runsc entry in the merged list
      // (docker wins name clashes). It never started — remove it
      // before the fallback launch. Best-effort: a failed rm must
      // not block the fallback.
      if (name) {
        await execDocker(["rm", validateContainerName(name)], { timeoutMs: 15000 }).catch(() => {});
      }
      return runViaRunsc({ image, name, env, cmd, entrypoint });
    }
    throw e;
  }
  return { id: stdout.trim().split("\n").pop() || "", image, runtime: "docker" };
}

export async function startContainer(id) {
  validateContainerId(id);
  try {
    await execDocker(["start", id], { timeoutMs: 30000 });
    return { id, state: "started" };
  } catch (e) {
    if (!isRunscContainer(id) || !isNoSuchContainer(e)) throw e;
    const launched = await launchRunsc(validateContainerName(id), readRunscMeta(id)?.image);
    if (launched && launched.queued) return { id, state: "queued", runtime: "runsc-direct" };
    return { id, state: "started", runtime: "runsc-direct" };
  }
}

export async function stopContainer(id) {
  validateContainerId(id);
  try {
    await execDocker(["stop", id], { timeoutMs: 60000 });
    return { id, state: "stopped" };
  } catch (e) {
    if (!isNoSuchContainer(e)) throw e;
    if (isRunscContainer(id)) {
      const live = (await listRunscContainers()).some((c) => c.id === id);
      if (!live && hasQueueRecord(id)) {
        // Queued but never executed — or the runner's "running"
        // record is stale (runsc no longer lists it). Stopping is a
        // dequeue: clear the queue records.
        clearQueueRecords(id);
        return { id, state: "dequeued", runtime: "runsc-direct" };
      }
      await execRunsc([...runscStateArgs(), "kill", id, "SIGTERM"], { timeoutMs: 30000 }).catch(() => {});
      await deleteRunscState(id);
      clearQueueRecords(id);
      return { id, state: "stopped", runtime: "runsc-direct" };
    }
    if (hasQueueRecord(id)) {
      clearQueueRecords(id);
      return { id, state: "dequeued", runtime: "runsc-direct" };
    }
    throw e;
  }
}

export async function restartContainer(id) {
  validateContainerId(id);
  try {
    await execDocker(["restart", id], { timeoutMs: 60000 });
    return { id, state: "restarted" };
  } catch (e) {
    if (!isRunscContainer(id) || !isNoSuchContainer(e)) throw e;
    await execRunsc([...runscStateArgs(), "kill", id, "SIGTERM"], { timeoutMs: 30000 }).catch(() => {});
    await deleteRunscState(id);
    clearQueueRecords(id);
    const launched = await launchRunsc(validateContainerName(id), readRunscMeta(id)?.image);
    if (launched && launched.queued) return { id, state: "queued", runtime: "runsc-direct" };
    return { id, state: "restarted", runtime: "runsc-direct" };
  }
}

export async function removeContainer(id, { force = false } = {}) {
  validateContainerId(id);
  const args = ["rm"];
  if (force) args.push("-f");
  args.push(id);
  try {
    await execDocker(args, { timeoutMs: 30000 });
    return { id, removed: true };
  } catch (e) {
    if (!isNoSuchContainer(e)) throw e;
    if (isRunscContainer(id)) {
      await deleteRunscState(id, { force: true });
      clearQueueRecords(id);
      fs.rmSync(runscBundleDir(id), { recursive: true, force: true });
      fs.rmSync(runscLogPath(id), { force: true });
      return { id, removed: true, runtime: "runsc-direct" };
    }
    if (hasQueueRecord(id)) {
      clearQueueRecords(id);
      fs.rmSync(runscBundleDir(id), { recursive: true, force: true });
      fs.rmSync(runscLogPath(id), { force: true });
      return { id, removed: true, runtime: "runsc-direct" };
    }
    throw e;
  }
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
