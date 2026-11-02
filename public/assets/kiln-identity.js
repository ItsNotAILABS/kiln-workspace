/**
 * Kiln identity — the app half of wallet-identity binding.
 *
 * The daemon half (KILN commit 994f403) binds wallet addresses to a
 * forge account by signed challenge and stores an opaque, client-
 * encrypted wallet backup. This module is the client:
 *
 *  - a forge-account session (email + password against the daemon,
 *    through this origin's /api/forge proxy) kept in localStorage;
 *  - on sign-in, GET /v1/accounts/me + /me/wallets restore the profile
 *    and the linked-wallet list into the store, so a second browser
 *    renders "wallet linked — restore" instead of "generate a new
 *    wallet";
 *  - after a wallet is generated or imported in this browser (the
 *    store's connect action, wrapped below the way kiln-forge.js wraps
 *    importGithub), a prompt offers an encrypted backup: the secret is
 *    encrypted in the browser with a password-derived key and only the
 *    opaque blob is PUT — the secret and the password never leave;
 *  - profile surfaces (the exported panel) for restore, backup
 *    management, and linking Phantom as a second wallet by signature.
 *
 * Everything is fail-soft: if the daemon's wallet surface is not live
 * yet, the panel says so plainly and the rest of the app is untouched.
 * Crypto and wire shapes live in kiln-identity-core.js and are pinned
 * by its harness.
 */
import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { b as store } from "./store-sx46DNi5.js";
import {
  createIdentityClient,
  encryptSecretBackup,
  decryptSecretBackup,
  linkLocalWallet,
  linkPhantomWallet,
  signInWithLocalWallet,
  signInWithPhantomWallet,
  signInWithPhantomSignature,
  isNotYetActive,
  utf8Bytes,
  base58Decode,
  bytesToHex,
  IdentityApiError,
} from "./kiln-identity-core.js";
import {
  ulSession,
  clearUlSession,
  setUlPending,
  peekUlPending,
  takeUlPending,
  setUlStatus,
  takeUlStatus,
  hasUlReturn,
  parseUlReturn,
  cleanUlReturnFromUrl,
  ulConnectUrl,
  ulSignMessageUrl,
  openInPhantomAppUrl,
} from "./kiln-phantom-ul.js";

const R = reactNs(React(), 1);
const j = jsxmod();

const SESSION_KEY = "kiln.daemon.session.v1";
const OFFERED_KEY = "kiln.backup.offered.v1";

// ------------------------------------------------------------- session state

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.token || !s?.account?.owner) return null;
    if (s.expiresAt && Date.parse(s.expiresAt) <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

let session = loadSession();
let meCache = null; // { account, wallets, hasWalletBackup } | null
let walletSurface = null; // null = unprobed, true = live, false = not yet active
let suppressOffer = false; // set while a restore installs the key itself
const listeners = new Set();

function emit() {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {}
  }
}

const client = createIdentityClient({ getToken: () => session?.token || null });

function saveSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
  emit();
}

export function getIdentitySnapshot() {
  return { session, me: meCache, walletSurface };
}

// ------------------------------------------------------------- daemon sync

function mergeAccountProfile(me) {
  try {
    const acct = me?.account;
    if (!acct?.owner) return;
    const s = store.getState();
    if (s.wallet && s.wallet.handle !== acct.owner) return; // another local identity is active
    const cur = (s.profiles || {})[acct.owner];
    if (cur && !cur.forgeMirror) return; // a genuine local profile is authoritative
    const local = (me.wallets || []).find((w) => w.kind === "local");
    s.upsertProfile({
      handle: acct.owner,
      displayName: acct.name || acct.owner,
      address: local?.address || cur?.address || "",
      kind: "user",
    });
  } catch {}
}

export async function refreshIdentity() {
  if (!session) {
    meCache = null;
    emit();
    return null;
  }
  try {
    const me = await client.me();
    meCache = {
      account: me.account,
      wallets: Array.isArray(me.wallets) ? me.wallets : [],
      hasWalletBackup: !!me.hasWalletBackup,
      sponsor: me.sponsor || me.account?.sponsor || null,
      sponsoredAgents: Array.isArray(me.sponsoredAgents) ? me.sponsoredAgents : [],
    };
    if (Array.isArray(me.wallets)) {
      walletSurface = true;
    } else {
      // An older daemon build answers /me without the wallet list; probe
      // the wallets route itself. There the surface's absence reads as
      // 404 (route unknown) or as the generic operator-only 403 (the
      // request falls through to the operator gate) — both mean the
      // account-wallet surface is not active on this daemon yet. The
      // account data above stands either way.
      try {
        const lw = await client.listWallets();
        meCache.wallets = Array.isArray(lw.wallets) ? lw.wallets : [];
        meCache.hasWalletBackup = meCache.wallets.some((w) => w.hasBackup);
        walletSurface = true;
      } catch (e) {
        if (e instanceof IdentityApiError && (e.status === 404 || e.status === 403)) {
          walletSurface = false;
        }
      }
    }
    mergeAccountProfile(meCache);
    emit();
    return meCache;
  } catch (e) {
    if (e instanceof IdentityApiError && e.status === 401) {
      saveSession(null);
      meCache = null;
      emit();
    }
    return null;
  }
}

async function signIn(email, password) {
  const res = await client.login({ email, password });
  saveSession({ token: res.sessionToken, expiresAt: res.expiresAt, account: res.account });
  await refreshIdentity();
  return res.account;
}

async function signOut() {
  // The daemon has no per-session revoke in this slice; signing out is
  // a browser act — the token is dropped here and expires on its own.
  meCache = null;
  saveSession(null);
}

// ------------------------------------------------------------- phantom

function phantomProvider() {
  try {
    const p = globalThis.phantom?.solana;
    if (p && p.isPhantom) return p;
    const s = globalThis.solana;
    if (s && s.isPhantom) return s;
    return null;
  } catch {
    return null;
  }
}

