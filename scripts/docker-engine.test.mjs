import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { before, after } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DockerError,
  authorizeDocker,
  buildImage,
  containerLogs,
  inspectContainer,
  listContainers,
  listImages,
  parseDockerfile,
  probe,
  removeContainer,
  requireDockerfile,
  resolveBuildContext,
  runContainer,
  startContainer,
  stopContainer,
  validateEnvKey,
  validateOwner,
  validatePortMapping,
  validateRef,
  validateRepo,
} from "./docker-engine.mjs";

// A fake docker CLI: canned output for every subcommand the engine uses,
// plus an argv log (one line per invocation, args space-joined) so tests
// can prove the argv SHAPE the engine builds — arrays, never a shell.
const FAKE_DOCKER = `#!/bin/sh
LOG="\${FAKE_DOCKER_ARGV_LOG:-}"
if [ -n "$LOG" ]; then
  printf '%s\\n' "$*" >> "$LOG"
fi
cmd="$1"
case "$cmd" in
  version)
    echo '{"Client":{"Version":"27.0.3","ApiVersion":"1.46"},"Server":{"Version":"27.0.3","ApiVersion":"1.46","Os":"linux","Arch":"arm64"}}'
    ;;
  info)
    echo '{"Driver":"overlay2","Containers":3,"ContainersRunning":1,"Images":5,"OperatingSystem":"Ubuntu 24.04"}'
    ;;
  images)
    echo '{"ID":"sha256:aaa111","Repository":"kiln/demo","Tag":"latest","Size":"12.3MB","CreatedAt":"2026-11-01 10:00:00 +0000 UTC"}'
    echo '{"ID":"sha256:bbb222","Repository":"alpine","Tag":"3.20","Size":"7.8MB","CreatedAt":"2026-10-01 10:00:00 +0000 UTC"}'
    ;;
  ps)
    echo '{"ID":"c0ffee123456","Image":"kiln/demo:latest","Names":"demo-web","State":"running","Status":"Up 2 hours","Ports":"0.0.0.0:8080->80/tcp","Labels":"kiln.managed=1","CreatedAt":"2026-11-03 09:00:00 +0000 UTC"}'
    echo '{"ID":"deadbeef9999","Image":"alpine:3.20","Names":"old-job","State":"exited","Status":"Exited (0) 3 days ago","Ports":"","Labels":"","CreatedAt":"2026-10-31 09:00:00 +0000 UTC"}'
    ;;
  logs)
    echo "line one"
    echo "line two" 1>&2
    ;;
  inspect)
    echo '[{"Id":"c0ffee1234567890","Name":"/demo-web","Created":"2026-11-03T09:00:00Z","Config":{"Image":"kiln/demo:latest","Labels":{"kiln.managed":"1"},"Env":["PATH=/usr/bin","SECRET_KEY=hunter2"]},"State":{"Status":"running","Running":true},"NetworkSettings":{"Ports":{"80/tcp":[{"HostIp":"0.0.0.0","HostPort":"8080"}]}}}]'
    ;;
  build)
    echo "Step 1/2 : FROM scratch"
    echo "Step 2/2 : COPY . ."
    echo "Successfully built abc123"
    ;;
  run)
    echo "f00df00df00df00df00df00df00df00df00df00df00df00df00df00df00df00d"
    ;;
  start|stop|restart|rm)
    echo "ok"
    ;;
  *)
    echo "fake docker: unknown command $cmd" 1>&2
    exit 1
    ;;
esac
exit 0
`;

let tmp;
let argvLog;
let savedBin;
let savedGitDir;

function argvLines() {
  try {
    return fs.readFileSync(argvLog, "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-docker-test-"));
  const fakePath = path.join(tmp, "docker");
  fs.writeFileSync(fakePath, FAKE_DOCKER, { mode: 0o755 });
  argvLog = path.join(tmp, "argv.log");
  savedBin = process.env.KILN_DOCKER_BIN;
  savedGitDir = process.env.KILN_SWARM_GIT_DIR;
  process.env.KILN_DOCKER_BIN = fakePath;
  process.env.FAKE_DOCKER_ARGV_LOG = argvLog;
});

