import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claimOpening, tillView } from "./kiln-market.mjs";
import { postWork, runPiece } from "./kiln-compute.mjs";
import {
  acceptAsk,
  acceptBring,
  answerAsk,
  openBring,
  peopleBoard,
  postAsk,
  readProof,
  returnAsk,
  setAutopilot,
  setShow,
  takeAsk,
  tickAutopilot,
} from "./kiln-people.mjs";

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kiln-people-"));
}

function seat(name) {
  return `${name}${process.pid}`.slice(0, 24);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("an ask locks a note and pays the person who answered", () => {
  const dir = scratch();
  const poster = seat("ap");
  const worker = seat("aw");
  const opts = { dir, seats: [poster, worker], capCents: 10_000, openingCents: 2500 };
  claimOpening(poster, opts);
  const broke = postAsk({ seat: poster, text: "Read this paper for me", cents: 9000 }, opts);
  assert.equal(broke.ok, false);
  assert.equal(tillView(poster, opts).cents, 2500);
  const asked = postAsk({ seat: poster, text: "Read this paper for me", cents: 400 }, opts);
  assert.equal(asked.ok, true);
  assert.equal(tillView(poster, opts).cents, 2100);
  assert.equal(postAsk({ seat: "kiln", text: "Read this paper for me" }, opts).ok, false);
  assert.equal(takeAsk({ seat: poster, id: asked.ask.id }, opts).ok, false);
  const took = takeAsk({ seat: worker, id: asked.ask.id }, opts);
  assert.equal(took.ok, true);
  const answered = answerAsk({ seat: worker, id: asked.ask.id, text: "The files say the gate is a band." }, opts);
  assert.equal(answered.ask.answer.includes("band"), true);
  assert.equal(acceptAsk({ seat: worker, id: asked.ask.id }, opts).ok, false);
  const paid = acceptAsk({ seat: poster, id: asked.ask.id }, opts);
  assert.equal(paid.ok, true);
  assert.equal(paid.proof.answerer, worker);
  assert.equal(tillView(poster, opts).cents, 2100);
  assert.equal(tillView(worker, opts).cents, 400);
  assert.equal(readProof({ id: asked.ask.id }, opts).proof.questionSha.length, 64);
  assert.equal(acceptAsk({ seat: poster, id: asked.ask.id }, opts).ok, false);
});

test("returning an ask gives the note back, and an expiry does too", async () => {
  const dir = scratch();
  const poster = seat("bp");
  const worker = seat("bw");
  const opts = { dir, seats: [poster, worker], askMs: 30, capCents: 10_000, openingCents: 2500 };
  claimOpening(poster, opts);
  const asked = postAsk({ seat: poster, text: "Hold this until I come back", cents: 300 }, opts);
  takeAsk({ seat: worker, id: asked.ask.id }, opts);
  const handed = returnAsk({ seat: worker, id: asked.ask.id }, opts);
  assert.equal(handed.ask.status, "open");
  assert.equal(tillView(poster, opts).cents, 2200);
  const closed = returnAsk({ seat: poster, id: asked.ask.id }, opts);
  assert.equal(closed.ask.status, "returned");
  assert.equal(tillView(poster, opts).cents, 2500);
  const timed = postAsk({ seat: poster, text: "This one should expire", cents: 200 }, opts);
  assert.equal(tillView(poster, opts).cents, 2300);
  await wait(45);
  const board = peopleBoard(opts);
  assert.equal(board.asks.find((row) => row.id === timed.ask.id).status, "returned");
  assert.equal(tillView(poster, opts).cents, 2500);
  assert.equal(board.services.map((row) => row.id).join(","), "ask,show,bring,proof");
});

test("a person can show what they do and bring someone once", () => {
  const dir = scratch();
  const host = seat("ch");
  const guest = seat("cg");
  const opts = { dir, seats: [host, guest] };
  assert.equal(setShow({ seat: "kiln", line: "origin" }, opts).ok, false);
  const shown = setShow({ seat: host, line: "I read papers and answer in one page." }, opts);
  assert.equal(shown.show.line.includes("papers"), true);
  assert.equal(peopleBoard(opts).people[0].seat, host);
  setShow({ seat: host, line: "" }, opts);
  assert.equal(peopleBoard(opts).people.length, 0);
  const intro = openBring({ seat: host }, opts);
  assert.match(intro.code, /^[a-f0-9]{8}$/);
  assert.equal(openBring({ seat: host }, opts).code, intro.code);
  assert.equal(peopleBoard(opts).invites, 1);
  assert.equal(JSON.stringify(peopleBoard(opts)).includes(intro.code), false);
  assert.equal(acceptBring({ seat: host, code: intro.code }, opts).ok, false);
  const joined = acceptBring({ seat: guest, code: intro.code }, opts);
  assert.equal(joined.from, host);
  assert.equal(acceptBring({ seat: guest, code: intro.code }, opts).error, "that intro was already used");
  assert.equal(peopleBoard(opts).invites, 0);
});

test("autopilot witnesses compute and reads an open ask", async () => {
  const dir = scratch();
  const poster = seat("dp");
  const pilot = seat("da");
  const witness = seat("dw");
  const opts = { dir, seats: [poster, pilot, witness], capCents: 10_000, openingCents: 2500 };
  claimOpening(poster, opts);
  assert.equal(tickAutopilot({ seat: pilot }, opts).error, "autopilot is off");
  setAutopilot({ seat: pilot, on: true }, opts);
  setAutopilot({ seat: witness, on: true }, opts);
  const opened = await postWork(
    { seat: poster, kind: "sha256-chain", seed: "auto", rounds: 5, bounty: 250 },
    { dir, remote: true },
  );
  assert.equal(opened.open, true);
  const claimed = tickAutopilot({ seat: pilot }, opts);
  assert.equal(claimed.did, "claim");
  assert.equal(claimed.job.status, "pending");
  const agreed = tickAutopilot({ seat: witness }, opts);
  assert.equal(agreed.did, "witness");
  assert.equal(agreed.job.status, "done");
  assert.equal(agreed.job.digest, runPiece({ kind: "sha256-chain", seed: "auto", rounds: 5 }).digest);
  assert.equal(tillView(pilot, opts).cents, 250);
  const asked = postAsk({ seat: poster, text: "sha256-chain kiln 4", cents: 0 }, opts);
  const read = tickAutopilot({ seat: pilot }, opts);
  assert.equal(read.did, "answer");
  assert.equal(read.ask.answer, runPiece({ kind: "sha256-chain", seed: "kiln", rounds: 4 }).digest);
  const paid = acceptAsk({ seat: poster, id: asked.ask.id }, opts);
  assert.equal(paid.ok, true);
  assert.equal(peopleBoard(opts).autopilots.length, 2);
});