async function connectPhantom() {
  const p = phantomProvider();
  if (!p) throw new Error("Phantom isn't available in this browser — install it or open this page in a browser that has it");
  const res = await p.connect();
  const addr = (res?.publicKey || p.publicKey)?.toString();
  if (!addr) throw new Error("Phantom connected without an address");
  return addr;
}

async function linkPhantom(address) {
  const p = phantomProvider();
  if (!p) throw new Error("Phantom isn't available in this browser");
  return linkPhantomWallet(client, {
    address,
    signMessage: (bytes) => p.signMessage(bytes, "utf8"),
  });
}

// ------------------------------------------------- wallet sign-in doors
//
// Every door opens the SAME account: password, an injected Phantom
// signature, this browser's local key, or a Phantom universal-link
// round trip. Verify answers with a normal session for the account
// the wallet is linked to — persisted exactly like a password
// sign-in, restored by the same refreshIdentity.

async function completeWalletSession(res) {
  saveSession({ token: res.sessionToken, expiresAt: res.expiresAt, account: res.account });
  await refreshIdentity();
  return res.account;
}

async function walletSignInInjected() {
  const addr = await connectPhantom();
  const res = await signInWithPhantomWallet(client, {
    address: addr,
    signMessage: (bytes) => phantomProvider().signMessage(bytes, "utf8"),
  });
  return completeWalletSession(res);
}

async function walletSignInLocal(wallet) {
  const res = await signInWithLocalWallet(client, { address: wallet.address, secretHex: wallet.secret });
  return completeWalletSession(res);
}

// ------------------------------------------- Phantom universal links
//
// Door 2 orchestration (transport + storage live in
// kiln-phantom-ul.js). Starting a UL action navigates away to the
// Phantom app; processUlReturn finishes it when Phantom redirects
// back. Chained states ride the pending record: connect first, then
// the challenge + signMessage trip, then verify/link here.

const UL_SIGNUP_ADDR_KEY = "kiln.ul.signup-address.v1";

function ulReturnUrl() {
  return `${location.origin}${location.pathname}`;
}

async function startUlSignIn() {
  const s = ulSession();
  if (!s) {
    setUlPending({ action: "signin-connect" });
    location.href = await ulConnectUrl(ulReturnUrl());
    return;
  }
  const ch = await client.walletChallenge({ address: s.pubkey });
  setUlPending({ action: "signin-sign", challengeId: ch.challengeId, address: s.pubkey });
  location.href = await ulSignMessageUrl(ulReturnUrl(), utf8Bytes(ch.message));
}

async function startUlLink() {
  const s = ulSession();
  if (!s) {
    setUlPending({ action: "link-connect" });
    location.href = await ulConnectUrl(ulReturnUrl());
    return;
  }
  const ch = await client.challenge(s.pubkey);
  setUlPending({ action: "link-sign", challengeId: ch.challengeId, address: s.pubkey });
  location.href = await ulSignMessageUrl(ulReturnUrl(), utf8Bytes(ch.message));
}

async function startUlSignupConnect() {
  setUlPending({ action: "signup-connect" });
  location.href = await ulConnectUrl(ulReturnUrl());
}

let ulReturnRunning = false;
export async function processUlReturn() {
  if (ulReturnRunning) return;
  let search = "";
  try {
    search = location.search || "";
  } catch {
    return;
  }
  if (!hasUlReturn(search)) return;
  ulReturnRunning = true;
  let pending = null;
  try {
    pending = peekUlPending();
    const parsed = await parseUlReturn(search);
    cleanUlReturnFromUrl();
    if (!parsed) return;
    if (parsed.kind === "error" || parsed.kind === "orphan") {
      takeUlPending();
      setUlStatus({ kind: "error", text: parsed.message });
      emit();
      return;
    }
    if (parsed.kind === "connect") {
      if (pending?.action === "signup-connect") {
        takeUlPending();
        try {
          localStorage.setItem(UL_SIGNUP_ADDR_KEY, parsed.address);
        } catch {}
        setUlStatus({
          kind: "note",
          text: `Phantom connected by app link: ${parsed.address} — finish creating your account below and this wallet links to it.`,
        });
        emit();
        return;
      }
      if (pending?.action === "link-connect") {
        const ch = await client.challenge(parsed.address);
        setUlPending({ action: "link-sign", challengeId: ch.challengeId, address: parsed.address });
        location.href = await ulSignMessageUrl(ulReturnUrl(), utf8Bytes(ch.message));
        return;
      }
      // signin-connect (and any bare connect): chain into the sign trip.
      const ch = await client.walletChallenge({ address: parsed.address });
      setUlPending({ action: "signin-sign", challengeId: ch.challengeId, address: parsed.address });
      location.href = await ulSignMessageUrl(ulReturnUrl(), utf8Bytes(ch.message));
      return;
    }
    if (parsed.kind === "sign") {
      takeUlPending();
      if (!pending || (pending.action !== "signin-sign" && pending.action !== "link-sign")) {
        setUlStatus({
          kind: "error",
          text: "Phantom returned a signature, but this browser has no sign-in or link in flight to finish — the trip that left isn't the one that came back. Start again from the wallet door.",
        });
        emit();
        return;
      }
      if (pending.action === "link-sign") {
        const pub = base58Decode(pending.address);
        if (!pub || pub.length !== 32) throw new Error("The app-link address isn't a Solana public key");
        await client.linkWallet({
          address: pending.address,
          kind: "phantom",
          publicKeyHex: bytesToHex(pub),
          challengeId: pending.challengeId,
          signatureHex: bytesToHex(parsed.signature),
        });
        await refreshIdentity();
        setUlStatus({ kind: "note", text: "Phantom linked by app link — it can sign in to this account from now on." });
        emit();
        return;
      }
      const res = await signInWithPhantomSignature(client, {
        address: pending.address,
        challenge: { challengeId: pending.challengeId },
        signatureBytes: parsed.signature,
      });
      await completeWalletSession(res);
      setUlStatus({ kind: "note", text: "Signed in with Phantom — your account and linked wallets are restored on this browser." });
      emit();
    }
  } catch (e) {
    takeUlPending();
    if (isNotYetActive(e)) {
      setUlStatus({
        kind: "error",
        text: "Wallet sign-in switches on with the next daemon update — the running forge doesn't answer that door yet. Sign in with your password; it opens the same account.",
      });
    } else if (e instanceof IdentityApiError && e.reason === "wallet_not_linked") {
      setUlStatus({ kind: "unlinked", text: "", address: pending?.address || "" });
    } else {
      setUlStatus({ kind: "error", text: e instanceof Error ? e.message : "Phantom app-link sign-in failed" });
    }
    emit();
  } finally {
    ulReturnRunning = false;
  }
}