after(() => {
  if (savedBin === undefined) delete process.env.KILN_DOCKER_BIN;
  else process.env.KILN_DOCKER_BIN = savedBin;
  if (savedGitDir === undefined) delete process.env.KILN_SWARM_GIT_DIR;
  else process.env.KILN_SWARM_GIT_DIR = savedGitDir;
  delete process.env.FAKE_DOCKER_ARGV_LOG;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("probe parses version + info and reports available", async () => {
  const p = await probe();
  assert.equal(p.available, true);
  assert.equal(p.serverVersion, "27.0.3");
  assert.equal(p.clientVersion, "27.0.3");
  assert.equal(p.driver, "overlay2");
  assert.equal(p.images, 5);
  assert.equal(p.containers, 3);
  assert.equal(p.containersRunning, 1);
});

test("probe is honest when the docker binary does not exist", async () => {
  process.env.KILN_DOCKER_BIN = "/nonexistent/docker-xyz";
  try {
    const p = await probe();
    assert.equal(p.available, false);
    assert.match(p.reason, /not found/i);
  } finally {
    process.env.KILN_DOCKER_BIN = path.join(tmp, "docker");
  }
});

test("listImages parses the JSON-lines output", async () => {
  const images = await listImages();
  assert.equal(images.length, 2);
  assert.equal(images[0].repository, "kiln/demo");
  assert.equal(images[0].tag, "latest");
  assert.equal(images[1].repository, "alpine");
});

test("listContainers parses ps -a output", async () => {
  const beforeCount = argvLines().length;
  const containers = await listContainers(true);
  assert.equal(containers.length, 2);
  assert.equal(containers[0].name, "demo-web");
  assert.equal(containers[0].state, "running");
  const line = argvLines().slice(beforeCount).find((l) => l.startsWith("ps"));
  assert.ok(line, "ps invocation recorded");
  assert.match(line, /^ps -a --format /);
});

test("containerLogs returns stdout and stderr together", async () => {
  const out = await containerLogs("c0ffee123456", 50);
  assert.match(out.logs, /line one/);
  assert.match(out.logs, /line two/);
  assert.equal(out.tail, 50);
});

test("inspectContainer strips the name slash and never leaks env values", async () => {
  const c = await inspectContainer("c0ffee123456");
  assert.equal(c.name, "demo-web");
  assert.equal(c.running, true);
  assert.deepEqual(c.env, ["PATH", "SECRET_KEY"]);
  assert.ok(!JSON.stringify(c).includes("hunter2"), "env values must never leave the engine");
  assert.equal(c.ports["80/tcp"][0], "0.0.0.0:8080");
});

test("validation rejects traversal and malformed identifiers", async () => {
  await assert.rejects(containerLogs("../etc/passwd"), (e) => e instanceof DockerError && e.code === "BAD_CONTAINER_ID");
  await assert.rejects(containerLogs("a/b"), (e) => e.code === "BAD_CONTAINER_ID");
  await assert.rejects(startContainer("--privileged"), (e) => e.code === "BAD_CONTAINER_ID");
  await assert.rejects(removeContainer(""), (e) => e.code === "BAD_CONTAINER_ID");
  assert.throws(() => validateOwner("Auro"), (e) => e.code === "BAD_OWNER");
  assert.throws(() => validateOwner("../evil"), (e) => e.code === "BAD_OWNER");
  assert.throws(() => validateOwner("-lead"), (e) => e.code === "BAD_OWNER");
  assert.throws(() => validateRepo(".."), (e) => e.code === "BAD_REPO");
  assert.throws(() => validateRepo("a/b"), (e) => e.code === "BAD_REPO");
  assert.throws(() => validateRef("-rf"), (e) => e.code === "BAD_REF");
  assert.throws(() => validateRef("a..b"), (e) => e.code === "BAD_REF");
  assert.equal(validateRef(undefined), "HEAD");
  assert.equal(validateRef("refs/heads/main"), "refs/heads/main");
});

test("validation rejects bad ports and env keys", async () => {
  assert.throws(() => validatePortMapping("8080"), (e) => e.code === "BAD_PORT");
  assert.throws(() => validatePortMapping("80:abc"), (e) => e.code === "BAD_PORT");
  assert.throws(() => validatePortMapping("0:80"), (e) => e.code === "BAD_PORT");
  assert.throws(() => validatePortMapping("99999:80"), (e) => e.code === "BAD_PORT");
  assert.throws(() => validatePortMapping("8080:80:extra"), (e) => e.code === "BAD_PORT");
  assert.equal(validatePortMapping("8080:80"), "8080:80");
  assert.throws(() => validateEnvKey("1BAD"), (e) => e.code === "BAD_ENV_KEY");
  assert.throws(() => validateEnvKey("BAD-KEY"), (e) => e.code === "BAD_ENV_KEY");
  assert.equal(validateEnvKey("GOOD_KEY_1"), "GOOD_KEY_1");
  await assert.rejects(runContainer({ image: "alpine", ports: ["0:80"] }), (e) => e.code === "BAD_PORT");
  await assert.rejects(runContainer({ image: "alpine", env: { "BAD-KEY": "x" } }), (e) => e.code === "BAD_ENV_KEY");
  await assert.rejects(runContainer({ image: "bad image; rm -rf /" }), (e) => e.code === "BAD_IMAGE");
  await assert.rejects(runContainer({ image: "alpine", name: "--privileged" }), (e) => e.code === "BAD_NAME");
  await assert.rejects(runContainer({ image: "alpine", memoryMb: 4 }), (e) => e.code === "BAD_MEMORY");
});

test("build argv: context dir + tag, streamed lines, no shell", async () => {
  const ctx = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-docker-ctx-"));
  fs.writeFileSync(path.join(ctx, "Dockerfile"), "FROM scratch\n");
  const beforeCount = argvLines().length;
  const lines = [];
  const out = await buildImage({ contextDir: ctx, tag: "kiln/demo:latest", onLine: (l) => lines.push(l) });
  assert.equal(out.ok, true);
  assert.ok(lines.some((l) => l.includes("Step 1/2")), "build output streamed to onLine");
  assert.ok(lines.some((l) => l.includes("Successfully built")), "final build line streamed");
  const line = argvLines().slice(beforeCount).find((l) => l.startsWith("build"));
  assert.ok(line, "build invocation recorded");
  assert.match(line, /build -t kiln\/demo:latest/);
  assert.ok(line.trim().endsWith(ctx), "context dir is the final argv entry");
  assert.ok(!line.includes(";") && !line.includes("&&"), "no shell operators in argv");
  fs.rmSync(ctx, { recursive: true, force: true });
});

test("run argv: detached, labeled, cap-drop ALL, no-new-privileges, memory cap", async () => {
  const beforeCount = argvLines().length;
  const out = await runContainer({
    image: "kiln/demo:latest",
    name: "demo-web",
    ports: ["8080:80"],
    env: { MODE: "prod" },
    memoryMb: 512,
    cpus: 1.5,
  });
  assert.match(out.id, /^f00d/);
  const line = argvLines().slice(beforeCount).find((l) => l.startsWith("run"));
  assert.ok(line, "run invocation recorded");
  assert.match(line, /^run -d /);
  assert.ok(line.includes("--label kiln.managed=1"), "managed label present");
  assert.ok(line.includes("--cap-drop ALL"), "cap-drop ALL present");
  assert.ok(line.includes("--security-opt no-new-privileges"), "no-new-privileges present");
  assert.ok(line.includes("--name demo-web"));
  assert.ok(line.includes("-e MODE=prod"));
  assert.ok(line.includes("-p 8080:80"));
  assert.ok(line.includes("--memory 512m"));
  assert.ok(line.includes("--cpus 1.5"));
  assert.ok(line.trim().endsWith("kiln/demo:latest"), "image is the final argv entry when no cmd");
});

test("authorizeDocker accepts only the exact Bearer token", () => {
  const tokenFile = path.join(tmp, "api.token");
  fs.writeFileSync(tokenFile, "s3cret-token\n");
  assert.equal(authorizeDocker("Bearer s3cret-token", tokenFile), true);
  assert.equal(authorizeDocker("bearer s3cret-token", tokenFile), true);
  assert.equal(authorizeDocker("Bearer s3cret-tokex", tokenFile), false); // same length, wrong value
  assert.equal(authorizeDocker("Bearer short", tokenFile), false);
  assert.equal(authorizeDocker("Basic s3cret-token", tokenFile), false);
  assert.equal(authorizeDocker("s3cret-token", tokenFile), false);
  assert.equal(authorizeDocker("", tokenFile), false);
  assert.equal(authorizeDocker(undefined, tokenFile), false);
  assert.equal(authorizeDocker("Bearer s3cret-token", path.join(tmp, "missing.token")), false);
  const emptyFile = path.join(tmp, "empty.token");
  fs.writeFileSync(emptyFile, "  \n");
  assert.equal(authorizeDocker("Bearer s3cret-token", emptyFile), false);
});

test("resolveBuildContext materializes a forge repo and cleans up", async () => {
  const gitRoot = path.join(tmp, "gitroot");
  const srcDir = path.join(tmp, "src-repo");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, "Dockerfile"), "FROM scratch\nCOPY . .\n");
  fs.writeFileSync(path.join(srcDir, "app.txt"), "hello\n");
  const git = (args, cwd) => execFileSync("git", args, { cwd, stdio: "pipe" });
  git(["init", "-b", "main"], srcDir);
  git(["add", "-A"], srcDir);
  git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "seed"], srcDir);
  fs.mkdirSync(path.join(gitRoot, "auro"), { recursive: true });
  git(["clone", "--bare", srcDir, path.join(gitRoot, "auro", "demo.git")], tmp);

  process.env.KILN_SWARM_GIT_DIR = gitRoot;
  try {
    const ctx = await resolveBuildContext("auro", "demo", "HEAD");
    assert.ok(fs.existsSync(path.join(ctx.dir, "Dockerfile")), "Dockerfile materialized");
    assert.ok(fs.existsSync(path.join(ctx.dir, "app.txt")), "repo file materialized");
    const df = requireDockerfile(ctx.dir);
    assert.equal(df, path.join(ctx.dir, "Dockerfile"));
    const dirPath = ctx.dir;
    ctx.cleanup();
    assert.ok(!fs.existsSync(dirPath), "cleanup removes the temp dir");

    await assert.rejects(resolveBuildContext("auro", "missing"), (e) => e.code === "REPO_NOT_FOUND");
    await assert.rejects(resolveBuildContext("../evil", "demo"), (e) => e.code === "BAD_OWNER");
    await assert.rejects(resolveBuildContext("auro", "demo", "no-such-ref-xyz"), (e) => e.code === "ARCHIVE_FAILED");
  } finally {
    if (savedGitDir === undefined) delete process.env.KILN_SWARM_GIT_DIR;
    else process.env.KILN_SWARM_GIT_DIR = savedGitDir;
  }
});

