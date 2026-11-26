/**
 * Repo meta bar — the repo page's forge-truth strip (parity batch,
 * closes G18 + the repo-page half of G8).
 *
 * Mounted once by AppShell next to the Create sheet (the house global
 * mount precedent); it self-gates on the location: exactly two path
 * segments whose first segment is not a reserved app route means a
 * repo page /:owner/:repo, and only then does it read and render.
 * Everywhere else it renders nothing and makes no calls.
 *
 * What it shows, all read live from the repo's project details
 * (GET /v1/repos/:owner/:repo/details, via kiln-parity-core):
 *  - the repo's VISIBILITY, plainly — "Public" or "Private" — on every
 *    repo page. Visibility is the daemon's fail-closed law: a repo is
 *    public only when its stored metadata says exactly "public";
 *    everything else is private. Showing the state on the surface is
 *    the fix for "nothing shows public": public repos say so, and
 *    private ones say why nothing shows.
 *  - the CI chip (G8): details.ci mapped by ciVerdict — pass / fail /
 *    running / "No CI configured" (ci null). Never a fake green.
 *  - description + topics as stored.
 *
 * Owner-only settings (G18): when the signed-in account owns the repo
 * namespace, a Settings button opens the edit panel — description,
 * topics, and THE visibility flip — saved through the details PATCH.
 * The daemon enforces owner-only itself (403 for anyone else); this
 * UI simply never offers the door to non-owners and never fakes a
 * save. Making a repo public takes an explicit confirm step that
 * says what public means; flipping back to private is one click.
 * Non-owners and signed-out visitors see the state, never the form.
 *
 * Completion (usefulness phase): the settings panel also carries the
 * repo's Pages designation (enabled + branch + path) and paper
 * designation (enabled) over the same details PATCH — the fields
 * kiln-papers.js already designates through; this is the settings-door
 * view of the same record, not a second flow. PATCH answers carry the
 * daemon's full post-write details, which is what the panel re-renders.
 *
 * If the details read fails (a private repo signed out, the forge
 * unreachable), the bar renders nothing: the frozen repo page already
 * carries its own states, and a meta strip that cannot read the truth
 * must not invent one.
 */
import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { createIdentityClient } from "./kiln-identity-core.js";
import { createParityClient, ParityApiError, ciVerdict, parseTopics, invalidTopics } from "./kiln-parity-core.js";
import { CiChip } from "./kiln-workspaces.js";

const R = reactNs(React(), 1);
const j = jsxmod();

const SESSION_KEY = "kiln.daemon.session.v1";

// First segments that are app routes, not owner namespaces (the frozen
// route tree's top level, plus the shadow surfaces and the paper/doi
// doors). A two-segment path under one of these is never a repo page.
const RESERVED = new Set([
  "account", "apps", "architecture", "assistants", "bounties", "chain",
  "cli", "cloud", "explore", "gists", "gpu", "invite", "login",
  "marketplace", "mcp", "members", "models", "new", "notifications",
  "orgs", "packages", "paper", "papers", "pricing", "search", "start",
  "studio", "wallet", "repos", "agents", "workspaces", "doi", "pages",
  "settings", "start-here", "u",
]);

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

const identity = createIdentityClient({ getToken: sessionToken });
const parity = createParityClient({ getToken: sessionToken });

