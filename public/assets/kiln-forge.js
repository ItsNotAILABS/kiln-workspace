/**
 * Kiln operator boot.
 * The kiln account is a real wallet (handle `kiln`, address SHA-256 of
 * kiln-addr:<secret>). Every tech drop is a public repository under kiln/<name>.
 * Fork / remix / branch / computer / agents sign with this wallet when no
 * other wallet is connected. Every Git tree is a sealed machine.
 */
import { b as store } from "./store-sx46DNi5.js";
import { constitution, remember, sealMachine } from "./machine-seal.js";

/**
 * /_serverFn 405 on live New/Import: original Start session call.
 * Map failed serverFns onto the GitHub engine the Look up button already uses.
 * Do NOT invent window.$_TSR — a stub lets mn() run and then die on __root__.
 */
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
      } catch {
        /* engine fallback */
      }
      let q = "", owner = "", repo = "";
      try {
        const parsed = JSON.parse((init && init.body) || "{}");
        const data = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
        q = String(data.query || data.q || "");
        owner = String(data.owner || "");
        repo = String(data.repo || "").replace(/\.git$/i, "");
      } catch {
        /* ignore */
      }
      if (owner && repo) {
        const r = await origFetch.call(this, `/api/github/import?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
        const data = await r.json().catch(() => ({ ok: false }));
        return new Response(JSON.stringify({ result: data }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      if (q) {
        const r = await origFetch.call(this, `/api/github/lookup?q=${encodeURIComponent(q)}`);
        const data = await r.json().catch(() => ({ ok: false, items: [] }));
        return new Response(JSON.stringify({ result: data }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response(JSON.stringify({ result: null }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
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
      } catch {
        /* keep */
      }
      return res;
    }
    return origFetch.call(this, input, init);
  };
})();

export const KILN_SECRET = "kiln-operator-secret-v1-3e032dea509564c25c64ddb9243c5b1b0fb0b2f8";
export const KILN_HANDLE = "kiln";
export const KILN_ADDRESS = "0xc04e1a85381b37ed879b1dfafe800ff29d7e065a";

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
  const incoming = (doc.repos || []).map((r) => ({
    ...r,
    viewerGrant: true,
    encrypted: !!r.encrypted,
    owner: "kiln",
    name: String(r.id).split("/")[1] || r.name,
  }));
  const byId = new Map();
  for (const r of s.userRepos || []) byId.set(r.id, r);
  for (const fresh of incoming) {
    const cur = byId.get(fresh.id);
    if (!cur) {
      byId.set(fresh.id, fresh);
      continue;
    }
    const paths = new Set((cur.files || []).map((f) => f.path));
    const files = [...(cur.files || [])];
    for (const f of fresh.files || []) {
      if (!paths.has(f.path)) files.push(f);
    }
    byId.set(fresh.id, {
      ...cur,
      ...fresh,
      files,
      name: fresh.name,
      description: cur.description || fresh.description,
      topics: (cur.topics && cur.topics.length ? cur.topics : fresh.topics) || [],
    });
  }
  const unlocked = { ...(s.unlocked || {}) };
  for (const r of byId.values()) unlocked[r.id] = true;
  const profile = {
    ...(s.profiles || {})[doc.account.handle],
    ...doc.account,
    address: s.wallet?.handle === "kiln" ? s.wallet.address : doc.account.address || KILN_ADDRESS,
    kind: "user",
  };
  store.setState({
    userRepos: dedupe([...byId.values()]),
    profiles: { ...(s.profiles || {}), [doc.account.handle]: profile },
    unlocked,
  });
  globalThis.__KILN_FORGE_REPOS = incoming;
  globalThis.__KILN_FORGE_PROFILE = profile;
  globalThis.__KILN_FORGE__ = doc;
}

export async function ensureWallet() {
  const s = store.getState();
  if (s.wallet) return s.wallet;
  return s.connect(KILN_HANDLE, KILN_SECRET);
}

async function seatMachine(id) {
  const live = store.getState();
  const repo = (live.userRepos || []).find((r) => r.id === id);
  if (!repo) return;
  const sm = await sealMachine(repo);
  try {
    live.ensureDomain?.(id);
  } catch {}
  remember(id, "episodic", `sealed machine boot ${id}`, { path: "MACHINE.md" });
  remember(id, "procedural", `model ${sm.models.bound} · domain ${sm.domain.host}`, { path: "MACHINE.json" });
  if (live.wallet?.handle === "kiln") {
    const files = repo.files || [];
    if (!files.some((f) => f.path === "COMPUTER.md")) {
      await live.commitFile(
        id,
        "COMPUTER.md",
        `# Computer on ${id}\n\nls · cat · git · node · python · write · machine · model · memory · domain · ledger · seal\nThis tree is a kiln. Agents git-commit here.\n`,
        "seat computer",
      );
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
      if (!st.agents.some((a) => a.repoId === id && a.role === "builder" && a.resident)) {
        await store.getState().spawnAgent({ role: "builder", repoId: id, resident: true });
      }
      if (!store.getState().agents.some((a) => a.repoId === id && a.role === "conductor" && a.resident)) {
        await store.getState().spawnAgent({ role: "conductor", repoId: id, resident: true });
      }
      await seatMachine(id);
    } catch {
      /* spawn is best-effort */
    }
  }
}

export async function bootKilnAccount() {
  if (booting) return booting;
  booting = (async () => {
    try {
      const doc = await fetch("/kiln-account.json", { cache: "no-store" }).then((r) => r.json());
      if (!doc?.account) return null;
      mergeRepos(doc);
      let s = store.getState();
      if (s.wallet?.handle === "kiln") {
        store.getState().upsertProfile({
          handle: "kiln",
          displayName: "KILN",
          bio: doc.account.bio,
          location: "on-chain",
          address: s.wallet.address || KILN_ADDRESS,
          kind: "user",
          lab: "KILN",
          website: "/",
          highlight: "Origin of the forge",
        });
      }
      await seatAgents(doc);
      return doc;
    } catch (e) {
      console.warn("kiln-forge boot", e);
      return null;
    } finally {
      booting = null;
    }
  })();
  return booting;
}

globalThis.__KILN_ENSURE_WALLET = ensureWallet;
globalThis.__KILN_BOOT = bootKilnAccount;
globalThis.__KILN_SECRET = KILN_SECRET;
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
        if (tree?.ok && (tree.files || []).length > files.length) {
          payload = { ...payload, files: tree.files, meta: { ...(payload.meta || {}), ...(tree.meta || {}) } };
        }
      } catch (e) {
        console.warn("kiln github fill", e);
      }
    }
    const landed = await orig.call(store.getState(), payload);
    try {
      if (landed?.id) {
        await fetch("/api/kiln/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            repoId: landed.id,
            files: (landed.files || []).slice(0, 80).map((f) => ({ path: f.path, content: f.content || "" })),
          }),
        });
      }
    } catch {
      /* computer seats on first shell */
    }
    return landed;
  };
  store.setState({ importGithub: wrapped });
}

function start() {
  const persist = store.persist;
  const run = () => {
    wrapImportGithub();
    bootKilnAccount();
  };
  if (persist?.hasHydrated?.()) run();
  else if (persist?.onFinishHydration) persist.onFinishHydration(run);
  else setTimeout(run, 50);
  if (persist?.onFinishHydration) persist.onFinishHydration(run);
  setTimeout(run, 400);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") bootKilnAccount();
  });
}

start();
