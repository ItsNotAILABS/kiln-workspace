/**
 * Papers Studio — the /papers suite (design round, Piece 2).
 *
 * Papers is a whole studio, the publishing counterpart to Studio's repo
 * creation suite: hero, doors (New paper / Release a paper), My papers,
 * and the public Papers index in scholarly record style. The claimed-
 * constructions Research list that already lived at /papers renders
 * below this suite, untouched (the route chunk composes the two).
 *
 * What binds TODAY (all live doors, no staged data):
 *  - Public papers: repos on the forge's public surface (this origin's
 *    /api/kiln/public API) that carry a paper — detected by a paper.json
 *    manifest at the root, or paper.md + paper.pdf. Manifest fields
 *    (title, authors, abstract, license, keywords) are parsed from the
 *    manifest content the public record itself carries.
 *  - My papers: the signed-in user's repos from the app store (same
 *    detection), merged with the registry view when it answers.
 *  - Create / designate / release: with a forge account session (the
 *    identity layer's daemon session, localStorage
 *    `kiln.daemon.session.v1`) the suite calls the daemon through this
 *    origin's /api/forge proxy — POST /v1/repos + contents PUTs are
 *    real commits; designation is PATCH details {paper:{enabled:true}};
 *    release is POST …/releases. Without a session the doors degrade
 *    to the surfaces that exist (repo create, the repo's releases
 *    page, the Account identity panel) and say so.
 *  - The registry: GET /api/forge/v1/papers — the papers-workflow
 *    daemon branch's read surface ({papers:[concept…]} with versions,
 *    generated citations, resolver + pages URLs). It 404s until that
 *    branch activates on the daemon; the suite probes it on mount and,
 *    when it answers, registry records take precedence for version
 *    IDs, citations and record-page links. Nothing here pretends the
 *    registry answered when it did not.
 *
 * Identifier honesty (the spec's binding rule): IDs printed here are
 * KILN-registered identifiers in DOI syntax — `kiln:<owner>/<slug>`
 * (concept) and `kiln:<owner>/<slug>.v<n>` (version). They are never
 * labeled DOIs; a real registered DOI needs a DataCite/Crossref
 * prefix, and records carry doi:null until one exists.
 */

import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { b as useStore, d as allRepos } from "./store-sx46DNi5.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { t as formatDistanceToNow } from "./formatDistanceToNow-SFVSzGBG.js";
import { t as LayersIcon } from "./layers-QFN7Wm40.js";
import { t as ArrowRightIcon } from "./arrow-right-T3FK7JNx.js";
import { lookupPublicAccount } from "./kiln-public.js";

const R = reactNs(React(), 1);
const j = jsxmod();

const SESSION_KEY = "kiln.daemon.session.v1";
/** Accounts whose public repos seed the index (the Discover chips precedent). */
const SEED_ACCOUNTS = ["auro", "itsnotailabs"];

// ---------------------------------------------------------------- session

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

/** One call through the origin's forge proxy. Errors surface verbatim. */
async function forge(method, path, body, { auth = true } = {}) {
  const headers = {};
  const token = auth ? sessionToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`/api/forge${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const msg =
      (data && (data.error?.message || data.error || data.message)) ||
      `forge answered ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : `forge answered ${res.status}`);
  }
  return data;
}

// ------------------------------------------------------- paper detection

function rootPaths(rec) {
  return new Set((rec?.files || []).map((f) => f.path));
}

export function isPaperRecord(rec) {
  if (!rec) return false;
  const p = rootPaths(rec);
  return p.has("paper.json") || (p.has("paper.md") && p.has("paper.pdf"));
}

export function manifestOf(rec) {
  const f = (rec?.files || []).find(
    (x) => x.path === "paper.json" && typeof x.content === "string",
  );
  if (!f) return null;
  try {
    const m = JSON.parse(f.content);
    return m && typeof m === "object" ? m : null;
  } catch {
    return null;
  }
}

const conceptIdOf = (rec) => `kiln:${rec.owner}/${rec.name}`;

