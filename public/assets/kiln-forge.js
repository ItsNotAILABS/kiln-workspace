/**
 * Kiln operator boot.
 * Public browser code may describe the kiln account but must never contain an
 * operator signing/vault secret. Privileged operator sessions must arrive via
 * an authenticated wallet/session boundary.
 */
import { b as store, t as chainBlocks, p as chainTxs } from "./store-sx46DNi5.js";
import { T as sha256Hex } from "./fs-ri9Mkfbm.js";
import { constitution, remember, sealMachine } from "./machine-seal.js";

(function installKilnFetch() {
  const w = globalThis;
  const origFetch = w.fetch;
  if (typeof origFetch !== "function") return;
  w.fetch = async function kilnFetch(input, init) {
    const url = String(typeof input === "string" ? input : input && input.url ? input.url : "");
    if (url.includes("/_serverFn/")) {
      try {
        const res = await origFetch.call(this, input, init);
        if (res.ok) return res;
      } catch {}
      let q = "", owner = "", repo = "";
      try {
        const parsed = JSON.parse((init && init.body) || "{}");
        const data = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
        q = String(data.query || data.q || "");
        owner = String(data.owner || "");
        repo = String(data.repo || "").replace(/\.git$/i, "");
      } catch {}
      if (owner && repo) {
        const r = await origFetch.call(this, `/api/github/import?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
        const data = await r.json().catch(() => ({ ok: false }));
        return new Response(JSON.stringify({ result: data }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
      }
      if (q) {
        const r = await origFetch.call(this, `/api/github/lookup?q=${encodeURIComponent(q)}`);
        const data = await r.json().catch(() => ({ ok: false, items: [] }));
        return new Response(JSON.stringify({ result: data }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
      }
      return new Response(JSON.stringify({ result: null }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
    }
    if (/\/api\/github\/?(\?|$)/.test(url) && /[?&]q=/.test(url)) {
      const res = await origFetch.call(this, input, init);
      try {
        const data = await res.clone().json();
        if (!Array.isArray(data.items)) {
          const u = new URL(url, w.location.origin);
          const q = u.searchParams.get("q") || u.searchParams.get("query") || "";
          if (q) return origFetch.call(this, `/api/github/lookup?q=${encodeURIComponent(q)}`);
        }
      } catch {}
      return res;
    }
    return origFetch.call(this, input, init);
  };
})();

export const KILN_HANDLE = "kiln";
export const KILN_ADDRESS = "0xbb316d9499a18f9cd5e3691e25e04072308e3700";

let booting = null;

function dedupe(repos) {
  const seen = new Set();
  const out = [];
  for (const r of repos || []) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    const name = String(r.id).split("/")[1] || r.name;
    out.push({ ...r, name, owner: r.owner || String(r.id).split("/")[0] });
  }
  return out;
}

function mergeRepos(doc) {
  const s = store.getState();
  const incoming = (doc.repos || []).map((r) => ({ ...r, viewerGrant: true, encrypted: !!r.encrypted, owner: "kiln", name: String(r.id).split("/")[1] || r.name }));
  const byId = new Map();
  for (const r of s.userRepos || []) byId.set(r.id, r);
  for (const fresh of incoming) {
    const cur = byId.get(fresh.id);
    if (!cur) { byId.set(fresh.id, fresh); continue; }
    const paths = new Set((cur.files || []).map((f) => f.path));
    const files = [...(cur.files || [])];
    for (const f of fresh.files || []) if (!paths.has(f.path)) files.push(f);
    byId.set(fresh.id, { ...cur, ...fresh, files, name: fresh.name, description: cur.description || fresh.description, topics: (cur.topics && cur.topics.length ? cur.topics : fresh.topics) || [] });
  }
  const unlocked = { ...(s.unlocked || {}) };
  for (const r of byId.values()) unlocked[r.id] = true;
  const profile = { ...(s.profiles || {})[doc.account.handle], ...doc.account, address: s.wallet?.handle === "kiln" ? s.wallet.address : doc.account.address || KILN_ADDRESS, kind: "user" };
  store.setState({ userRepos: dedupe([...byId.values()]), profiles: { ...(s.profiles || {}), [doc.account.handle]: profile }, unlocked });
  globalThis.__KILN_FORGE_REPOS = incoming;
  globalThis.__KILN_FORGE_PROFILE = profile;
  globalThis.__KILN_FORGE__ = doc;
}

export async function ensureWallet() {
  const s = store.getState();
  if (s.wallet) return s.wallet;
  throw new Error("KILN operator wallet is not embedded in public browser code; authenticate/connect a wallet first.");
}

async function seatMachine(id) {
  const live = store.getState();
  const repo = (live.userRepos || []).find((r) => r.id === id);
  if (!repo) return;
  const sm = await sealMachine(repo);
  try { live.ensureDomain?.(id); } catch {}
  remember(id, "episodic", `sealed machine boot ${id}`, { path: "MACHINE.md" });
  remember(id, "procedural", `model ${sm.models.bound} · domain ${sm.domain.host}`, { path: "MACHINE.json" });
  if (live.wallet?.handle === "kiln") {
    const files = repo.files || [];
    if (!files.some((f) => f.path === "COMPUTER.md")) {
      await live.commitFile(id, "COMPUTER.md", `# Computer on ${id}\n\nls · cat · git · node · python · write · machine · model · memory · domain · ledger · seal\nThis tree is a kiln. Agents git-commit here.\n`, "seat computer");
    }
    if (!files.some((f) => f.path === "MACHINE.md")) {
      const md = await constitution(repo);
      await live.commitFile(id, "MACHINE.md", md, "seat sealed machine");
    }
  }
}

async function seatAgents(doc) {
  const origin = (doc.repos || []).map((r) => r.id);
  for (const id of origin.slice(0, 8)) {
    try {
      const st = store.getState();
      if (!st.agents.some((a) => a.repoId === id && a.role === "builder" && a.resident)) await store.getState().spawnAgent({ role: "builder", repoId: id, resident: true });
      if (!store.getState().agents.some((a) => a.repoId === id && a.role === "conductor" && a.resident)) await store.getState().spawnAgent({ role: "conductor", repoId: id, resident: true });
      await seatMachine(id);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Forge activity mirror: daemon-side commits as L1 transactions.
//
// The app's chain is local (seeded + extraTxs/extraBlocks in the store), so
// work that happens on the forge daemon never appears in it. At boot we pull
// the recent daemon commits from /api/kiln/forge-activity (serve-original
// reads them from the swarm daemon on this host) and settle one tx per real
// commit, built exactly the way the store's own builder builds them: same
// field order, same SHA-256 hash recipes for tx and block, one block per tx,
// heights continuing from the current chain head. Each mirrored tx carries
// forgeSha (the daemon commit sha) — that is the citation anyone can verify
// against the daemon, and the dedupe key: extraTxs persist across reloads,
// so a sha already in the ledger is never appended twice.
// ---------------------------------------------------------------------------
const L1_SETTLE_TO = "0x4c1e7a91b0c3d2e8f5a6478901234567890abcde"; // settle address the store's own actions (star/claim/import) write to

async function forgeTxHash(tx) {
  return `0x${(await sha256Hex(JSON.stringify(tx))).slice(0, 48)}`;
}

async function forgeBlockHash(block) {
  const line = `${block.height}:${block.parent}:${block.timestamp}:${block.txs.map((t) => t.hash).join(",")}`;
  return `0x${(await sha256Hex(line)).slice(0, 48)}`;
}

export async function mirrorForgeActivity() {
  try {
    const data = await fetch("/api/kiln/forge-activity", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    const acts = Array.isArray(data?.activities) ? data.activities : [];
    if (!acts.length) return 0;
    const s = store.getState();
    const seen = new Set((s.extraTxs || []).filter((t) => t && t.forgeSha).map((t) => t.forgeSha));
    const fresh = acts
      .filter((a) => a && a.sha && a.timestamp && !seen.has(a.sha))
      .sort((x, y) => (Date.parse(x.timestamp) || 0) - (Date.parse(y.timestamp) || 0));
    if (!fresh.length) return 0;
    const head = chainBlocks(store.getState())[0];
    let parent = head ? head.hash : "0x0";
    let height = head ? head.height : 0;
    const extraTxs = [...(s.extraTxs || [])];
    const extraBlocks = [...(s.extraBlocks || [])];
    for (const a of fresh) {
      height += 1;
      const repoId = `${a.owner}/${a.repo}`;
      const base = {
        type: "forge_commit",
        from: KILN_ADDRESS,
        to: L1_SETTLE_TO,
        amount: 0,
        memo: `${a.authorName} · ${repoId} — ${a.message}`,
        repoId,
        timestamp: a.timestamp,
        block: height,
        forgeSha: a.sha,
      };
      const tx = { ...base, hash: await forgeTxHash(base) };
      const blockBase = { height, parent, timestamp: a.timestamp, txs: [tx] };
      const block = { ...blockBase, hash: await forgeBlockHash(blockBase) };
      extraTxs.push(tx);
      extraBlocks.push(block);
      parent = block.hash;
    }
    store.setState({ extraTxs, extraBlocks });
    return fresh.length;
  } catch (e) {
    console.warn("kiln-forge activity mirror", e);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Wallet transfers: one settled L1 tx between two wallets in this account —
// the main wallet, an agent wallet, or a model wallet.
//
// The store's own tx builder (O) and settle (Y) are module-private, so this
// replicates their recipes exactly, the same way the forge mirror above
// replicates the hash recipes: tx base in O's field order, tx hash =
// sha256(JSON.stringify(base)), one block per tx built like oe (height /
// parent / timestamp + the block-hash line), heights continuing from the
// current chain head. Field balances (main balance, agent wallet.balance)
// move in the SAME setState as the ledger append, so a throw anywhere above
// leaves every balance untouched; model wallets carry no balance field — the
// settled tx alone moves their ledger-derived balance. The server copy is
// posted best-effort, exactly like Y posts it (failures swallowed).
// ---------------------------------------------------------------------------

function ledgerBalanceOf(state, address) {
  let balance = 0;
  for (const t of chainTxs(state) || []) {
    if (!t || (t.from !== address && t.to !== address)) continue;
    balance += t.to === address ? +(t.amount ?? 0) : -(t.amount ?? 0);
  }
  return balance;
}

function resolveWallet(state, address) {
  if (state.wallet && address === state.wallet.address) return { kind: "main", balance: state.balance ?? 0 };
  const agent = (state.agents || []).find((a) => a.wallet && a.wallet.address === address);
  if (agent) return { kind: "agent", agent, balance: agent.wallet.balance ?? 0 };
  const conn = (state.modelConnections || []).find((m) => m.walletAddress === address);
  if (conn) return { kind: "model", connection: conn, balance: ledgerBalanceOf(state, address) };
  return null;
}

export async function transferFunds({ fromAddress, toAddress, amount, memo } = {}) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount more than 0 KLN");
  if (!fromAddress || !toAddress || fromAddress === toAddress) throw new Error("Pick two different wallets");
  const s = store.getState();
  const from = resolveWallet(s, fromAddress);
  const to = resolveWallet(s, toAddress);
  if (!from || !to) throw new Error("Wallet not found in this account");
  if (from.balance < amt) throw new Error("Not enough KLN in this wallet");
  const head = chainBlocks(store.getState())[0];
  const height = head ? head.height + 1 : 1;
  const timestamp = new Date().toISOString();
  const base = { type: "transfer", from: fromAddress, to: toAddress, amount: amt, memo: memo || "Transfer", repoId: undefined, timestamp, block: height, merkleRoot: undefined };
  const tx = { ...base, hash: await forgeTxHash(base) };
  const blockBase = { height, parent: head ? head.hash : "0x0", timestamp, txs: [tx] };
  const block = { ...blockBase, hash: await forgeBlockHash(blockBase) };
  const st = store.getState();
  const patch = { extraTxs: [...(st.extraTxs || []), tx], extraBlocks: [...(st.extraBlocks || []), block] };
  if (from.kind === "main" || to.kind === "main") patch.balance = (st.balance ?? 0) + (to.kind === "main" ? amt : 0) - (from.kind === "main" ? amt : 0);
  if (from.kind === "agent" || to.kind === "agent") {
    patch.agents = (st.agents || []).map((a) => {
      if (!a.wallet) return a;
      let bal = a.wallet.balance ?? 0;
      if (from.kind === "agent" && a.id === from.agent.id) bal -= amt;
      if (to.kind === "agent" && a.id === to.agent.id) bal += amt;
      return bal === (a.wallet.balance ?? 0) ? a : { ...a, wallet: { ...a.wallet, balance: bal } };
    });
  }
  store.setState(patch);
  try {
    await fetch(`/api/kiln/l1`, { method: `POST`, headers: { "content-type": "application/json" }, body: JSON.stringify({ block, tx }) });
  } catch {}
  return tx;
}

export async function bootKilnAccount() {
  if (booting) return booting;
  booting = (async () => {
    try {
      const doc = await fetch("/kiln-account.json", { cache: "no-store" }).then((r) => r.json());
      if (!doc?.account) return null;
      mergeRepos(doc);
      const s = store.getState();
      if (s.wallet?.handle === "kiln") {
        store.getState().upsertProfile({ handle: "kiln", displayName: "KILN", bio: doc.account.bio, location: "on-chain", address: s.wallet.address || KILN_ADDRESS, kind: "user", lab: "KILN", website: "/", highlight: "Origin of the forge" });
      }
      await seatAgents(doc);
      await mirrorForgeActivity();
      return doc;
    } catch (e) {
      console.warn("kiln-forge boot", e);
      return null;
    } finally { booting = null; }
  })();
  return booting;
}

globalThis.__KILN_ENSURE_WALLET = ensureWallet;
globalThis.__KILN_BOOT = bootKilnAccount;
globalThis.__KILN_FORGE_ACTIVITY = mirrorForgeActivity;
globalThis.__KILN_TRANSFER = transferFunds;
globalThis.__KILN_ADDRESS = KILN_ADDRESS;

let wrappedImport = false;
function wrapImportGithub() {
  if (wrappedImport) return;
  const st = store.getState();
  const orig = st.importGithub;
  if (typeof orig !== "function") return;
  wrappedImport = true;
  const wrapped = async (n) => {
    let payload = n || {};
    const stNow = store.getState();
    if (stNow.wallet?.handle) payload = { ...payload, owner: stNow.wallet.handle };
    const files = payload.files || [];
    const ghOwner = payload.meta?.owner || n?.owner;
    const repo = payload.meta?.name || payload.meta?.repo || payload.repo;
    if (ghOwner && repo && files.length < 250) {
      try {
        const { githubImportTree } = await import("./github-import.js");
        const tree = await githubImportTree({ owner: ghOwner, repo });
        if (tree?.ok && (tree.files || []).length > files.length) payload = { ...payload, files: tree.files, meta: { ...(payload.meta || {}), ...(tree.meta || {}) } };
      } catch (e) { console.warn("kiln github fill", e); }
    }
    const landed = await orig.call(store.getState(), payload);
    try {
      if (landed?.id) {
        await fetch("/api/kiln/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repoId: landed.id, files: (landed.files || []).slice(0, 80).map((f) => ({ path: f.path, content: f.content || "" })) }) });
      }
    } catch {}
    return landed;
  };
  store.setState({ importGithub: wrapped });
}

function start() {
  const persist = store.persist;
  const run = () => { wrapImportGithub(); bootKilnAccount(); };
  if (persist?.hasHydrated?.()) run();
  else if (persist?.onFinishHydration) persist.onFinishHydration(run);
  else setTimeout(run, 50);
  if (persist?.onFinishHydration) persist.onFinishHydration(run);
  setTimeout(run, 400);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") bootKilnAccount(); });
}

start();
