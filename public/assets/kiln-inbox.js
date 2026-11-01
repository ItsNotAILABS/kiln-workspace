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
 * Deliberately absent: workspace invites. Invites arrive by email
 * with a token; the daemon offers no "invites addressed to me" list
 * and the app has no workspace surface, so there is no honest feed
 * to render. The daemon-side door that would feed this section is
 * GET /v1/invites/mine — recorded in NOTES-design-round.md.
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
        count: unread.length,
        children: unread.length
          ? j.jsx("ul", {
              className: "mt-3 flex flex-col gap-1",
              children: unread.map((n) => j.jsx(NoticeRow, { key: n.id, n })),
            })
          : j.jsx("p", { className: "mt-3 text-sm text-muted", children: "Nothing needs attention." }),
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
