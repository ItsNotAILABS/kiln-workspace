/**
 * Phantom on mobile — universal links (Lane B-mobile).
 *
 * Why this exists (the recon, 2026-11-02): mobile Safari/Chrome expose
 * NO injected provider — window.phantom / window.solana exist only
 * inside Phantom's own in-app browser (and in desktop extensions). So
 * every Phantom action that waits for an injected provider dead-ends
 * on a phone browser. Two doors fix it:
 *
 *  Door 1 — "Open in Phantom app": the browse deep link
 *  (https://phantom.app/ul/browse/<url>?ref=<origin>) lands this exact
 *  page inside Phantom's browser, where the injected provider lives
 *  and signing works in place. The session then lives in THAT browser
 *  context — the panel copy says so.
 *
 *  Door 2 — this module: Phantom's universal-link protocol
 *  (https://phantom.app/ul/v1/connect + /signMessage) with the
 *  documented NaCl-box encrypted payload, so a challenge signature
 *  completes without leaving the mobile browser. The crypto is the
 *  real tweetnacl (vendored byte-for-byte from ShopStream's
 *  production vendor/nacl.min.js as kiln-nacl.min.js; X25519 +
 *  XSalsa20-Poly1305 via nacl.box) — never hand-rolled, never stubbed.
 *
 * Prior art: ShopStream's app.js UL implementation + its Round 27
 * forensics, adopted deliberately:
 *  (a) a stored UL session RE-ATTACHES at boot (restoreUlSession) —
 *      before R27 a reload quietly disconnected the wallet while its
 *      session sat in storage;
 *  (b) NO silent failures — an orphaned return (Phantom answered but
 *      this browser lost the dapp key that left: iOS webviews
 *      partition storage per app) surfaces its exact reason + the fix;
 *      Phantom's own errorCode/errorMessage surface verbatim;
 *  (c) pending actions live in localStorage, NOT sessionStorage —
 *      the return can land in a restored/fresh tab where
 *      sessionStorage is empty.
 *
 * Storage (localStorage):
 *  kiln.ul.session.v1 — { sk58, encPub, session, pubkey }: the dapp
 *    box secret (base58), Phantom's encryption public key (base58),
 *    the Phantom session token, the wallet address. The dapp secret
 *    never leaves this browser; it decrypts Phantom's replies.
 *  kiln.ul.pending.v1 — { action, ts, ... }: what to finish when
 *    Phantom redirects back (a sign-in verify, a link, a signup
 *    connect), with the daemon challenge when one is in flight.
 *  kiln.ul.status.v1 — { kind: "error"|"note", text }: a one-shot
 *    message the identity panel shows after a redirect round trip.
 */
import { base58Encode, base58Decode, utf8Bytes } from "./kiln-identity-core.js";

export const UL_BASE = "https://phantom.app/ul/v1";
const SESSION_KEY = "kiln.ul.session.v1";
const PENDING_KEY = "kiln.ul.pending.v1";
const STATUS_KEY = "kiln.ul.status.v1";
const PENDING_TTL_MS = 30 * 60 * 1000;

// ------------------------------------------------------------ nacl load

let naclPromise = null;

/**
 * The vendored tweetnacl, loaded lazily as a side-effect module: its
 * UMD tail assigns self.nacl when no CommonJS module exists (the
 * frozen app has none), exactly how ShopStream's classic script tag
 * exposes window.nacl.
 */
export function loadNacl() {
  if (globalThis.nacl && globalThis.nacl.box) return Promise.resolve(globalThis.nacl);
  if (!naclPromise) {
    naclPromise = import("./kiln-nacl.min.js")
      .then(() => {
        if (globalThis.nacl && globalThis.nacl.box) return globalThis.nacl;
        throw new Error("Encryption library loaded without nacl.box");
      })
      .catch((e) => {
        naclPromise = null;
        throw e instanceof Error ? e : new Error("Encryption library failed to load");
      });
  }
  return naclPromise;
}

// ------------------------------------------------------------- storage

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJson(key, value) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {}
}

/** The stored UL session, or null. Boot restore reads exactly this. */
export function ulSession() {
  const s = readJson(SESSION_KEY);
  if (!s || !s.sk58 || !s.session || !s.pubkey || !s.encPub) return null;
  return s;
}

function saveUlSession(s) {
  writeJson(SESSION_KEY, s);
}

export function clearUlSession() {
  writeJson(SESSION_KEY, null);
  writeJson(PENDING_KEY, null);
}

