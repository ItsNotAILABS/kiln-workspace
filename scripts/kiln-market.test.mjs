import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bootSpace, writeOnTree } from "./kiln-space.mjs";
import { buyProduct, claimOpening, listProduct, catalog, tillView, transferNote, unlistProduct } from "./kiln-market.mjs";

const computers = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "computers");

function seat(name) {
  return `${name}${process.pid}`.slice(0, 24);
}

function dirOf(repoId) {
  return path.join(computers, repoId.replace(/\/+/g, "_"));
}

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kiln-till-"));
}

test("opening note is once, and the till closes", () => {
  const dir = scratch();
  const a = seat("oa");
  const b = seat("ob");
  const first = claimOpening(a, { dir, capCents: 2500, openingCents: 2500 });
  assert.equal(first.ok, true);
  assert.equal(first.minted, true);
  assert.equal(first.cents, 2500);
  const again = claimOpening(a, { dir });
  assert.equal(again.minted, false);
  assert.equal(again.cents, 2500);
  const closed = claimOpening(b, { dir });
  assert.equal(closed.ok, false);
  assert.equal(closed.error, "till is closed");
  assert.equal(tillView(b, { dir }).cents, 0);
});

test("a short till cannot buy, and a funded buy delivers once", () => {
  const dir = scratch();
  const seller = seat("sa");
  const buyer = seat("by");
  const src = `${seller}/shelf`;
  const dest = `${buyer}/home`;
  bootSpace({ repoId: src, owner: seller });
  writeOnTree(dirOf(src), "escrow.mjs", "export const subject = 'warehouse';\n", "goods");
  const missing = listProduct({ seller, repoId: src, path: "nope.mjs", cents: 1000 }, { dir });
  assert.equal(missing.ok, false);
  const listed = listProduct(
    { seller, repoId: src, path: "escrow.mjs", title: "Warehouse escrow", cents: 1000, stock: 1 },
    { dir },
  );
  assert.equal(listed.ok, true);
  const broke = buyProduct({ buyer, productId: listed.product.id, destRepo: dest }, { dir });
  assert.equal(broke.ok, false);
  assert.equal(broke.error, "till is short");
  assert.equal(catalog({}, { dir }).products.length, 1);
  claimOpening(buyer, { dir, capCents: 10_000, openingCents: 2500 });
  const own = buyProduct({ buyer: seller, productId: listed.product.id, destRepo: `${seller}/home` }, { dir });
  assert.equal(own.ok, false);
  assert.equal(own.error, "you listed this");
  const bought = buyProduct({ buyer, productId: listed.product.id, destRepo: dest }, { dir, seats: [seller, buyer] });
  assert.equal(bought.ok, true);
  assert.equal(bought.not, "Not a bank, not a card, not USDC.");
  const landed = fs.readFileSync(path.join(dirOf(dest), bought.receipt.path), "utf8");
  assert.equal(landed, "export const subject = 'warehouse';\n");
  assert.equal(bought.buyer.cents, 1500);
  assert.equal(bought.seller.cents, 1000);
  assert.equal(catalog({}, { dir }).products.length, 0);
  const second = buyProduct({ buyer, productId: listed.product.id, destRepo: dest }, { dir });
  assert.equal(second.ok, false);
  assert.equal(tillView(buyer, { dir }).cents, 1500);
  const paid = transferNote({ from: buyer, to: seller, cents: 400, memo: "retain" }, { dir, seats: [seller, buyer] });
  assert.equal(paid.ok, true);
  assert.equal(tillView(buyer, { dir }).cents, 1100);
  assert.equal(tillView(seller, { dir }).cents, 1400);
  const self = transferNote({ from: buyer, to: buyer, cents: 1 }, { dir, seats: [buyer] });
  assert.equal(self.ok, false);
  const over = transferNote({ from: buyer, to: seller, cents: 5000 }, { dir, seats: [seller] });
  assert.equal(over.ok, false);
  assert.equal(tillView(buyer, { dir }).cents, 1100);
  fs.rmSync(dirOf(src), { recursive: true, force: true });
  fs.rmSync(dirOf(dest), { recursive: true, force: true });
  fs.rmSync(dirOf(`${seller}/home`), { recursive: true, force: true });
});

test("the shelf can be searched, and only the seller takes a listing down", () => {
  const dir = scratch();
  const seller = seat("sh");
  const other = seat("ot");
  const src = `${seller}/shelf`;
  bootSpace({ repoId: src, owner: seller });
  writeOnTree(dirOf(src), "note.txt", "a warehouse note\n", "goods");
  const listed = listProduct(
    {
      seller,
      repoId: src,
      path: "note.txt",
      title: "Warehouse note",
      cents: 250,
      stock: 3,
      description: "Plain text for the dock.",
    },
    { dir },
  );
  assert.equal(listed.ok, true);
  assert.equal(listed.product.description, "Plain text for the dock.");
  assert.equal(catalog({ q: "dock" }, { dir }).products.length, 1);
  assert.equal(catalog({ q: "warehouse note" }, { dir }).products.length, 1);
  assert.equal(catalog({ q: "missing-good" }, { dir }).products.length, 0);
  const stolen = unlistProduct({ seller: other, productId: listed.product.id }, { dir });
  assert.equal(stolen.ok, false);
  const down = unlistProduct({ seller, productId: listed.product.id }, { dir });
  assert.equal(down.ok, true);
  assert.equal(catalog({}, { dir }).products.length, 0);
  const again = unlistProduct({ seller, productId: listed.product.id }, { dir });
  assert.equal(again.ok, false);
  fs.rmSync(dirOf(src), { recursive: true, force: true });
});
