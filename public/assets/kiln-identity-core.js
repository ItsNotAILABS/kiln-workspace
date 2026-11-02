/**
 * Kiln identity — pure core (no app imports, node-harnessable).
 *
 * The client half of the daemon's wallet-identity contract
 * (KILN commit 994f403, swarm/docs/ACCOUNTS.md, lib/accounts.mjs):
 *
 *   POST /v1/accounts/me/wallets/challenge {address}
 *                                -> 201 {challengeId, message, expiresAt}
 *   POST /v1/accounts/me/wallets {address, kind, publicKey, challengeId,
 *                                 signature} -> 201 {ok, wallet}
 *                                 (bad sig 403, replay/unknown challenge
 *                                  404, expired 410, address bound to
 *                                  another account 409)
 *   GET  /v1/accounts/me/wallets -> {wallets:[{address, kind, publicKey,
 *                                 createdAt, hasBackup}]}
 *   DELETE /v1/accounts/me/wallets/:address -> {ok, wallet}
 *   PUT  /v1/accounts/me/wallet-backup {blob, kdf} -> {ok, updatedAt}
 *   GET  /v1/accounts/me/wallet-backup -> {backup:{blob, kdf, updatedAt}|null}
 *
 * The challenge message is built by the DAEMON and signed verbatim; the
 * builder below exists so the harness can pin the format byte-for-byte
 * against lib/accounts.mjs and so the UI can show the user exactly what
 * a wallet is being asked to sign:
 *
 *   kiln-wallet-link\naccount:<owner>\naddress:<addr>\nnonce:<hex>\nexpires:<iso>
 *
 * Secrets never leave the browser: the local wallet's secret is
 * encrypted here with a key derived from a user password (PBKDF2 ->
 * AES-256-GCM) and only the opaque blob + flat KDF metadata are PUT.
 * The password and the secret are never sent anywhere.
 */

// ---------------------------------------------------------------- utilities

