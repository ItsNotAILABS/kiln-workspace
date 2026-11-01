/**
 * Repos hub — the bottom bar's Repos tab (design round, Piece 4a).
 *
 * The frozen router admits no new route (the route tree lives in the
 * generated client bundle), so /repos resolves through /$owner with
 * owner "repos"; the _owner chunk's module-scope wrapper hands that
 * one owner value to this hub and renders every real profile exactly
 * as before. (The router already shadows explore/studio/papers/new
 * the same way.)
 *
 * Three segments, each bound to a real source:
 *  MINE — the signed-in user's profile database: profile summary +
 *    their repos from the app store (the same merged records the
 *    profile page renders), with forge details.
 *  ALL REPOS — the whole app's PUBLIC repos: the public API's known
 *    accounts merged live, plus search over /api/kiln/public/search.
 *    Private repos are never returned by that surface, for anyone.
 *  EXPLORER — a read-only file explorer. Public repos browse from
 *    their public record (files[] with text content inline when the
 *    record carries it); the user's own store repos browse from
 *    their store files; and with a forge account session ANY repo
 *    the session may read — including the user's private repos —
 *    browses through the daemon's tree/contents doors via this
 *    origin's /api/forge proxy. What the public record cannot carry
 *    (files over the text cap, binaries) says so and links the repo
 *    page — anonymous browsing beyond the public record has no door
 *    today; the session door is the widening path.
 */

import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { b as useStore, d as allRepos, G as formatKln } from "./store-sx46DNi5.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { t as formatDistanceToNow } from "./formatDistanceToNow-SFVSzGBG.js";
import { t as FolderIcon } from "./folder-CuS7zSFG.js";
import { t as ArrowRightIcon } from "./arrow-right-T3FK7JNx.js";
import { lookupPublicAccount, searchPublic } from "./kiln-public.js";

const R = reactNs(React(), 1);
const j = jsxmod();

const SESSION_KEY = "kiln.daemon.session.v1";
const SEED_ACCOUNTS = ["auro", "itsnotailabs"];

function sessionToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && typeof s.token === "string" && s.token ? s.token : null;
  } catch {
    return null;
  }
}