export function setUlPending(p) {
  writeJson(PENDING_KEY, p ? { ...p, ts: Date.now() } : null);
}

export function peekUlPending() {
  const p = readJson(PENDING_KEY);
  if (!p) return null;
  if (Date.now() - (p.ts || 0) > PENDING_TTL_MS) {
    writeJson(PENDING_KEY, null);
    return null;
  }
  return p;
}

export function takeUlPending() {
  const p = peekUlPending();
  if (p) writeJson(PENDING_KEY, null);
  return p;
}

export function setUlStatus(status) {
  writeJson(STATUS_KEY, status);
}

export function takeUlStatus() {
  const s = readJson(STATUS_KEY);
  if (s) writeJson(STATUS_KEY, null);
  return s;
}

// ------------------------------------------------------------- crypto

export async function ulEncrypt(payloadObj, theirPubKeyBytes, secretKeyBytes) {
  const nacl = await loadNacl();
  const nonce = nacl.randomBytes(24);
  const msg = utf8Bytes(JSON.stringify(payloadObj));
  const boxed = nacl.box(msg, nonce, theirPubKeyBytes, secretKeyBytes);
  if (!boxed) throw new Error("Could not encrypt the Phantom request");
  return { nonce: base58Encode(nonce), data: base58Encode(boxed) };
}

export async function ulDecrypt(dataB58, nonceB58, theirPubKeyBytes, secretKeyBytes) {
  const nacl = await loadNacl();
  const data = base58Decode(dataB58);
  const nonce = base58Decode(nonceB58);
  if (!data || !nonce) throw new Error("Phantom's reply was not readable base58");
  const opened = nacl.box.open(data, nonce, theirPubKeyBytes, secretKeyBytes);
  if (!opened) throw new Error("could not decrypt Phantom's response");
  return JSON.parse(new TextDecoder().decode(opened));
}

async function dappKeypair() {
  const nacl = await loadNacl();
  const existing = readJson(SESSION_KEY);
  if (existing && existing.sk58) {
    const sk = base58Decode(existing.sk58);
    if (sk && sk.length === 32) {
      const kp = nacl.box.keyPair.fromSecretKey(sk);
      return { secretKey: sk, publicKey: kp.publicKey };
    }
  }
  const kp = nacl.box.keyPair();
  return { secretKey: kp.secretKey, publicKey: kp.publicKey };
}

// ------------------------------------------------------------- doors

/** Door 1: open this exact page inside Phantom's own browser. */
export function openInPhantomAppUrl(pageUrl, origin) {
  return `https://phantom.app/ul/browse/${encodeURIComponent(pageUrl)}?ref=${encodeURIComponent(origin)}`;
}

/**
 * Start (or restart) the UL connect: persist a fresh dapp keypair and
 * return the /connect URL to navigate to. Any previous session is
 * replaced — connecting is the explicit act that re-keys the link.
 */
export async function ulConnectUrl(returnUrl) {
  const nacl = await loadNacl();
  const kp = nacl.box.keyPair();
  saveUlSession({ sk58: base58Encode(kp.secretKey), encPub: null, session: null, pubkey: null });
  const params = new URLSearchParams({
    app_url: returnUrl,
    dapp_encryption_public_key: base58Encode(kp.publicKey),
    redirect_link: returnUrl,
    cluster: "mainnet-beta",
  });
  return `${UL_BASE}/connect?${params.toString()}`;
}

/**
 * Build the /signMessage URL for a stored session: payload is the
 * Phantom session + the base58-encoded message bytes, NaCl-boxed to
 * Phantom's encryption key. Throws with the exact fix when there is
 * no live session to sign with.
 */
export async function ulSignMessageUrl(returnUrl, messageBytes) {
  const s = ulSession();
  if (!s) {
    throw new Error(
      "Phantom app-link session missing in this browser — reconnect here, or open this page inside Phantom's app (Door 1) where signing works in place.",
    );
  }
  const { secretKey, publicKey } = await dappKeypairFrom(s);
  const { nonce, data } = await ulEncrypt(
    { session: s.session, message: base58Encode(messageBytes) },
    base58Decode(s.encPub),
    secretKey,
  );
  const params = new URLSearchParams({
    dapp_encryption_public_key: base58Encode(publicKey),
    nonce,
    redirect_link: returnUrl,
    payload: data,
  });
  return `${UL_BASE}/signMessage?${params.toString()}`;
}

