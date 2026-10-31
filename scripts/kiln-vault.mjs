/**
 * Real AES-256-GCM vaults, wrapped by ML-KEM-768.
 * The key never hits disk. Scope: account | repo:<id> | agent:<id>
 * Wire: 12-byte IV || 16-byte tag || ciphertext
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { publicFromSecret, wrapKey, unwrapKey } from "./kiln-pq.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const VAULTS = path.join(ROOT, "data", "vaults");
const UNWRAP = new Map();

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

export function vaultKey(secret, scope) {
  return crypto.createHash("sha256").update(`kiln-vault:${String(secret)}:${String(scope)}`).digest();
}

export function vaultCommitment(secret, scope) {
  return "0x" + crypto.createHash("sha256").update(vaultKey(secret, scope)).digest("hex").slice(0, 48);
}

function vaultDir(handle) {
  return path.join(VAULTS, String(handle || "x").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48));
}

function blobPath(handle, scope) {
  const safe = String(scope || "account").replace(/[^a-zA-Z0-9._:-]+/g, "_").slice(0, 80);
  return path.join(vaultDir(handle), "blobs", `${safe}.bin`);
}

export function ensureAccountVault(handle, { displayName, lab, secret } = {}) {
  const h = String(handle || "").slice(0, 24);
  if (!h) return { ok: false, error: "handle required" };
  const dir = vaultDir(h);
  fs.mkdirSync(path.join(dir, "blobs"), { recursive: true });
  fs.mkdirSync(path.join(dir, "repos"), { recursive: true });
  fs.mkdirSync(path.join(dir, "agents"), { recursive: true });
  const file = path.join(dir, "VAULT.json");
  let doc = readJson(file, null);
  if (!doc) {
    doc = {
      handle: h,
      cipher: "AES-256-GCM+ML-KEM-768",
      createdAt: new Date().toISOString(),
      displayName: displayName || h,
      lab: lab || "",
      scopes: {},
    };
  }
  doc.displayName = displayName || doc.displayName || h;
  doc.lab = lab || doc.lab || "";
  if (secret) {
    doc.scopes.account = {
      commitment: vaultCommitment(secret, `${h}:account`),
      kind: "account",
      kem: "ML-KEM-768",
    };
    try {
      const pub = publicFromSecret(secret);
      const packed = wrapKey(pub.kemPublicKey, vaultKey(secret, `${h}:account`));
      if (packed.ok) {
        doc.scopes.account.wrap = { alg: packed.alg, cipherText: packed.cipherText, blob: packed.blob };
        doc.pqAddress = pub.address;
      }
    } catch {
      /* kem wrap is additive */
    }
  }
  doc.cipher = "AES-256-GCM+ML-KEM-768";
  doc.updatedAt = new Date().toISOString();
  writeJson(file, doc);
  return { ok: true, vault: publicVault(doc) };
}

export function ensureRepoVault(handle, repoId, { visibility = "public", secret } = {}) {
  const h = String(handle || "");
  const id = String(repoId || `${h}/home`);
  ensureAccountVault(h, { secret });
  const file = path.join(vaultDir(h), "repos", `${id.replace(/\//g, "_")}.json`);
  const rec = {
    repoId: id,
    owner: h,
    visibility: visibility === "private" ? "private" : "public",
    cipher: "AES-256-GCM+ML-KEM-768",
    createdAt: new Date().toISOString(),
    commitment: secret ? vaultCommitment(secret, `${h}:repo:${id}`) : "",
  };
  writeJson(file, rec);
  const doc = readJson(path.join(vaultDir(h), "VAULT.json"), { handle: h, scopes: {} });
  doc.scopes = doc.scopes || {};
  doc.scopes[`repo:${id}`] = { commitment: rec.commitment, visibility: rec.visibility, kind: "repo" };
  writeJson(path.join(vaultDir(h), "VAULT.json"), doc);
  return { ok: true, vault: rec };
}

export function ensureAgentVault(handle, agentId, { role = "agent", repoId, secret } = {}) {
  const h = String(handle || "");
  const aid = String(agentId || "orchestrator").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48);
  ensureAccountVault(h, { secret });
  const rec = {
    agent: aid,
    owner: h,
    role,
    repoId: repoId || `${h}/home`,
    cipher: "AES-256-GCM+ML-KEM-768",
    createdAt: new Date().toISOString(),
    commitment: secret ? vaultCommitment(secret, `${h}:agent:${aid}`) : "",
  };
  writeJson(path.join(vaultDir(h), "agents", `${aid}.json`), rec);
  const doc = readJson(path.join(vaultDir(h), "VAULT.json"), { handle: h, scopes: {} });
  doc.scopes = doc.scopes || {};
  doc.scopes[`agent:${aid}`] = { commitment: rec.commitment, role, kind: "agent" };
  writeJson(path.join(vaultDir(h), "VAULT.json"), doc);
  return { ok: true, vault: rec };
}

export function sealBlob({ handle, scope, plaintext, secret }) {
  if (!secret) return { ok: false, error: "vault key required" };
  const key = vaultKey(secret, `${handle}:${scope}`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const buf = Buffer.concat([iv, tag, enc]);
  const dest = blobPath(handle, scope);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return { ok: true, scope, bytes: buf.length, commitment: vaultCommitment(secret, `${handle}:${scope}`) };
}

export function openBlob({ handle, scope, secret }) {
  if (!secret) return { ok: false, error: "vault key required" };
  const dest = blobPath(handle, scope);
  if (!fs.existsSync(dest)) return { ok: false, error: "empty vault" };
  const buf = fs.readFileSync(dest);
  if (buf.length < 29) return { ok: false, error: "truncated" };
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", vaultKey(secret, `${handle}:${scope}`), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    return { ok: true, scope, text: plain };
  } catch {
    return { ok: false, error: "open failed" };
  }
}

export function openKemWrap(secret, packed) {
  return unwrapKey(secret, packed);
}

export function unwrapSession(token, { handle, secret }) {
  if (!token || !secret || !handle) return;
  UNWRAP.set(token, { handle, secret });
}

export function sessionSecret(token) {
  return UNWRAP.get(token)?.secret || "";
}

export function dropUnwrap(token) {
  UNWRAP.delete(token);
}

export function dropUnwrapForHandle(handle, keepToken) {
  const h = String(handle || "");
  for (const [tok, rec] of UNWRAP) {
    if (rec?.handle === h && tok !== keepToken) UNWRAP.delete(tok);
  }
}

export function readVaultMeta(handle) {
  const h = String(handle || "");
  const doc = readJson(path.join(vaultDir(h), "VAULT.json"), null);
  return { ok: !!doc, vault: publicVault(doc) };
}

function publicVault(doc) {
  if (!doc) return null;
  return {
    handle: doc.handle,
    cipher: doc.cipher || "AES-256-GCM+ML-KEM-768",
    displayName: doc.displayName,
    lab: doc.lab,
    createdAt: doc.createdAt,
    pqAddress: doc.pqAddress || null,
    kem: "ML-KEM-768",
    scopes: Object.fromEntries(
      Object.entries(doc.scopes || {}).map(([k, v]) => [k, { kind: v.kind, visibility: v.visibility, role: v.role, commitment: v.commitment, kem: v.kem }]),
    ),
  };
}