async function forgeGet(path) {
  const token = sessionToken();
  const res = await fetch(`/api/forge${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok)
    throw new Error(
      (data && (data.error?.message || data.error)) || `forge answered ${res.status}`,
    );
  return data;
}

function fmtBytes(n) {
  if (typeof n !== "number") return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function rel(iso) {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

// ------------------------------------------------------------ repo rows

function RepoRow({ rec, onExplore }) {
  return j.jsxs("li", {
    className: "rounded-lg border border-border bg-surface px-4 py-3",
    children: [
      j.jsxs("div", {
        key: "top",
        className: "flex flex-wrap items-center gap-2",
        children: [
          j.jsx(FolderIcon, { key: "i", className: "size-4 text-muted" }),
          j.jsxs(Link, {
            key: "n",
            to: `/${rec.owner}/${rec.name}`,
            className: "font-medium text-fg",
            children: [
              j.jsx("span", { key: "o", className: "text-muted", children: `${rec.owner}/` }),
              rec.name,
            ],
          }),
          rec.visibility === "public"
            ? j.jsx("span", { key: "v", className: "chip", children: "Public" })
            : j.jsx("span", { key: "v", className: "chip", children: "Private" }),
          rec.language
            ? j.jsx("span", { key: "l", className: "chip", children: rec.language })
            : null,
          onExplore
            ? j.jsx("button", {
                key: "x",
                type: "button",
                className: "btn h-8",
                style: { marginLeft: "auto" },
                onClick: () => onExplore(rec),
                children: "Explore files",
              })
            : null,
        ],
      }),
      rec.description
        ? j.jsx("p", {
            key: "d",
            className: "mt-1 text-sm leading-relaxed text-muted",
            children: rec.description,
          })
        : null,
      j.jsxs("div", {
        key: "meta",
        className: "mt-2 flex flex-wrap text-[11px] text-subtle",
        style: { columnGap: "1rem", rowGap: "0.25rem" },
        children: [
          typeof rec.commitsCount === "number"
            ? j.jsx("span", { key: "c", children: `${rec.commitsCount} commits` })
            : null,
          typeof rec.filesCount === "number"
            ? j.jsx("span", { key: "f", children: `${rec.filesCount} files` })
            : null,
          rec.defaultBranch
            ? j.jsx("span", { key: "b", children: `branch ${rec.defaultBranch}` })
            : null,
          rec.updatedAt
            ? j.jsx("span", { key: "u", children: `updated ${rel(rec.updatedAt)}` })
            : null,
          typeof rec.tvlKln === "number"
            ? j.jsx("span", { key: "t", children: `${formatKln(rec.tvlKln)} KLN in repo` })
            : null,
        ],
      }),
    ],
  });
}

// -------------------------------------------------------------- explorer

/** Build a nested tree from flat file records. */
function buildTree(files) {
  const root = { name: "", dirs: new Map(), files: [] };
  for (const f of files || []) {
    const parts = String(f.path || "").split("/").filter(Boolean);
    if (!parts.length) continue;
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { name: parts[i], dirs: new Map(), files: [] });
      node = node.dirs.get(parts[i]);
    }
    node.files.push({ ...f, base: parts[parts.length - 1] });
  }
  return root;
}

function nodeAt(root, segs) {
  let node = root;
  for (const s of segs) {
    node = node.dirs.get(s);
    if (!node) return null;
  }
  return node;
}

function Explorer({ candidates, initial }) {
  const [pick, setPick] = R.useState(initial || null); // {owner, name, record?}
  const [manual, setManual] = R.useState("");
  const [segs, setSegs] = R.useState([]);
  const [file, setFile] = R.useState(null); // {path, content|null, note}
  const [sessTree, setSessTree] = R.useState(null); // {key, entries} for session browsing
  const [sessBusy, setSessBusy] = R.useState(false);
  const [sessError, setSessError] = R.useState("");
  const hasSession = Boolean(sessionToken());

  const record = pick?.record || null;
  const localTree = R.useMemo(() => (record ? buildTree(record.files) : null), [record]);
  const localNode = localTree ? nodeAt(localTree, segs) : null;

  const choose = (p) => {
    setPick(p);
    setSegs([]);
    setFile(null);
    setSessTree(null);
    setSessError("");
  };

  // Session browsing: one tree level per call.
  const loadSessLevel = async (owner, name, pathSegs) => {
    setSessBusy(true);
    setSessError("");
    try {
      const q = pathSegs.length ? `?path=${encodeURIComponent(pathSegs.join("/"))}` : "";
      const data = await forgeGet(`/v1/repos/${owner}/${name}/tree${q}`);
      const entries = (data && (data.entries || data.tree)) || [];
      setSessTree({ key: pathSegs.join("/"), entries });
    } catch (e) {
      setSessError(String(e?.message || e));
      setSessTree(null);
    } finally {
      setSessBusy(false);
    }
  };

  R.useEffect(() => {
    if (pick && !pick.record && hasSession) loadSessLevel(pick.owner, pick.name, segs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick?.owner, pick?.name, segs.join("/")]);

  const openSessFile = async (entry) => {
    setSessBusy(true);
    try {
      const data = await forgeGet(
        `/v1/repos/${pick.owner}/${pick.name}/contents?path=${encodeURIComponent(entry.path)}`,
      );
      let text = null;
      try {
        const bytes = Uint8Array.from(atob(data.content || ""), (c) => c.charCodeAt(0));
        if (!bytes.includes(0)) text = new TextDecoder().decode(bytes);
      } catch {}
      setFile({
        path: entry.path,
        content: text,
        note: text === null ? "Binary file — contents are not shown; open it from the repository page." : null,
      });
    } catch (e) {
      setFile({ path: entry.path, content: null, note: String(e?.message || e) });
    } finally {
      setSessBusy(false);
    }
  };

  const crumbs = [
    j.jsx("button", {
      key: "root",
      type: "button",
      className: "text-seal",
      onClick: () => {
        setSegs([]);
        setFile(null);
      },
      children: pick ? `${pick.owner}/${pick.name}` : "Choose a repository",
    }),
    ...segs.map((s, i) =>
      j.jsxs("span", {
        key: `c${i}`,
        children: [
          j.jsx("span", { key: "s", className: "text-subtle", children: " / " }),
          j.jsx("button", {
            key: "b",
            type: "button",
            className: "text-seal",
            onClick: () => {
              setSegs(segs.slice(0, i + 1));
              setFile(null);
            },
            children: s,
          }),
        ],
      }),
    ),
    file
      ? j.jsxs("span", {
          key: "file",
          children: [
            j.jsx("span", { key: "s", className: "text-subtle", children: " / " }),
            j.jsx("span", { key: "n", children: file.path.split("/").pop() }),
          ],
        })
      : null,
  ];

  return j.jsxs("div", {
    children: [
      j.jsxs("div", {
        key: "pick",
        className: "flex flex-wrap items-center gap-2",
        children: [
          ...(candidates || []).map((rec) =>
            j.jsx("button", {
              key: rec.id,
              type: "button",
              className: `chip ${pick?.record?.id === rec.id ? "text-seal" : ""}`,
              onClick: () => choose({ owner: rec.owner, name: rec.name, record: rec }),
              children: `${rec.owner}/${rec.name}`,
            }),
          ),
          j.jsx("input", {
            key: "manual",
            className: "input",
            style: { maxWidth: "14rem" },
            placeholder: "owner/name",
            value: manual,
            onChange: (e) => setManual(e.target.value),
            autoCapitalize: "none",
            autoCorrect: "off",
          }),
          j.jsx("button", {
            key: "go",
            type: "button",
            className: "btn h-8",
            onClick: () => {
              const m = manual.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
              if (m) choose({ owner: m[1], name: m[2], record: null });
            },
            children: "Browse",
          }),
        ],
      }),
      !hasSession && !record
        ? j.jsx("p", {
            key: "nosess",
            className: "mt-3 text-sm leading-relaxed text-muted",
            children:
              "Browsing a repository you pick from the lists above uses its public record. Browsing any other repository by name needs a forge account session — connect one in Account and it reads through the daemon's tree door.",
          })
        : null,
      pick
        ? j.jsxs("div", {
            key: "browse",
            className: "mt-4 rounded-lg border border-border bg-surface",
            children: [
              j.jsx("div", {
                className: "flex flex-wrap items-center gap-1 border-b border-border px-4 py-2 font-mono text-xs",
                children: crumbs,
              }),
              file
                ? j.jsxs("div", {
                    key: "fileview",
                    children: [
                      j.jsx("button", {
                        key: "back",
                        type: "button",
                        className: "btn h-8",
                        style: { margin: "0.75rem" },
                        onClick: () => setFile(null),
                        children: "← Back to files",
                      }),
                      file.content !== null && file.content !== undefined
                        ? j.jsx("pre", {
                            key: "pre",
                            className:
                              "overflow-auto whitespace-pre-wrap break-words px-4 font-mono text-xs leading-relaxed",
                            style: { paddingBottom: "1rem" },
                            children: file.content,
                          })
                        : j.jsx("p", {
                            key: "note",
                            className: "px-4 text-sm text-muted",
                            style: { paddingBottom: "1rem" },
                            children: file.note || "This file's contents are not in the record.",
                          }),
                    ],
                  })
                : record
                  ? localNode && (localNode.dirs.size || localNode.files.length)
                    ? j.jsx("ul", {
                        key: "entries",
                        className: "divide-y divide-border",
                        children: [
                          ...[...localNode.dirs.values()].map((d) =>
                            j.jsx("li", {
                              key: `d${d.name}`,
                              children: j.jsxs("button", {
                                type: "button",
                                className: "flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm hover:bg-surface-2",
                                onClick: () => setSegs([...segs, d.name]),
                                children: [
                                  j.jsx(FolderIcon, { key: "i", className: "size-4 text-seal" }),
                                  `${d.name}/`,
                                ],
                              }),
                            }),
                          ),
                          ...localNode.files.map((f) =>
                            j.jsx("li", {
                              key: `f${f.path}`,
                              children: j.jsxs("button", {
                                type: "button",
                                className: "flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm hover:bg-surface-2",
                                onClick: () =>
                                  setFile({
                                    path: f.path,
                                    content: typeof f.content === "string" ? f.content : null,
                                    note:
                                      typeof f.content === "string"
                                        ? null
                                        : "The public record carries text contents up to 32 KB for text files; this one is larger or binary — open it from the repository page.",
                                  }),
                                children: [
                                  j.jsx("span", { key: "n", className: "font-mono text-xs", children: f.base }),
                                  j.jsx("span", {
                                    key: "s",
                                    className: "text-[11px] text-subtle",
                                    children: fmtBytes(f.size),
                                  }),
                                ],
                              }),
                            }),
                          ),
                        ],
                      })
                    : j.jsx("p", { className: "px-4 py-3 text-sm text-muted", children: "Nothing here — the folder is empty, or this record carries no file list for it." })
                  : sessBusy
                    ? j.jsx("p", { className: "px-4 py-3 text-sm text-muted", children: "Reading the tree…" })
                    : sessError
                      ? j.jsx("p", { className: "px-4 py-3 text-sm text-muted", children: sessError })
                      : sessTree
                        ? j.jsx("ul", {
                            key: "sessentries",
                            className: "divide-y divide-border",
                            children: (sessTree.entries || []).map((e) =>
                              j.jsx("li", {
                                key: e.path || e.name,
                                children: j.jsxs("button", {
                                  type: "button",
                                  className: "flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm hover:bg-surface-2",
                                  onClick: () =>
                                    e.type === "tree" || e.type === "dir"
                                      ? setSegs([...segs, e.name])
                                      : openSessFile(e),
                                  children: [
                                    e.type === "tree" || e.type === "dir"
                                      ? j.jsx(FolderIcon, { key: "i", className: "size-4 text-seal" })
                                      : null,
                                    j.jsx("span", {
                                      key: "n",
                                      className: "font-mono text-xs",
                                      children: e.type === "tree" || e.type === "dir" ? `${e.name}/` : e.name,
                                    }),
                                    typeof e.size === "number"
                                      ? j.jsx("span", { key: "s", className: "text-[11px] text-subtle", children: fmtBytes(e.size) })
                                      : null,
                                  ],
                                }),
                              }),
                            ),
                          })
                        : j.jsx("p", { className: "px-4 py-3 text-sm text-muted", children: "No tree read yet." }),
            ],
          })
        : null,
    ],
  });
}

// ---------------------------------------------------------------- the hub

const SEGMENTS = [
  { id: "mine", label: "Mine" },
  { id: "all", label: "All repos" },
  { id: "explorer", label: "Explorer" },
];

export function KilnReposHub() {
  const state = useStore();
  const wallet = state?.wallet || null;
  const profile = wallet?.handle ? state?.profiles?.[wallet.handle] : null;
  const myRepos = R.useMemo(
    () =>
      wallet?.handle
        ? (allRepos(state) || []).filter((r) => r.owner === wallet.handle)
        : [],
    [state, wallet?.handle],
  );

  const [seg, setSeg] = R.useState("mine");
  const [pubRepos, setPubRepos] = R.useState(null);
  const [query, setQuery] = R.useState("");
  const [searchRows, setSearchRows] = R.useState(null);
  const [searchMsg, setSearchMsg] = R.useState("");
  const [explorePick, setExplorePick] = R.useState(null);

  R.useEffect(() => {
    let dead = false;
    (async () => {
      const byId = new Map();
      for (const owner of SEED_ACCOUNTS) {
        try {
          const out = await lookupPublicAccount(owner);
          for (const r of (out && out.repos) || []) byId.set(r.id, r);
        } catch {}
      }
      if (!dead) setPubRepos([...byId.values()]);
    })();
    return () => {
      dead = true;
    };
  }, []);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchMsg("Search needs at least two characters.");
      return;
    }
    setSearchMsg("Searching the forge…");
    try {
      const out = await searchPublic(q);
      setSearchRows(out.repos || []);
      setSearchMsg(
        out.repos && out.repos.length ? "" : "No public repositories match that search.",
      );
    } catch {
      setSearchMsg("The forge's public search did not answer.");
    }
  };

  const openExplorer = (rec) => {
    setExplorePick({ owner: rec.owner, name: rec.name, record: rec });
    setSeg("explorer");
  };

  const segBtn = (s) =>
    j.jsx("button", {
      key: s.id,
      type: "button",
      className: `btn h-8 ${seg === s.id ? "btn-primary" : ""}`,
      onClick: () => setSeg(s.id),
      children: s.label,
    });

  return j.jsxs("div", {
    className: "mx-auto w-full max-w-5xl",
    children: [
      j.jsx("p", {
        key: "eb",
        className: "text-[11px] font-medium uppercase tracking-[0.2em] text-muted",
        children: "Repositories",
      }),
      j.jsx("h1", {
        key: "h",
        className: "mt-3 font-display text-4xl leading-[0.95] tracking-tight sm:text-5xl",
        children: "Repos",
      }),
      j.jsxs("div", {
        key: "segs",
        className: "mt-6 flex flex-wrap gap-2",
        role: "tablist",
        children: SEGMENTS.map(segBtn),
      }),

      seg === "mine"
        ? j.jsxs("div", {
            key: "mine",
            className: "mt-8",
            children: wallet
              ? [
                  j.jsxs("div", {
                    key: "prof",
                    className: "rounded-lg border border-border bg-surface p-5",
                    children: [
                      j.jsxs("div", {
                        className: "flex flex-wrap items-center gap-2",
                        children: [
                          j.jsx("span", {
                            key: "h",
                            className: "font-display text-2xl tracking-tight",
                            children: `@${wallet.handle}`,
                          }),
                          j.jsx("span", {
                            key: "bal",
                            className: "chip text-seal",
                            children: `${formatKln(wallet.balanceKln || 0)} KLN`,
                          }),
                        ],
                      }),
                      j.jsxs("p", {
                        key: "meta",
                        className: "mt-2 font-mono text-[11px] text-subtle",
                        children: [
                          wallet.address || "",
                          profile?.joinedAt ? ` · joined ${rel(profile.joinedAt)}` : "",
                          ` · ${myRepos.length} repositor${myRepos.length === 1 ? "y" : "ies"}`,
                        ]
                          .filter(Boolean)
                          .join(""),
                      }),
                      profile?.bio
                        ? j.jsx("p", { key: "bio", className: "mt-2 text-sm leading-relaxed text-muted", children: profile.bio })
                        : null,
                      j.jsxs("div", {
                        key: "links",
                        className: "mt-4 flex flex-wrap gap-2",
                        children: [
                          j.jsx(Link, { key: "p", to: `/${wallet.handle}`, className: "btn h-8", children: "Profile page" }),
                          j.jsx(Link, { key: "w", to: "/wallet", className: "btn h-8", children: "Wallet" }),
                        ],
                      }),
                    ],
                  }),
                  myRepos.length
                    ? j.jsx("ul", {
                        key: "list",
                        className: "mt-4 flex flex-col gap-3",
                        children: myRepos.map((rec) =>
                          j.jsx(RepoRow, { key: rec.id, rec, onExplore: openExplorer }),
                        ),
                      })
                    : j.jsx("p", {
                        key: "empty",
                        className: "mt-4 text-sm leading-relaxed text-muted",
                        children: "No repositories yet under your handle — the Create sheet starts one.",
                      }),
                ]
              : [
                  j.jsx("p", {
                    key: "out",
                    className: "max-w-2xl text-sm leading-relaxed text-muted",
                    children:
                      "Your profile database — your repositories with their forge details — lives behind your wallet. Connect to see it; the public segments below work signed-out.",
                  }),
                  j.jsx("div", {
                    key: "cta",
                    className: "mt-4 flex flex-wrap gap-2",
                    children: [
                      j.jsx("button", {
                        type: "button",
                        className: "btn h-8",
                        onClick: () => setSeg("all"),
                        children: "Browse all public repos",
                      }),
                      j.jsx(Link, { to: "/login", className: "btn h-8", children: "Sign in" }),
                    ],
                  }),
                ],
          })
        : null,

      seg === "all"
        ? j.jsxs("div", {
            key: "all",
            className: "mt-8",
            children: [
              j.jsxs("form", {
                key: "search",
                className: "flex flex-wrap items-center gap-2",
                onSubmit: (e) => {
                  e.preventDefault();
                  runSearch();
                },
                children: [
                  j.jsx("input", {
                    key: "q",
                    className: "input",
                    style: { maxWidth: "22rem" },
                    placeholder: "Search public repositories…",
                    value: query,
                    onChange: (e) => setQuery(e.target.value),
                    autoCapitalize: "none",
                    autoCorrect: "off",
                  }),
                  j.jsx("button", { key: "go", type: "submit", className: "btn h-8", children: "Search" }),
                  searchMsg
                    ? j.jsx("span", { key: "m", className: "text-xs text-muted", children: searchMsg })
                    : null,
                ],
              }),
              j.jsx("ul", {
                key: "list",
                className: "mt-4 flex flex-col gap-3",
                children: (searchRows !== null ? searchRows : pubRepos || []).map((rec) =>
                  j.jsx(RepoRow, { key: rec.id, rec, onExplore: openExplorer }),
                ),
              }),
              pubRepos === null && searchRows === null
                ? j.jsx("p", { key: "load", className: "mt-4 text-sm text-muted", children: "Reading the forge…" })
                : null,
              searchRows === null && pubRepos && !pubRepos.length
                ? j.jsx("p", {
                    key: "none",
                    className: "mt-4 text-sm text-muted",
                    children: "No public repositories answered — the list reads the forge's public surface live.",
                  })
                : null,
            ],
          })
        : null,

      seg === "explorer"
        ? j.jsxs("div", {
            key: "explorer",
            className: "mt-8",
            children: [
              j.jsx("p", {
                key: "intro",
                className: "max-w-2xl text-sm leading-relaxed text-muted",
                children:
                  "Read-only. Pick a repository and walk its tree — folders, files, and the text contents the record carries.",
              }),
              j.jsx("div", {
                key: "x",
                className: "mt-4",
                children: j.jsx(Explorer, {
                  candidates: [
                    ...myRepos,
                    ...(pubRepos || []).filter(
                      (r) => !myRepos.some((m) => m.id === r.id),
                    ),
                  ],
                  initial: explorePick,
                }),
              }),
            ],
          })
        : null,
    ],
  });
}