/**
 * Fallback metadata for a paper repo with no paper.json yet (record
 * zero's manifest lands with the papers-workflow activation): the
 * repo's own README states the title, the byline and an abstract —
 * parse exactly those, nothing more. A manifest or registry record
 * supersedes this wherever both exist.
 */
function readmeFallback(rec) {
  const f = (rec?.files || []).find(
    (x) => x.path === "README.md" && typeof x.content === "string",
  );
  if (!f) return null;
  const lines = f.content.split("\n");
  const h1 = lines.find((l) => /^#\s+/.test(l));
  if (!h1) return null;
  let title = h1.replace(/^#\s+/, "").trim();
  const after = lines.slice(lines.indexOf(h1) + 1).filter((l) => l.trim());
  if (after.length && /^\*\*.+\*\*$/.test(after[0].trim()))
    title = `${title}: ${after[0].trim().replace(/^\*\*|\*\*$/g, "")}`;
  let authors = [];
  const byline = after.find((l) => /—\s*Version\s/i.test(l));
  if (byline) {
    const left = byline.split(/—\s*Version\s/i)[0].trim();
    const parts = left.split("·").map((s) => s.trim()).filter(Boolean);
    if (parts.length)
      authors = [{ name: parts[0], ...(parts[1] ? { affiliation: parts[1] } : {}) }];
  }
  let abstract = "";
  const wi = lines.findIndex((l) => /^##\s+What this is/i.test(l));
  if (wi >= 0) {
    const para = lines.slice(wi + 1).find((l) => l.trim() && !l.startsWith("#"));
    if (para) abstract = para.trim();
  }
  return { title, authors, abstract };
}

/**
 * One display row, merging a repo record with its registry concept
 * (registry wins for title/authors/license/version/citations).
 */
function paperRow(rec, concept) {
  const manifest = (concept && concept.manifest) || manifestOf(rec);
  const fallback = !manifest && !concept && rec ? readmeFallback(rec) : null;
  const latest =
    concept && concept.versions && concept.versions.length
      ? concept.versions[concept.versions.length - 1]
      : null;
  return {
    key: rec ? rec.id : concept.id,
    owner: rec ? rec.owner : concept.owner,
    name: rec ? rec.name : concept.slug,
    conceptId: concept ? concept.id : conceptIdOf(rec),
    title:
      (concept && concept.title) ||
      (manifest && manifest.title) ||
      (fallback && fallback.title) ||
      (rec && rec.name) ||
      concept.slug,
    authors: (manifest && manifest.authors) || (fallback && fallback.authors) || [],
    abstract: (manifest && manifest.abstract) || (fallback && fallback.abstract) || "",
    license: (manifest && manifest.license) || null,
    versionId: latest ? latest.id : null,
    versionCount: concept ? concept.versionCount || (concept.versions || []).length : 0,
    citations: latest ? latest.citations : null,
    releasedAt: concept ? concept.latestReleasedAt : null,
    updatedAt: rec ? rec.updatedAt : null,
    pagesUrl: concept ? concept.pagesUrl : null,
    resolver: concept ? concept.resolver : null,
    hasManifest: Boolean(manifest) || Boolean(concept),
    repo: rec || null,
    concept: concept || null,
  };
}

/** The record-page door that exists for this paper today. */
function readHref(row) {
  // Registry truth: a pages-designated paper's record page is served by
  // KILN Pages; this origin proxies /papers/<repo>/ for the auro
  // namespace (the papers workspace owner) — other owners' record
  // pages join when the origin proxy generalizes (NOTES, Piece 2).
  if (row.owner === "auro") return { href: `/papers/${row.name}/`, external: true, label: "Record page" };
  return { href: `/${row.owner}/${row.name}`, external: false, label: "Repository" };
}

function authorLine(authors) {
  if (!authors || !authors.length) return null;
  return authors
    .map((a) => (a && a.affiliation ? `${a.name} (${a.affiliation})` : a?.name))
    .filter(Boolean)
    .join(", ");
}

// ---------------------------------------------------------------- pieces

function Chip({ children, seal }) {
  return j.jsx("span", {
    className: `chip ${seal ? "text-seal" : ""}`,
    children,
  });
}

function PaperRowView({ row, action }) {
  const [citeOpen, setCiteOpen] = R.useState(false);
  const [copied, setCopied] = R.useState("");
  const read = readHref(row);
  const authors = authorLine(row.authors);
  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 1600);
    } catch {}
  };
  return j.jsxs("li", {
    className: "rounded-lg border border-border bg-surface p-5",
    children: [
      j.jsxs("div", {
        key: "meta",
        className: "flex flex-wrap items-center gap-2",
        children: [
          j.jsx("span", {
            key: "id",
            className: "font-mono text-[11px] tracking-[0.14em] text-seal",
            children: row.conceptId,
          }),
          row.versionId
            ? j.jsx(Chip, { key: "v", seal: true, children: row.versionId })
            : null,
          row.license ? j.jsx(Chip, { key: "lic", children: row.license }) : null,
          row.releasedAt
            ? j.jsx("span", {
                key: "rel",
                className: "text-[11px] text-subtle",
                children: `released ${formatDistanceToNow(new Date(row.releasedAt), { addSuffix: true })}`,
              })
            : row.updatedAt
              ? j.jsx("span", {
                  key: "upd",
                  className: "text-[11px] text-subtle",
                  children: `updated ${formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })}`,
                })
              : null,
        ],
      }),
      j.jsx("h3", {
        key: "t",
        className: "mt-2 font-display text-2xl tracking-tight",
        children: row.title,
      }),
      authors
        ? j.jsx("p", { key: "a", className: "mt-1 text-sm text-muted", children: authors })
        : null,
      row.abstract
        ? j.jsx("p", {
            key: "abs",
            className: "mt-2 line-clamp-3 text-sm leading-relaxed text-muted",
            children: row.abstract,
          })
        : null,
      j.jsxs("div", {
        key: "act",
        className: "mt-4 flex flex-wrap items-center gap-2",
        children: [
          read.external
            ? j.jsxs("a", {
                key: "read",
                href: read.href,
                className: "btn h-8",
                children: [
                  read.label,
                  j.jsx(ArrowRightIcon, { key: "ar", className: "size-3.5" }),
                ],
              })
            : j.jsxs(Link, {
                key: "read",
                to: `/${row.owner}/${row.name}`,
                className: "btn h-8",
                children: [
                  read.label,
                  j.jsx(ArrowRightIcon, { key: "ar", className: "size-3.5" }),
                ],
              }),
          row.citations
            ? j.jsx("button", {
                key: "cite",
                type: "button",
                className: "btn h-8",
                onClick: () => setCiteOpen(!citeOpen),
                children: citeOpen ? "Hide citation" : "Cite",
              })
            : null,
          action || null,
        ],
      }),
      citeOpen && row.citations
        ? j.jsxs("div", {
            key: "citebox",
            className: "mt-4 rounded-lg border border-border bg-surface-2 p-3",
            children: [
              j.jsxs("div", {
                key: "ct",
                className: "flex items-start justify-between gap-3",
                children: [
                  j.jsx("p", {
                    key: "x",
                    className: "text-sm leading-relaxed",
                    children: row.citations.text,
                  }),
                  j.jsx("button", {
                    key: "cp",
                    type: "button",
                    className: "btn h-8 shrink-0",
                    onClick: () => copy(row.citations.text, "text"),
                    children: copied === "text" ? "Copied" : "Copy",
                  }),
                ],
              }),
              row.citations.bibtex
                ? j.jsxs("div", {
                    key: "bib",
                    className: "mt-3",
                    children: [
                      j.jsx("pre", {
                        key: "pre",
                        className:
                          "overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted",
                        children: row.citations.bibtex,
                      }),
                      j.jsx("button", {
                        key: "cpb",
                        type: "button",
                        className: "btn mt-2 h-8",
                        onClick: () => copy(row.citations.bibtex, "bib"),
                        children: copied === "bib" ? "Copied" : "Copy BibTeX",
                      }),
                    ],
                  })
                : null,
            ],
          })
        : null,
    ],
  });
}