async function dappKeypairFrom(s) {
  const nacl = await loadNacl();
  const sk = base58Decode(s.sk58);
  if (!sk || sk.length !== 32) throw new Error("The stored Phantom app-link key is unreadable — reconnect the app link");
  const kp = nacl.box.keyPair.fromSecretKey(sk);
  return { secretKey: sk, publicKey: kp.publicKey };
}

// --------------------------------------------------------- return path

/** Does this URL carry a Phantom UL return (result, or an error)? */
export function hasUlReturn(search) {
  const q = new URLSearchParams(search || "");
  return Boolean(q.get("data") || q.get("nonce") || q.get("phantom_encryption_public_key") || q.get("errorCode"));
}

/**
 * Parse + apply a UL return. Pure transport: resolves to one of
 *   { kind: "connect", address, session }  — session persisted
 *   { kind: "sign", signature: Uint8Array } — for the pending action
 *   { kind: "error", message }             — Phantom's own words
 *   { kind: "orphan", message }            — answered, but this
 *     browser lost the key/session that left (R27 lesson b)
 *   null — not a UL return.
 * Finishing the pending ACTION (verify / link / signup) is the
 * caller's job, with takeUlPending().
 */
export async function parseUlReturn(search) {
  const q = new URLSearchParams(search || "");
  if (!hasUlReturn(search)) return null;

  if (q.get("errorCode")) {
    return {
      kind: "error",
      message: `Phantom: ${q.get("errorMessage") || `error ${q.get("errorCode")}`} — nothing was signed. Try again, or use Door 1 (open this page inside Phantom's app).`,
    };
  }

  const stored = readJson(SESSION_KEY);
  if ((q.get("data") || q.get("phantom_encryption_public_key")) && (!stored || !stored.sk58)) {
    return {
      kind: "orphan",
      message:
        "Phantom answered, but this browser lost the session that left — app webviews keep separate storage, so the key that started the trip isn't here. Open this page inside Phantom's own browser (Door 1: Open in Phantom app) and sign there, or restart the app-link sign-in in this browser.",
    };
  }

  const sk = base58Decode(stored.sk58);
  if (!sk || sk.length !== 32) {
    return { kind: "orphan", message: "The stored Phantom app-link key is unreadable — reconnect the app link and try again." };
  }

  // Connect result: Phantom's encryption key arrives in the clear,
  // the payload (session + public_key) boxed to our dapp key.
  if (q.get("phantom_encryption_public_key") && q.get("data")) {
    const theirPub = base58Decode(q.get("phantom_encryption_public_key"));
    if (!theirPub) return { kind: "error", message: "Phantom's connect reply carried an unreadable encryption key" };
    let res;
    try {
      res = await ulDecrypt(q.get("data"), q.get("nonce"), theirPub, sk);
    } catch (e) {
      return { kind: "error", message: `Phantom connect reply unreadable: ${e instanceof Error ? e.message : e}` };
    }
    if (!res || !res.public_key || !res.session) {
      return { kind: "error", message: "Phantom's connect reply didn't carry a wallet address and session" };
    }
    saveUlSession({ sk58: stored.sk58, encPub: q.get("phantom_encryption_public_key"), session: res.session, pubkey: res.public_key });
    return { kind: "connect", address: res.public_key, session: res.session };
  }

  // Sign result: boxed to the session's Phantom encryption key; the
  // payload is { signature: "<base58>" }.
  if (q.get("data") && q.get("nonce")) {
    const s = ulSession();
    if (!s || !s.encPub) {
      return {
        kind: "orphan",
        message:
          "Phantom returned a signature, but this browser has no app-link session to read it with — the session that left isn't the one that came back. Reconnect the app link in this browser and try again.",
      };
    }
    let res;
    try {
      res = await ulDecrypt(q.get("data"), q.get("nonce"), base58Decode(s.encPub), sk);
    } catch (e) {
      return { kind: "error", message: `Phantom's signed reply unreadable: ${e instanceof Error ? e.message : e}` };
    }
    const sig = res && res.signature ? base58Decode(res.signature) : null;
    if (!sig || sig.length !== 64) return { kind: "error", message: "Phantom's reply didn't carry a 64-byte signature" };
    return { kind: "sign", signature: sig };
  }

  return { kind: "error", message: "Phantom's return was incomplete — nothing was signed" };
}

/** Strip UL return params from the address bar after handling. */
export function cleanUlReturnFromUrl() {
  try {
    const url = new URL(globalThis.location.href);
    for (const k of ["data", "nonce", "phantom_encryption_public_key", "errorCode", "errorMessage"]) {
      url.searchParams.delete(k);
    }
    globalThis.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {}
}
