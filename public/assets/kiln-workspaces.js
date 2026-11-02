/**
 * Workspaces — the /workspaces surface (parity batch, closes G1).
 *
 * The frozen router admits no new route, so /workspaces resolves
 * through /$owner with owner "workspaces"; the _owner chunk's wrapper
 * hands that one owner value to this surface (the /repos and /agents
 * precedent).
 *
 * Contents (real daemon doors, through this origin's /api/forge proxy):
 *  - my workspaces (GET /v1/workspaces — the daemon returns the ones
 *    the session account owns PLUS any it belongs to as a member):
 *    name, slug, repo count, and whether it is yours or shared with you;
 *  - workspace detail (GET /v1/workspaces/:id, the aggregated live
 *    status): the repos inside (each with its forge CI chip, G8, read
 *    from that repo's project details), linked sites, and the members
 *    list read (owner + members[] with roles — the owner is never a
 *    member; membership changes ride the email-invite doors, not this
 *    surface);
 *  - create workspace (POST /v1/workspaces {owner, slug, name,
 *    description?}) under the signed-in account's own namespace —
 *    the daemon refuses any other owner with 403, and the Create
 *    sheet's "New workspace" door lands here with ?new=1.
 *
 * The workspaces routes are LIVE on the running daemon (verified
 * read-only 2026-11-02); a 404 still renders the honest
 * not-yet-active state in case an older daemon answers.
 */
import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { createIdentityClient } from "./kiln-identity-core.js";
import { createParityClient, ParityApiError, isNotYetActive, ciVerdict } from "./kiln-parity-core.js";

const R = reactNs(React(), 1);
const j = jsxmod();

const SESSION_KEY = "kiln.daemon.session.v1";

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

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/** The G8 CI chip, shared shape with the repo page bar. */
export function CiChip({ verdict }) {
  if (!verdict) return null;
  const cls =
    verdict.state === "pass"
      ? "chip text-seal"
      : verdict.state === "fail"
        ? "chip text-red-500"
        : verdict.state === "running"
          ? "chip text-amber-500"
          : "chip";
  return j.jsx("span", { className: cls, children: verdict.label });
}

function section(title, children, sub, eyebrow) {
  return j.jsxs("section", {
    className: "mt-6 rounded-xl border border-border bg-surface p-5",
    children: [
      j.jsx("p", { className: "text-[10px] uppercase tracking-[0.16em] text-muted", children: eyebrow || "Workspaces" }),
      j.jsx("h2", { className: "mt-1 font-display text-2xl tracking-tight", children: title }),
      sub ? j.jsx("p", { className: "mt-2 text-sm leading-relaxed text-muted", children: sub }) : null,
      ...children,
    ],
  });
}

// ------------------------------------------------------------ detail

