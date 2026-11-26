import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loginAccount, sessionAccount } from "./kiln-accounts.mjs";
import { getPassport } from "./kiln-badge.mjs";
import { runIngestTool, originIngest, seatIngest, repoIngest, writeIngestCard } from "./kiln-ingest.mjs";

const ORIGIN = "http://127.0.0.1:8080";

test("origin ingest is kiln-ingest/v1", () => {
  const card = originIngest(ORIGIN, null);
  assert.equal(card.spec, "kiln-ingest/v1");
  assert.equal(card.kind, "origin");
  assert.ok(card.tools.includes("kiln_write_file"));
  assert.ok(card.tools.includes("kiln_passport"));
  assert.ok(card.public.some((id) => String(id).startsWith("kiln/")));
});

test("unsigned cannot write kiln origin trees", async () => {
  const out = await runIngestTool(
    "kiln_write_file",
    { repo: "kiln/kiln", path: "HACK.md", content: "no" },
    { viewer: null },
  );
  assert.equal(out.ok, false);
});

test("unsigned cannot write a seated private tree", async () => {
  const out = await runIngestTool(
    "kiln_write_file",
    { repo: "itsnotailabs/home", path: "HACK.md", content: "no" },
    { viewer: null },
  );
  assert.equal(out.ok, false);
});

test("signed itsnotailabs can write, upload, and read the seated passport", async () => {
  const login = loginAccount({ handle: "itsnotailabs", secret: "Medina-Lattice-1848!" });
  assert.equal(login.ok, true);
  const ctx = { viewer: "itsnotailabs", account: login.account, secret: "Medina-Lattice-1848!", origin: ORIGIN };
  const pass = await runIngestTool("kiln_passport", { handle: "itsnotailabs" }, ctx);
  assert.equal(pass.ok, true);
  assert.equal(pass.passport.token, "d24118493d42");
  const seated = getPassport("itsnotailabs");
  assert.equal(seated.token, "d24118493d42");
  const write = await runIngestTool(
    "kiln_write_file",
    {
      repo: "itsnotailabs/home",
      path: "AGENT.md",
      content: "# Seated agent write\n\nOutside agent ingested this seat as @itsnotailabs.\n",
      message: "ingest: AGENT.md",
    },
    ctx,
  );
  assert.equal(write.ok, true);
  assert.equal(write.mutated, true);
  assert.equal(fs.existsSync(path.join("/workspace/computers/itsnotailabs_home/AGENT.md")), true);
  const ingest = writeIngestCard("itsnotailabs/home");
  assert.equal(ingest.spec, "kiln-ingest/v1");
  const stamp = Date.now().toString(36);
  const upload = await runIngestTool(
    "kiln_upload",
    {
      repo: "itsnotailabs/home",
      path: `agent-${stamp}.txt`,
      content: "kiln-ingest/v1 seated write",
      type: "text/plain",
    },
    ctx,
  );
  assert.equal(upload.ok, true);
  const kilnWrite = await runIngestTool(
    "kiln_write_file",
    { repo: "kiln/kiln", path: "NOPE.md", content: "no" },
    ctx,
  );
  assert.equal(kilnWrite.ok, false);
  const seat = seatIngest("itsnotailabs", ORIGIN, "itsnotailabs");
  assert.equal(seat.ok, true);
  assert.equal(seat.passport.token, "d24118493d42");
  const publicTree = repoIngest("itsnotailabs/kiln", ORIGIN, null);
  assert.equal(publicTree.ok, true);
  assert.equal(publicTree.write, false);
});

test("unsigned cannot shell, traversal cannot leave the tree, owner run is jailed", async () => {
  const unsigned = await runIngestTool("kiln_run", { repo: "itsnotailabs/kiln", command: "ls .." }, { viewer: null });
  assert.equal(unsigned.ok, false);
  const login = loginAccount({ handle: "itsnotailabs", secret: "Medina-Lattice-1848!" });
  const ctx = { viewer: "itsnotailabs", account: login.account, secret: "Medina-Lattice-1848!" };
  const escapeWrite = await runIngestTool(
    "kiln_write_file",
    { repo: "itsnotailabs/home", path: "../../HACK.md", content: "no" },
    ctx,
  );
  assert.equal(escapeWrite.ok, false);
  const gitWrite = await runIngestTool(
    "kiln_write_file",
    { repo: "itsnotailabs/home", path: ".git/config", content: "no" },
    ctx,
  );
  assert.equal(gitWrite.ok, false);
  const meta = await runIngestTool("kiln_run", { repo: "itsnotailabs/home", command: "ls; cat /etc/passwd" }, ctx);
  assert.equal(meta.ok, false);
  const abs = await runIngestTool("kiln_run", { repo: "itsnotailabs/home", command: "cat /etc/passwd" }, ctx);
  assert.equal(abs.ok, false);
  const ls = await runIngestTool("kiln_run", { repo: "itsnotailabs/home", command: "ls" }, ctx);
  assert.equal(ls.ok, true);
  const machine = await runIngestTool("kiln_machine", { repo: "itsnotailabs/kiln" }, { viewer: null });
  assert.equal(machine.ok, true);
  assert.equal(machine.machine.home, undefined);
});

test("sessions are hashed at rest", () => {
  const login = loginAccount({ handle: "itsnotailabs", secret: "Medina-Lattice-1848!" });
  assert.equal(login.ok, true);
  const map = JSON.parse(fs.readFileSync("/workspace/data/sessions.json", "utf8"));
  assert.equal(Object.prototype.hasOwnProperty.call(map, login.token), false);
  const seated = sessionAccount(login.token);
  assert.equal(seated.handle, "itsnotailabs");
});
