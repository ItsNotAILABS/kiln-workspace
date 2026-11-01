/**
 * Public discovery — Kiln accounts and their PUBLIC forge repositories.
 *
 * Data comes from /api/kiln/public/... on this origin, which reads the
 * swarm daemon anonymously: the daemon's visibility gate decides what
 * exists here, so private repositories are never returned, never merged
 * into the store, and never rendered — for any viewer, signed in or not.
 *
 * Merging follows the kiln-forge.js pattern: the profile lands in
 * state.profiles[handle], repos in state.userRepos, marked forgeMirror so
 * a later lookup refreshes them. A local (non-mirror) repo or profile with
 * the same id/handle is never overwritten, and the viewer's own account is
 * never merged over — local state stays authoritative for your own handle.
 *
 * One exception, documented at isImportStub below: capsule-imported records
 * are daemon-shaped stubs (missing fields the views format unconditionally,
 * owner force-written to the importing account). A stub is not a local repo,
 * so the daemon's public record replaces it, and a repair pass keeps every
 * stub in the store renderable even before any lookup runs.
 */
import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { b as store } from "./store-sx46DNi5.js";
import { T as sha256Hex } from "./fs-ri9Mkfbm.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { t as formatDistanceToNow } from "./formatDistanceToNow-SFVSzGBG.js";

const R = reactNs(React(), 1);
const j = jsxmod();

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;

