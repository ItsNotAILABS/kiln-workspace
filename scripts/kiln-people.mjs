/**
 * Four doors a person uses, and the autopilot that keeps this kiln moving.
 * Ask, Show, Bring, Proof. A person and an agent call the same actions.
 * A kiln note on an ask is not a bank, not a card, and not USDC.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { lockNote, releaseNote } from "./kiln-market.mjs";
import { boardCompute, claimWork, runPiece, submitWork } from "./kiln-compute.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIR = path.join(ROOT, "data", "backend");
const ACCOUNTS = path.join(ROOT, "data", "accounts");
const DAY = 24 * 60 * 60 * 1000;

export const NOT_A_BANK = "Not a bank, not a card, not USDC.";

const SERVICES = [
  { id: "ask", action: "ask", for: "A person posts one sentence. An agent, or another person, answers it." },
  { id: "show", action: "show", for: "A person says what they do, in one line, where others can find them." },
  { id: "bring", action: "bring", for: "A person brings someone else onto a seat." },
  { id: "proof", action: "proof", for: "Anyone reads what was asked, who answered, and that the note moved." },
];

function fail(error) {
  return { ok: false, error, not: NOT_A_BANK };
}

function norm(handle) {
  return String(handle || "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
    .toLowerCase();
}

function sha256(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

function stateFile(opts) {
  return path.join((opts && opts.dir) || DEFAULT_DIR, "people.json");
}

function blank() {
  return { asks: [], shows: [], brings: [], proofs: [], pilots: [] };
}

function load(opts) {
  try {
    const doc = JSON.parse(fs.readFileSync(stateFile(opts), "utf8"));
    return {
      asks: Array.isArray(doc.asks) ? doc.asks : [],
      shows: Array.isArray(doc.shows) ? doc.shows : [],
      brings: Array.isArray(doc.brings) ? doc.brings : [],
      proofs: Array.isArray(doc.proofs) ? doc.proofs : [],
      pilots: Array.isArray(doc.pilots) ? doc.pilots : [],
    };
  } catch {
    return blank();
  }
}

function save(state, opts) {
  const file = stateFile(opts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
}

function isSeat(handle, opts) {
  const h = norm(handle);
  if (!h || h === "kiln") return false;
  if (opts && Array.isArray(opts.seats)) return opts.seats.map(norm).includes(h);
  return fs.existsSync(path.join(ACCOUNTS, `${h}.json`));
}

function seatOr(handle, opts) {
  const who = norm(handle);
  if (!isSeat(who, opts)) return fail("not a seat");
  return { ok: true, who };
}

function centsOf(cents) {
  if (cents == null || cents === "") return 0;
  const n = Number(cents);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) return null;
  return n;
}

function askLife(opts) {
  const n = Number(opts && opts.askMs);
  if (Number.isInteger(n) && n > 0) return n;
  return DAY;
}

function refund(ask, opts, memo) {
  if (!(ask.cents > 0) || !ask.box) return { ok: true };
  return releaseNote({ box: ask.box, to: ask.seat, cents: ask.cents, memo }, { dir: opts.dir });
}

function sweep(state, opts) {
  const now = Date.now();
  for (const ask of state.asks) {
    if (ask.status !== "open" && ask.status !== "taken" && ask.status !== "answered") continue;
    if (!ask.expires || now <= ask.expires) continue;
    const back = refund(ask, opts, "ask expired");
    if (!back.ok) continue;
    ask.status = "returned";
    ask.taker = "";
    ask.answer = "";
  }
}

function pubAsk(ask) {
  const showAnswer = ask.status === "answered" || ask.status === "done";
  return {
    id: ask.id,
    seat: ask.seat,
    text: ask.text,
    cents: ask.cents || 0,
    status: ask.status,
    taker: ask.taker || "",
    answer: showAnswer ? ask.answer || "" : "",
    at: ask.at,
  };
}

function pilotOf(state, who) {
  let row = state.pilots.find((p) => p.seat === who);
  if (!row) {
    row = { seat: who, on: false, last: "", log: [] };
    state.pilots.push(row);
  }
  return row;
}

function remember(state, who, line) {
  const row = pilotOf(state, who);
  row.last = line;
  row.log = [{ at: new Date().toISOString(), line }, ...(row.log || [])].slice(0, 8);
  return row;
}

export function peopleBoard(opts = {}) {
  const state = load(opts);
  sweep(state, opts);
  save(state, opts);
  return {
    ok: true,
    not: NOT_A_BANK,
    services: SERVICES,
    autopilot: "action autopilot, then action autopilotTick. One real step: witness compute, claim short work, or read an open ask.",
    asks: state.asks.slice(0, 24).map(pubAsk),
    people: state.shows.slice(0, 24).map((row) => ({ seat: row.seat, line: row.line, at: row.at })),
    proofs: state.proofs.slice(0, 12),
    invites: state.brings.filter((row) => !row.acceptedBy).length,
    autopilots: state.pilots.filter((row) => row.on).map((row) => ({ seat: row.seat, last: row.last || "" })),
  };
}

export function postAsk({ seat, text, cents } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const line = String(text || "").replace(/\s+/g, " ").trim();
  if (line.length < 8 || line.length > 280) return fail("an ask is 8 to 280 characters");
  const price = centsOf(cents);
  if (price == null) return fail("cents is an integer from 0 to 1000000");
  const state = load(opts);
  sweep(state, opts);
  const id = "a" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  const box = price > 0 ? `box-${id}` : "";
  if (price > 0) {
    const locked = lockNote({ from: who.who, box, cents: price, memo: "ask" }, { dir: opts.dir });
    if (!locked.ok) return locked;
  }
  state.asks.unshift({
    id,
    seat: who.who,
    text: line,
    cents: price,
    box,
    status: "open",
    taker: "",
    answer: "",
    at: new Date().toISOString(),
    expires: Date.now() + askLife(opts),
  });
  state.asks = state.asks.slice(0, 80);
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, ask: pubAsk(state.asks[0]) };
}

export function takeAsk({ seat, id } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const state = load(opts);
  sweep(state, opts);
  const ask = state.asks.find((row) => row.id === id);
  if (!ask) return fail("no such ask");
  if (ask.seat === who.who) return fail("that is your ask");
  if (ask.status !== "open") return fail("not open");
  ask.status = "taken";
  ask.taker = who.who;
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, ask: pubAsk(ask) };
}

export function answerAsk({ seat, id, text } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const line = String(text || "").replace(/\s+/g, " ").trim();
  if (line.length < 1 || line.length > 2000) return fail("an answer is 1 to 2000 characters");
  const state = load(opts);
  sweep(state, opts);
  const ask = state.asks.find((row) => row.id === id);
  if (!ask) return fail("no such ask");
  if (ask.status !== "taken" || ask.taker !== who.who) return fail("take it first");
  ask.status = "answered";
  ask.answer = line;
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, ask: pubAsk(ask) };
}

export function acceptAsk({ seat, id } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const state = load(opts);
  sweep(state, opts);
  const ask = state.asks.find((row) => row.id === id);
  if (!ask) return fail("no such ask");
  if (ask.seat !== who.who) return fail("not your ask");
  if (ask.status !== "answered" || !ask.taker) return fail("no answer yet");
  if (ask.cents > 0) {
    const paid = releaseNote({ box: ask.box, to: ask.taker, cents: ask.cents, memo: "ask paid" }, { dir: opts.dir });
    if (!paid.ok) return paid;
  }
  ask.status = "done";
  const proof = {
    id: ask.id,
    poster: ask.seat,
    answerer: ask.taker,
    cents: ask.cents || 0,
    text: ask.text,
    answer: ask.answer,
    questionSha: sha256(ask.text),
    answerSha: sha256(ask.answer),
    at: new Date().toISOString(),
  };
  state.proofs.unshift(proof);
  state.proofs = state.proofs.slice(0, 40);
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, ask: pubAsk(ask), proof };
}

export function returnAsk({ seat, id } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const state = load(opts);
  sweep(state, opts);
  const ask = state.asks.find((row) => row.id === id);
  if (!ask) return fail("no such ask");
  if (ask.status === "done" || ask.status === "returned") return fail("already closed");
  if (ask.taker === who.who && ask.seat !== who.who) {
    ask.status = "open";
    ask.taker = "";
    ask.answer = "";
    save(state, opts);
    return { ok: true, not: NOT_A_BANK, ask: pubAsk(ask) };
  }
  if (ask.seat !== who.who) return fail("not your ask");
  const back = refund(ask, opts, "ask returned");
  if (!back.ok) return back;
  ask.status = "returned";
  ask.taker = "";
  ask.answer = "";
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, ask: pubAsk(ask) };
}

export function setShow({ seat, line } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const text = String(line || "").replace(/\s+/g, " ").trim().slice(0, 140);
  const state = load(opts);
  state.shows = state.shows.filter((row) => row.seat !== who.who);
  if (!text) {
    save(state, opts);
    return { ok: true, not: NOT_A_BANK, show: null };
  }
  const show = { seat: who.who, line: text, at: new Date().toISOString() };
  state.shows.unshift(show);
  state.shows = state.shows.slice(0, 80);
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, show };
}

export function openBring({ seat } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const state = load(opts);
  const existing = state.brings.find((row) => row.seat === who.who && !row.acceptedBy);
  if (existing) return { ok: true, not: NOT_A_BANK, code: existing.code, seat: who.who };
  const code = crypto.randomBytes(4).toString("hex");
  state.brings.unshift({ code, seat: who.who, at: new Date().toISOString(), acceptedBy: "" });
  state.brings = state.brings.slice(0, 80);
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, code, seat: who.who };
}

export function acceptBring({ seat, code } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const token = String(code || "").trim().toLowerCase();
  if (!/^[a-f0-9]{8}$/.test(token)) return fail("that code is not an intro");
  const state = load(opts);
  const row = state.brings.find((item) => item.code === token);
  if (!row) return fail("that code is not an intro");
  if (row.acceptedBy) return fail("that intro was already used");
  if (row.seat === who.who) return fail("you cannot bring yourself");
  row.acceptedBy = who.who;
  row.acceptedAt = new Date().toISOString();
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, from: row.seat, seat: who.who };
}

export function readProof({ id } = {}, opts = {}) {
  const state = load(opts);
  const want = String(id || "");
  if (!want) return { ok: true, not: NOT_A_BANK, proofs: state.proofs.slice(0, 12) };
  const proof = state.proofs.find((row) => row.id === want);
  if (!proof) return fail("no such proof");
  return { ok: true, not: NOT_A_BANK, proof };
}

export function setAutopilot({ seat, on } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const state = load(opts);
  const row = pilotOf(state, who.who);
  row.on = on === true;
  if (row.on) remember(state, who.who, "on");
  else row.last = "off";
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, seat: who.who, on: row.on, last: row.last };
}

function computeSpec(text) {
  const match = String(text || "").match(/^sha256-chain\s+(\S+)\s+(\d{1,6})$/);
  if (!match) return null;
  const rounds = Number(match[2]);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20_000) return null;
  return { kind: "sha256-chain", seed: match[1].slice(0, 80), rounds };
}

function pieceFromJob(job) {
  if (job.kind === "sha256-chain") return { kind: job.kind, seed: job.seed || "kiln", rounds: job.rounds };
  if (job.kind === "merkle") return { kind: job.kind, leaves: job.taskLeaves || [] };
  if (job.kind === "reduce") return { kind: job.kind, n: job.n, seed: Number(job.seed) >>> 0 };
  return null;
}

function shortJob(job) {
  const piece = pieceFromJob(job);
  if (!piece) return false;
  if (piece.kind === "sha256-chain") return piece.rounds >= 1 && piece.rounds <= 20_000;
  if (piece.kind === "merkle") return piece.leaves.length >= 1 && piece.leaves.length <= 512;
  if (piece.kind === "reduce") return piece.n >= 1 && piece.n <= 200_000;
  return false;
}

function step(state, who, line, extra) {
  remember(state, who, line);
  save(state, extra.opts);
  return { ok: true, not: NOT_A_BANK, autopilot: true, did: extra.did, seat: who, ...extra.out };
}

export function tickAutopilot({ seat } = {}, opts = {}) {
  const who = seatOr(seat, opts);
  if (!who.ok) return who;
  const state = load(opts);
  sweep(state, opts);
  const row = state.pilots.find((item) => item.seat === who.who);
  if (!row || !row.on) return fail("autopilot is off");
  const board = boardCompute(opts);
  const jobs = (board.jobs || []).filter(shortJob);
  for (const job of jobs) {
    if (job.status !== "pending" || job.seat === who.who || job.claimer === who.who) continue;
    const piece = pieceFromJob(job);
    let digest = "";
    try {
      digest = runPiece(piece).digest;
    } catch {
      continue;
    }
    const out = submitWork({ id: job.id, seat: who.who, digest }, opts);
    if (!out.ok) continue;
    return step(state, who.who, `witness ${job.id}`, { opts, did: "witness", out: { job: out.job } });
  }
  for (const job of jobs) {
    if (job.status !== "open" || !job.remote || job.seat === who.who) continue;
    const claimed = claimWork({ id: job.id, seat: who.who }, opts);
    if (!claimed.ok) continue;
    const piece = pieceFromJob(claimed.job);
    let digest = "";
    try {
      digest = runPiece(piece).digest;
    } catch {
      return fail("could not run the work");
    }
    const out = submitWork({ id: job.id, seat: who.who, digest }, opts);
    if (!out.ok) return out;
    return step(state, who.who, `claim ${job.id}`, { opts, did: "claim", out: { job: out.job } });
  }
  const open = state.asks.filter((ask) => {
    if (ask.status !== "open" || ask.seat === who.who) return false;
    return ask.cents === 0 || computeSpec(ask.text);
  });
  const ask = open[open.length - 1];
  if (ask) {
    ask.status = "taken";
    ask.taker = who.who;
    const spec = computeSpec(ask.text);
    ask.answer = spec ? runPiece(spec).digest : `Read. ${ask.text.length} characters. sha256 ${sha256(ask.text)}`;
    ask.status = "answered";
    remember(state, who.who, `answer ${ask.id}`);
    save(state, opts);
    return { ok: true, not: NOT_A_BANK, autopilot: true, did: "answer", seat: who.who, ask: pubAsk(ask) };
  }
  remember(state, who.who, "idle");
  save(state, opts);
  return { ok: true, not: NOT_A_BANK, autopilot: true, did: "idle", seat: who.who };
}