// ------------------------------------------------------------- the suite

export function KilnPapersStudio() {
  const state = useStore();
  const wallet = state?.wallet || null;
  const myRepos = R.useMemo(
    () =>
      (allRepos(state) || []).filter(
        (r) => wallet?.handle && r.owner === wallet.handle,
      ),
    [state, wallet?.handle],
  );
  const myPapers = R.useMemo(() => myRepos.filter(isPaperRecord), [myRepos]);

  const [registry, setRegistry] = R.useState(null); // Map conceptId -> concept | null=not probed/no answer
  const [pubRows, setPubRows] = R.useState(null); // null = loading
  const [pubError, setPubError] = R.useState("");
  const [me, setMe] = R.useState(null); // {owner} when a forge session exists
  const [showCreate, setShowCreate] = R.useState(false);
  const [releaseFor, setReleaseFor] = R.useState(null); // repo record
  const createRef = R.useRef(null);

  // Registry probe (anonymous view for the index) + session identity.
  R.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const data = await forge("GET", "/v1/papers", undefined, { auth: false });
        if (dead) return;
        const map = new Map();
        for (const c of (data && data.papers) || []) map.set(c.id, c);
        setRegistry(map);
      } catch {
        if (!dead) setRegistry(new Map());
      }
    })();
    (async () => {
      if (!sessionToken()) return;
      try {
        const data = await forge("GET", "/v1/accounts/me");
        if (!dead && data && (data.owner || data.account?.owner))
          setMe({ owner: data.owner || data.account.owner });
      } catch {}
    })();
    if (typeof location !== "undefined" && location.hash === "#new") {
      setShowCreate(true);
      setTimeout(() => {
        try {
          createRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {}
      }, 350);
    }
    return () => {
      dead = true;
    };
  }, []);

  // Public index: search + seed accounts, detection-filtered, registry-merged.
  R.useEffect(() => {
    if (registry === null) return;
    let dead = false;
    (async () => {
      const byId = new Map();
      const add = (recs) => {
        for (const r of recs || []) if (isPaperRecord(r)) byId.set(r.id, r);
      };
      let failed = false;
      try {
        const res = await fetch(`/api/kiln/public/search?q=${encodeURIComponent("paper")}`);
        const data = await res.json().catch(() => null);
        add(data && data.repos);
      } catch {
        failed = true;
      }
      for (const owner of SEED_ACCOUNTS) {
        try {
          const out = await lookupPublicAccount(owner);
          add(out && out.repos);
        } catch {
          failed = true;
        }
      }
      if (dead) return;
      if (!byId.size && failed) setPubError("The forge's public surface did not answer — the index reads it live, so this fills in when it responds.");
      const rows = [...byId.values()].map((rec) => paperRow(rec, registry.get(conceptIdOf(rec))));
      // Registry concepts with no detected repo record still belong in the
      // index when they are public (the anonymous probe only returns those).
      for (const c of registry.values()) {
        if (!rows.some((r) => r.conceptId === c.id)) rows.push(paperRow(null, c));
      }
      rows.sort((a, b) => String(b.releasedAt || b.updatedAt || "").localeCompare(String(a.releasedAt || a.updatedAt || "")));
      setPubRows(rows);
    })();
    return () => {
      dead = true;
    };
  }, [registry]);

  const myRows = R.useMemo(() => {
    if (!registry) return myPapers.map((rec) => paperRow(rec, null));
    return myPapers.map((rec) => paperRow(rec, registry.get(conceptIdOf(rec))));
  }, [myPapers, registry]);

  return j.jsxs("div", {
    className: "mx-auto w-full max-w-5xl",
    style: { paddingBottom: "1rem" },
    children: [
      // ---- hero
      j.jsxs("div", {
        key: "hero",
        children: [
          j.jsx("p", {
            className:
              "flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted",
            children: [
              j.jsx(LayersIcon, { key: "i", className: "size-3.5 text-seal" }),
              "Papers · the forge's publishing house",
            ],
          }),
          j.jsx("h1", {
            className: "mt-3 font-display text-4xl leading-[0.95] tracking-tight sm:text-5xl",
            children: "Papers Studio",
          }),
          j.jsx("p", {
            className: "mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted",
            children:
              "Write a paper in a repository. Release it like software. The release lands in the registry under the paper's own KILN ID — kiln:you/paper — with a record page on KILN Pages and citations generated from the release itself. KILN IDs are KILN-registered identifiers; they map 1:1 onto registered DOIs when a prefix exists.",
          }),
        ],
      }),
      // ---- doors
      j.jsxs("div", {
        key: "doors",
        className: "mt-6 flex flex-wrap items-center gap-2",
        children: [
          j.jsx("button", {
            key: "new",
            type: "button",
            className: "btn btn-primary h-8",
            onClick: () => {
              setShowCreate(!showCreate);
              setTimeout(() => {
                try {
                  createRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                } catch {}
              }, 60);
            },
            children: "New paper",
          }),
          j.jsx("a", { key: "rel", href: "#release", className: "btn h-8", children: "Release a paper" }),
          j.jsx("a", { key: "idx", href: "#index", className: "btn h-8", children: "Browse the index" }),
          registry && registry.size
            ? j.jsx(Chip, { key: "reg", seal: true, children: `registry live · ${registry.size} paper${registry.size === 1 ? "" : "s"}` })
            : null,
        ],
      }),
      // ---- create panel
      showCreate
        ? j.jsx("div", {
            key: "create",
            ref: createRef,
            children: j.jsx(CreatePaperPanel, { me, wallet }),
          })
        : j.jsx("div", { key: "create-anchor", ref: createRef }),
      // ---- my papers + release
      j.jsxs("div", {
        key: "mine",
        className: "mt-12",
        children: [
          j.jsx("h2", {
            className: "font-display text-2xl tracking-tight",
            children: "My papers",
          }),
          wallet || me
            ? myRows.length
              ? j.jsx("ul", {
                  className: "mt-4 flex flex-col gap-3",
                  children: myRows.map((row) =>
                    j.jsx(PaperRowView, {
                      key: row.key,
                      row,
                      action: j.jsx("button", {
                        type: "button",
                        className: "btn h-8",
                        onClick: () => setReleaseFor(row.repo),
                        children: "Release…",
                      }),
                    }),
                  ),
                })
              : j.jsx("p", {
                  className: "mt-3 text-sm leading-relaxed text-muted",
                  children:
                    "No papers yet under your handle. A repo becomes a paper when a paper.json manifest sits at its root — the New paper door above scaffolds one.",
                })
            : j.jsxs("p", {
                className: "mt-3 text-sm leading-relaxed text-muted",
                children: [
                  "Connect a wallet or sign in with your forge account to see your papers. ",
                  j.jsx(Link, { to: "/login", className: "text-seal", children: "Sign in" }),
                ],
              }),
        ],
      }),
      j.jsx("div", {
        key: "release",
        id: "release",
        children: j.jsx(ReleasePanel, {
          repos: myRepos,
          selected: releaseFor,
          onSelect: setReleaseFor,
          me,
          registry,
        }),
      }),
      // ---- public index
      j.jsxs("div", {
        key: "index",
        id: "index",
        className: "mt-12",
        children: [
          j.jsx("h2", {
            className: "font-display text-2xl tracking-tight",
            children: "Papers index",
          }),
          j.jsx("p", {
            className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
            children:
              "Every published paper the forge's public surface can see, in record form. Private papers never appear here — a paper record is exactly as public as its repository.",
          }),
          pubRows === null
            ? j.jsx("p", { className: "mt-4 text-sm text-muted", children: "Reading the forge…" })
            : pubRows.length
              ? j.jsx("ul", {
                  className: "mt-4 flex flex-col gap-3",
                  children: pubRows.map((row) => j.jsx(PaperRowView, { key: row.key, row })),
                })
              : j.jsx("p", {
                  className: "mt-4 text-sm leading-relaxed text-muted",
                  children: pubError || "No public papers yet.",
                }),
        ],
      }),
    ],
  });
}