function WorkspaceDetail({ id, me, onBack }) {
  const [status, setStatus] = R.useState(undefined); // undefined = loading, null = failed
  const [chips, setChips] = R.useState({}); // repoRef -> verdict
  const [err, setErr] = R.useState("");

  R.useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await parity.getWorkspace(id);
        if (!live) return;
        setStatus(res);
        const repos = Array.isArray(res?.repos) ? res.repos : [];
        // G8: the aggregated status carries no CI verdict, so each
        // member repo's chip is read from its own project details —
        // the same details.ci the repo page renders. Capped so a huge
        // workspace cannot fan out unboundedly.
        for (const entry of repos.slice(0, 24)) {
          const ref = entry?.repo;
          if (!ref || !entry.exists) continue;
          const [o, r] = ref.split("/");
          try {
            const d = await parity.getRepoDetails(o, r);
            if (live) setChips((c) => ({ ...c, [ref]: ciVerdict(d?.ci) }));
          } catch {
            if (live) setChips((c) => ({ ...c, [ref]: { state: "none", label: "CI unknown", status: null } }));
          }
        }
      } catch (e) {
        if (!live) return;
        setStatus(null);
        setErr(
          isNotYetActive(e)
            ? "Workspaces switch on with the next daemon update — the running forge doesn't answer this door yet."
            : e instanceof Error
              ? e.message
              : "Could not read this workspace",
        );
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);

  if (status === undefined) return j.jsx("p", { className: "mt-6 text-sm text-muted", children: "Reading the workspace…" });
  if (status === null)
    return j.jsxs("div", {
      children: [
        j.jsx("p", { className: "mt-6 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-red-500", children: err }),
        j.jsx("button", { type: "button", className: "btn mt-4 min-h-11", onClick: onBack, children: "Back to workspaces" }),
      ],
    });

  const ws = status.workspace || {};
  const repos = Array.isArray(status.repos) ? status.repos : [];
  const sites = Array.isArray(status.sites) ? status.sites : [];
  const members = Array.isArray(ws.members) ? ws.members : [];
  const mine = me && ws.owner === me.owner;

  return j.jsxs("div", {
    children: [
      j.jsx("button", { type: "button", className: "btn min-h-11", onClick: onBack, children: "Back to workspaces" }),
      j.jsx("p", { className: "mt-4 text-[11px] uppercase tracking-[0.2em] text-muted", children: "Workspace" }),
      j.jsx("h1", { className: "mt-1 font-display text-4xl tracking-tight", children: ws.name || ws.slug || id }),
      j.jsxs("p", {
        className: "mt-1 flex flex-wrap items-center gap-2 text-sm text-muted",
        children: [
          j.jsx("span", { className: "font-mono text-xs", children: `${ws.owner}/${ws.slug}` }),
          mine
            ? j.jsx("span", { className: "chip text-seal", children: "Yours" })
            : j.jsx("span", { className: "chip", children: `Shared with you · owner ${ws.owner}` }),
          status.parent ? j.jsx("span", { className: "chip", children: `Part of ${status.parent.name || status.parent.slug}` }) : null,
        ],
      }),
      ws.description ? j.jsx("p", { className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted", children: ws.description }) : null,

      section(
        "Repositories",
        [
          repos.length
            ? j.jsx("ul", {
                className: "mt-3 divide-y divide-border rounded-lg border border-border",
                children: repos.map((entry) =>
                  j.jsxs(
                    "li",
                    {
                      className: "flex flex-wrap items-center gap-2 px-3 py-3 text-sm",
                      children: [
                        entry.exists
                          ? j.jsx(Link, { to: `/${entry.repo}`, className: "font-mono font-medium text-seal hover:underline", children: entry.repo })
                          : j.jsx("span", { className: "font-mono text-muted", children: entry.repo }),
                        entry.exists ? null : j.jsx("span", { className: "chip", children: "No longer on the forge" }),
                        entry.details?.description ? j.jsx("span", { className: "text-muted", children: entry.details.description }) : null,
                        j.jsx("span", { className: "flex-1" }),
                        entry.exists && chips[entry.repo] ? j.jsx(CiChip, { verdict: chips[entry.repo] }) : null,
                        entry.head?.shortSha
                          ? j.jsx("span", { className: "font-mono text-xs text-subtle", children: `${entry.head.shortSha}${entry.head.subject ? ` · ${entry.head.subject}` : ""}` })
                          : entry.exists
                            ? j.jsx("span", { className: "text-xs text-subtle", children: "Empty repository" })
                            : null,
                      ],
                    },
                    entry.repo,
                  ),
                ),
              })
            : j.jsx("p", { className: "mt-3 text-sm text-muted", children: "No repositories in this workspace yet." }),
        ],
        "Every repo this workspace groups, read live from the forge — HEAD, description, and the latest CI verdict per repo.",
        "Inside",
      ),

      section(
        "Members",
        [
          j.jsx("ul", {
            className: "mt-3 divide-y divide-border rounded-lg border border-border",
            children: [
              j.jsxs(
                "li",
                {
                  className: "flex flex-wrap items-center gap-2 px-3 py-3 text-sm",
                  children: [
                    j.jsx("span", { className: "font-mono font-medium", children: ws.owner }),
                    j.jsx("span", { className: "chip text-seal", children: "Owner" }),
                  ],
                },
                "owner",
              ),
              ...members.map((m) =>
                j.jsxs(
                  "li",
                  {
                    className: "flex flex-wrap items-center gap-2 px-3 py-3 text-sm",
                    children: [
                      j.jsx("span", { className: "font-mono", children: m.owner }),
                      j.jsx("span", { className: "chip", children: m.role || "member" }),
                      m.via ? j.jsx("span", { className: "text-xs text-subtle", children: `via ${m.via}` }) : null,
                      m.joinedAt ? j.jsx("span", { className: "text-xs text-subtle", children: `joined ${fmtDate(m.joinedAt)}` }) : null,
                    ],
                  },
                  m.owner,
                ),
              ),
            ],
          }),
          members.length
            ? null
            : j.jsx("p", { className: "mt-3 text-sm text-muted", children: "No members yet — the owner works alone here for now. Members join through email invites sent to their address; this list is the read view of who is in." }),
        ],
        "The owner plus every account that joined by email invite, with its role. Read-only here: invites are managed through the workspace's invite doors.",
        "Who is in",
      ),

      sites.length
        ? section(
            "Linked sites",
            [
              j.jsx("ul", {
                className: "mt-3 divide-y divide-border rounded-lg border border-border",
                children: sites.map((s) =>
                  j.jsxs(
                    "li",
                    {
                      className: "flex flex-wrap items-center gap-2 px-3 py-3 text-sm",
                      children: [
                        j.jsx("span", { className: "font-medium", children: s.name || s.id }),
                        s.found
                          ? j.jsx("span", { className: "font-mono text-xs text-subtle", children: `${s.frontend} + ${s.backend}` })
                          : j.jsx("span", { className: "chip", children: "Site record gone" }),
                      ],
                    },
                    s.id,
                  ),
                ),
              }),
            ],
            undefined,
            "Sites",
          )
        : null,
    ],
  });
}

// ------------------------------------------------------------ surface

export function KilnWorkspacesSurface() {
  const [tick, setTick] = R.useState(0);
  const [me, setMe] = R.useState(undefined); // undefined = loading, null = signed out
  const [list, setList] = R.useState(null);
  const [off, setOff] = R.useState(false);
  const [err, setErr] = R.useState("");
  const [note, setNote] = R.useState("");
  const [busy, setBusy] = R.useState(false);
  const [selected, setSelected] = R.useState("");
  const [showCreate, setShowCreate] = R.useState(() => {
    try {
      return new URLSearchParams(location.search || "").get("new") === "1";
    } catch {
      return false;
    }
  });
  const [cName, setCName] = R.useState("");
  const [cSlug, setCSlug] = R.useState("");
  const [cDesc, setCDesc] = R.useState("");
  const [slugTouched, setSlugTouched] = R.useState(false);

  const load = async () => {
    if (!sessionToken()) {
      setMe(null);
      return;
    }
    try {
      const res = await identity.me();
      setMe(res?.account || null);
    } catch {
      setMe(null);
      return;
    }
    try {
      const res = await parity.listWorkspaces();
      setList(Array.isArray(res?.workspaces) ? res.workspaces : []);
      setOff(false);
    } catch (e) {
      if (isNotYetActive(e)) setOff(true);
      else setErr(e instanceof Error ? e.message : "Could not read workspaces");
      setList([]);
    }
  };

  R.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  if (selected && me) {
    return j.jsx("div", {
      className: "mx-auto w-full max-w-5xl",
      children: j.jsx(WorkspaceDetail, { id: selected, me, onBack: () => setSelected("") }),
    });
  }

  const children = [
    j.jsxs("div", {
      key: "head",
      children: [
        j.jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-muted", children: "Workspaces" }),
        j.jsx("h1", { className: "mt-1 font-display text-4xl tracking-tight", children: "Your workspaces" }),
        j.jsx("p", {
          className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
          children:
            "A workspace is the whole effort, not just one repo: any number of member repositories and linked sites grouped under one owner and one slug, so the forge can serve, check, and keep honest what used to live in people's heads.",
        }),
      ],
    }),
  ];

  if (err) children.push(j.jsx("p", { key: "err", className: "mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-red-500", children: err }));
  if (note) children.push(j.jsx("p", { key: "note", className: "mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-seal", children: note }));

  if (me === undefined) {
    children.push(j.jsx("p", { key: "load", className: "mt-6 text-sm text-muted", children: "Reading your workspaces…" }));
    return j.jsx("div", { className: "mx-auto w-full max-w-5xl", children });
  }

  if (!me) {
    children.push(
      j.jsxs("div", {
        key: "out",
        className: "mt-6 rounded-xl border border-border bg-surface p-5",
        children: [
          j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: "Sign in to see your workspaces" }),
          j.jsx("p", {
            className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
            children:
              "Workspaces live behind your forge account session: the ones you own and the ones you belong to as a member. Sign in and they are all here — there is no public workspace directory, by design.",
          }),
          j.jsx(Link, { to: "/login", className: "btn-primary btn mt-4 min-h-11", children: "Sign in" }),
        ],
      }),
    );
    return j.jsx("div", { className: "mx-auto w-full max-w-5xl", children });
  }

  if (off) {
    children.push(
      j.jsx("p", {
        key: "off",
        className: "mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted",
        children:
          "Workspaces are built and switch on with the next daemon update — the running forge doesn't answer the workspace doors yet. Nothing is faked here in the meantime; this page fills in as soon as the daemon answers.",
      }),
    );
  }

  children.push(
    section(
      "All workspaces",
      [
        list && list.length
          ? j.jsx("ul", {
              className: "mt-3 divide-y divide-border rounded-lg border border-border",
              children: list.map((w) =>
                j.jsxs(
                  "li",
                  {
                    className: "flex flex-wrap items-center gap-2 px-3 py-3 text-sm",
                    children: [
                      j.jsx("button", {
                        type: "button",
                        className: "font-medium text-seal hover:underline",
                        onClick: () => setSelected(w.id),
                        children: w.name || w.slug,
                      }),
                      j.jsx("span", { className: "font-mono text-xs text-subtle", children: `${w.owner}/${w.slug}` }),
                      w.owner === me.owner
                        ? j.jsx("span", { className: "chip text-seal", children: "Yours" })
                        : j.jsx("span", { className: "chip", children: "Member" }),
                      j.jsx("span", { className: "flex-1" }),
                      j.jsx("span", {
                        className: "text-xs text-muted",
                        children: `${Array.isArray(w.repos) ? w.repos.length : 0} ${Array.isArray(w.repos) && w.repos.length === 1 ? "repository" : "repositories"}`,
                      }),
                    ],
                  },
                  w.id,
                ),
              ),
            })
          : j.jsx("p", {
              className: "mt-3 text-sm text-muted",
              children: off ? "This list answers when the daemon update lands." : "No workspaces yet. Create the first one below — group the repos of one effort under a single name.",
            }),
      ],
      "Yours, plus every workspace you belong to as a member. Open one to see its repos, its members, and its linked sites.",
      "On the forge",
    ),
  );

  children.push(
    section(
      "New workspace",
      [
        showCreate
          ? j.jsx("form", {
              className: "mt-3 grid gap-3",
              onSubmit: (e) => {
                e.preventDefault();
                void (async () => {
                  setBusy(true);
                  setErr("");
                  setNote("");
                  try {
                    const res = await parity.createWorkspace({
                      owner: me.owner,
                      slug: cSlug.trim().toLowerCase(),
                      name: cName.trim(),
                      description: cDesc.trim() || undefined,
                    });
                    setNote(`Workspace created: ${res?.workspace?.name || cName.trim()} (${me.owner}/${cSlug.trim().toLowerCase()}). It is already true on the forge — every door reads the same record.`);
                    setCName("");
                    setCSlug("");
                    setCDesc("");
                    setSlugTouched(false);
                    setShowCreate(false);
                    setTick((t) => t + 1);
                  } catch (e2) {
                    if (isNotYetActive(e2)) setOff(true);
                    if (e2 instanceof ParityApiError && e2.status === 409) {
                      setErr(`You already have a workspace at ${me.owner}/${cSlug.trim().toLowerCase()} — pick another slug.`);
                    } else {
                      setErr(e2 instanceof Error ? e2.message : "Create failed");
                    }
                  } finally {
                    setBusy(false);
                  }
                })();
              },
              children: [
                j.jsxs("label", {
                  className: "block text-xs uppercase tracking-[0.14em] text-muted",
                  children: [
                    "Name",
                    j.jsx("input", {
                      className: "input mt-1.5",
                      value: cName,
                      onChange: (e) => {
                        setCName(e.target.value);
                        if (!slugTouched) {
                          setCSlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/^-+|-+$/g, "")
                              .slice(0, 64),
                          );
                        }
                      },
                      placeholder: "DFW Haul",
                      required: true,
                    }),
                  ],
                }),
                j.jsxs("label", {
                  className: "block text-xs uppercase tracking-[0.14em] text-muted",
                  children: [
                    "Slug",
                    j.jsx("input", {
                      className: "input mt-1.5",
                      value: cSlug,
                      onChange: (e) => {
                        setSlugTouched(true);
                        setCSlug(e.target.value.toLowerCase());
                      },
                      placeholder: "dfw-haul",
                      required: true,
                      autoCapitalize: "none",
                      autoCorrect: "off",
                    }),
                    j.jsx("span", { className: "mt-1 block font-mono text-[11px] normal-case tracking-normal text-subtle", children: `${me.owner}/${cSlug || "…"}` }),
                  ],
                }),
                j.jsxs("label", {
                  className: "block text-xs uppercase tracking-[0.14em] text-muted",
                  children: [
                    "Description (optional)",
                    j.jsx("input", { className: "input mt-1.5", value: cDesc, onChange: (e) => setCDesc(e.target.value), placeholder: "What this effort is" }),
                  ],
                }),
                j.jsxs("div", {
                  className: "flex flex-wrap gap-2",
                  children: [
                    j.jsx("button", { type: "submit", className: "btn-primary btn min-h-11", disabled: busy || off, children: busy ? "Creating…" : "Create workspace" }),
                    j.jsx("button", { type: "button", className: "btn min-h-11", onClick: () => setShowCreate(false), children: "Cancel" }),
                  ],
                }),
                j.jsx("p", {
                  className: "text-xs leading-relaxed text-muted",
                  children: "The workspace starts empty — add repos to it from the forge doors (the workspace API and the agent kit carry the add-repo patch). Creating writes the record on the one daemon both doors read, so it is true everywhere at once.",
                }),
              ],
            })
          : j.jsx("button", {
              type: "button",
              className: "btn-primary btn mt-3 min-h-11",
              disabled: off,
              onClick: () => setShowCreate(true),
              children: "New workspace",
            }),
      ],
      "A workspace is created under your own namespace — the daemon refuses any other owner, and the slug must be free in your namespace.",
      "Create",
    ),
  );

  return j.jsx("div", { className: "mx-auto w-full max-w-5xl", children });
}