// --- runsc-direct fallback -------------------------------------------------
// A fake docker whose daemon RUN path fails the way this sandbox fails
// it (namespace/keyring class), while create/export/inspect work — so
// the engine can still assemble OCI bundles from images. Its lifecycle
// verbs answer "No such container", because runsc-direct containers
// are not the daemon's. build fails (buildkit hits the same wall).
const FAKE_DOCKER_NSFAIL = `#!/bin/sh
LOG="\${FAKE_DOCKER_ARGV_LOG:-}"
if [ -n "$LOG" ]; then
  printf '%s\\n' "$*" >> "$LOG"
fi
cmd="$1"
case "$cmd" in
  version)
    echo '{"Client":{"Version":"29.1.3","ApiVersion":"1.52"},"Server":{"Version":"29.1.3","ApiVersion":"1.52","Os":"linux","Arch":"amd64"}}'
    ;;
  info)
    echo '{"Driver":"vfs","Containers":2,"ContainersRunning":0,"Images":1,"OperatingSystem":"Ubuntu 24.04"}'
    ;;
  images)
    echo '{"ID":"sha256:ccc333","Repository":"kiln/demo","Tag":"latest","Size":"12.9MB","CreatedAt":"2026-11-03 10:00:00 +0000 UTC"}'
    ;;
  ps)
    echo '{"ID":"c0ffee123456","Image":"kiln/demo:latest","Names":"demo-web","State":"running","Status":"Up 2 hours","Ports":"","Labels":"kiln.managed=1","CreatedAt":"2026-11-03 09:00:00 +0000 UTC"}'
    ;;
  run)
    echo "Error response from daemon: failed to create task for container: OCI runtime create failed: unable to join session keyring: operation not permitted while joining namespace" 1>&2
    exit 1
    ;;
  create)
    echo "createdcontainer123456"
    ;;
  export)
    head -c 1024 /dev/zero
    ;;
  inspect)
    if [ "$2" = "--format" ]; then
      echo '{"Cmd":["/bin/sh","-c","echo hello-from-runsc"],"Entrypoint":null,"Env":["PATH=/usr/local/bin"],"WorkingDir":"/work"}'
    else
      echo "Error response from daemon: No such container: fake" 1>&2
      exit 1
    fi
    ;;
  logs)
    echo "Error response from daemon: No such container: fake" 1>&2
    exit 1
    ;;
  build)
    echo "ERROR: failed to solve: bind-mount /proc/1/ns/net: operation not permitted" 1>&2
    exit 1
    ;;
  import)
    echo "sha256:imported123456"
    ;;
  start|stop|restart|rm)
    echo "Error response from daemon: No such container: fake" 1>&2
    exit 1
    ;;
  *)
    echo "fake docker (nsfail): unknown command $cmd" 1>&2
    exit 1
    ;;
esac
exit 0
`;

