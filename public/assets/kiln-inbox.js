/**
 * Inbox — the /notifications rebuild (design round, Piece 4b).
 *
 * The old page rendered the store's notices as one flat list of
 * title-or-JSON strings. This is a real inbox over the data the app
 * can actually see — nothing here is staged:
 *
 *  NEEDS ATTENTION — unread store notices (stars, watches, bounty
 *    claims, crew handoffs, issues, pulls — whatever the app's own
 *    actions recorded), each with its deep link. Reading one here
 *    marks exactly that notice read.
 *  ACTIVITY — the read notices, newest first: the same feed, settled.
 *  SYSTEM — two live mirrors: the forge's recent commits (this
 *    origin's /api/kiln/forge-activity — the daemon's real commit
 *    stream) and, when a wallet is connected, the account's recent
 *    Kiln L1 transactions from the app ledger, each opening its full
 *    receipt at /chain/<hash>.
 *
 * Workspace invites (completeness round): with a forge account
 * session, Needs Attention also lists the account's pending
 * workspace invites from the daemon's GET /v1/invites/mine, read
 * through this origin's /api/forge proxy with the session's Bearer
 * token (the kiln-papers / kiln-repos pattern). The rows are
 * information only: the app has no workspace-invite accept surface
 * — acceptance happens from the invite email, whose token link
 * completes the join — so no fake action is offered. Until the
 * daemon activates the endpoint it 404s, and every failure mode
 * (404, signed out, fetch error, malformed payload) degrades to
 * the invites simply not appearing; nothing else in the inbox
 * changes and no error is shown for it.
 *
 * Known interaction (pre-existing, left as-is): the header bell
 * panel marks all notices read when opened, so Needs Attention can
 * empty from there too. Changing the bell is out of this round's
 * scope; the inbox reflects whatever read state results.
 */

import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { b as useStore, p as allTxsOf } from "./store-sx46DNi5.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { t as formatDistanceToNow } from "./formatDistanceToNow-SFVSzGBG.js";

const R = reactNs(React(), 1);
const j = jsxmod();

