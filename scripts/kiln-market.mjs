/**
 * Kiln-note till. Integer cents, append-only, double entry.
 * A note is not a bank balance, not a card charge, and not USDC.
 * Supply is capped. A seat draws one opening note, or sells a file.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { bootSpace, writeOnTree } from "./kiln-space.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIR = path.join(ROOT, "data", "backend");
const ACCOUNTS = path.join(ROOT, "data", "accounts");
const COMPUTERS = path.join(ROOT, "computers");

export const RAIL = "kiln-note";
export const NOT_A_BANK = "Not a bank, not a card, not USDC.";
const DEFAULT_CAP = 250_000;
const DEFAULT_OPENING = 2_500;
const MAX_PRICE = 1_000_000;
const MAX_GOOD = 65_536;

function fail(error) {
  return { ok: false, error, rail: RAIL, not: NOT_A_BANK };
}

function norm(handle) {
  return String(handle || "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
    .toLowerCase();
}

function safeRepo(id) {
  return String(id || "")
    .replace(/[^a-zA-Z0-9._/-]+/g, "_")
    .replace(/\/+/g, "_")
    .slice(0, 80);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

function stateFile(opts) {
  return path.join((opts && opts.dir) || DEFAULT_DIR, "market.json");
}

function goodsFile(opts, id) {
  return path.join((opts && opts.dir) || DEFAULT_DIR, "goods", id);
}

function blank(opts) {
  return {
    unit: "KILN",
    capCents: (opts && opts.capCents) || DEFAULT_CAP,
    openingCents: (opts && opts.openingCents) || DEFAULT_OPENING,
    issued: 0,
    claims: {},
    entries: [],
    products: [],
    receipts: [],
  };
}

function load(opts) {
  return readJson(stateFile(opts), null) || blank(opts);
}

function save(book, opts) {
  writeJson(stateFile(opts), book);
}

function centsOf(v) {
  if (typeof v === "string" && /^\d+$/.test(v)) v = Number(v);
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  return v;
}

function balance(book, handle) {
  let n = 0;
  for (const e of book.entries) {
    if (e.credit === handle) n += e.cents;
    if (e.debit === handle) n -= e.cents;
  }
  return n;
}

function seated(handle, opts) {
  const h = norm(handle);
  if (!h || h === "kiln") return false;
  if (opts && Array.isArray(opts.seats) && opts.seats.map(norm).includes(h)) return true;
  return fs.existsSync(path.join(ACCOUNTS, `${h}.json`));
}

function pushEntry(book, row) {
  const entry = {
    id: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    at: new Date().toISOString(),
    debit: row.debit,
    credit: row.credit,
    cents: row.cents,
    memo: String(row.memo || "").slice(0, 140),
    kind: row.kind,
    ref: row.ref || "",
  };
  book.entries.push(entry);
  return entry;
}

function pub(p) {
  return {
    id: p.id,
    seller: p.seller,
    repoId: p.repoId,
    path: p.path,
    title: p.title,
    cents: p.cents,
    notes: (p.cents / 100).toFixed(2),
    unit: "KILN",
    stock: p.stock,
    sold: p.sold,
    bytes: p.bytes,
    sha256: p.sha256,
  };
}

function viewOf(book, handle) {
  const h = norm(handle);
  const cents = balance(book, h);
  const receipts = book.receipts
    .filter((r) => r.buyer === h || r.seller === h)
    .slice(-8)
    .map((r) => ({
      id: r.id,
      productId: r.productId,
      buyer: r.buyer,
      seller: r.seller,
      cents: r.cents,
      path: r.path,
      repoId: r.repoId,
      at: r.at,
    }));
  return {
    ok: true,
    handle: h,
    unit: "KILN",
    cents,
    notes: (cents / 100).toFixed(2),
    claimed: !!book.claims[h],
    issued: book.issued,
    capCents: book.capCents,
    openingCents: book.openingCents,
    rail: RAIL,
    not: NOT_A_BANK,
    receipts,
  };
}

function relOf(rel) {
  const normed = String(rel || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\.\./g, "");
  if (!normed || normed === ".git" || normed.startsWith(".git/") || normed.startsWith(".kiln/") || normed === ".kiln") return "";
  if (normed.split("/").some((p) => !p || p === "." || p === "..")) return "";
  return normed;
}

function computerFile(repoId, rel) {
  const relNorm = relOf(rel);
  if (!relNorm) return null;
  const root = path.resolve(COMPUTERS, safeRepo(repoId));
  const dest = path.resolve(root, relNorm);
  if (dest !== root && !dest.startsWith(root + path.sep)) return null;
  return dest;
}

export function tillView(handle, opts = {}) {
  const h = norm(handle);
  if (!h || h === "kiln") return fail("not a seat");
  return viewOf(load(opts), h);
}

export function claimOpening(handle, opts = {}) {
  const h = norm(handle);
  if (!h || h === "kiln") return fail("not a seat");
  const book = load(opts);
  if (book.claims[h]) return { ...viewOf(book, h), minted: false };
  if (book.issued + book.openingCents > book.capCents) return fail("till is closed");
  book.issued += book.openingCents;
  book.claims[h] = new Date().toISOString();
  const entry = pushEntry(book, {
    debit: "kiln",
    credit: h,
    cents: book.openingCents,
    memo: "opening kiln note",
    kind: "opening",
  });
  save(book, opts);
  return { ...viewOf(book, h), minted: true, entry: entry.id };
}

export function catalog({ seller } = {}, opts = {}) {
  const book = load(opts);
  const want = seller ? norm(seller) : "";
  const products = book.products.filter((p) => p.stock > 0 && (!want || p.seller === want)).map(pub);
  return { ok: true, rail: RAIL, not: NOT_A_BANK, products };
}

export function listProduct({ seller, repoId, path: rel, title, cents, stock } = {}, opts = {}) {
  const who = norm(seller);
  const repo = String(repoId || "").trim();
  if (!who || who === "kiln") return fail("not a seat");
  if (!repo || repo.split("/")[0] !== who) return fail("list a file on your computer");
  if (repo.split("/")[0] === "kiln") return fail("kiln origin is sealed");
  const price = centsOf(cents);
  if (price == null || price < 1 || price > MAX_PRICE) return fail("price is integer cents, from 1 to 1000000");
  let left = stock == null || stock === "" ? 1 : centsOf(stock);
  if (left == null || left < 1 || left > 100) return fail("stock is an integer from 1 to 100");
  const relNorm = relOf(rel);
  const file = computerFile(repo, relNorm);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return fail("that file is not on this computer");
  const buf = fs.readFileSync(file);
  if (buf.length < 1 || buf.length > MAX_GOOD) return fail("a listed file is 1 to 65536 bytes");
  if (buf.includes(0)) return fail("listed file must be text");
  const book = load(opts);
  if (book.products.some((p) => p.stock > 0 && p.repoId === repo && p.path === relNorm)) return fail("that file is already listed");
  const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const product = {
    id,
    seller: who,
    repoId: repo,
    path: relNorm,
    title: String(title || path.basename(relNorm)).slice(0, 80),
    cents: price,
    stock: left,
    sold: 0,
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
    listedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(goodsFile(opts, id)), { recursive: true });
  fs.writeFileSync(goodsFile(opts, id), buf);
  book.products.push(product);
  save(book, opts);
  return { ok: true, rail: RAIL, not: NOT_A_BANK, product: pub(product) };
}

export function transferNote({ from, to, cents, memo } = {}, opts = {}) {
  const payer = norm(from);
  const payee = norm(to);
  const price = centsOf(cents);
  if (!payer || payer === "kiln") return fail("not a seat");
  if (!payee || payee === "kiln") return fail("no such seat");
  if (payer === payee) return fail("you cannot pay yourself");
  if (!seated(payee, opts)) return fail("no such seat");
  if (price == null || price < 1 || price > MAX_PRICE) return fail("amount is integer cents, from 1 to 1000000");
  const book = load(opts);
  if (balance(book, payer) < price) return fail("till is short");
  const entry = pushEntry(book, {
    debit: payer,
    credit: payee,
    cents: price,
    memo: memo || "pay",
    kind: "pay",
  });
  save(book, opts);
  return {
    ok: true,
    rail: RAIL,
    not: NOT_A_BANK,
    entry: entry.id,
    cents: price,
    from: { ...viewOf(book, payer), receipts: undefined },
    to: { handle: payee, cents: balance(book, payee), notes: (balance(book, payee) / 100).toFixed(2), unit: "KILN" },
  };
}

export function buyProduct({ buyer, productId, destRepo, destPath } = {}, opts = {}) {
  const who = norm(buyer);
  const id = String(productId || "").trim();
  if (!who || who === "kiln") return fail("not a seat");
  if (!id) return fail("product required");
  const book = load(opts);
  const product = book.products.find((p) => p.id === id);
  if (!product || product.stock < 1) return fail("not on the shelf");
  if (product.seller === who) return fail("you listed this");
  if (balance(book, who) < product.cents) return fail("till is short");
  const dest = String(destRepo || `${who}/home`).trim();
  if (!dest.includes("/") || dest.split("/")[0] !== who) return fail("delivery stays on your computer");
  if (dest.split("/")[0] === "kiln") return fail("kiln origin is sealed");
  const good = goodsFile(opts, product.id);
  if (!fs.existsSync(good)) return fail("the file is gone");
  const buf = fs.readFileSync(good);
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== product.sha256) return fail("listed file does not match");
  const base = path.basename(product.path).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48) || "file.txt";
  const rel = relOf(destPath || `inbox/${product.id}-${base}`);
  if (!rel) return fail("bad path");
  bootSpace({ repoId: dest, owner: who });
  const wrote = writeOnTree(path.join(COMPUTERS, safeRepo(dest)), rel, buf.toString("utf8"), `buy ${product.title}`);
  if (!wrote.ok) return fail(wrote.error || "delivery failed");
  if (fs.readFileSync(path.join(COMPUTERS, safeRepo(dest), wrote.path)).toString("utf8") !== buf.toString("utf8")) {
    return fail("delivery mismatch");
  }
  product.stock -= 1;
  product.sold += 1;
  const entry = pushEntry(book, {
    debit: who,
    credit: product.seller,
    cents: product.cents,
    memo: product.title,
    kind: "buy",
    ref: product.id,
  });
  const receipt = {
    id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    productId: product.id,
    buyer: who,
    seller: product.seller,
    cents: product.cents,
    repoId: dest,
    path: wrote.path,
    sha256: sha,
    commit: wrote.commit || "",
    entry: entry.id,
    at: new Date().toISOString(),
  };
  book.receipts.push(receipt);
  if (book.receipts.length > 400) book.receipts.splice(0, book.receipts.length - 400);
  save(book, opts);
  return {
    ok: true,
    rail: RAIL,
    not: NOT_A_BANK,
    receipt,
    product: pub(product),
    buyer: viewOf(book, who),
    seller: { handle: product.seller, cents: balance(book, product.seller), notes: (balance(book, product.seller) / 100).toFixed(2), unit: "KILN" },
  };
}
