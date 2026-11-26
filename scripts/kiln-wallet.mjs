/**
 * Per-account PQ wallet. Public keys live on the tree.
 * Secret material is derived at unwrap and never written.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { PQ, keypairFromSecret, publicFromSecret, signBytes, verifyBytes, signChallenge, verifyChallenge, wrapKey, unwrapKey, signTx } from "./kiln-pq.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const USERS = path.join(ROOT, "data", "users");
const CHAL = path.join(ROOT, "data", "wallet-challenges.json");
const MAC = path.join(ROOT, "data", "security", "mac.bin");

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
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function handleOf(h) {
  return String(h || "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 24)
    .toLowerCase();
}

function walletPath(handle) {
  return path.join(USERS, handleOf(handle), "WALLET.json");
}

export function loadWallet(handle) {
  return readJson(walletPath(handle), null);
}

export function walletByAddress(addr) {
  const want = String(addr || "").toLowerCase();
  if (!want) return null;
  try {
    for (const d of fs.readdirSync(USERS)) {
      const w = loadWallet(d);
      if (!w) continue;
      if (String(w.address || "").toLowerCase() === want || String(w.legacyAddress || "").toLowerCase() === want) return w;
    }
  } catch {
    /* none */
  }
  return null;
}

export function publicWallet(doc) {
  if (!doc) return null;
  return {
    spec: doc.spec || PQ.spec,
    scheme: doc.scheme || PQ.scheme,
    nist: doc.nist || PQ.nist,
    dsa: doc.dsa || PQ.dsa,
    kem: doc.kem || PQ.kem,
    address: doc.address,
    legacyAddress: doc.legacyAddress,
    dsaPublicKey: doc.dsaPublicKey,
    kemPublicKey: doc.kemPublicKey,
    seatedAt: doc.seatedAt,
    quantum: true,
  };
}

export function seatWallet(handle, secret) {
  const h = handleOf(handle);
  if (!h || h === "kiln" || !secret) return { ok: false, error: "wallet needs a user secret" };
  const keys = keypairFromSecret(secret);
  const prev = loadWallet(h) || {};
  const doc = {
    handle: h,
    spec: PQ.spec,
    scheme: PQ.scheme,
    nist: PQ.nist,
    dsa: PQ.dsa,
    kem: PQ.kem,
    address: keys.pqAddress,
    legacyAddress: prev.legacyAddress || keys.legacyAddress,
    dsaPublicKey: keys.public.dsaPublicKey,
    kemPublicKey: keys.public.kemPublicKey,
    dsaPublicBytes: keys.public.dsaPublicBytes,
    kemPublicBytes: keys.public.kemPublicBytes,
    seatedAt: prev.seatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeJson(walletPath(h), doc);
  return { ok: true, wallet: publicWallet(doc), created: !prev.address };
}

export function issueChallenge(handle) {
  const h = handleOf(handle);
  const nonce = crypto.randomBytes(16).toString("hex");
  const map = readJson(CHAL, {});
  const exp = Date.now() + 5 * 60 * 1000;
  map[nonce] = { handle: h, exp };
  const keep = {};
  const now = Date.now();
  for (const [k, v] of Object.entries(map)) {
    if (v && v.exp > now) keep[k] = v;
  }
  writeJson(CHAL, keep);
  return { ok: true, nonce, exp, handle: h, msg: `kiln-pq-challenge:v1:${h}:${nonce}`, alg: PQ.dsa };
}

export function consumeChallenge(nonce, handle) {
  const map = readJson(CHAL, {});
  const row = map[nonce];
  if (!row || row.exp < Date.now()) return { ok: false, error: "challenge expired" };
  if (handle && row.handle && row.handle !== handleOf(handle)) return { ok: false, error: "challenge bound to another handle" };
  delete map[nonce];
  writeJson(CHAL, map);
  return { ok: true, handle: row.handle };
}

export function verifyWalletSig({ handle, nonce, sig, pub, secret } = {}) {
  const h = handleOf(handle);
  const consumed = consumeChallenge(nonce, h);
  if (!consumed.ok) return consumed;
  const wallet = loadWallet(h);
  const pubKey = pub || wallet?.dsaPublicKey;
  if (!pubKey && secret) {
    const live = publicFromSecret(secret);
    if (live.address && wallet?.address && live.address !== wallet.address) {
      return { ok: false, error: "wallet mismatch" };
    }
    return { ...verifyChallenge({ sig, nonce, handle: h, pub: live.dsaPublicKey }), wallet: publicWallet(wallet) || live };
  }
  if (!pubKey) return { ok: false, error: "no public key seated" };
  const out = verifyChallenge({ sig, nonce, handle: h, pub: pubKey });
  if (!out.ok) return { ok: false, error: "bad signature" };
  return { ok: true, handle: h, wallet: publicWallet(wallet), alg: PQ.dsa };
}

export function signWithSecret(secret, text) {
  return signBytes(secret, text);
}

export function attestSession(secret, handle, tokenHash) {
  return signBytes(secret, `kiln-session:${handle}:${tokenHash}`);
}

export function wrapSecret(handle, secret, plaintext) {
  const w = loadWallet(handle) || seatWallet(handle, secret).wallet;
  const pub = w?.kemPublicKey || publicFromSecret(secret).kemPublicKey;
  return wrapKey(pub, plaintext);
}

export function openWrap(secret, packed) {
  return unwrapKey(secret, packed);
}

export function macKey() {
  fs.mkdirSync(path.dirname(MAC), { recursive: true });
  if (!fs.existsSync(MAC)) fs.writeFileSync(MAC, crypto.randomBytes(32));
  return fs.readFileSync(MAC);
}

export function signObjectGrant({ repoId, bucket, name, exp, viewer }) {
  const e = Number(exp) || Date.now() + 15 * 60 * 1000;
  const body = `${repoId}|${bucket}|${name}|${e}|${viewer || ""}`;
  const sig = crypto.createHmac("sha256", macKey()).update(body).digest("hex");
  return { ok: true, sig, exp: e, repo: repoId, bucket, path: name };
}

export function verifyObjectGrant({ repoId, bucket, name, exp, sig, viewer }) {
  if (!sig || !exp || Number(exp) < Date.now()) return { ok: false, error: "grant expired" };
  const body = `${repoId}|${bucket}|${name}|${exp}|${viewer || ""}`;
  const want = crypto.createHmac("sha256", macKey()).update(body).digest("hex");
  const a = Buffer.from(String(sig));
  const b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: "bad grant" };
  return { ok: true };
}

export function signLedger(secret, tx) {
  return signTx(secret, tx);
}

export function verifyLedger(tx, pub) {
  if (!tx?.sig || !pub) return { ok: false };
  const body = JSON.stringify({
    type: tx.type,
    from: tx.from,
    repoId: tx.repoId || "",
    merkleRoot: tx.merkleRoot || "",
    memo: tx.memo || "",
    timestamp: tx.timestamp,
  });
  return verifyBytes(tx.sig, body, pub);
}

export { PQ, publicFromSecret, verifyBytes };
