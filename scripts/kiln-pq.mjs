/**
 * Kiln post-quantum wallets.
 * ML-DSA-65 (FIPS 204) signs. ML-KEM-768 (FIPS 203) wraps.
 * Private keys are derived from the account secret via SHAKE256.
 * They never hit disk. The merkle root stays the proof; this is the signer.
 */
import crypto from "node:crypto";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";

export const PQ = {
  spec: "kiln-pq/v1",
  dsa: "ML-DSA-65",
  kem: "ML-KEM-768",
  nist: ["FIPS-204", "FIPS-203"],
  scheme: "ml-dsa-65+ml-kem-768",
  hash: "SHAKE256",
  cipher: "AES-256-GCM",
};

function shake(label, secret, len) {
  return crypto.createHash("shake256", { outputLength: len }).update(`kiln-pq:${label}:`).update(String(secret || "")).digest();
}

function b64(u8) {
  return Buffer.from(u8).toString("base64");
}

function fromB64(s) {
  return new Uint8Array(Buffer.from(String(s || ""), "base64"));
}

function shaHex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function deriveSeeds(secret) {
  const dsaLen = ml_dsa65.lengths.seed || 32;
  const kemLen = ml_kem768.lengths.seed || 64;
  return {
    dsa: new Uint8Array(shake("ml-dsa-65", secret, dsaLen)),
    kem: new Uint8Array(shake("ml-kem-768", secret, kemLen)),
  };
}

export function keypairFromSecret(secret) {
  const seeds = deriveSeeds(secret);
  const dsa = ml_dsa65.keygen(seeds.dsa);
  const kem = ml_kem768.keygen(seeds.kem);
  const pqAddress = "0x" + shaHex(Buffer.concat([Buffer.from("kiln-pq-addr:"), Buffer.from(dsa.publicKey), Buffer.from(kem.publicKey)])).slice(0, 40);
  const legacyAddress = "0x" + shaHex(Buffer.from(`kiln-addr:${secret}`)).slice(0, 40);
  return {
    dsa,
    kem,
    pqAddress,
    legacyAddress,
    public: {
      spec: PQ.spec,
      scheme: PQ.scheme,
      nist: PQ.nist,
      dsa: PQ.dsa,
      kem: PQ.kem,
      address: pqAddress,
      legacyAddress,
      dsaPublicKey: b64(dsa.publicKey),
      kemPublicKey: b64(kem.publicKey),
      dsaPublicBytes: dsa.publicKey.length,
      kemPublicBytes: kem.publicKey.length,
    },
  };
}

export function publicFromSecret(secret) {
  return keypairFromSecret(secret).public;
}

export function signBytes(secret, msg) {
  const { dsa } = keypairFromSecret(secret);
  const bytes = typeof msg === "string" ? Buffer.from(msg) : Buffer.from(msg || []);
  const sig = ml_dsa65.sign(new Uint8Array(bytes), dsa.secretKey);
  return {
    ok: true,
    alg: PQ.dsa,
    sig: b64(sig),
    bytes: sig.length,
    pub: b64(dsa.publicKey),
  };
}

export function verifyBytes(sigB64, msg, pubB64) {
  try {
    const bytes = typeof msg === "string" ? Buffer.from(msg) : Buffer.from(msg || []);
    const ok = ml_dsa65.verify(fromB64(sigB64), new Uint8Array(bytes), fromB64(pubB64));
    return { ok: !!ok, alg: PQ.dsa };
  } catch {
    return { ok: false, alg: PQ.dsa, error: "verify failed" };
  }
}

export function wrapKey(kemPublicB64, plaintext) {
  const pub = fromB64(kemPublicB64);
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(pub);
  const key = crypto.createHash("sha256").update("kiln-kem-wrap:").update(Buffer.from(sharedSecret)).digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(Buffer.from(plaintext)), c.final()]);
  const tag = c.getAuthTag();
  return {
    ok: true,
    alg: PQ.kem,
    cipherText: b64(cipherText),
    blob: Buffer.concat([iv, tag, enc]).toString("base64"),
  };
}

export function unwrapKey(secret, packed) {
  const { kem } = keypairFromSecret(secret);
  try {
    const ss = ml_kem768.decapsulate(fromB64(packed.cipherText), kem.secretKey);
    const key = crypto.createHash("sha256").update("kiln-kem-wrap:").update(Buffer.from(ss)).digest();
    const buf = Buffer.from(String(packed.blob || ""), "base64");
    if (buf.length < 29) return { ok: false, error: "truncated wrap" };
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    const plain = Buffer.concat([d.update(enc), d.final()]);
    return { ok: true, plaintext: plain };
  } catch {
    return { ok: false, error: "kem open failed" };
  }
}

export function challengeMessage(nonce, handle) {
  return `kiln-pq-challenge:v1:${String(handle || "")}:${String(nonce || "")}`;
}

export function signChallenge(secret, nonce, handle) {
  const msg = challengeMessage(nonce, handle);
  const signed = signBytes(secret, msg);
  const pub = publicFromSecret(secret);
  return { ok: true, ...signed, nonce, handle, address: pub.address, msg };
}

export function verifyChallenge({ sig, nonce, handle, pub }) {
  const msg = challengeMessage(nonce, handle);
  return verifyBytes(sig, msg, pub);
}

export function signTx(secret, tx) {
  const body = JSON.stringify({
    type: tx.type,
    from: tx.from,
    repoId: tx.repoId || "",
    merkleRoot: tx.merkleRoot || "",
    memo: tx.memo || "",
    timestamp: tx.timestamp,
  });
  const signed = signBytes(secret, body);
  const pub = publicFromSecret(secret);
  return { ...signed, address: pub.address, body };
}