// A fake docker whose run fails for an ordinary, non-namespace reason:
// the fallback must NOT engage for this class.
const FAKE_DOCKER_PLAINFAIL = `#!/bin/sh
cmd="$1"
case "$cmd" in
  run)
    echo "Error response from daemon: No such image: nope:latest" 1>&2
    exit 1
    ;;
  *)
    echo "fake docker (plainfail): unknown command $cmd" 1>&2
    exit 1
    ;;
esac
exit 0
`;

// A fake runsc: records argv, emulates spec/run/list/kill/delete with a
// state file of "running" container names (one per line).
const FAKE_RUNSC = `#!/bin/sh
LOG="\${FAKE_RUNSC_ARGV_LOG:-}"
if [ -n "$LOG" ]; then
  printf '%s\\n' "$*" >> "$LOG"
fi
STATE="\${FAKE_RUNSC_STATE:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --root) shift 2 ;;
    --network=*|--platform=*|--debug-log=*|--log-format=*) shift ;;
    --ignore-cgroups|--debug|--rootless) shift ;;
    *) break ;;
  esac
done
cmd="$1"
if [ $# -gt 0 ]; then shift; fi
case "$cmd" in
  spec)
    cat > config.json <<'JSON'
{"ociVersion":"1.0.2","process":{"terminal":false,"user":{"uid":0,"gid":0},"args":["sh"],"env":[],"cwd":"/","capabilities":{"bounding":["CAP_CHOWN"]}},"root":{"path":"rootfs","readonly":true},"hostname":"","linux":{"namespaces":[{"type":"pid"},{"type":"network"},{"type":"ipc"},{"type":"uts"},{"type":"mount"}]},"mounts":[]}
JSON
    ;;
  run)
    while [ $# -gt 1 ]; do shift; done
    name="$1"
    if [ -n "\${FAKE_RUNSC_FAIL_RUN:-}" ]; then
      echo "running container: creating container: cannot create gofer process: gofer: error setting namespace of type network and path \\"/proc/self/fd/14\\": operation not permitted" 1>&2
      exit 1
    fi
    echo "fake runsc: started $name"
    if [ -n "$STATE" ]; then printf '%s\\n' "$name" >> "$STATE"; fi
    ;;
  list)
    if [ -n "$STATE" ] && [ -f "$STATE" ]; then
      printf '['
      first=1
      while IFS= read -r n; do
        [ -n "$n" ] || continue
        if [ $first -eq 1 ]; then first=0; else printf ','; fi
        printf '{"id":"%s","pid":4242,"status":"running","bundle":"/fake/%s","created":"2026-11-04T00:00:00Z"}' "$n" "$n"
      done < "$STATE"
      printf ']\\n'
    else
      echo 'null'
    fi
    ;;
  kill)
    echo "fake runsc: killed $1"
    ;;
  delete)
    id=""
    for a in "$@"; do
      case "$a" in
        --*) ;;
        *) id="$a" ;;
      esac
    done
    if [ -n "$STATE" ] && [ -f "$STATE" ]; then
      grep -vx "$id" "$STATE" > "$STATE.tmp" || true
      mv "$STATE.tmp" "$STATE"
    fi
    echo "fake runsc: deleted $id"
    ;;
  *)
    echo "fake runsc: unknown command $cmd" 1>&2
    exit 1
    ;;
esac
exit 0
`;