function rel(iso) {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

const SESSION_KEY = "kiln.daemon.session.v1";

/** The forge account session token, or null when signed out (kiln-papers pattern). */
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

function markOneRead(id) {
  try {
    const s = useStore.getState();
    useStore.setState({
      notices: (s.notices || []).map((n) => (n.id === id ? { ...n, read: true } : n)),
    });
  } catch {}
}

function NoticeRow({ n }) {
  const inner = [
    j.jsxs("span", {
      key: "main",
      className: "min-w-0 flex-1",
      children: [
        j.jsxs("span", {
          key: "t",
          className: "flex items-center gap-2",
          children: [
            !n.read
              ? j.jsx("span", { key: "dot", className: "pulse-dot", style: { flex: "none" } })
              : null,
            j.jsx("span", {
              key: "x",
              className: n.read ? "text-sm text-muted" : "text-sm font-medium text-fg",
              children: n.title || "Notice",
            }),
          ],
        }),
        n.body
          ? j.jsx("span", {
              key: "b",
              className: "mt-0.5 block truncate text-xs text-muted",
              children: n.body,
            })
          : null,
      ],
    }),
    j.jsx("span", {
      key: "when",
      className: "shrink-0 text-[11px] text-subtle",
      children: rel(n.createdAt),
    }),
  ];
  const cls = "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2";
  return j.jsx("li", {
    children: n.href
      ? j.jsxs(Link, { to: n.href, className: cls, onClick: () => markOneRead(n.id), children: inner })
      : j.jsxs("div", { className: cls, onClick: () => markOneRead(n.id), children: inner }),
  });
}

/**
 * One pending workspace invite, in the NoticeRow idiom. Rendered as
 * information only — no link, no button: acceptance happens from
 * the invite email's token link (see the header comment).
 */
function InviteRow({ inv }) {
  const name = inv.workspaceName || inv.workspaceSlug || inv.workspaceId || "Workspace";
  const parts = ["Workspace invite"];
  if (inv.role) parts.push(`${inv.role} role`);
  if (inv.workspaceSlug && inv.workspaceSlug !== name) parts.push(inv.workspaceSlug);
  return j.jsx("li", {
    children: j.jsxs("div", {
      className: "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2",
      children: [
        j.jsxs("span", {
          key: "main",
          className: "min-w-0 flex-1",
          children: [
            j.jsxs("span", {
              key: "t",
              className: "flex items-center gap-2",
              children: [
                j.jsx("span", { key: "dot", className: "pulse-dot", style: { flex: "none" } }),
                j.jsx("span", { key: "x", className: "text-sm font-medium text-fg", children: name }),
              ],
            }),
            j.jsx("span", {
              key: "b",
              className: "mt-0.5 block truncate text-xs text-muted",
              children: parts.join(" · "),
            }),
          ],
        }),
        j.jsx("span", {
          key: "when",
          className: "shrink-0 text-[11px] text-subtle",
          children: inv.expiresAt ? `expires ${rel(inv.expiresAt)}` : rel(inv.createdAt),
        }),
      ],
    }),
  });
}

function Section({ title, count, children }) {
  return j.jsxs("section", {
    className: "mt-10",
    children: [
      j.jsxs("h2", {
        className: "flex items-baseline gap-2 font-display text-2xl tracking-tight",
        children: [
          title,
          typeof count === "number"
            ? j.jsx("span", { className: "text-sm text-subtle", children: count })
            : null,
        ],
      }),
      children,
    ],
  });
}

export function KilnInbox() {
  const state = useStore();
  const wallet = state?.wallet || null;
  const notices = state?.notices || [];
  const unread = notices.filter((n) => !n.read);
  const read = notices.filter((n) => n.read);

  const [forge, setForge] = R.useState(null); // null=loading, []=answered empty/failed
  const [forgeFailed, setForgeFailed] = R.useState(false);
  R.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch("/api/kiln/forge-activity");
        const data = await res.json();
        if (!dead) setForge((data && data.activities) || []);
      } catch {
        if (!dead) {
          setForge([]);
          setForgeFailed(true);
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // Pending workspace invites for the signed-in forge account. Every
  // failure — no session, the endpoint's pre-activation 404, a fetch
  // error, a malformed payload — leaves this empty and silent.
  const [invites, setInvites] = R.useState([]);
  R.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const token = sessionToken();
        if (!token) return;
        const res = await fetch("/api/forge/v1/invites/mine", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = (data && Array.isArray(data.invites) ? data.invites : []).filter(
          (inv) => inv && typeof inv === "object" && (!inv.status || inv.status === "pending"),
        );
        if (!dead && list.length) setInvites(list);
      } catch {}
    })();
    return () => {
      dead = true;
    };
  }, []);

  const myTxs = R.useMemo(() => {
    if (!wallet) return [];
    const mine = new Set([wallet.address, wallet.handle].filter(Boolean));
    return (allTxsOf(state) || [])
      .filter((tx) => mine.has(tx.from) || mine.has(tx.to) || mine.has(tx.actor))
      .slice(0, 8);
  }, [state, wallet?.address, wallet?.handle]);

  return j.jsxs("div", {
    className: "mx-auto w-full max-w-3xl",
    children: [
      j.jsxs("div", {
        key: "hd",
        className: "flex flex-wrap items-end justify-between gap-3",
        children: [
          j.jsxs("div", {
            key: "t",
            children: [
              j.jsx("h1", { className: "font-display text-4xl leading-[0.95] tracking-tight", children: "Inbox" }),
              j.jsx("p", {
                className: "mt-3 text-base leading-relaxed text-muted",
                children: "Stars, watches, bounty claims, and crew handoffs land here.",
              }),
            ],
          }),
          unread.length
            ? j.jsx("button", {
                key: "markall",
                type: "button",
                className: "btn h-8",
                onClick: () => {
                  try {
                    useStore.getState().markNoticesRead();
                  } catch {}
                },
                children: `Mark all read (${unread.length})`,
              })
            : null,
        ],
      }),

      j.jsx(Section, {
        key: "attn",
        title: "Needs attention",
        count: unread.length + invites.length,
        children: [
          invites.length
            ? j.jsx("ul", {
                key: "inv",
                className: "mt-3 flex flex-col gap-1",
                children: invites.map((inv) =>
                  j.jsx(InviteRow, { key: inv.id || inv.workspaceId || inv.workspaceSlug, inv }),
                ),
              })
            : null,
          invites.length
            ? j.jsx("p", {
                key: "invnote",
                className: "mt-2 text-xs text-subtle",
                children: "Workspace invites are accepted from the invite email — its link completes the join.",
              })
            : null,
          unread.length
            ? j.jsx("ul", {
                key: "unread",
                className: "mt-3 flex flex-col gap-1",
                children: unread.map((n) => j.jsx(NoticeRow, { key: n.id, n })),
              })
            : null,
          !invites.length && !unread.length
            ? j.jsx("p", {
                key: "empty",
                className: "mt-3 text-sm text-muted",
                children: "Nothing needs attention.",
              })
            : null,
        ],
      }),

      j.jsx(Section, {
        key: "act",
        title: "Activity",
        count: read.length,
        children: read.length
          ? j.jsx("ul", {
              className: "mt-3 flex flex-col gap-1",
              children: read.map((n) => j.jsx(NoticeRow, { key: n.id, n })),
            })
          : j.jsx("p", {
              className: "mt-3 text-sm text-muted",
              children: notices.length ? "Everything above is still unread." : "You're all caught up.",
            }),
      }),

      j.jsx(Section, {
        key: "sys",
        title: "System",
        children: j.jsxs("div", {
          className: "mt-3 flex flex-col gap-4",
          children: [
            j.jsxs("div", {
              key: "forge",
              children: [
                j.jsx("h3", { className: "text-sm font-medium text-fg", children: "Forge activity" }),
                forge === null
                  ? j.jsx("p", { className: "mt-2 text-sm text-muted", children: "Reading the forge…" })
                  : forge.length
                    ? j.jsx("ul", {
                        className: "mt-2 flex flex-col gap-1",
                        children: forge.slice(0, 12).map((a) =>
                          j.jsx("li", {
                            key: a.sha,
                            children: j.jsxs(Link, {
                              to: `/${a.owner}/${a.repo}`,
                              className: "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2",
                              children: [
                                j.jsxs("span", {
                                  key: "m",
                                  className: "min-w-0 flex-1",
                                  children: [
                                    j.jsx("span", {
                                      key: "msg",
                                      className: "block truncate text-sm",
                                      children: String(a.message || "").split("\n")[0],
                                    }),
                                    j.jsx("span", {
                                      key: "sub",
                                      className: "mt-0.5 block text-[11px] text-subtle",
                                      children: `${a.owner}/${a.repo} · ${a.authorName || a.authorKind || ""}`,
                                    }),
                                  ],
                                }),
                                j.jsx("span", { key: "w", className: "shrink-0 text-[11px] text-subtle", children: rel(a.timestamp) }),
                              ],
                            }),
                          }),
                        ),
                      })
                    : j.jsx("p", {
                        className: "mt-2 text-sm text-muted",
                        children: forgeFailed
                          ? "The forge activity mirror did not answer."
                          : "No forge commits yet.",
                      }),
              ],
            }),
            wallet
              ? j.jsxs("div", {
                  key: "chain",
                  children: [
                    j.jsx("h3", { className: "text-sm font-medium text-fg", children: "Your chain activity" }),
                    myTxs.length
                      ? j.jsx("ul", {
                          className: "mt-2 flex flex-col gap-1",
                          children: myTxs.map((tx) =>
                            j.jsx("li", {
                              key: tx.hash,
                              children: j.jsxs(Link, {
                                to: "/chain/$id",
                                params: { id: tx.hash },
                                className: "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2",
                                children: [
                                  j.jsxs("span", {
                                    key: "m",
                                    className: "min-w-0 flex-1",
                                    children: [
                                      j.jsx("span", {
                                        key: "t",
                                        className: "block truncate text-sm",
                                        children: tx.memo || tx.kind || "Transaction",
                                      }),
                                      j.jsx("span", {
                                        key: "s",
                                        className: "mt-0.5 block font-mono text-[11px] text-subtle",
                                        children: String(tx.hash || "").slice(0, 16) + "…",
                                      }),
                                    ],
                                  }),
                                  j.jsx("span", { key: "w", className: "shrink-0 text-[11px] text-subtle", children: rel(tx.createdAt) }),
                                ],
                              }),
                            }),
                          ),
                        })
                      : j.jsx("p", {
                          className: "mt-2 text-sm text-muted",
                          children: "No ledger transactions touch your wallet yet.",
                        }),
                  ],
                })
              : null,
          ],
        }),
      }),
    ],
  });
}
