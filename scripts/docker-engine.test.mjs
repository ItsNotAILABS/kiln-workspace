import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { before, after } from "node:test";

import {
  DockerError,
  authorizeDocker,
  buildImage,
  containerLogs,
  inspectContainer,
  listContainers,
  listImages,
  probe,
  removeContainer,
  requireDockerfile,
  resolveBuildContext,
  runContainer,
  startContainer,
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