function writeFake(dir, name, body) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, body, { mode: 0o755 });
  return p;
}

function swapEnv(vars) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

test("runContainer labels a plain docker run with runtime docker", async () => {
  const out = await runContainer({ image: "alpine:3.20" });
  assert.equal(out.runtime, "docker");
});

test("probe reports the runsc-direct execution availability", async () => {
  const p = await probe();
  assert.ok(p.execution && typeof p.execution.runscDirect === "boolean");
  if (p.execution.runscDirect) assert.match(p.execution.note, /runsc-direct/);
});

test("runContainer falls back to runsc-direct on a namespace-class daemon failure", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-runsc-test-"));
  const nsfailPath = writeFake(dir, "docker-nsfail", FAKE_DOCKER_NSFAIL);
  const runscPath = writeFake(dir, "runsc-fake", FAKE_RUNSC);
  const runscArgv = path.join(dir, "runsc-argv.log");
  const restore = swapEnv({
    KILN_DOCKER_BIN: nsfailPath,
    KILN_RUNSC_BIN: runscPath,
    KILN_RUNSC_STATE: path.join(dir, "runsc-state"),
    FAKE_RUNSC_ARGV_LOG: runscArgv,
    FAKE_RUNSC_STATE: path.join(dir, "running.txt"),
  });
  try {
    const out = await runContainer({ image: "kiln/demo:latest", name: "kiln-fallback-1", env: { MODE: "prod" } });
    assert.equal(out.runtime, "runsc-direct");
    assert.equal(out.id, "kiln-fallback-1");
    assert.equal(out.name, "kiln-fallback-1");
    assert.equal(out.state, "running");
    assert.deepEqual(out.ports, []);
    const runscLog = fs.readFileSync(runscArgv, "utf8");
    assert.match(runscLog, /--network=none/, "runsc launched with the sandbox-safe network mode");
    assert.match(runscLog, /run --detach --bundle/, "runsc run --detach on the assembled bundle");
    // The bundle's spec came from runsc spec, patched with the image's
    // real command/env/cwd — not the spec defaults.
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, "runsc-state", "bundles", "kiln-fallback-1", "config.json"), "utf8"));
    assert.deepEqual(cfg.process.args, ["/bin/sh", "-c", "echo hello-from-runsc"]);
    assert.ok(cfg.process.env.includes("PATH=/usr/local/bin"), "image env carried into the spec");
    assert.ok(cfg.process.env.includes("MODE=prod"), "request env wins in the spec");
    assert.equal(cfg.process.cwd, "/work");
    assert.equal(cfg.root.readonly, false);
    assert.ok(cfg.root.path.endsWith(path.join("bundles", "kiln-fallback-1", "rootfs")));
    const netNs = cfg.linux.namespaces.find((n) => n.type === "network");
    assert.ok(netNs && !("path" in netNs), "spec network namespace carries no path");
    // Listing merges the runsc container, labeled, next to docker's.
    const containers = await listContainers(true);
    const entry = containers.find((c) => c.name === "kiln-fallback-1");
    assert.ok(entry, "runsc-direct container appears in listContainers");
    assert.equal(entry.runtime, "runsc-direct");
    assert.equal(entry.image, "kiln/demo:latest");
    assert.equal(entry.state, "running");
    assert.equal(containers.find((c) => c.name === "demo-web").runtime, "docker");
    // Logs come from the captured runsc log file, labeled.
    const logs = await containerLogs("kiln-fallback-1", 50);
    assert.match(logs.logs, /fake runsc: started kiln-fallback-1/);
    assert.equal(logs.runtime, "runsc-direct");
    // Stop drives runsc kill + delete and drops it from the listing.
    const stopped = await stopContainer("kiln-fallback-1");
    assert.equal(stopped.state, "stopped");
    assert.equal(stopped.runtime, "runsc-direct");
    assert.match(fs.readFileSync(runscArgv, "utf8"), /kill kiln-fallback-1 SIGTERM/);
    const afterStop = await listContainers(true);
    assert.ok(!afterStop.some((c) => c.name === "kiln-fallback-1"), "stopped runsc container leaves the listing");
    // Remove tears the bundle down.
    const removed = await removeContainer("kiln-fallback-1");
    assert.equal(removed.removed, true);
    assert.equal(removed.runtime, "runsc-direct");
    assert.ok(!fs.existsSync(path.join(dir, "runsc-state", "bundles", "kiln-fallback-1")), "bundle removed");
  } finally {
    restore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runContainer does NOT fall back when docker fails for an ordinary reason", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-runsc-plainfail-"));
  const plainPath = writeFake(dir, "docker-plainfail", FAKE_DOCKER_PLAINFAIL);
  const runscPath = writeFake(dir, "runsc-fake", FAKE_RUNSC);
  const runscArgv = path.join(dir, "runsc-argv.log");
  const restore = swapEnv({
    KILN_DOCKER_BIN: plainPath,
    KILN_RUNSC_BIN: runscPath,
    KILN_RUNSC_STATE: path.join(dir, "runsc-state"),
    FAKE_RUNSC_ARGV_LOG: runscArgv,
    FAKE_RUNSC_STATE: path.join(dir, "running.txt"),
  });
  try {
    await assert.rejects(
      runContainer({ image: "nope:latest" }),
      (e) => e instanceof DockerError && e.code === "DOCKER_FAILED" && /No such image/.test(e.message),
    );
    assert.ok(!fs.existsSync(runscArgv), "runsc was never invoked for a non-namespace failure");
  } finally {
    restore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildImage falls back to import-assembly for a COPY-only Dockerfile", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-import-assembly-"));
  const nsfailPath = writeFake(dir, "docker-nsfail", FAKE_DOCKER_NSFAIL);
  const restore = swapEnv({ KILN_DOCKER_BIN: nsfailPath });
  const ctx = path.join(dir, "ctx");
  fs.mkdirSync(path.join(ctx, "data"), { recursive: true });
  fs.writeFileSync(path.join(ctx, "Dockerfile"), [
    "FROM kiln/base:latest",
    "WORKDIR /app",
    "COPY hello.txt .",
    "COPY data /data/",
    "ENV MODE=prod",
    'CMD ["cat", "/app/hello.txt"]',
    "",
  ].join("\n"));
  fs.writeFileSync(path.join(ctx, "hello.txt"), "hello world\n");
  fs.writeFileSync(path.join(ctx, "data", "x.txt"), "x\n");
  try {
    const beforeCount = argvLines().length;
    const lines = [];
    const out = await buildImage({ contextDir: ctx, tag: "kiln/assembled:latest", onLine: (l) => lines.push(l) });
    assert.equal(out.ok, true);
    assert.equal(out.buildMethod, "import-assembly");
    assert.ok(lines.some((l) => l.includes("import-assembly")), "job log names the assembly method");
    const importLine = argvLines().slice(beforeCount).find((l) => l.startsWith("import"));
    assert.ok(importLine, "docker import invocation recorded");
    assert.ok(importLine.includes("-c WORKDIR /app"));
    assert.ok(importLine.includes("-c ENV MODE=prod"));
    assert.ok(importLine.includes('-c CMD ["cat","/app/hello.txt"]'));
    assert.ok(importLine.trim().endsWith("kiln/assembled:latest"), "import targets the requested tag");
  } finally {
    restore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildImage states the honest limit when the Dockerfile has RUN steps", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-import-runsteps-"));
  const nsfailPath = writeFake(dir, "docker-nsfail", FAKE_DOCKER_NSFAIL);
  const restore = swapEnv({ KILN_DOCKER_BIN: nsfailPath });
  const ctx = path.join(dir, "ctx");
  fs.mkdirSync(ctx, { recursive: true });
  fs.writeFileSync(path.join(ctx, "Dockerfile"), "FROM kiln/base:latest\nRUN echo hi\nCOPY hello.txt .\n");
  fs.writeFileSync(path.join(ctx, "hello.txt"), "hello\n");
  try {
    await assert.rejects(
      buildImage({ contextDir: ctx, tag: "kiln/nope:latest" }),
      (e) => e instanceof DockerError && e.code === "BUILD_FAILED" && /RUN steps cannot execute on this host yet/.test(e.message),
    );
  } finally {
    restore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("parseDockerfile resolves copies against WORKDIR and flags what assembly cannot do", () => {
  const parsed = parseDockerfile([
    "FROM kiln/base:1 AS base",
    "WORKDIR /srv",
    "COPY a.txt .",
    "COPY b.txt c.txt /files/",
    "ENV X=1 Y=two",
    "ENV GREETING hello world",
    "CMD echo hi",
    'ENTRYPOINT ["/bin/run"]',
    "",
  ].join("\n"));
  assert.equal(parsed.from, "kiln/base:1");
  assert.equal(parsed.workdir, "/srv");
  assert.equal(parsed.copies.length, 2);
  assert.equal(parsed.copies[0].dest, "/srv");
  assert.equal(parsed.copies[0].destIsDir, true);
  assert.equal(parsed.copies[1].dest, "/files");
  assert.deepEqual(parsed.copies[1].sources, ["b.txt", "c.txt"]);
  assert.deepEqual(parsed.env, [["X", "1"], ["Y", "two"], ["GREETING", "hello world"]]);
  assert.deepEqual(parsed.cmd, ["/bin/sh", "-c", "echo hi"]);
  assert.deepEqual(parsed.entrypoint, ["/bin/run"]);
  assert.deepEqual(parsed.unsupported, []);

  const multi = parseDockerfile("FROM a:1\nFROM b:2\n");
  assert.ok(multi.unsupported.length > 0, "multi-stage is flagged, not faked");
  const scratch = parseDockerfile("FROM scratch\nCOPY a.txt .\n");
  assert.ok(scratch.unsupported.some((u) => /scratch/.test(u)));
  const staged = parseDockerfile("FROM a:1 AS base\nCOPY --from=base /x /y\n");
  assert.ok(staged.unsupported.some((u) => /--from/.test(u)));
});

// --- operator-context runner queue -------------------------------------------
// When the launch fails with the host-context class (the gofer's
// namespace setup denied in the CALLER's context), the engine queues
// the prepared bundle for scripts/runsc-runner.mjs and reports the run
// honestly as "queued" until a runner executes it.

test("runContainer queues for the operator runner when the caller's context blocks the launch", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-runsc-queue-"));
  const nsfailPath = writeFake(dir, "docker-nsfail", FAKE_DOCKER_NSFAIL);
  const runscPath = writeFake(dir, "runsc-fake", FAKE_RUNSC);
  const stateDir = path.join(dir, "runsc-state");
  const restore = swapEnv({
    KILN_DOCKER_BIN: nsfailPath,
    KILN_RUNSC_BIN: runscPath,
    KILN_RUNSC_STATE: stateDir,
    FAKE_RUNSC_ARGV_LOG: path.join(dir, "runsc-argv.log"),
    FAKE_RUNSC_STATE: path.join(dir, "running.txt"),
    FAKE_RUNSC_FAIL_RUN: "1",
    RUNSC_RUNNER_WAIT_MS: "250",
  });
  try {
    const out = await runContainer({ image: "kiln/demo:latest", name: "kiln-queued-1" });
    assert.equal(out.runtime, "runsc-direct");
    assert.equal(out.state, "queued");
    assert.deepEqual(out.ports, []);
    assert.match(out.note, /operator-context runner/);
    // The pending request is on disk for the runner, with the bundle.
    const pendingFile = path.join(stateDir, "queue", "pending", "kiln-queued-1.json");
    assert.ok(fs.existsSync(pendingFile), "pending request written for the runner");
    const pending = JSON.parse(fs.readFileSync(pendingFile, "utf8"));
    assert.equal(pending.name, "kiln-queued-1");
    assert.equal(pending.image, "kiln/demo:latest");
    assert.ok(pending.bundleDir.endsWith(path.join("bundles", "kiln-queued-1")));
    assert.ok(pending.logFile.endsWith(path.join("logs", "kiln-queued-1.log")));
    assert.ok(pending.requestedAt, "pending carries requestedAt");
    // The listing shows it as queued, labeled.
    const containers = await listContainers(true);
    const entry = containers.find((c) => c.name === "kiln-queued-1");
    assert.ok(entry, "queued container appears in listContainers");
    assert.equal(entry.state, "queued");
    assert.equal(entry.runtime, "runsc-direct");
    assert.equal(entry.image, "kiln/demo:latest");
    // Logs serve the failed direct launch's captured output, labeled.
    const logs = await containerLogs("kiln-queued-1", 50);
    assert.match(logs.logs, /operation not permitted/);
    assert.equal(logs.runtime, "runsc-direct");
    // Stop on a queued, never-executed name is a dequeue.
    const stopped = await stopContainer("kiln-queued-1");
    assert.equal(stopped.state, "dequeued");
    assert.equal(stopped.runtime, "runsc-direct");
    assert.ok(!fs.existsSync(pendingFile), "dequeue clears the pending request");
    const afterStop = await listContainers(true);
    assert.ok(!afterStop.some((c) => c.name === "kiln-queued-1"), "dequeued container leaves the listing");
    // Remove tears the bundle down.
    const removed = await removeContainer("kiln-queued-1");
    assert.equal(removed.removed, true);
    assert.equal(removed.runtime, "runsc-direct");
    assert.ok(!fs.existsSync(path.join(stateDir, "bundles", "kiln-queued-1")), "bundle removed");
  } finally {
    restore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runContainer resolves as running when a runner result lands during the wait", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-runsc-queue-run-"));
  const nsfailPath = writeFake(dir, "docker-nsfail", FAKE_DOCKER_NSFAIL);
  const runscPath = writeFake(dir, "runsc-fake", FAKE_RUNSC);
  const stateDir = path.join(dir, "runsc-state");
  const restore = swapEnv({
    KILN_DOCKER_BIN: nsfailPath,
    KILN_RUNSC_BIN: runscPath,
    KILN_RUNSC_STATE: stateDir,
    FAKE_RUNSC_ARGV_LOG: path.join(dir, "runsc-argv.log"),
    FAKE_RUNSC_STATE: path.join(dir, "running.txt"),
    FAKE_RUNSC_FAIL_RUN: "1",
    RUNSC_RUNNER_WAIT_MS: "5000",
  });
  try {
    const resultFile = path.join(stateDir, "queue", "results", "kiln-queued-2.json");
    const timer = setTimeout(() => {
      fs.mkdirSync(path.dirname(resultFile), { recursive: true });
      fs.writeFileSync(resultFile, JSON.stringify({
        name: "kiln-queued-2",
        state: "running",
        pid: 4242,
        startedAt: new Date().toISOString(),
      }));
    }, 600);
    let out;
    try {
      out = await runContainer({ image: "kiln/demo:latest", name: "kiln-queued-2" });
    } finally {
      clearTimeout(timer);
    }
    assert.equal(out.runtime, "runsc-direct");
    assert.equal(out.state, "running");
    // The queue entry now reports the runner's state, not "queued".
    const containers = await listContainers(true);
    const entry = containers.find((c) => c.name === "kiln-queued-2");
    assert.ok(entry, "runner-executed container appears in listContainers");
    assert.equal(entry.state, "running");
    assert.equal(entry.runtime, "runsc-direct");
    const removed = await removeContainer("kiln-queued-2");
    assert.equal(removed.removed, true);
    assert.ok(!fs.existsSync(resultFile), "remove clears the queue result");
  } finally {
    restore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runsc-runner --once executes a queued request and writes a running result", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-runsc-runner-"));
  const runscPath = writeFake(dir, "runsc-fake", FAKE_RUNSC);
  const runscArgv = path.join(dir, "runsc-argv.log");
  const stateDir = path.join(dir, "runsc-state");
  const bundleDir = path.join(stateDir, "bundles", "queued-runner-1");
  fs.mkdirSync(bundleDir, { recursive: true });
  fs.writeFileSync(path.join(bundleDir, "meta.json"), JSON.stringify({
    name: "queued-runner-1",
    image: "kiln/demo:latest",
    runtime: "runsc-direct",
    createdAt: new Date().toISOString(),
  }));
  fs.writeFileSync(path.join(bundleDir, "config.json"), "{}");
  const pendingDir = path.join(stateDir, "queue", "pending");
  fs.mkdirSync(pendingDir, { recursive: true });
  fs.writeFileSync(path.join(pendingDir, "queued-runner-1.json"), JSON.stringify({
    name: "queued-runner-1",
    image: "kiln/demo:latest",
    bundleDir,
    logFile: path.join(stateDir, "logs", "queued-runner-1.log"),
    requestedAt: new Date().toISOString(),
  }));
  const runnerPath = fileURLToPath(new URL("./runsc-runner.mjs", import.meta.url));
  const stdout = execFileSync(process.execPath, [runnerPath, "--once"], {
    encoding: "utf8",
    timeout: 30000,
    env: {
      ...process.env,
      KILN_RUNSC_STATE: stateDir,
      KILN_RUNSC_BIN: runscPath,
      FAKE_RUNSC_ARGV_LOG: runscArgv,
      FAKE_RUNSC_STATE: path.join(dir, "running.txt"),
    },
  });
  assert.match(stdout, /queued-runner-1: running/);
  const result = JSON.parse(fs.readFileSync(path.join(stateDir, "queue", "results", "queued-runner-1.json"), "utf8"));
  assert.equal(result.state, "running");
  assert.equal(result.pid, 4242);
  assert.ok(result.startedAt, "result carries startedAt");
  const argv = fs.readFileSync(runscArgv, "utf8");
  assert.match(argv, /--network=none/, "runner launches with the sandbox-safe network mode");
  assert.match(argv, /run --detach --bundle/, "runner launches the prepared bundle detached");
  assert.ok(fs.existsSync(path.join(stateDir, "logs", "queued-runner-1.log")), "container log file created");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("requireDockerfile: typed NO_DOCKERFILE and confined relative paths", () => {
  const ctx = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-docker-df-"));
  assert.throws(() => requireDockerfile(ctx), (e) => e instanceof DockerError && e.code === "NO_DOCKERFILE");
  fs.mkdirSync(path.join(ctx, "sub"), { recursive: true });
  fs.writeFileSync(path.join(ctx, "sub", "Dockerfile.web"), "FROM scratch\n");
  assert.equal(requireDockerfile(ctx, "sub/Dockerfile.web"), path.join(ctx, "sub", "Dockerfile.web"));
  assert.throws(() => requireDockerfile(ctx, "../escape"), (e) => e.code === "BAD_DOCKERFILE");
  assert.throws(() => requireDockerfile(ctx, "/etc/passwd"), (e) => e.code === "BAD_DOCKERFILE");
  fs.rmSync(ctx, { recursive: true, force: true });
});