export function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex) {
  const s = String(hex || "").replace(/^0x/i, "").trim();
  if (!s || s.length % 2 || /[^0-9a-fA-F]/.test(s)) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToBase64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64ToBytes(b64) {
  const bin = atob(String(b64 || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58 decode (Solana/Phantom addresses). Returns null on bad input. */
export function base58Decode(str) {
  const s = String(str || "").trim();
  if (!s) return null;
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes = [];
  for (const ch of s) {
    const v = B58_ALPHABET.indexOf(ch);
    if (v < 0) return null;
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[zeros + bytes.length - 1 - i] = bytes[i];
  return out;
}

export function utf8Bytes(str) {
  return new TextEncoder().encode(String(str));
}

/** Base58 encode (Solana/Phantom addresses + Phantom UL fields). */
export function base58Encode(bytes) {
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (!src.length) return "";
  let zeros = 0;
  while (zeros < src.length && src[zeros] === 0) zeros++;
  const digits = [0];
  for (const byte of src) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  if (zeros === src.length) return "1".repeat(zeros); // the value is zero
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += B58_ALPHABET[digits[i]];
  return out;
}

// ------------------------------------------------- challenge message format

/**
 * The daemon's link message, byte-for-byte (lib/accounts.mjs builds it
 * with exactly this join). The client never builds the message it signs
 * in production — it signs the daemon's `message` field verbatim — this
 * builder pins the format for the harness and for display.
 */
export function buildLinkMessage({ owner, address, nonce, expiresAt }) {
  return [
    "kiln-wallet-link",
    `account:${owner}`,
    `address:${address}`,
    `nonce:${nonce}`,
    `expires:${expiresAt}`,
  ].join("\n");
}

/**
 * The daemon's wallet SIGN-IN message, byte-for-byte (Lane B,
 * lib/accounts.mjs): own purpose tag, NO account line — the owning
 * account is never revealed before proof of the key.
 *
 *   kiln-wallet-signin\naddress:<addr>\nnonce:<48hex>\nexpires:<iso>
 */
export function buildSignInMessage({ address, nonce, expiresAt }) {
  return [
    "kiln-wallet-signin",
    `address:${address}`,
    `nonce:${nonce}`,
    `expires:${expiresAt}`,
  ].join("\n");
}

// ---------------------------------------------------------------- ed25519
//
// RFC 8032 ed25519 over BigInt field arithmetic — the app bundle carries
// no ed25519 implementation, and WebCrypto's Ed25519 is not yet in every
// browser the app runs in. Only what linking needs: derive the public
// key from a 32-byte seed and sign. Verified in the harness against
// node:crypto, which is the exact verifier the daemon runs
// (createPublicKey JWK OKP + cryptoVerify over the UTF-8 message).

const ED_P = (1n << 255n) - 19n;
const ED_L = (1n << 252n) + 27742317777372353535851937790883648493n;

function edMod(a) {
  const r = a % ED_P;
  return r >= 0n ? r : r + ED_P;
}
function edPow(base, exp) {
  let r = 1n;
  let b = edMod(base);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % ED_P;
    b = (b * b) % ED_P;
    e >>= 1n;
  }
  return r;
}
function edInv(a) {
  return edPow(a, ED_P - 2n);
}

const ED_D = edMod(-121665n * edInv(121666n));
const ED_I = edPow(2n, (ED_P - 1n) / 4n);

function edXRecover(y) {
  const xx = edMod((y * y - 1n) * edInv(edMod(ED_D * y * y + 1n)));
  let x = edPow(xx, (ED_P + 5n) / 8n);
  if (edMod(x * x - xx) !== 0n) x = edMod(x * ED_I);
  if (x & 1n) x = ED_P - x; // base point takes the even root
  return x;
}

const ED_BY = edMod(4n * edInv(5n));
const ED_B = [edXRecover(ED_BY), ED_BY]; // affine base point

// Extended coordinates [X, Y, Z, T]
function edFromAffine([x, y]) {
  return [x, y, 1n, edMod(x * y)];
}
function edAdd(P, Q) {
  const [X1, Y1, Z1, T1] = P;
  const [X2, Y2, Z2, T2] = Q;
  const A = edMod((Y1 - X1) * (Y2 - X2));
  const B = edMod((Y1 + X1) * (Y2 + X2));
  const C = edMod(2n * ED_D * T1 * T2);
  const D = edMod(2n * Z1 * Z2);
  const E = edMod(B - A);
  const F = edMod(D - C);
  const G = edMod(D + C);
  const H = edMod(B + A);
  return [edMod(E * F), edMod(G * H), edMod(F * G), edMod(E * H)];
}
function edMul(point, scalar) {
  let acc = [0n, 1n, 1n, 0n]; // neutral element
  let addend = edFromAffine(point);
  let s = scalar;
  while (s > 0n) {
    if (s & 1n) acc = edAdd(acc, addend);
    addend = edAdd(addend, addend);
    s >>= 1n;
  }
  return acc;
}
function edEncode(Pt) {
  const [X, Y, Z] = Pt;
  const zInv = edInv(Z);
  const x = edMod(X * zInv);
  const y = edMod(Y * zInv);
  const out = new Uint8Array(32);
  let v = y;
  for (let i = 0; i < 32; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (x & 1n) out[31] |= 0x80;
  return out;
}

async function sha512(bytes) {
  const buf = await crypto.subtle.digest("SHA-512", bytes);
  return new Uint8Array(buf);
}
function leToBigInt(bytes) {
  let v = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(bytes[i]);
  return v;
}
function bigIntToLe(v, len = 32) {
  const out = new Uint8Array(len);
  let x = v;
  for (let i = 0; i < len; i++) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

async function edSecretExpand(seed32) {
  const h = await sha512(seed32);
  const aBytes = h.slice(0, 32);
  aBytes[0] &= 248;
  aBytes[31] &= 63;
  aBytes[31] |= 64;
  return { a: leToBigInt(aBytes), prefix: h.slice(32, 64), aBytes };
}

/** Derive the ed25519 public key (32 bytes) for a 32-byte seed. */
export async function ed25519PublicKey(seed32) {
  const { a } = await edSecretExpand(seed32);
  return edEncode(edMul(ED_B, a));
}

/** RFC 8032 sign: 64-byte signature over messageBytes with the seed. */
export async function ed25519Sign(seed32, messageBytes) {
  const { a, prefix } = await edSecretExpand(seed32);
  const pub = edEncode(edMul(ED_B, a));
  const rHash = await sha512(concatBytes(prefix, messageBytes));
  const r = modL(rHash);
  const R = edEncode(edMul(ED_B, r));
  const kHash = await sha512(concatBytes(concatBytes(R, pub), messageBytes));
  const k = modL(kHash);
  const S = (r + k * a) % ED_L;
  return concatBytes(R, bigIntToLe(S));
}
function modL(bytes) {
  return leToBigInt(bytes) % ED_L;
}
function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// ------------------------------------------------------- encrypted backup
//
// PBKDF2(SHA-256, 210k rounds, 16-byte salt) -> AES-256-GCM key.
// blob = base64(iv || ciphertext). kdf records every parameter the
// decrypt side needs, as a FLAT object of strings/numbers — the exact
// shape the daemon validates and stores opaquely (values must be
// string|number|boolean, JSON <= 1024 chars; blob <= 16384 chars).

export const BACKUP_KDF = { v: 1, kdf: "PBKDF2", hash: "SHA-256", iterations: 210000, cipher: "AES-256-GCM" };

async function deriveBackupKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", utf8Bytes(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecretBackup(secret, password) {
  if (typeof secret !== "string" || !secret) throw new Error("No wallet secret to back up");
  if (typeof password !== "string" || password.length < 8) throw new Error("Use a backup password of at least 8 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt, BACKUP_KDF.iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8Bytes(secret)));
  const blob = bytesToBase64(concatBytes(iv, ct));
  if (blob.length > 16384) throw new Error("Encrypted backup exceeds the daemon's size limit");
  const kdf = { ...BACKUP_KDF, salt: bytesToBase64(salt) };
  return { blob, kdf };
}

export async function decryptSecretBackup(blob, kdf, password) {
  if (!kdf || kdf.kdf !== "PBKDF2" || typeof kdf.salt !== "string") {
    throw new Error("This backup's format isn't recognized");
  }
  const raw = base64ToBytes(blob);
  if (raw.length < 12 + 16) throw new Error("This backup is incomplete");
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const iterations = Number(kdf.iterations) || BACKUP_KDF.iterations;
  const key = await deriveBackupKey(password, base64ToBytes(kdf.salt), iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("That password doesn't open this backup");
  }
}

/**
 * Parse the OAuth callback fragment the daemon lands on the return path:
 *   #oauth_handoff=<code>   — provider identity matched an account
 *   #oauth_pending=<token>  — new account; a handle still needs picking
 * Returns { kind: "handoff", code } | { kind: "pending", token } | null.
 * A fragment (not a query) so the code never reaches a server log or a
 * referrer; the app exchanges it once and scrubs it from the URL.
 */
export function parseOAuthFragment(hash) {
  const h = String(hash || "").replace(/^#/, "");
  if (!h) return null;
  const params = new URLSearchParams(h);
  const code = params.get("oauth_handoff");
  if (code) return { kind: "handoff", code };
  const token = params.get("oauth_pending");
  if (token) return { kind: "pending", token };
  return null;
}

export const OAUTH_NOT_CONFIGURED_TEXT = {
  google: "Google sign-in isn't switched on yet — the provider app still needs to be created. Sign in with your password or a wallet below: every door opens the same account.",
  x: "X sign-in isn't switched on yet — the provider app still needs to be created. Sign in with your password or a wallet below: every door opens the same account.",
};

// ------------------------------------------------------------- API client
//
// The browser reaches the daemon through this origin's /api/forge proxy
// (the edge Worker and kiln-original both forward the path and the
// Authorization header verbatim; the daemon enforces accounts-only
// itself). The session token is the daemon's kiln_sess_ bearer.

export class IdentityApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    // The daemon's machine-readable refusal fields, when it sends them
    // (wallet sign-in's unlinked refusal carries reason "wallet_not_linked").
    this.reason = (data && (data.reason || data.code)) || null;
    this.data = data || null;
  }
}

/**
 * True when an answer means "this route is not on the running daemon
 * yet" rather than a real refusal: the merged routes are staged until
 * the next Doctor boot, and a staged daemon either 404s the route or
 * lets the request fall through to the operator gate (401 with the
 * generic token-required error, measured live 2026-11-02).
 */
export function isNotYetActive(e) {
  if (!(e instanceof IdentityApiError)) return false;
  if (e.status === 404) return true;
  if (e.status === 401 && /valid token required/i.test(e.message || "")) return true;
  return false;
}

export function createIdentityClient({ fetchImpl, getToken, base = "/api/forge/v1" } = {}) {
  const doFetch = fetchImpl || ((...args) => fetch(...args));

  async function call(method, path, body, { auth = true } = {}) {
    const headers = { "content-type": "application/json" };
    if (auth) {
      const token = typeof getToken === "function" ? getToken() : null;
      if (token) headers.authorization = `Bearer ${token}`;
    }
    const res = await doFetch(`${base}${path}`, {
      method,
      headers,
      cache: "no-store",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new IdentityApiError(res.status, (data && data.error) || `request failed (${res.status})`, data);
    }
    return data;
  }

  return {
    signup: ({ email, name, owner, password }) =>
      call("POST", "/accounts", { email, name, owner, password }, { auth: false }),
    login: ({ email, password }) => call("POST", "/accounts/login", { email, password }, { auth: false }),
    // Wallet sign-in (Lane B): PUBLIC bootstrap doors, like login. The
    // challenge names no account; verify mints a normal session for
    // the account the wallet is LINKED to, and only after the
    // signature verifies does the daemon reveal link state (unlinked
    // → 403 with reason "wallet_not_linked").
    walletChallenge: ({ address, publicKeyHex }) =>
      call(
        "POST",
        "/accounts/wallet/challenge",
        publicKeyHex ? { address, publicKey: publicKeyHex } : { address },
        { auth: false },
      ),
    walletVerify: ({ challengeId, address, signatureHex, publicKeyHex }) =>
      call(
        "POST",
        "/accounts/wallet/verify",
        {
          challengeId,
          address,
          signature: signatureHex,
          ...(publicKeyHex ? { publicKey: publicKeyHex } : {}),
        },
        { auth: false },
      ),
    // Agent accounts + invite links (Lane C). Session doors, except
    // redemption, which is the public bootstrap: the link IS the
    // credential.
    listAgents: () => call("GET", "/accounts/me/agents"),
    listAgentAccounts: () => call("GET", "/accounts/me/agent-accounts"),
    createAgentAccount: ({ owner, name, modelLabel, scopes }) =>
      call("POST", "/accounts/me/agent-accounts", {
        owner,
        name,
        ...(modelLabel ? { modelLabel } : {}),
        ...(scopes ? { scopes } : {}),
      }),
    severAgentAccount: (id) => call("DELETE", `/accounts/me/agent-accounts/${encodeURIComponent(id)}`),
    mintAgentInvite: ({ label } = {}) =>
      call("POST", "/accounts/me/agent-invites", label ? { label } : {}),
    listAgentInvites: () => call("GET", "/accounts/me/agent-invites"),
    revokeAgentInvite: (id) => call("DELETE", `/accounts/me/agent-invites/${encodeURIComponent(id)}`),
    redeemAgentInvite: (token, { owner, name, modelLabel }) =>
      call(
        "POST",
        `/agent-invites/${encodeURIComponent(token)}/redeem`,
        { owner, name, ...(modelLabel ? { modelLabel } : {}) },
        { auth: false },
      ),
    // OAuth doors (Google / X). The start door is a full-page navigation
    // on the daemon (GET /accounts/oauth/<provider>/start?return=<path>);
    // the panel preflights it with fetch first, because a browser
    // navigation to a not-configured daemon would land on raw JSON.
    // Preflight resolves { configured: boolean } and never throws for the
    // 503 provider_not_configured answer — that state is server-driven
    // copy in the panel, not an error. Other failures DO throw.
    oauthStartUrl: (provider, returnPath) =>
      `${base}/accounts/oauth/${encodeURIComponent(provider)}/start?return=${encodeURIComponent(returnPath || "/login")}`,
    oauthPreflight: async (provider, returnPath) => {
      const res = await doFetch(
        `${base}/accounts/oauth/${encodeURIComponent(provider)}/start?return=${encodeURIComponent(returnPath || "/login")}`,
        { method: "GET", headers: { accept: "application/json" }, cache: "no-store", redirect: "manual" },
      );
      if (res.status === 503) {
        const data = await res.json().catch(() => null);
        if (data && data.error === "provider_not_configured") return { configured: false };
        throw new IdentityApiError(503, (data && data.error) || "provider unavailable", data);
      }
      // A configured provider answers the start door with a redirect to
      // the provider (opaqueredirect under redirect:"manual", or a 3xx we
      // can see). Anything else that is not an error = configured.
      if (res.ok || res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
        return { configured: true };
      }
      const data = await res.json().catch(() => null);
      throw new IdentityApiError(res.status, (data && data.error) || `request failed (${res.status})`, data);
    },
    // Callback exchanges. Handoff: the daemon matched the provider
    // identity to an account — exchange the one-shot code for a normal
    // session (same shape as wallet verify). Complete: a pending token
    // (new account) + the handle/name the user picked → account + session.
    // Owner taken → 409, and the pending token SURVIVES (the caller keeps
    // it and lets the user pick another handle).
    oauthHandoff: (code) => call("POST", "/accounts/oauth/handoff", { code }, { auth: false }),
    oauthComplete: ({ pendingToken, owner, name }) =>
      call("POST", "/accounts/oauth/complete", { pendingToken, owner, name }, { auth: false }),
    me: () => call("GET", "/accounts/me"),
    listWallets: () => call("GET", "/accounts/me/wallets"),
    challenge: (address) => call("POST", "/accounts/me/wallets/challenge", { address }),
    linkWallet: ({ address, kind, publicKeyHex, challengeId, signatureHex }) =>
      call("POST", "/accounts/me/wallets", {
        address,
        kind,
        publicKey: publicKeyHex,
        challengeId,
        signature: signatureHex,
      }),
    unlinkWallet: (address) => call("DELETE", `/accounts/me/wallets/${encodeURIComponent(address)}`),
    putBackup: ({ blob, kdf }) => call("PUT", "/accounts/me/wallet-backup", { blob, kdf }),
    getBackup: () => call("GET", "/accounts/me/wallet-backup"),
  };
}

/**
 * The full local-wallet link: ask the daemon for a challenge, sign its
 * message verbatim with the wallet secret's ed25519 key, submit.
 * The secret is a 64-char hex string (the store's randomSecret shape);
 * its first 32 bytes ARE the seed the daemon binds to the 0x address
 * as a pair.
 */
export async function linkLocalWallet(client, { address, secretHex }) {
  const seed = hexToBytes(secretHex);
  if (!seed || seed.length !== 32) throw new Error("This wallet's secret isn't a 32-byte key — it can't be linked");
  const ch = await client.challenge(address);
  const pub = await ed25519PublicKey(seed);
  const sig = await ed25519Sign(seed, utf8Bytes(ch.message));
  return client.linkWallet({
    address,
    kind: "local",
    publicKeyHex: bytesToHex(pub),
    challengeId: ch.challengeId,
    signatureHex: bytesToHex(sig),
  });
}

/**
 * The Phantom link: sign the daemon's challenge with the connected
 * provider. The address is base58 — the daemon requires the presented
 * public key to BE the address's bytes, so the key is decoded from the
 * address itself.
 */
export async function linkPhantomWallet(client, { address, signMessage }) {
  const pub = base58Decode(address);
  if (!pub || pub.length !== 32) throw new Error("Phantom returned an address that isn't a Solana public key");
  const ch = await client.challenge(address);
  const signed = await signMessage(utf8Bytes(ch.message));
  const sigBytes = signed && signed.signature ? signed.signature : signed;
  if (!sigBytes || sigBytes.length !== 64) throw new Error("Phantom didn't return a signature");
  return client.linkWallet({
    address,
    kind: "phantom",
    publicKeyHex: bytesToHex(pub),
    challengeId: ch.challengeId,
    signatureHex: bytesToHex(new Uint8Array(sigBytes)),
  });
}

// ------------------------------------------------------- wallet sign-in
//
// The sign-in twins of the link flows above: ask the daemon for a
// sign-in challenge, sign its message verbatim, verify. Verify returns
// { account, sessionToken, expiresAt, wallet } — a normal session for
// the OWNING account. Callers persist it exactly like a password
// sign-in; there is no separate "wallet session".

/** Sign in with this browser's local (0x) wallet key. */
export async function signInWithLocalWallet(client, { address, secretHex }) {
  const seed = hexToBytes(secretHex);
  if (!seed || seed.length !== 32) throw new Error("This wallet's secret isn't a 32-byte key — it can't sign in");
  const pub = await ed25519PublicKey(seed);
  const ch = await client.walletChallenge({ address, publicKeyHex: bytesToHex(pub) });
  const sig = await ed25519Sign(seed, utf8Bytes(ch.message));
  return client.walletVerify({
    challengeId: ch.challengeId,
    address,
    signatureHex: bytesToHex(sig),
    publicKeyHex: bytesToHex(pub),
  });
}

/**
 * Sign in with a Phantom signature over a fresh challenge. The
 * signMessage callback abstracts the transport: the injected provider
 * today, a universal-link redirect round trip on mobile — both hand
 * back the same 64 signature bytes for the same challenge.
 */
export async function signInWithPhantomSignature(client, { address, challenge, signatureBytes }) {
  const sigBytes = signatureBytes && signatureBytes.signature ? signatureBytes.signature : signatureBytes;
  if (!sigBytes || sigBytes.length !== 64) throw new Error("Phantom didn't return a signature");
  return client.walletVerify({
    challengeId: challenge.challengeId,
    address,
    signatureHex: bytesToHex(new Uint8Array(sigBytes)),
  });
}

export async function signInWithPhantomWallet(client, { address, signMessage }) {
  const pub = base58Decode(address);
  if (!pub || pub.length !== 32) throw new Error("Phantom returned an address that isn't a Solana public key");
  const ch = await client.walletChallenge({ address });
  const signed = await signMessage(utf8Bytes(ch.message));
  return signInWithPhantomSignature(client, { address, challenge: ch, signatureBytes: signed });
}