// ------------------------------------------------- backup offer (on generate)

function offeredAddresses() {
  try {
    return new Set(JSON.parse(localStorage.getItem(OFFERED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function markOffered(address) {
  try {
    const set = offeredAddresses();
    set.add(address);
    localStorage.setItem(OFFERED_KEY, JSON.stringify([...set]));
  } catch {}
}

function onWalletArrived(wallet) {
  if (suppressOffer) return;
  if (!wallet?.address || !wallet?.secret) return;
  const linkedLocal = (meCache?.wallets || []).find((w) => w.kind === "local");
  if (meCache?.hasWalletBackup && linkedLocal?.address === wallet.address) return; // already protected
  showBackupOffer(wallet);
}

function showBackupOffer(wallet) {
  try {
    if (document.getElementById("kiln-backup-offer")) return;
    const card = document.createElement("div");
    card.id = "kiln-backup-offer";
    card.setAttribute("style", "position:fixed;right:1rem;bottom:1rem;z-index:60;width:min(92vw,22rem)");
    card.className = "rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-panel)]";
    const title = document.createElement("h3");
    title.className = "font-display text-lg tracking-tight";
    title.textContent = "Back up this wallet";
    const body = document.createElement("p");
    body.className = "mt-1 text-sm text-muted";
    const close = () => {
      markOffered(wallet.address);
      card.remove();
    };
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "btn min-h-11 flex-1";
    dismiss.textContent = "Not now";
    dismiss.addEventListener("click", close);
    card.append(title, body);
    if (session) {
      body.textContent =
        "This browser holds your wallet key. Encrypt a backup with a password and store it on your Kiln account — sign in on any browser and the same wallet restores. The key and the password never leave this browser; the forge stores only ciphertext.";
      const pw = document.createElement("input");
      pw.type = "password";
      pw.className = "input mt-3";
      pw.placeholder = "Backup password (8+ characters)";
      pw.autocomplete = "new-password";
      const status = document.createElement("p");
      status.className = "mt-2 text-sm";
      const go = document.createElement("button");
      go.type = "button";
      go.className = "btn-primary btn min-h-11 flex-1";
      go.textContent = "Encrypt & back up";
      go.addEventListener("click", async () => {
        go.disabled = true;
        status.textContent = "Working…";
        status.className = "mt-2 text-sm text-muted";
        try {
          if (walletSurface === false) {
            status.textContent = "Wallet linking and backup switch on with the daemon's account-wallet surface — your account is ready for them, and this wallet stays in this browser until then.";
            status.className = "mt-2 text-sm text-muted";
            go.disabled = false;
            return;
          }
          const linked = (meCache?.wallets || []).some((w) => w.address === wallet.address);
          if (!linked) {
            await linkLocalWallet(client, { address: wallet.address, secretHex: wallet.secret });
          }
          const { blob, kdf } = await encryptSecretBackup(wallet.secret, pw.value);
          await client.putBackup({ blob, kdf });
          await refreshIdentity();
          status.textContent = "Backup stored. This wallet now restores on any browser you sign in to.";
          status.className = "mt-2 text-sm text-seal";
          setTimeout(close, 4000);
        } catch (e) {
          status.textContent = e instanceof Error ? e.message : "Backup failed";
          status.className = "mt-2 text-sm text-red-500";
          go.disabled = false;
        }
      });
      const row = document.createElement("div");
      row.className = "mt-3 flex gap-2";
      row.append(go, dismiss);
      card.append(pw, row, status);
    } else {
      body.textContent =
        "This browser holds your wallet key — and only this browser. Create a Kiln account and you can store an encrypted backup, so signing in on another browser restores this same wallet instead of generating a new one.";
      const go = document.createElement("a");
      go.href = "/account";
      go.className = "btn-primary btn min-h-11 flex-1";
      go.textContent = "Create a Kiln account";
      const row = document.createElement("div");
      row.className = "mt-3 flex gap-2";
      row.append(go, dismiss);
      card.append(row);
    }
    document.body.appendChild(card);
  } catch {}
}

// ------------------------------------------------------------- arming

let armed = false;
export function armIdentity() {
  if (armed) return;
  armed = true;
  try {
    if (session) void refreshIdentity();
  } catch {}
  try {
    void processUlReturn();
  } catch {}
  try {
    const st = store.getState();
    if (typeof st.connect === "function" && !st.connect.__kilnIdentityWrapped) {
      const orig = st.connect;
      const wrapped = async (handle, secret) => {
        const before = store.getState().wallet?.secret || null;
        const wallet = await orig.call(store.getState(), handle, secret);
        try {
          const after = store.getState().wallet;
          if (after?.secret && after.secret !== before) onWalletArrived(after);
        } catch {}
        return wallet;
      };
      wrapped.__kilnIdentityWrapped = true;
      store.setState({ connect: wrapped });
    }
  } catch {}
}

try {
  armIdentity();
} catch {}

globalThis.__KILN_IDENTITY = {
  getSnapshot: getIdentitySnapshot,
  refresh: refreshIdentity,
  signOut,
  processUlReturn,
};

// ------------------------------------------------------------- the panel

function shortAddr(a) {
  const s = String(a || "");
  return s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s;
}

function field(label, input) {
  return j.jsxs("label", {
    className: "block text-xs uppercase tracking-[0.14em] text-muted",
    children: [label, input],
  });
}
function textInput(props) {
  return j.jsx("input", { className: "input mt-1.5", ...props });
}

export function KilnIdentityPanel() {
  const [, setTick] = R.useState(0);
  const [busy, setBusy] = R.useState(false);
  const [err, setErr] = R.useState("");
  const [note, setNote] = R.useState("");
  // sign-in form
  const [email, setEmail] = R.useState("");
  const [password, setPassword] = R.useState("");
  // signup form (wallet-first)
  const [suEmail, setSuEmail] = R.useState("");
  const [suName, setSuName] = R.useState("");
  const [suOwner, setSuOwner] = R.useState("");
  const [suPassword, setSuPassword] = R.useState("");
  const [suTwitter, setSuTwitter] = R.useState("");
  const [pendingPhantom, setPendingPhantom] = R.useState("");
  // restore / backup
  const [restorePw, setRestorePw] = R.useState("");
  const [backupPw, setBackupPw] = R.useState("");
  const [importSecret, setImportSecret] = R.useState("");
  // wallet sign-in doors
  const [walletDoorOff, setWalletDoorOff] = R.useState(false);
  const [unlinkedAddr, setUnlinkedAddr] = R.useState("");

  const wallet = store((s) => s.wallet);

  R.useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    void refreshIdentity();
    // Finish a Phantom universal-link trip that landed on this page,
    // then surface its one-shot outcome (never silent, R27 lesson b).
    void (async () => {
      try {
        await processUlReturn();
      } catch {}
      const st = takeUlStatus();
      if (st) {
        if (st.kind === "error") setErr(st.text);
        else if (st.kind === "note") setNote(st.text);
        else if (st.kind === "unlinked") setUnlinkedAddr(st.address || "that wallet");
      }
      try {
        const addr = localStorage.getItem(UL_SIGNUP_ADDR_KEY);
        if (addr) {
          localStorage.removeItem(UL_SIGNUP_ADDR_KEY);
          setPendingPhantom(addr);
        }
      } catch {}
    })();
    return () => listeners.delete(fn);
  }, []);

  const snap = getIdentitySnapshot();
  const me = snap.me;
  const acct = me?.account || snap.session?.account || null;
  const wallets = me?.wallets || [];
  const linkedLocal = wallets.find((w) => w.kind === "local") || null;
  const localLinked = !!(wallet && wallets.some((w) => w.address === wallet.address));
  const restoreCandidate = !!(linkedLocal && linkedLocal.hasBackup && (!wallet || wallet.address !== linkedLocal.address));
  const surfaceOff = snap.walletSurface === false;
  const hasProvider = !!phantomProvider();
  const ulSess = ulSession();

  const run = async (fn, okText) => {
    setBusy(true);
    setErr("");
    setNote("");
    try {
      await fn();
      if (okText) setNote(okText);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something failed");
    } finally {
      setBusy(false);
    }
  };

  const doSignIn = () =>
    run(async () => {
      await signIn(email.trim(), password);
    }, "Signed in — your account and linked wallets are restored on this browser.");

  // Wallet-door failures share one translation: a staged daemon turns
  // the door "activating" (honest, steered to password); a validly
  // signed but unlinked wallet opens the link-it guidance; anything
  // else is the daemon's own words.
  const walletDoorFail = (e, address) => {
    if (isNotYetActive(e)) {
      setWalletDoorOff(true);
      setNote("Wallet sign-in switches on with the next daemon update. Sign in with your password — it opens the same account.");
      return;
    }
    if (e instanceof IdentityApiError && e.reason === "wallet_not_linked") {
      setUnlinkedAddr(address || "that wallet");
      return;
    }
    setErr(e instanceof Error ? e.message : "Wallet sign-in failed");
  };

  const doWalletSignInPhantom = () =>
    (async () => {
      setBusy(true);
      setErr("");
      setNote("");
      setUnlinkedAddr("");
      let addr = "";
      try {
        addr = await connectPhantom();
        const res = await signInWithPhantomWallet(client, {
          address: addr,
          signMessage: (bytes) => phantomProvider().signMessage(bytes, "utf8"),
        });
        await completeWalletSession(res);
        setNote("Signed in with Phantom — your account and linked wallets are restored on this browser.");
      } catch (e) {
        walletDoorFail(e, addr);
      } finally {
        setBusy(false);
      }
    })();

  const doWalletSignInLocal = () =>
    (async () => {
      setBusy(true);
      setErr("");
      setNote("");
      setUnlinkedAddr("");
      try {
        if (!wallet) throw new Error("No wallet in this browser yet");
        await walletSignInLocal(wallet);
        setNote("Signed in with this device's wallet — your account and linked wallets are restored.");
      } catch (e) {
        walletDoorFail(e, wallet?.address || "");
      } finally {
        setBusy(false);
      }
    })();

  const doUlSignIn = () =>
    (async () => {
      setBusy(true);
      setErr("");
      setNote("");
      setUnlinkedAddr("");
      try {
        await startUlSignIn();
        setNote("Opening Phantom… approve the sign-in there and you'll land back here, signed in.");
      } catch (e) {
        walletDoorFail(e, ulSession()?.pubkey || "");
        setBusy(false);
      }
    })();

  const doUlLink = () =>
    (async () => {
      setBusy(true);
      setErr("");
      setNote("");
      try {
        await startUlLink();
        setNote("Opening Phantom… approve the link signature there and you'll land back here.");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Phantom app-link link failed");
        setBusy(false);
      }
    })();

  const doGenerateForSignup = () =>
    run(async () => {
      const handle = (suOwner || suEmail.split("@")[0] || "member").trim();
      await store.getState().connect(handle);
    }, "Wallet generated in this browser. Create the account to link and back it up.");

  const doConnectPhantomForSignup = () =>
    run(async () => {
      const addr = await connectPhantom();
      setPendingPhantom(addr);
    });

  const doSignup = () =>
    run(async () => {
      const owner = suOwner.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(owner)) throw new Error("Pick a handle: lowercase letters, numbers and dashes, up to 64 characters");
      if (suPassword.length < 10) throw new Error("The forge requires a password of at least 10 characters");
      await client.signup({ email: suEmail.trim(), name: suName.trim() || owner, owner, password: suPassword });
      await signIn(suEmail.trim(), suPassword);
      // Wallet-first follow-through: link what step 1 set up.
      const st = store.getState();
      if (st.wallet && snap.walletSurface !== false) {
        try {
          await linkLocalWallet(client, { address: st.wallet.address, secretHex: st.wallet.secret });
        } catch {}
      }
      if (pendingPhantom && snap.walletSurface !== false) {
        try {
          await linkPhantom(pendingPhantom);
        } catch {}
      }
      if (suTwitter.trim()) {
        try {
          store.getState().upsertProfile({ handle: owner, twitter: suTwitter.trim().replace(/^@+/, "") });
        } catch {}
      }
      await refreshIdentity();
    }, "Account created. Your wallet is linked; add an encrypted backup below so it restores anywhere.");

  const doRestore = () =>
    run(async () => {
      const res = await client.getBackup();
      if (!res?.backup) throw new Error("No encrypted backup is stored on this account");
      const secret = await decryptSecretBackup(res.backup.blob, res.backup.kdf, restorePw);
      suppressOffer = true;
      try {
        await store.getState().connect(acct?.owner, secret);
      } finally {
        suppressOffer = false;
      }
      setRestorePw("");
    }, "Wallet restored on this browser — same address, same key.");

  const doBackup = () =>
    run(async () => {
      const st = store.getState();
      if (!st.wallet) throw new Error("No wallet in this browser to back up");
      if (!localLinked && walletSurface !== false) {
        await linkLocalWallet(client, { address: st.wallet.address, secretHex: st.wallet.secret });
      }
      const { blob, kdf } = await encryptSecretBackup(st.wallet.secret, backupPw);
      await client.putBackup({ blob, kdf });
      setBackupPw("");
      await refreshIdentity();
    }, "Encrypted backup stored. Only your password opens it.");

  const doImport = () =>
    run(async () => {
      const s = importSecret.trim();
      if (s.replace(/^0x/i, "").length < 16) throw new Error("That secret is too short — the wallet secret is 64 hex characters");
      suppressOffer = true;
      try {
        await store.getState().connect(acct?.owner, s);
      } finally {
        suppressOffer = false;
      }
      setImportSecret("");
    }, "Wallet installed on this browser from its secret.");

  const section = (title, children, sub, eyebrow) =>
    j.jsxs("section", {
      className: "mt-6 rounded-xl border border-border bg-surface p-5",
      children: [
        j.jsx("p", { className: "text-[10px] uppercase tracking-[0.16em] text-muted", children: eyebrow || "Kiln account" }),
        j.jsx("h2", { className: "mt-1 font-display text-2xl tracking-tight", children: title }),
        sub ? j.jsx("p", { className: "mt-2 text-sm leading-relaxed text-muted", children: sub }) : null,
        ...children,
      ],
    });

  const children = [];

  // Composed identity header: when signed in, the account itself is the
  // header — avatar initials, handle, email, and the real wallet/backup
  // state as chips — with Sign out on the same handler the old "Signed in"
  // section carried. Signed out it stays the plain explainer.
  const headerChips = [];
  if (acct && me) {
    headerChips.push(
      j.jsx("span", { key: "w", className: "chip", children: wallets.length === 1 ? "1 linked wallet" : `${wallets.length} linked wallets` }),
      me.hasWalletBackup
        ? j.jsx("span", { key: "b", className: "chip text-seal", children: "Backup on file" })
        : j.jsx("span", { key: "b", className: "chip", children: "No backup yet" }),
    );
    if (wallet && localLinked) headerChips.push(j.jsx("span", { key: "l", className: "chip text-seal", children: "This browser's wallet is linked" }));
    else if (wallet) headerChips.push(j.jsx("span", { key: "l", className: "chip", children: "Wallet in this browser — not linked" }));
    else if (restoreCandidate) headerChips.push(j.jsx("span", { key: "l", className: "chip", children: "Wallet ready to restore below" }));
  }
  children.push(
    j.jsxs("div", {
      className: "mt-10",
      children: [
        j.jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-muted", children: "Identity & wallets" }),
        j.jsx("h2", { className: "mt-1 font-display text-3xl tracking-tight", children: "Your Kiln account" }),
        j.jsx("p", {
          className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
          children:
            "Your wallet key lives in this browser. A Kiln account ties it to you: link wallets by signature, store an encrypted backup, and signing in on any browser restores the same wallet — no new key, no new account.",
        }),
        acct
          ? j.jsxs("div", {
              className: "mt-4 flex flex-wrap items-center gap-3",
              children: [
                j.jsx("div", {
                  className: "flex size-10 items-center justify-center rounded-xl border border-border bg-surface font-display text-lg font-semibold",
                  children: (acct.name || acct.owner || "?").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w.slice(0, 1).toUpperCase()).join("") || "?",
                }),
                j.jsxs("div", {
                  className: "min-w-0",
                  children: [
                    j.jsx("p", { className: "font-mono text-sm text-seal", children: acct.owner }),
                    acct.email ? j.jsx("p", { className: "truncate text-xs text-muted", children: acct.email }) : null,
                  ],
                }),
                headerChips.length ? j.jsx("div", { className: "flex flex-wrap gap-2", children: headerChips }) : null,
                j.jsx("span", { className: "flex-1" }),
                j.jsx("button", {
                  type: "button",
                  className: "btn min-h-11",
                  disabled: busy,
                  onClick: () => void run(async () => signOut(), "Signed out on this browser."),
                  children: "Sign out",
                }),
              ],
            })
          : null,
      ],
    }),
  );

  if (snap.walletSurface === false) {
    children.push(
      j.jsx("p", {
        className: "mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted",
        children:
          "Wallet linking and the encrypted backup are built into this page and switch on with the daemon's account-wallet surface. Forge account sign-in below already works; the wallet sections will light up as soon as the daemon answers them.",
      }),
    );
  }

  if (err) children.push(j.jsx("p", { className: "mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-red-500", children: err }));
  if (note) children.push(j.jsx("p", { className: "mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-seal", children: note }));

  if (!snap.session) {
    // ---- sign in
    children.push(
      section(
        "Sign in",
        [
          j.jsx("form", {
            className: "mt-4 grid gap-3",
            onSubmit: (e) => {
              e.preventDefault();
              void doSignIn();
            },
            children: [
              field("Email", textInput({ type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true })),
              field("Password", textInput({ type: "password", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), required: true })),
              j.jsx("button", { type: "submit", className: "btn-primary btn min-h-11", disabled: busy, children: busy ? "Working…" : "Sign in & restore my wallet" }),
            ],
          }),
        ],
        "Sign in with your forge account. Your profile and linked wallets load here, and a backed-up wallet can be restored onto this browser.",
        "Account",
      ),
    );
    // ---- sign in with a wallet: the same account, another door
    children.push(
      section(
        "Sign in with a wallet",
        [
          walletDoorOff
            ? j.jsx("p", {
                className: "mt-3 text-sm leading-relaxed text-muted",
                children:
                  "This door is built and wired, and it switches on with the next daemon update — the running forge doesn't answer wallet sign-in yet. Sign in with your password above; it opens the same account, and every wallet linked to it will sign in here once the update lands.",
              })
            : null,
          unlinkedAddr
            ? j.jsxs("div", {
                className: "mt-3 rounded-lg border border-border bg-bg p-4",
                children: [
                  j.jsx("p", {
                    className: "text-sm leading-relaxed",
                    children: `Wallet ${shortAddr(unlinkedAddr)} signed the challenge — and it isn't linked to an account yet, so there is no account for it to open. Two ways in:`,
                  }),
                  j.jsx("p", {
                    className: "mt-2 text-sm leading-relaxed text-muted",
                    children:
                      "Sign in with your password above, once — then link this wallet under Sign-in & wallets, and it signs in by itself from then on. Or create the account with this wallet in the form below.",
                  }),
                  j.jsx("button", {
                    type: "button",
                    className: "btn mt-3 min-h-11",
                    disabled: busy,
                    onClick: () => {
                      setPendingPhantom(unlinkedAddr.startsWith("0x") ? "" : unlinkedAddr);
                      setNote(
                        unlinkedAddr.startsWith("0x")
                          ? "That is this device's wallet — generate or restore it in step 1 of the create form below, then create the account and it links."
                          : "Phantom is set as the new account's wallet in the create form below — finish it and the wallet is linked from the start.",
                      );
                    },
                    children: "Create the account with this wallet",
                  }),
                ],
              })
            : null,
          j.jsxs("div", {
            className: "mt-4 flex flex-col gap-2 sm:flex-row",
            children: [
              hasProvider
                ? j.jsx("button", {
                    type: "button",
                    className: "btn-primary btn flex-1 min-h-11",
                    disabled: busy || walletDoorOff,
                    onClick: () => void doWalletSignInPhantom(),
                    children: "Sign in with Phantom",
                  })
                : j.jsx("a", {
                    href: openInPhantomAppUrl(location.href, location.origin),
                    className: "btn-primary btn flex-1 min-h-11",
                    children: "Open in Phantom app",
                  }),
              wallet
                ? j.jsx("button", {
                    type: "button",
                    className: "btn flex-1 min-h-11",
                    disabled: busy || walletDoorOff,
                    onClick: () => void doWalletSignInLocal(),
                    children: `Sign in with this device's wallet (${shortAddr(wallet.address)})`,
                  })
                : null,
            ],
          }),
          !hasProvider
            ? j.jsxs("div", {
                className: "mt-2 flex flex-col gap-2",
                children: [
                  j.jsx("p", {
                    className: "text-xs leading-relaxed text-muted",
                    children:
                      "This browser has no Phantom provider — on a phone that's normal: the provider lives inside Phantom's own browser. Door 1 opens this page there and the session lives in that browser. Door 2 signs through the Phantom app by universal link and lands back here:",
                  }),
                  j.jsx("button", {
                    type: "button",
                    className: "btn min-h-11",
                    disabled: busy || walletDoorOff,
                    onClick: () => void doUlSignIn(),
                    children: ulSess ? `Sign in via Phantom app link (${shortAddr(ulSess.pubkey)})` : "Sign in via Phantom app link",
                  }),
                ],
              })
            : ulSess
              ? j.jsx("button", {
                  type: "button",
                  className: "btn mt-2 min-h-11",
                  disabled: busy || walletDoorOff,
                  onClick: () => void doUlSignIn(),
                  children: `Sign in via Phantom app link (${shortAddr(ulSess.pubkey)})`,
                })
              : null,
          !wallet && !hasProvider
            ? null
            : !wallet
              ? j.jsx("p", {
                  className: "mt-2 text-xs leading-relaxed text-muted",
                  children: "No wallet key in this browser yet — the device-wallet door appears once one is generated or restored here.",
                })
              : null,
          ulSess
            ? j.jsxs("p", {
                className: "mt-3 flex flex-wrap items-center gap-2 text-xs text-muted",
                children: [
                  j.jsx("span", { className: "chip text-seal", children: `App link connected · ${shortAddr(ulSess.pubkey)}` }),
                  j.jsx("button", {
                    type: "button",
                    className: "btn h-8 px-3",
                    onClick: () => {
                      clearUlSession();
                      setTick((t) => t + 1);
                    },
                    children: "Disconnect app link",
                  }),
                ],
              })
            : null,
        ],
        "Every door opens the same account. A wallet signs a one-time challenge and the forge answers with the account that wallet is linked to — no separate wallet account, no new identity.",
        "Wallet door",
      ),
    );
    // ---- create account, wallet first
    children.push(
      section(
        "Create your account — wallet first",
        [
          j.jsxs("div", {
            className: "mt-4 rounded-lg border border-border bg-bg p-4",
            children: [
              j.jsx("p", { className: "text-xs uppercase tracking-[0.14em] text-muted", children: "Step 1 · Your wallet" }),
              wallet
                ? j.jsx("p", {
                    className: "mt-2 font-mono text-sm",
                    children: `This browser's wallet: ${shortAddr(wallet.address)} (${wallet.handle})`,
                  })
                : j.jsxs("div", {
                    className: "mt-2 flex flex-col gap-2 sm:flex-row",
                    children: [
                      j.jsx("button", { type: "button", className: "btn flex-1 min-h-11", disabled: busy, onClick: () => void doGenerateForSignup(), children: "Generate wallet" }),
                      hasProvider
                        ? j.jsx("button", {
                            type: "button",
                            className: "btn flex-1 min-h-11",
                            disabled: busy,
                            onClick: () => void doConnectPhantomForSignup(),
                            children: pendingPhantom ? `Phantom: ${shortAddr(pendingPhantom)}` : "Connect Phantom",
                          })
                        : j.jsx("a", {
                            href: openInPhantomAppUrl(location.href, location.origin),
                            className: "btn flex-1 min-h-11",
                            children: pendingPhantom ? `Phantom: ${shortAddr(pendingPhantom)}` : "Open in Phantom app",
                          }),
                      !hasProvider && !pendingPhantom
                        ? j.jsx("button", {
                            type: "button",
                            className: "btn flex-1 min-h-11",
                            disabled: busy,
                            onClick: () => {
                              if (ulSess) {
                                setPendingPhantom(ulSess.pubkey);
                                return;
                              }
                              void (async () => {
                                setBusy(true);
                                setErr("");
                                try {
                                  await startUlSignupConnect();
                                } catch (e) {
                                  setErr(e instanceof Error ? e.message : "Phantom app-link connect failed");
                                  setBusy(false);
                                }
                              })();
                            },
                            children: ulSess ? `App-link Phantom: ${shortAddr(ulSess.pubkey)}` : "Connect Phantom via app link",
                          })
                        : null,
                    ],
                  }),
              pendingPhantom && wallet
                ? j.jsx("p", { className: "mt-2 font-mono text-sm", children: `Phantom: ${shortAddr(pendingPhantom)} — linked as a second wallet when the account is created.` })
                : null,
            ],
          }),
          j.jsx("form", {
            className: "mt-4 grid gap-3 sm:grid-cols-2",
            onSubmit: (e) => {
              e.preventDefault();
              void doSignup();
            },
            children: [
              field("Email", textInput({ type: "email", autoComplete: "email", value: suEmail, onChange: (e) => setSuEmail(e.target.value), required: true })),
              field("Name", textInput({ value: suName, onChange: (e) => setSuName(e.target.value), placeholder: "Your name or lab" })),
              field("Handle", textInput({ value: suOwner, onChange: (e) => setSuOwner(e.target.value.toLowerCase()), placeholder: "itsnotailabs", required: true })),
              field("Password (10+ characters)", textInput({ type: "password", autoComplete: "new-password", value: suPassword, onChange: (e) => setSuPassword(e.target.value), required: true })),
              field("X / Twitter handle (optional)", textInput({ value: suTwitter, onChange: (e) => setSuTwitter(e.target.value), placeholder: "handle" })),
              j.jsx("button", { type: "submit", className: "btn-primary btn min-h-11 sm:col-span-2", disabled: busy, children: busy ? "Working…" : "Create account" }),
            ],
          }),
          j.jsx("p", {
            className: "mt-3 text-xs leading-relaxed text-muted",
            children: "Everything else — website, bio, location — links later in your profile settings, above. Your X handle is shown on your public profile.",
          }),
        ],
        "Step 2 is the account. The wallet from step 1 links to it by signature — it becomes your identity on every browser, not just this one.",
        "New here",
      ),
    );
  } else {
    // ---- signed in: the account summary lives in the composed header
    // above (avatar, handle, email, wallet/backup chips, Sign out) — no
    // separate "Signed in" section anymore.

    // ---- restore
    if (restoreCandidate) {
      children.push(
        section(
          "Restore your wallet on this browser",
          [
            j.jsx("p", {
              className: "mt-2 text-sm text-muted",
              children: `Wallet ${shortAddr(linkedLocal.address)} is linked to this account and has an encrypted backup. Enter your backup password to install the same key here — no new wallet, no new account.`,
            }),
            j.jsx("form", {
              className: "mt-3 flex flex-col gap-2 sm:flex-row",
              onSubmit: (e) => {
                e.preventDefault();
                void doRestore();
              },
              children: [
                textInput({ type: "password", autoComplete: "off", placeholder: "Backup password", value: restorePw, onChange: (e) => setRestorePw(e.target.value), required: true }),
                j.jsx("button", { type: "submit", className: "btn-primary btn min-h-11", disabled: busy, children: "Restore wallet" }),
              ],
            }),
          ],
          "",
          "Wallet recovery",
        ),
      );
    }

    // ---- sign-in & wallets: every door into this account, visible
    children.push(
      section(
        "Sign-in & wallets",
        [
          j.jsxs("div", {
            className: "mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm",
            children: [
              j.jsx("span", { className: "font-medium", children: "Password" }),
              acct?.email ? j.jsx("span", { className: "text-muted", children: acct.email }) : null,
              acct?.kind === "agent"
                ? j.jsx("span", { className: "chip", children: "Not set — agent account: its token and its linked wallets are its doors" })
                : j.jsx("span", { className: "chip text-seal", children: "Set — signs in" }),
            ],
          }),
          wallets.length
            ? j.jsx("ul", {
                className: "mt-3 divide-y divide-border rounded-lg border border-border",
                children: wallets.map((w) =>
                  j.jsxs(
                    "li",
                    {
                      className: "flex flex-wrap items-center gap-2 px-3 py-3 text-sm",
                      children: [
                        j.jsx("span", { className: "font-mono", title: w.address, children: shortAddr(w.address) }),
                        j.jsx("span", { className: "chip", children: w.kind === "phantom" ? "Phantom" : "This app's key" }),
                        j.jsx("span", { className: "chip text-seal", children: "Can sign in" }),
                        w.hasBackup ? j.jsx("span", { className: "chip text-seal", children: "Backup on file" }) : null,
                        wallet && wallet.address === w.address ? j.jsx("span", { className: "chip", children: "In this browser" }) : null,
                        j.jsx("span", { className: "flex-1" }),
                        j.jsx("button", {
                          type: "button",
                          className: "btn min-h-11 px-3",
                          disabled: busy || surfaceOff,
                          onClick: () =>
                            void run(async () => {
                              await client.unlinkWallet(w.address);
                              await refreshIdentity();
                            }, "Wallet unlinked — the address is free to link elsewhere."),
                          children: "Unlink",
                        }),
                      ],
                    },
                    w.address,
                  ),
                ),
              })
            : j.jsx("p", { className: "mt-3 text-sm text-muted", children: "No wallets linked yet. Link this browser's wallet or your Phantom — linking is a signature, so only the key holder can do it." }),
          j.jsxs("div", {
            className: "mt-3 flex flex-col gap-2 sm:flex-row",
            children: [
              wallet && !localLinked
                ? j.jsx("button", {
                    type: "button",
                    className: "btn flex-1 min-h-11",
                    disabled: busy || surfaceOff,
                    onClick: () =>
                      void run(async () => {
                        await linkLocalWallet(client, { address: wallet.address, secretHex: wallet.secret });
                        await refreshIdentity();
                      }, "This browser's wallet is linked to your account."),
                    children: `Link this browser's wallet (${shortAddr(wallet.address)})`,
                  })
                : null,
              hasProvider
                ? j.jsx("button", {
                    type: "button",
                    className: "btn flex-1 min-h-11",
                    disabled: busy || surfaceOff,
                    onClick: () =>
                      void run(async () => {
                        const addr = pendingPhantom || (await connectPhantom());
                        await linkPhantom(addr);
                        setPendingPhantom("");
                        await refreshIdentity();
                      }, "Phantom linked as a second wallet on this account."),
                    children: "Link Phantom",
                  })
                : j.jsx("a", {
                    href: openInPhantomAppUrl(location.href, location.origin),
                    className: "btn flex-1 min-h-11",
                    children: "Open in Phantom app to link",
                  }),
              !hasProvider
                ? j.jsx("button", {
                    type: "button",
                    className: "btn flex-1 min-h-11",
                    disabled: busy || surfaceOff,
                    onClick: () => void doUlLink(),
                    children: ulSess ? `Link Phantom via app link (${shortAddr(ulSess.pubkey)})` : "Link Phantom via app link",
                  })
                : null,
            ],
          }),
          ulSess
            ? j.jsxs("p", {
                className: "mt-3 flex flex-wrap items-center gap-2 text-xs text-muted",
                children: [
                  j.jsx("span", { className: "chip text-seal", children: `App link connected · ${shortAddr(ulSess.pubkey)}` }),
                  j.jsx("button", {
                    type: "button",
                    className: "btn h-8 px-3",
                    onClick: () => {
                      clearUlSession();
                      setTick((t) => t + 1);
                    },
                    children: "Disconnect app link",
                  }),
                ],
              })
            : null,
          j.jsx("p", {
            className: "mt-3 text-xs leading-relaxed text-muted",
            children: "An address links to exactly one account. If Phantom says the address belongs elsewhere, it is already linked to another Kiln account — unlink it there first.",
          }),
        ],
        "Every door into this one account, with its state. Wallets are proven by signature, not by assertion — Phantom signs a one-time challenge, this browser's key signs locally — and every linked wallet can also sign in, from the wallet door on the login page. On a phone with no Phantom provider, Open in Phantom app leads; the app-link door signs through Phantom and lands back here.",
        "Signature-linked",
      ),
    );

    // ---- backup management
    children.push(
      section(
        me?.hasWalletBackup ? "Encrypted backup — on file" : "Back up this browser's wallet",
        [
          wallet
            ? j.jsxs("form", {
                className: "mt-3 flex flex-col gap-2 sm:flex-row",
                onSubmit: (e) => {
                  e.preventDefault();
                  void doBackup();
                },
                children: [
                  textInput({ type: "password", autoComplete: "new-password", placeholder: "Backup password (8+ characters)", value: backupPw, onChange: (e) => setBackupPw(e.target.value), required: true }),
                  j.jsx("button", { type: "submit", className: "btn-primary btn min-h-11", disabled: busy || surfaceOff, children: me?.hasWalletBackup ? "Update backup" : "Encrypt & back up" }),
                ],
              })
            : j.jsx("p", { className: "mt-3 text-sm text-muted", children: "No wallet in this browser right now — restore yours above, or generate one from Connect." }),
        ],
        "The secret is encrypted here, with a key derived from your password. The forge stores only ciphertext and can never read your key — forget the password and the backup cannot be opened.",
        "Encrypted backup",
      ),
    );

    // ---- import fallback
    children.push(
      section(
        "Import a secret directly",
        [
          j.jsx("form", {
            className: "mt-3 flex flex-col gap-2 sm:flex-row",
            onSubmit: (e) => {
              e.preventDefault();
              void doImport();
            },
            children: [
              textInput({ className: "input mt-1.5 font-mono", placeholder: "64-char hex secret", value: importSecret, onChange: (e) => setImportSecret(e.target.value), required: true }),
              j.jsx("button", { type: "submit", className: "btn min-h-11", disabled: busy, children: "Import" }),
            ],
          }),
        ],
        "The fallback the Connect dialog uses: the raw 64-character hex secret installs the key on this browser directly. It is not a backup — anyone holding the secret holds the wallet.",
        "Advanced",
      ),
    );
  }

  return j.jsx("div", { className: "mx-auto w-full max-w-2xl text-left", children });
}