// ------------------------------------------------------------ create door

function scaffoldManifest(form) {
  return {
    title: form.title.trim(),
    authors: form.authors
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, rest] = line.split("|").map((x) => x.trim());
        const author = { name };
        if (rest && /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(rest)) author.orcid = rest;
        else if (rest) author.affiliation = rest;
        return author;
      }),
    abstract: form.abstract.trim(),
    license: form.license.trim() || "CC-BY-4.0",
    keywords: form.keywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function CreatePaperPanel({ me, wallet }) {
  const [form, setForm] = R.useState({
    slug: "",
    title: "",
    authors: "",
    abstract: "",
    license: "CC-BY-4.0",
    keywords: "",
  });
  const [busy, setBusy] = R.useState(false);
  const [msg, setMsg] = R.useState("");
  const [doneId, setDoneId] = R.useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const manifest = scaffoldManifest(form);
  const canCreate =
    me && form.slug.trim() && manifest.title && manifest.authors.length && manifest.license;

  const create = async () => {
    setBusy(true);
    setMsg("");
    try {
      const owner = me.owner;
      const name = form.slug.trim();
      await forge("POST", "/v1/repos", {
        owner,
        name,
        description: manifest.title,
        visibility: "private",
      });
      const put = (path, content, message) =>
        forge("PUT", `/v1/repos/${owner}/${name}/contents`, { path, content, message });
      await put("paper.json", JSON.stringify(manifest, null, 2) + "\n", "paper: scaffold the manifest");
      await put(
        "paper.md",
        `# ${manifest.title}\n\n${manifest.abstract || "Abstract to come."}\n\n<!-- The paper lives here. Designate this repo as a paper and cut a forge release to register version 1 under its KILN ID. -->\n`,
        "paper: stub the paper",
      );
      await put(
        "README.md",
        `# ${manifest.title}\n\nA KILN paper. The manifest is \`paper.json\`; the paper is \`paper.md\`.\nIts KILN ID is \`kiln:${owner}/${name}\` — assigned in the registry at its first release.\n`,
        "paper: readme",
      );
      setDoneId(`${owner}/${name}`);
      setMsg("Repository created on the forge with the manifest scaffolded. Write the paper, then designate + release below.");
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const field = (label, key, props, hint) =>
    j.jsxs("label", {
      key,
      className: "block",
      children: [
        j.jsx("span", { key: "l", className: "text-xs font-medium text-muted", children: label }),
        j.jsx("input", {
          key: "i",
          className: "input mt-1",
          value: form[key],
          onChange: set(key),
          ...props,
        }),
        hint
          ? j.jsx("span", { key: "h", className: "mt-1 block text-[11px] text-subtle", children: hint })
          : null,
      ],
    });

  return j.jsxs("div", {
    className: "mt-6 rounded-lg border border-border bg-surface p-5",
    children: [
      j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: "New paper" }),
      j.jsx("p", {
        className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
        children:
          "A paper starts as a repository with a manifest. The manifest below becomes paper.json at the repo root; the paper itself is paper.md beside it. One author per line — append “| affiliation” or “| 0000-0002-1825-0097” (an ORCID iD) after a name.",
      }),
      j.jsxs("div", {
        className: "mt-4 grid gap-3 sm:grid-cols-2",
        children: [
          field("Repository name", "slug", { placeholder: "attention-is-all-you-need", autoCapitalize: "none", autoCorrect: "off" }),
          field("License", "license", { placeholder: "CC-BY-4.0" }),
        ],
      }),
      j.jsx("div", {
        className: "mt-3",
        children: field("Title", "title", { placeholder: "The paper's full title" }),
      }),
      j.jsxs("label", {
        className: "mt-3 block",
        children: [
          j.jsx("span", { className: "text-xs font-medium text-muted", children: "Authors (one per line)" }),
          j.jsx("textarea", {
            className: "input mt-1",
            rows: 3,
            value: form.authors,
            onChange: set("authors"),
            placeholder: "Ada Lovelace | Analytical Engines Lab",
          }),
        ],
      }),
      j.jsxs("label", {
        className: "mt-3 block",
        children: [
          j.jsx("span", { className: "text-xs font-medium text-muted", children: "Abstract" }),
          j.jsx("textarea", {
            className: "input mt-1",
            rows: 4,
            value: form.abstract,
            onChange: set("abstract"),
            placeholder: "What the paper shows, in a paragraph.",
          }),
        ],
      }),
      j.jsx("div", {
        className: "mt-3",
        children: field("Keywords (comma separated)", "keywords", { placeholder: "attention, transformers" }),
      }),
      j.jsxs("div", {
        className: "mt-4",
        children: [
          j.jsx("span", { className: "text-xs font-medium text-muted", children: "paper.json — written to the repo root" }),
          j.jsx("pre", {
            className:
              "mt-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-muted",
            children: JSON.stringify(manifest, null, 2),
          }),
        ],
      }),
      me
        ? j.jsxs("div", {
            className: "mt-4 flex flex-wrap items-center gap-2",
            children: [
              j.jsx("button", {
                key: "go",
                type: "button",
                className: "btn btn-primary h-8",
                disabled: !canCreate || busy,
                onClick: create,
                children: busy ? "Creating…" : `Create the paper repo as ${me.owner}`,
              }),
              doneId
                ? j.jsx(Link, {
                    key: "open",
                    to: `/${doneId.split("/")[0]}/${doneId.split("/")[1]}`,
                    className: "btn h-8",
                    children: `Open ${doneId}`,
                  })
                : null,
            ],
          })
        : j.jsxs("div", {
            className: "mt-4 flex flex-wrap items-center gap-2",
            children: [
              j.jsx(Link, { key: "n", to: "/new", search: { tab: "create" }, className: "btn h-8", children: "Create the repository" }),
              j.jsx(Link, { key: "a", to: "/account", className: "btn h-8", children: "Connect a forge account" }),
              j.jsx("span", {
                key: "note",
                className: "text-[11px] text-subtle",
                children: wallet
                  ? "Your wallet is connected; creating from here also needs a forge account session — the identity panel in Account issues one."
                  : "Creating from here needs a forge account session — sign in via Account, or start the repository and add this manifest by hand.",
              }),
            ],
          }),
      msg
        ? j.jsx("p", { className: "mt-3 text-sm leading-relaxed text-muted", children: msg })
        : null,
    ],
  });
}

