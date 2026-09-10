import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sha256Hex,
  sha256Short,
  vaultSecret,
  encryptText,
  decryptText,
  encryptBytes,
  decryptBytes,
  looksSealed,
  keyCommitment,
} from "./crypto.ts";

describe("sha256Hex", () => {
  it("matches the known SHA-256 of 'abc'", async () => {
    assert.equal(
      await sha256Hex("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("accepts Uint8Array input identically to its string form", async () => {
    const fromStr = await sha256Hex("kiln");
    const fromBytes = await sha256Hex(new TextEncoder().encode("kiln"));
    assert.equal(fromStr, fromBytes);
  });
});

describe("sha256Short", () => {
  it("returns the requested prefix length", async () => {
    const full = await sha256Hex("kiln");
    assert.equal(await sha256Short("kiln", 8), full.slice(0, 8));
    assert.equal((await sha256Short("kiln", 16)).length, 16);
  });
});

describe("vaultSecret", () => {
  it("binds the secret to the repo id", async () => {
    const a = await vaultSecret("s3cret", "owner/repo-a");
    const b = await vaultSecret("s3cret", "owner/repo-b");
    const c = await vaultSecret("other", "owner/repo-a");
    assert.notEqual(a, b);
    assert.notEqual(a, c);
    assert.equal(a, await vaultSecret("s3cret", "owner/repo-a"));
  });
});

describe("encryptText / decryptText", () => {
  it("round-trips", async () => {
    const sealed = await encryptText("hello kiln", "s3cret");
    assert.ok(looksSealed(sealed));
    assert.equal(await decryptText(sealed, "s3cret"), "hello kiln");
  });

  it("uses a fresh IV per encryption", async () => {
    const a = await encryptText("same", "s3cret");
    const b = await encryptText("same", "s3cret");
    assert.notEqual(a, b);
  });

  it("wrong secret fails closed", async () => {
    const sealed = await encryptText("hello kiln", "s3cret");
    await assert.rejects(() => decryptText(sealed, "wrong"));
  });

  it("rejects malformed payloads", async () => {
    await assert.rejects(() => decryptText("not-a-payload", "s3cret"));
    await assert.rejects(() => decryptText("v1:only-two", "s3cret"));
  });

  it("round-trips unicode", async () => {
    const msg = "sealed ✓ unicode → λ";
    assert.equal(await decryptText(await encryptText(msg, "s3cret"), "s3cret"), msg);
  });
});

describe("encryptBytes / decryptBytes", () => {
  it("round-trips bytes with a 12-byte IV prefix", async () => {
    const plain = new Uint8Array([1, 2, 3, 250, 0, 255]);
    const sealed = await encryptBytes(plain, "s3cret");
    assert.equal(sealed.byteLength, 12 + plain.byteLength + 16); // IV + GCM tag
    assert.deepEqual(await decryptBytes(sealed, "s3cret"), plain);
  });

  it("rejects truncated payloads", async () => {
    await assert.rejects(() => decryptBytes(new Uint8Array(5), "s3cret"));
  });

  it("wrong secret fails closed", async () => {
    const sealed = await encryptBytes(new Uint8Array([9, 9]), "s3cret");
    await assert.rejects(() => decryptBytes(sealed, "wrong"));
  });
});

describe("keyCommitment", () => {
  it("is a 20-byte 0x address-style commitment, deterministic per secret", async () => {
    const a = await keyCommitment("s3cret");
    assert.match(a, /^0x[0-9a-f]{40}$/);
    assert.equal(a, await keyCommitment("s3cret"));
    assert.notEqual(a, await keyCommitment("other"));
  });
});
