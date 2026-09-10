import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { merkleRoot, merkleProof, fileLeaves } from "./merkle.ts";
import { sha256Hex } from "./crypto.ts";

const LEAVES = ["0xaa", "0xbb", "0xcc", "0xdd", "0xee"];

/** Fold a leaf up through a proof the way a verifier would. */
async function verifyFromProof(leaf: string, proof: string[], index: number): Promise<string> {
  let h = leaf.replace(/^0x/, "").toLowerCase();
  let i = index;
  for (const sib of proof) {
    const s = sib.replace(/^0x/, "").toLowerCase();
    h = i % 2 === 0 ? await sha256Hex(h + s) : await sha256Hex(s + h);
    i = Math.floor(i / 2);
  }
  return `0x${h}`;
}

describe("merkleRoot", () => {
  it("is deterministic and 0x-prefixed 32-byte hex", async () => {
    const a = await merkleRoot(LEAVES);
    const b = await merkleRoot(LEAVES);
    assert.equal(a, b);
    assert.match(a, /^0x[0-9a-f]{64}$/);
  });

  it("empty leaf set hashes a domain separator, not zero", async () => {
    const r = await merkleRoot([]);
    assert.equal(r, `0x${await sha256Hex("kiln:empty")}`);
    assert.notEqual(r, `0x${"0".repeat(64)}`);
  });

  it("single leaf is the normalized leaf itself", async () => {
    assert.equal(await merkleRoot(["0xAA"]), "0xaa");
  });

  it("order matters", async () => {
    const a = await merkleRoot(["0xaa", "0xbb"]);
    const b = await merkleRoot(["0xbb", "0xaa"]);
    assert.notEqual(a, b);
  });

  it("duplicates an odd leaf bitcoin-style", async () => {
    const three = await merkleRoot(["0xaa", "0xbb", "0xcc"]);
    const four = await merkleRoot(["0xaa", "0xbb", "0xcc", "0xcc"]);
    assert.equal(three, four);
  });
});

describe("merkleProof", () => {
  it("every leaf verifies against the root", async () => {
    const root = await merkleRoot(LEAVES);
    for (let i = 0; i < LEAVES.length; i++) {
      const proof = await merkleProof(LEAVES, i);
      assert.equal(proof.length, Math.ceil(Math.log2(LEAVES.length)));
      assert.equal(await verifyFromProof(LEAVES[i]!, proof, i), root);
    }
  });

  it("a tampered leaf does not verify", async () => {
    const root = await merkleRoot(LEAVES);
    const proof = await merkleProof(LEAVES, 0);
    assert.notEqual(await verifyFromProof("0xff", proof, 0), root);
  });
});

describe("fileLeaves", () => {
  it("sorts by path so insertion order cannot change the root", async () => {
    const a = [
      { path: "b.txt", hash: "0x11" },
      { path: "a.txt", hash: "0x22" },
    ];
    const b = [
      { path: "a.txt", hash: "0x22" },
      { path: "b.txt", hash: "0x11" },
    ];
    assert.deepEqual(await fileLeaves(a), await fileLeaves(b));
    const rootA = await merkleRoot(await fileLeaves(a));
    const rootB = await merkleRoot(await fileLeaves(b));
    assert.equal(rootA, rootB);
  });

  it("binds path to hash", async () => {
    const [x] = await fileLeaves([{ path: "a.txt", hash: "0x11" }]);
    assert.equal(x, await sha256Hex("a.txt:11"));
  });
});