export function normalizeHandle(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

// --- pure mapping: daemon public record -> app store shapes ----------------

export function buildPublicRepo(rec, chainAddress) {
  const tip = rec.tip || null;
  return {
    id: rec.id,
    owner: rec.owner,
    name: rec.name,
    description: rec.description || "",
    visibility: "public",
    encrypted: false,
    viewerGrant: true,
    chainAddress,
    language: rec.language || "",
    languages: rec.languages || {},
    stars: 0,
    forks: 0,
    watchers: 0,
    topics: Array.isArray(rec.topics) ? rec.topics : [],
    defaultBranch: rec.defaultBranch || "main",
    createdAt: rec.createdAt || rec.updatedAt || "2026-01-01T00:00:00.000Z",
    updatedAt: rec.updatedAt || rec.createdAt || "2026-01-01T00:00:00.000Z",
    tvlKln: 0,
    listedKln: 0,
    kind: "code",
    forgeMirror: true,
    forgePublic: true,
    commitCount: typeof rec.commitCount === "number" ? rec.commitCount : 0,
    fileCount: typeof rec.fileCount === "number" ? rec.fileCount : Array.isArray(rec.files) ? rec.files.length : 0,
    commits: Array.isArray(rec.commits) ? rec.commits : [],
    readme: typeof rec.readme === "string" ? rec.readme : undefined,
    files: (Array.isArray(rec.files) ? rec.files : []).map((f) => ({
      path: f.path,
      size: f.size || 0,
      sha: f.sha || "",
      language: f.language || "",
      message: tip ? tip.subject : "",
      updatedAt: tip ? tip.date : rec.updatedAt,
      ...(typeof f.content === "string" ? { content: f.content } : {}),
    })),
  };
}

export function buildPublicProfile(owner, recs) {
  let joined;
  for (const r of recs || []) {
    const y = String(r.createdAt || "").slice(0, 4);
    if (y && (!joined || y < joined)) joined = y;
  }
  return {
    handle: owner,
    displayName: owner.charAt(0).toUpperCase() + owner.slice(1),
    bio: "Forge account. Public repositories are mirrored live from the KILN daemon — private repositories are never shown here.",
    location: "KILN forge",
    ...(joined ? { joined } : {}),
    kind: "user",
    forgeMirror: true,
  };
}

// --- import stubs --------------------------------------------------------------
//
// The forge capsule import (kiln-forge.js, fed by kiln-account.json) lands
// daemon-shaped records in the store: no tvlKln / listedKln / chainAddress,
// and an owner field force-written to the importing account ("kiln") even
// though the record's id belongs to someone else. The views format tvlKln
// unconditionally (the store KLN formatter throws on undefined), read
// chainAddress as a string, and select a profile's repositories by owner —
// so a stub crashes Explore and every repo page it appears on, and hides
// its owner's repositories from their profile. A record the app itself
// created always carries the full shape, so these tells are reliable:
// a stub is an imported record, never a genuine local repo.

export function isImportStub(rec) {
  if (!rec || !rec.id) return false;
  if (rec.forgeBridge === true) return true;
  if (typeof rec.tvlKln !== "number") return true;
  const seg = String(rec.id).split("/")[0];
  return !!seg && rec.owner !== seg;
}

// Fill only what a stub lacks, with the honest values the daemon's own
// records carry: these repos hold no KLN TVL (0, exactly what the capsule
// writes for its fully-shaped records) and no marketplace listing (0).
// Present values are never overwritten, and the owner is restored from
// the record's own id — the id is the daemon's truth.
export function repairImportStub(rec) {
  if (!isImportStub(rec)) return rec;
  const seg = String(rec.id).split("/")[0];
  const fixOwner = !!seg && rec.owner !== seg;
  const fixTvl = typeof rec.tvlKln !== "number";
  const fixListed = typeof rec.listedKln !== "number";
  // Idempotent: a stub whose fields are already filled (it keeps its
  // forgeBridge tell) is returned as-is, so repair passes settle instead
  // of churning the store with fresh identities.
  if (!fixOwner && !fixTvl && !fixListed) return rec;
  const out = { ...rec };
  if (fixOwner) out.owner = seg;
  if (fixTvl) out.tvlKln = 0;
  if (fixListed) out.listedKln = 0;
  return out;
}

const chainFillPending = new Set();

async function fillStubChainAddresses(recs) {
  const missing = (recs || []).filter((r) => r && typeof r.chainAddress !== "string" && !chainFillPending.has(r.id));
  if (!missing.length) return;
  for (const r of missing) chainFillPending.add(r.id);
  try {
    const derived = new Map();
    for (const r of missing) {
      // Same derivation buildPublicRepo merges use for a mirrored repo.
      derived.set(r.id, `0x${(await sha256Hex(`${r.owner}/${r.name}`)).slice(0, 40)}`);
    }
    const patch = (list) =>
      (list || []).map((r) => (r && derived.has(r.id) && typeof r.chainAddress !== "string" ? { ...r, chainAddress: derived.get(r.id) } : r));
    const st = store.getState();
    const nextRepos = patch(st.userRepos);
    if (nextRepos.some((r, i) => r !== (st.userRepos || [])[i])) store.setState({ userRepos: nextRepos });
    if (Array.isArray(globalThis.__KILN_FORGE_REPOS)) globalThis.__KILN_FORGE_REPOS = patch(globalThis.__KILN_FORGE_REPOS);
  } catch {
    /* a failed derivation leaves the record as-is; the numeric fills above
       already removed the crash, this only restores the header chip */
  } finally {
    for (const r of missing) chainFillPending.delete(r.id);
  }
}

// Repair stubs wherever the capsule import put them: state.userRepos and
// the forge record list the store's repo selector merges from. Runs at
// module load and again whenever userRepos changes (the import lands
// asynchronously, after first paint), so the store never sits holding a
// record the views cannot render. Only stub records change; everything
// else keeps its identity, so this settles instead of looping.
export function repairImportStubs() {
  let changed = false;
  try {
    const st = store.getState();
    const repos = st.userRepos || [];
    const next = repos.map(repairImportStub);
    if (next.some((r, i) => r !== repos[i])) {
      store.setState({ userRepos: next });
      changed = true;
    }
    if (Array.isArray(globalThis.__KILN_FORGE_REPOS)) {
      const forge = globalThis.__KILN_FORGE_REPOS;
      const nextForge = forge.map(repairImportStub);
      if (nextForge.some((r, i) => r !== forge[i])) {
        globalThis.__KILN_FORGE_REPOS = nextForge;
        changed = true;
      }
    }
    const all = [...(store.getState().userRepos || []), ...(globalThis.__KILN_FORGE_REPOS || [])];
    // Any record still missing a chain address gets the derived one filled
    // asynchronously (the header shortens it with startsWith/slice — it
    // must be a string before a repo page renders the record).
    if (all.some((r) => r && typeof r.chainAddress !== "string")) void fillStubChainAddresses(all);
  } catch {
    /* the repair must never break the app it is protecting */
  }
  return changed;
}

try {
  repairImportStubs();
  if (typeof store.subscribe === "function") {
    store.subscribe((state, prev) => {
      if (state.userRepos !== prev.userRepos) queueMicrotask(repairImportStubs);
    });
  }
} catch {
  /* module load continues without the repair hook */
}

// --- store merge -------------------------------------------------------------

export async function mergePublicAccount(owner, recs) {
  const list = Array.isArray(recs) ? recs : [];
  if (!owner || !list.length) return 0;
  const s = store.getState();
  if (s.wallet?.handle && s.wallet.handle.toLowerCase() === String(owner).toLowerCase()) return 0;
  const byId = new Map();
  for (const r of s.userRepos || []) if (r?.id) byId.set(r.id, r);
  const merged = new Map();
  let touched = 0;
  for (const rec of list) {
    if (!rec?.id || !rec?.name || !rec?.owner) continue;
    const cur = byId.get(rec.id);
    // A genuine local repo with this id wins, untouched. An import stub
    // (capsule-shaped, fields missing) does not: the daemon's public
    // record is the authoritative shape for the same repository.
    if (cur && !cur.forgeMirror && !isImportStub(cur)) continue;
    const chainAddress = `0x${(await sha256Hex(`${rec.owner}/${rec.name}`)).slice(0, 40)}`;
    const pub = buildPublicRepo(rec, chainAddress);
    byId.set(rec.id, pub);
    merged.set(rec.id, pub);
    touched += 1;
  }
  if (!touched) return 0;
  const st = store.getState();
  const profiles = { ...(st.profiles || {}) };
  const prev = profiles[owner];
  if (!prev || prev.forgeMirror) profiles[owner] = { ...(prev || {}), ...buildPublicProfile(owner, list) };
  store.setState({ userRepos: [...byId.values()], profiles });
  // The store's repo selector merges the forge record list first and takes
  // a merged repo's owner from it — replace stub entries there too, or the
  // deficient copy (and its wrong owner) is resurrected on every render.
  if (merged.size && Array.isArray(globalThis.__KILN_FORGE_REPOS)) {
    globalThis.__KILN_FORGE_REPOS = globalThis.__KILN_FORGE_REPOS.map((r) => (r && merged.has(r.id) && isImportStub(r) ? merged.get(r.id) : r));
  }
  return touched;
}

// --- API ---------------------------------------------------------------------

export async function lookupPublicAccount(rawOwner) {
  const owner = normalizeHandle(rawOwner);
  if (!HANDLE_RE.test(owner)) return { ok: false, owner, repos: [], error: "That doesn't look like an account handle." };
  const res = await fetch(`/api/kiln/public/accounts/${encodeURIComponent(owner)}/repos`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  const repos = Array.isArray(data?.repos) ? data.repos : [];
  const canonical = data?.owner || owner;
  await mergePublicAccount(canonical, repos);
  return { ok: true, owner: canonical, repos };
}

export async function searchPublic(rawQuery) {
  const q = String(rawQuery || "").trim().toLowerCase();
  if (q.length < 2) return { accounts: [], repos: [] };
  const res = await fetch(`/api/kiln/public/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const repos = Array.isArray(data?.repos) ? data.repos : [];
  // Merge the full public record of every owner the search touched, so the
  // profile and repo pages the results link to render from the store.
  const owners = new Set();
  for (const a of accounts) if (a?.owner) owners.add(a.owner);
  for (const r of repos) if (r?.owner) owners.add(r.owner);
  for (const owner of owners) {
    try {
      await lookupPublicAccount(owner);
    } catch {
      /* a failed merge must not sink the search results */
    }
  }
  return { accounts, repos };
}

globalThis.__KILN_PUBLIC_LOOKUP = lookupPublicAccount;
globalThis.__KILN_PUBLIC_SEARCH = searchPublic;

// --- Explore discovery section ----------------------------------------------

const CHIPS = ["auro", "itsnotailabs"];

function relTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

export function KilnAccountLookup() {
  const [q, setQ] = R.useState("");
  const [busy, setBusy] = R.useState(false);
  const [err, setErr] = R.useState("");
  const [result, setResult] = R.useState(null);

  const run = async (raw) => {
    const owner = normalizeHandle(raw ?? q);
    if (!owner) return;
    setBusy(true);
    setErr("");
    try {
      const r = await lookupPublicAccount(owner);
      if (!r.ok) {
        setErr(r.error || "Lookup failed");
        setResult(null);
        return;
      }
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lookup failed");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return j.jsxs("div", {
    className: "mb-10",
    children: [
      j.jsx("h1", { className: "font-display text-4xl tracking-tight", children: "Discover" }),
      j.jsx("p", {
        className: "mt-1 max-w-2xl text-sm leading-relaxed text-muted",
        children:
          "Look up any Kiln account and browse its public repositories — commits, trees, READMEs — mirrored live from the forge. Private repositories are never shown, to anyone.",
      }),
      j.jsxs("form", {
        className: "mt-4 flex flex-col gap-2 sm:flex-row",
        action: "#",
        onSubmit: (e) => {
          e.preventDefault();
          void run();
        },
        children: [
          j.jsx("input", {
            className: "input flex-1",
            value: q,
            onChange: (e) => setQ(e.target.value),
            placeholder: "account handle — try auro",
            "aria-label": "Kiln account handle",
          }),
          j.jsx("button", {
            type: "button",
            className: "btn-primary btn h-9 px-4",
            disabled: busy,
            onClick: () => void run(),
            children: busy ? "Looking up…" : "Look up",
          }),
        ],
      }),
      j.jsx("div", {
        className: "mt-3 flex flex-wrap gap-2",
        children: CHIPS.map((c) =>
          j.jsx(
            "button",
            {
              type: "button",
              className: "chip",
              onClick: () => {
                setQ(c);
                void run(c);
              },
              children: c,
            },
            c,
          ),
        ),
      }),
      err ? j.jsx("p", { className: "mt-3 text-sm text-red-400", children: err }) : null,
      result
        ? result.repos.length
          ? j.jsxs("div", {
              className: "mt-5",
              children: [
                j.jsxs("p", {
                  className: "flex flex-wrap items-baseline gap-2 text-sm",
                  children: [
                    j.jsx(Link, {
                      to: "/$owner",
                      params: { owner: result.owner },
                      className: "font-display text-xl font-semibold text-seal hover:underline",
                      children: result.owner,
                    }),
                    j.jsx("span", {
                      className: "text-muted",
                      children: `${result.repos.length} public ${result.repos.length === 1 ? "repository" : "repositories"} — open the profile or a repo to browse.`,
                    }),
                  ],
                }),
                j.jsx("ul", {
                  className: "mt-3 divide-y divide-border rounded-lg border border-border",
                  children: result.repos.map((r) =>
                    j.jsxs(
                      "li",
                      {
                        className: "px-4 py-3",
                        children: [
                          j.jsxs("div", {
                            className: "flex flex-wrap items-center gap-2",
                            children: [
                              j.jsx(Link, {
                                to: "/$owner/$repo",
                                params: { owner: r.owner, repo: r.name },
                                className: "font-medium text-seal hover:underline",
                                children: `${r.owner}/${r.name}`,
                              }),
                              j.jsx("span", { className: "chip", children: "Public" }),
                              r.language
                                ? j.jsx("span", { className: "text-xs text-muted", children: r.language })
                                : null,
                            ],
                          }),
                          r.description
                            ? j.jsx("p", { className: "mt-1 text-sm text-muted", children: r.description })
                            : null,
                          r.tip
                            ? j.jsx("p", {
                                className: "mt-1 truncate font-mono text-[11px] text-subtle",
                                children: `${r.tip.shortSha} ${r.tip.subject} — ${r.tip.author}${r.tip.date ? ` · ${relTime(r.tip.date)}` : ""}`,
                              })
                            : null,
                        ],
                      },
                      r.id,
                    ),
                  ),
                }),
              ],
            })
          : j.jsx("p", {
              className: "mt-5 text-sm text-muted",
              children: `No public repositories for ${result.owner}. If this account exists, everything on it is private — and private stays invisible here.`,
            })
        : j.jsx("p", { className: "mt-6 text-sm text-muted", children: "Look up an account to see its public repositories." }),
    ],
  });
}