// ----------------------------------------------------------- release door

function ReleasePanel({ repos, selected, onSelect, me, registry }) {
  const [tag, setTag] = R.useState("");
  const [busy, setBusy] = R.useState("");
  const [msg, setMsg] = R.useState("");
  const rec = selected || null;
  const manifest = rec ? manifestOf(rec) : null;
  const concept = rec && registry ? registry.get(conceptIdOf(rec)) : null;

  const designate = async () => {
    if (!rec) return;
    setBusy("designate");
    setMsg("");
    try {
      await forge("PATCH", `/v1/repos/${rec.owner}/${rec.name}/details`, {
        paper: { enabled: true },
      });
      setMsg("Designated as a paper. The next release registers a version in the papers registry.");
    } catch (e) {
      setMsg(
        `Designation answered: ${String(e?.message || e)} — the live daemon takes the paper designation when the papers-workflow build activates; the manifest and release doors here already work over the forge.`,
      );
    } finally {
      setBusy("");
    }
  };

  const release = async () => {
    if (!rec || !tag.trim()) return;
    setBusy("release");
    setMsg("");
    try {
      await forge("POST", `/v1/repos/${rec.owner}/${rec.name}/releases`, {
        tag: tag.trim(),
        name: manifest?.title || tag.trim(),
      });
      setMsg(
        concept || (registry && registry.size)
          ? `Release ${tag.trim()} created — the registry snapshots it as the next version of ${conceptIdOf(rec)}.`
          : `Release ${tag.trim()} created on the forge. When the papers registry activates on the daemon, releases of designated papers are snapshotted as registered versions with generated citations.`,
      );
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy("");
    }
  };

  return j.jsxs("div", {
    className: "mt-12 rounded-lg border border-border bg-surface p-5",
    children: [
      j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: "Release a paper" }),
      j.jsx("p", {
        className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
        children:
          "Pick one of your repositories. Designation marks it as a paper (the daemon checks a valid paper.json sits at the tip); a forge release then registers the next immutable version under its KILN ID.",
      }),
      repos && repos.length
        ? j.jsxs("div", {
            className: "mt-4 flex flex-wrap gap-2",
            children: repos.map((r) =>
              j.jsx("button", {
                key: r.id,
                type: "button",
                className: `chip ${rec && rec.id === r.id ? "text-seal" : ""}`,
                onClick: () => onSelect(r),
                children: `${r.owner}/${r.name}${isPaperRecord(r) ? " · paper" : ""}`,
              }),
            ),
          })
        : j.jsx("p", {
            className: "mt-3 text-sm text-muted",
            children: "Sign in to pick from your repositories.",
          }),
      rec
        ? j.jsxs("div", {
            className: "mt-4",
            children: [
              j.jsxs("div", {
                className: "flex flex-wrap items-center gap-2",
                children: [
                  j.jsx("span", {
                    className: "font-mono text-[11px] tracking-[0.14em] text-seal",
                    children: conceptIdOf(rec),
                  }),
                  j.jsx(Chip, {
                    children: manifest
                      ? "paper.json present"
                      : "no paper.json at the root — add the manifest first (New paper shows the shape)",
                  }),
                  concept
                    ? j.jsx(Chip, { seal: true, children: `${concept.versionCount} registered version${concept.versionCount === 1 ? "" : "s"}` })
                    : null,
                ],
              }),
              me
                ? j.jsxs("div", {
                    className: "mt-4 flex flex-wrap items-center gap-2",
                    children: [
                      j.jsx("button", {
                        key: "d",
                        type: "button",
                        className: "btn h-8",
                        disabled: busy === "designate",
                        onClick: designate,
                        children: busy === "designate" ? "Designating…" : "Designate as a paper",
                      }),
                      j.jsx("input", {
                        key: "tag",
                        className: "input",
                        style: { maxWidth: "10rem" },
                        placeholder: "v1.0.0",
                        value: tag,
                        onChange: (e) => setTag(e.target.value),
                        autoCapitalize: "none",
                        autoCorrect: "off",
                      }),
                      j.jsx("button", {
                        key: "r",
                        type: "button",
                        className: "btn btn-primary h-8",
                        disabled: busy === "release" || !tag.trim(),
                        onClick: release,
                        children: busy === "release" ? "Releasing…" : "Cut the release",
                      }),
                    ],
                  })
                : j.jsxs("div", {
                    className: "mt-4 flex flex-wrap items-center gap-2",
                    children: [
                      j.jsx(Link, {
                        key: "rel",
                        to: `/${rec.owner}/${rec.name}/releases`,
                        className: "btn h-8",
                        children: "Open its releases page",
                      }),
                      j.jsx("span", {
                        className: "text-[11px] text-subtle",
                        children:
                          "Designating and releasing from here needs a forge account session — connect one in Account.",
                      }),
                    ],
                  }),
              msg
                ? j.jsx("p", { className: "mt-3 text-sm leading-relaxed text-muted", children: msg })
                : null,
            ],
          })
        : null,
    ],
  });
}