function repoFromLocation() {
  try {
    const segs = (location.pathname || "").split("/").filter(Boolean);
    if (segs.length !== 2) return null;
    const [owner, repo] = segs;
    if (RESERVED.has(owner.toLowerCase())) return null;
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

export function KilnRepoMetaBar() {
  const [where, setWhere] = R.useState(() => repoFromLocation());
  const [details, setDetails] = R.useState(undefined); // undefined = loading/none, null = unreadable
  const [me, setMe] = R.useState(undefined);
  const [open, setOpen] = R.useState(false);
  const [desc, setDesc] = R.useState("");
  const [topicsText, setTopicsText] = R.useState("");
  const [busy, setBusy] = R.useState(false);
  const [err, setErr] = R.useState("");
  const [note, setNote] = R.useState("");
  const [armPublic, setArmPublic] = R.useState(false);
  const [pagesBranch, setPagesBranch] = R.useState("");
  const [pagesPath, setPagesPath] = R.useState("");

  // The frozen router navigates client-side; poll the path cheaply so
  // the bar follows SPA navigation (and disappears off repo pages).
  R.useEffect(() => {
    const id = setInterval(() => {
      const next = repoFromLocation();
      setWhere((cur) => {
        if (!cur && !next) return cur;
        if (cur && next && cur.owner === next.owner && cur.repo === next.repo) return cur;
        return next;
      });
    }, 700);
    return () => clearInterval(id);
  }, []);

  R.useEffect(() => {
    setOpen(false);
    setErr("");
    setNote("");
    setArmPublic(false);
    if (!where) {
      setDetails(undefined);
      return;
    }
    let live = true;
    setDetails(undefined);
    (async () => {
      try {
        const d = await parity.getRepoDetails(where.owner, where.repo);
        if (live) setDetails(d);
      } catch {
        if (live) setDetails(null);
      }
    })();
    (async () => {
      if (!sessionToken()) {
        if (live) setMe(null);
        return;
      }
      try {
        const res = await identity.me();
        if (live) setMe(res?.account || null);
      } catch {
        if (live) setMe(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [where]);

  if (!where || details === undefined || details === null) return null;

  const isOwner = !!me && me.owner === where.owner;
  const vis = details.visibility === "public" ? "public" : "private";
  const verdict = ciVerdict(details.ci);

  const openSettings = () => {
    setDesc(details.description || "");
    setTopicsText((details.topics || []).join(", "));
    setPagesBranch((details.pages && details.pages.branch) || "");
    setPagesPath((details.pages && details.pages.path) || "");
    setErr("");
    setNote("");
    setArmPublic(false);
    setOpen(true);
  };

  const save = async (patch, okText) => {
    setBusy(true);
    setErr("");
    setNote("");
    try {
      const res = await parity.patchRepoDetails(where.owner, where.repo, patch);
      if (res?.details) setDetails(res.details);
      setArmPublic(false);
      if (okText) setNote(okText);
    } catch (e) {
      setErr(e instanceof ParityApiError ? e.message : e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const saveMeta = () => {
    const topics = parseTopics(topicsText);
    const bad = invalidTopics(topics);
    if (bad.length) {
      setErr(`Invalid topic "${bad[0]}": topics are lowercase letters, digits and dashes, up to 32 characters.`);
      return;
    }
    if (topics.length > 16) {
      setErr("At most 16 topics.");
      return;
    }
    if (desc.length > 1024) {
      setErr("Description must be at most 1024 characters.");
      return;
    }
    const patch = {};
    if (desc !== (details.description || "")) patch.description = desc;
    if (JSON.stringify(topics) !== JSON.stringify(details.topics || [])) patch.topics = topics;
    if (!Object.keys(patch).length) {
      setNote("Nothing changed.");
      return;
    }
    void save(patch, "Repository details saved — the forge record is updated everywhere at once.");
  };

  const children = [
    j.jsxs("div", {
      key: "bar",
      className: "flex flex-wrap items-center gap-2",
      children: [
        vis === "public"
          ? j.jsx("span", { className: "chip text-seal", children: "Public" })
          : j.jsx("span", { className: "chip", children: "Private" }),
        j.jsx(CiChip, { verdict }),
        details.description ? j.jsx("span", { className: "min-w-0 text-sm text-muted", children: details.description }) : null,
        ...(Array.isArray(details.topics) ? details.topics : []).map((t) => j.jsx("span", { key: `t-${t}`, className: "chip", children: t })),
        j.jsx("span", { className: "flex-1" }),
        isOwner
          ? j.jsx("button", {
              type: "button",
              className: "btn min-h-11 px-3",
              onClick: () => (open ? setOpen(false) : openSettings()),
              children: open ? "Close settings" : "Settings",
            })
          : null,
      ],
    }),
    j.jsx("p", {
      key: "vis-note",
      className: "mt-1 text-xs text-subtle",
      children:
        vis === "public"
          ? "This repository is public: anyone can read it, signed in or not. Writes stay owner-only."
          : "This repository is private: only its owner's namespace can read it. Nothing in it shows publicly.",
    }),
  ];

  if (note) children.push(j.jsx("p", { key: "note", className: "mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-seal", children: note }));
  if (err) children.push(j.jsx("p", { key: "err", className: "mt-3 rounded-lg border border-border px-3 py-2 text-sm text-red-500", children: err }));

  if (open && isOwner) {
    children.push(
      j.jsxs("div", {
        key: "panel",
        className: "mt-4 grid gap-3 rounded-xl border border-border bg-surface p-5",
        children: [
          j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: "Repository settings" }),
          j.jsxs("label", {
            className: "block text-xs uppercase tracking-[0.14em] text-muted",
            children: [
              "Description",
              j.jsx("input", {
                className: "input mt-1.5",
                value: desc,
                onChange: (e) => setDesc(e.target.value),
                placeholder: "What this repository is",
                maxLength: 1024,
              }),
            ],
          }),
          j.jsxs("label", {
            className: "block text-xs uppercase tracking-[0.14em] text-muted",
            children: [
              "Topics (comma separated)",
              j.jsx("input", {
                className: "input mt-1.5",
                value: topicsText,
                onChange: (e) => setTopicsText(e.target.value),
                placeholder: "edge, api, forge",
                autoCapitalize: "none",
                autoCorrect: "off",
              }),
            ],
          }),
          j.jsx("button", {
            type: "button",
            className: "btn-primary btn min-h-11",
            disabled: busy,
            onClick: saveMeta,
            children: busy ? "Saving…" : "Save description & topics",
          }),
          j.jsxs("div", {
            className: "mt-2 border-t border-border pt-4",
            children: [
              j.jsx("p", { className: "text-xs uppercase tracking-[0.14em] text-muted", children: "Visibility" }),
              j.jsx("p", {
                className: "mt-2 text-sm leading-relaxed text-muted",
                children:
                  vis === "public"
                    ? "This repository is public. Making it private hides it from everyone outside your namespace immediately — the forge checks the stored visibility on every read."
                    : "This repository is private. Making it public lets anyone read it — files, history, project details — signed in or not, like a public GitHub repo. Writes stay owner-only either way.",
              }),
              armPublic
                ? j.jsxs("div", {
                    className: "mt-3 flex flex-wrap items-center gap-2",
                    children: [
                      j.jsx("span", { className: "text-sm text-red-500", children: "Make this repository readable by anyone?" }),
                      j.jsx("button", {
                        type: "button",
                        className: "btn min-h-11 px-3",
                        disabled: busy,
                        onClick: () => void save({ visibility: "public" }, "Repository is now public — anyone can read it."),
                        children: "Confirm — make public",
                      }),
                      j.jsx("button", { type: "button", className: "btn min-h-11 px-3", onClick: () => setArmPublic(false), children: "Keep private" }),
                    ],
                  })
                : j.jsx("button", {
                    type: "button",
                    className: "btn mt-3 min-h-11 px-3",
                    disabled: busy,
                    onClick: () => {
                      if (vis === "public") void save({ visibility: "private" }, "Repository is now private — only your namespace can read it.");
                      else setArmPublic(true);
                    },
                    children: vis === "public" ? "Make private" : "Make public",
                  }),
            ],
          }),
          j.jsxs("div", {
            className: "mt-2 border-t border-border pt-4",
            children: [
              j.jsx("p", { className: "text-xs uppercase tracking-[0.14em] text-muted", children: "KILN Pages" }),
              j.jsx("p", {
                className: "mt-2 text-sm leading-relaxed text-muted",
                children:
                  details.pages && details.pages.enabled
                    ? `Pages is on: this repo serves as a site at /pages/${where.owner}/${where.repo}/ from ${details.pages.branch ? `branch ${details.pages.branch}` : "the default branch"}${details.pages.path ? `, path ${details.pages.path}` : ", at the repo root"}. The visibility law above applies to the site too — a private repo's site answers sign-in required.`
                    : "Pages is off. Turning it on serves this repo's current ref as a site at /pages/<owner>/<repo>/ — the designation the forge's Pages server reads. The visibility law above applies to the site too.",
              }),
              j.jsxs("div", {
                className: "mt-3 flex flex-wrap items-center gap-2",
                children: [
                  j.jsx("button", {
                    type: "button",
                    className: "btn min-h-11 px-3",
                    disabled: busy,
                    onClick: () =>
                      void save(
                        { pages: { enabled: !(details.pages && details.pages.enabled), branch: pagesBranch, path: pagesPath } },
                        details.pages && details.pages.enabled ? "Pages is off — the site no longer serves." : "Pages is on — the site serves from this repo.",
                      ),
                    children: details.pages && details.pages.enabled ? "Turn Pages off" : "Turn Pages on",
                  }),
                  details.pages && details.pages.enabled
                    ? j.jsx("a", { className: "text-sm text-seal hover:underline", href: `/pages/${where.owner}/${where.repo}/`, children: "Open the live site" })
                    : null,
                ],
              }),
              j.jsxs("form", {
                className: "mt-3 flex flex-col gap-2 sm:flex-row",
                onSubmit: (e) => {
                  e.preventDefault();
                  void save({ pages: { branch: pagesBranch, path: pagesPath } }, "Pages source saved.");
                },
                children: [
                  j.jsx("input", { className: "input min-w-0 flex-1 font-mono", value: pagesBranch, onChange: (e) => setPagesBranch(e.target.value), placeholder: "branch (blank = default branch)", autoCapitalize: "none", autoCorrect: "off" }),
                  j.jsx("input", { className: "input min-w-0 flex-1 font-mono", value: pagesPath, onChange: (e) => setPagesPath(e.target.value), placeholder: "path (blank = root, e.g. site)", autoCapitalize: "none", autoCorrect: "off" }),
                  j.jsx("button", { type: "submit", className: "btn min-h-11 shrink-0 px-3", disabled: busy, children: "Save source" }),
                ],
              }),
            ],
          }),
          j.jsxs("div", {
            className: "mt-2 border-t border-border pt-4",
            children: [
              j.jsx("p", { className: "text-xs uppercase tracking-[0.14em] text-muted", children: "Paper designation" }),
              j.jsx("p", {
                className: "mt-2 text-sm leading-relaxed text-muted",
                children:
                  details.paper && details.paper.enabled
                    ? "This repo is designated as a paper. Releases register versions under its KILN ID in the Papers Studio."
                    : "Not designated as a paper. Designation is by manifest: the forge requires a valid paper.json at the repo root on the default branch and refuses without one. Releases and the registry live in the Papers Studio.",
              }),
              j.jsx("button", {
                type: "button",
                className: "btn mt-3 min-h-11 px-3",
                disabled: busy,
                onClick: () =>
                  void save(
                    { paper: { enabled: !(details.paper && details.paper.enabled) } },
                    details.paper && details.paper.enabled ? "Paper designation removed." : "Designated as a paper — releases register under its KILN ID.",
                  ),
                children: details.paper && details.paper.enabled ? "Remove designation" : "Designate as a paper",
              }),
            ],
          }),
        ],
      }),
    );
  }

  return j.jsx("div", {
    className: "mx-auto w-full max-w-[1320px] px-4 pt-4 sm:px-6",
    children: j.jsx("div", { className: "rounded-xl border border-border bg-surface p-4", children }),
  });
}
