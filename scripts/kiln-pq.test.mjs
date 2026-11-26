import test from "node:test";
import assert from "node:assert/strict";
import { keypairFromSecret, signBytes, verifyBytes, wrapKey, unwrapKey, signChallenge, verifyChallenge, PQ } from "./kiln-pq.mjs";
import { seatWallet, loadWallet } from "./kiln-wallet.mjs";
import { settleRipple } from "./kiln-ripple.mjs";

test("pq wallet is deterministic and signs", () => {
  const a = keypairFromSecret("Medina-Lattice-1848!");
  const b = keypairFromSecret("Medina-Lattice-1848!");
  const c = keypairFromSecret("other-secret-xx");
  assert.equal(a.pqAddress, b.pqAddress);
  assert.notEqual(a.pqAddress, c.pqAddress);
  assert.equal(a.public.dsa, PQ.dsa);
  const msg = "kiln merkle root is the proof";
  const s = signBytes("Medina-Lattice-1848!", msg);
  assert.equal(verifyBytes(s.sig, msg, a.public.dsaPublicKey).ok, true);
  assert.equal(verifyBytes(s.sig, msg + "x", a.public.dsaPublicKey).ok, false);
});

test("ml-kem wraps a vault key", () => {
  const w = keypairFromSecret("wrap-secret-01");
  const packed = wrapKey(w.public.kemPublicKey, Buffer.from("vault-cek-bytes"));
  const open = unwrapKey("wrap-secret-01", packed);
  assert.equal(open.ok, true);
  assert.equal(open.plaintext.toString(), "vault-cek-bytes");
  const bad = unwrapKey("wrong-secret-01", packed);
  assert.equal(bad.ok, false);
});

test("challenge binds handle", () => {
  const signed = signChallenge("s3cret-handle", "nonce-1", "itsnotailabs");
  const ok = verifyChallenge({ sig: signed.sig, nonce: "nonce-1", handle: "itsnotailabs", pub: signed.pub });
  const no = verifyChallenge({ sig: signed.sig, nonce: "nonce-1", handle: "other", pub: signed.pub });
  assert.equal(ok.ok, true);
  assert.equal(no.ok, false);
});

test("settleRipple attaches ML-DSA and rejects a bad sig", () => {
  const secret = "unit-ledger-secret-01";
  const seated = seatWallet("unitpq", secret);
  assert.equal(seated.ok, true);
  const r = settleRipple({ type: "wallet_pq", from: seated.wallet.address, repoId: "unitpq/home", memo: "seat", secret });
  assert.equal(r.ok, true);
  const unsigned = settleRipple({ type: "remember", from: seated.wallet.address, repoId: "unitpq/home", memo: "unsigned still settles" });
  assert.equal(unsigned.ok, true);
  const bad = settleRipple({
    type: "wallet_pq",
    from: seated.wallet.address,
    repoId: "unitpq/home",
    memo: "forged",
    timestamp: new Date().toISOString(),
    sig: "not-a-real-sig",
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "bad ml-dsa");
});
