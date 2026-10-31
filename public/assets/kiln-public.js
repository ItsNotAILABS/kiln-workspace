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

// --- store merge -------------------------------------------------------------

export async function mergePublicAccount(owner, recs) {
  const list = Array.isArray(recs) ? recs : [];
  if (!owner || !list.length) return 0;
  const s = store.getState();
  if (s.wallet?.handle && s.wallet.handle.toLowerCase() === String(owner).toLowerCase()) return 0;
  const byId = new Map();
  for (const r of s.userRepos || []) if (r?.id) byId.set(r.id, r);
  let touched = 0;
  for (const rec of list) {
    if (!rec?.id || !rec?.name || !rec?.owner) continue;
    const cur = byId.get(rec.id);
    if (cur && !cur.forgeMirror) continue; // a local repo with this id wins, untouched
    const chainAddress = `0x${(await sha256Hex(`${rec.owner}/${rec.name}`)).slice(0, 40)}`;
    byId.set(rec.id, buildPublicRepo(rec, chainAddress));
    touched += 1;
  }
  if (!touched) return 0;
  const st = store.getState();
  const profiles = { ...(st.profiles || {}) };
  const prev = profiles[owner];
  if (!prev || prev.forgeMirror) profiles[owner] = { ...(prev || {}), ...buildPublicProfile(owner, list) };
  store.setState({ userRepos: [...byId.values()], profiles });
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
