/**
 * The Vault — the /wallet route, restructured (Round 2, Piece 3).
 *
 * The architect's order: "wallet make it vault with wallets." This surface
 * is a VAULT that contains the wallets:
 *
 *   1. A vault header whose total is the sum across every wallet in it.
 *   2. The MAIN WALLET as a card — the transfer hub — holding its address
 *      + copy, its balance, its account actions (reveal secret, faucet,
 *      GitHub link, disconnect, switch wallet) and its Settled activity
 *      (its last 20 transactions).
 *   3. AGENT WALLETS — one card per agent wallet, each with Details.
 *   4. MODEL WALLETS — one card per model wallet, each with Details;
 *      models without a wallet keep their real Mint button.
 *   5. The AGENT LEDGER — the /chain page's ledger, embedded here with
 *      its kind filters and search, rows opening the full receipt.
 *   6. Your repositories — the section this page has always carried.
 *
 * PRESENTATION + IA ONLY. No wallet math, key derivation, store shape, or
 * transfer logic changes:
 *   - main balance   = state.balance (the figure the old page showed)
 *   - agent balance  = agent.wallet.balance; agent total = their sum
 *   - model balance  = the ledger net for the model's address (the old
 *     page's W() computation, verbatim); model total = their sum
 *   - VAULT TOTAL    = balance + agentTotal + modelTotal — the exact sum
 *     the old page printed as "All wallets"
 *   - transfers go through globalThis.__KILN_TRANSFER with the hub rules
 *     untouched: Fund = main → wallet, Sweep = wallet → main. There is no
 *     agent↔agent or model↔model path, exactly as before.
 *   - Mint = state.upsertConnection(connection), as before.
 * A wallet class with zero wallets shows the old page's honest empty
 * notes; nothing is fabricated.
 *
 * Transaction rows are the receipt wiring from the completeness lane
 * (cherry-picked af8f0bd, module-scope TxReceiptRow): a row with a hash
 * opens the full receipt at /chain/$id; a row without one renders
 * unwrapped, exactly as before.
 *
 * Components live at module scope only — the React #130 lesson
 * (NOTES-mobile-studio.md): nothing is constructed inside another
 * component's scope, and no local binding shadows an import here.
 */

import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { n as toast } from "./dist-gk9u-W-R.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { a as ConnectGate, r as SwitchWallet } from "./AppShell-H-m5HQPd.js";
import { E as shortHash } from "./fs-ri9Mkfbm.js";
import {
  G as formatKln,
  b as useStore,
  d as allRepos,
  p as allTxsOf,
} from "./store-sx46DNi5.js";
import { t as formatDistanceToNow } from "./formatDistanceToNow-SFVSzGBG.js";

const R = reactNs(React(), 1);
const j = jsxmod();

function rel(iso) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/** Every ledger tx touching an address (the old page's q()). */
function txsFor(txs, address) {
  return txs.filter((tx) => tx.from === address || tx.to === address);
}

/**
 * A model's ledger balance (the old page's W(), verbatim): null when the
 * ledger holds no tx for the address, else credits minus debits.
 */
function ledgerBalance(txs, address) {
  const rows = txsFor(txs, address);
  if (!rows.length) return null;
  return rows.reduce(
    (acc, tx) => acc + (tx.to === address ? +(tx.amount ?? 0) : -(tx.amount ?? 0)),
    0
  );
}

/** Actor labels, the /chain list's own mapping (kiln-receipt.js idiom). */
function actorLabels(state) {
  const m = {};
  if (state.wallet?.address)
    m[state.wallet.address] = { kind: "you", label: state.wallet.handle || "You" };
  for (const a of state.agents || []) {
    if (a.wallet?.address)
      m[a.wallet.address] = { kind: "agent", label: `${a.name} · ${a.role}` };
  }
  for (const mc of state.modelConnections || []) {
    if (mc.walletAddress)
      m[mc.walletAddress] = { kind: "model", label: `Model · ${mc.label}` };
  }
  return m;
}

function actorOf(labels, tx) {
  return labels[tx.from] || labels[tx.to] || { kind: "system", label: "System" };
}

/**
 * One transaction row (receipt wiring, ported from af8f0bd): the row
 * renders exactly as the old wallet page rendered it, and when the tx
 * carries a hash the row opens the full receipt at /chain/$id.
 */
function TxReceiptRow({ tx }) {
  const inner = [
    j.jsx("span", {
      key: "h",
      className: "font-mono text-[11px] text-subtle",
      children: tx.hash ? shortHash(tx.hash) : "",
    }),
    j.jsx("span", { key: "t", className: "ml-2", children: tx.type }),
    j.jsx("span", { key: "m", className: "ml-2 text-muted", children: tx.memo }),
    j.jsx("span", {
      key: "w",
      className: "ml-2 text-xs text-muted",
      children: rel(tx.timestamp),
    }),
  ];
  return j.jsx("li", {
    className: "rounded-lg border border-border px-4 py-2 text-sm",
    children: tx.hash
      ? j.jsx(Link, {
          to: "/chain/$id",
          params: { id: tx.hash },
          className: "block hover:bg-surface",
          children: inner,
        })
      : inner,
  });
}

/**
 * A wallet's Details (the old page's L() closure, lifted to module
 * scope): address + copy, the hub transfer controls, and the wallet's
 * last 20 transactions as receipt rows. Transfer semantics are the old
 * ones, unchanged — see the header comment.
 */
function WalletDetails({ state, address, balance }) {
  const [dir, setDir] = R.useState(null);
  const [amount, setAmount] = R.useState("");
  const transfer = globalThis.__KILN_TRANSFER;
  const main = state.wallet;
  const rows = txsFor(allTxsOf(state), address).slice(0, 20);
  return j.jsxs("div", {
    className: "mt-3 border-t border-border",
    style: { paddingTop: "0.75rem" },
    children: [
      j.jsxs("div", {
        key: "addr",
        className: "flex flex-wrap items-center gap-2",
        children: [
          j.jsx("span", {
            key: "a",
            className: "break-all font-mono text-[11px] text-muted",
            children: address,
          }),
          j.jsx("button", {
            key: "c",
            type: "button",
            className: "btn h-7 px-2 text-xs",
            onClick: () => {
              navigator.clipboard.writeText(address);
              toast("Address copied");
            },
            children: "Copy",
          }),
        ],
      }),
      j.jsxs("div", {
        key: "xfer",
        className: "mt-3 flex flex-wrap gap-2",
        children: [
          j.jsx("button", {
            key: "f",
            type: "button",
            className: "btn h-7 px-2 text-xs",
            disabled: typeof transfer !== "function",
            title:
              typeof transfer === "function"
                ? undefined
                : "Transfers unavailable — forge companion not loaded",
            onClick: () => {
              setDir("fund");
              setAmount("");
            },
            children: "Fund from main",
          }),
          j.jsx("button", {
            key: "s",
            type: "button",
            className: "btn h-7 px-2 text-xs",
            disabled: typeof transfer !== "function",
            title:
              typeof transfer === "function"
                ? undefined
                : "Transfers unavailable — forge companion not loaded",
            onClick: () => {
              setDir("sweep");
              setAmount("");
            },
            children: "Sweep to main",
          }),
        ],
      }),
      dir
        ? j.jsxs("div", {
            key: "form",
            className: "mt-2 flex flex-wrap items-center gap-2",
            children: [
              j.jsx("div", {
                key: "in",
                className: "w-28",
                children: j.jsx("input", {
                  className: "input",
                  value: amount,
                  onChange: (e) => setAmount(e.target.value),
                  placeholder: "Amount",
                  inputMode: "decimal",
                }),
              }),
              j.jsx("button", {
                key: "ok",
                type: "button",
                className: "btn-primary btn h-7 px-2 text-xs",
                onClick: () => {
                  const amt = Number(amount);
                  const avail = dir === "fund" ? (state.balance ?? 0) : balance;
                  if (!Number.isFinite(amt) || amt <= 0) {
                    toast("Enter an amount more than 0 KLN");
                    return;
                  }
                  if (amt > avail) {
                    toast("Not enough KLN in this wallet");
                    return;
                  }
                  const from = dir === "fund" ? main.address : address;
                  const to = dir === "fund" ? address : main.address;
                  void transfer({
                    fromAddress: from,
                    toAddress: to,
                    amount: amt,
                    memo:
                      dir === "fund"
                        ? "Fund from main wallet"
                        : "Sweep to main wallet",
                  })
                    .then(() => {
                      toast(`Transferred ${amt} KLN`);
                      setDir(null);
                      setAmount("");
                    })
                    .catch((err) =>
                      toast(err && err.message ? err.message : "Transfer failed")
                    );
                },
                children: "Confirm",
              }),
              j.jsx("button", {
                key: "x",
                type: "button",
                className: "btn h-7 px-2 text-xs",
                onClick: () => setDir(null),
                children: "Cancel",
              }),
              j.jsxs("span", {
                key: "av",
                className: "text-xs text-muted",
                children: [
                  "Available ",
                  formatKln(dir === "fund" ? (state.balance ?? 0) : balance),
                ],
              }),
            ],
          })
        : null,
      rows.length
        ? j.jsx("ul", {
            key: "txs",
            className: "mt-2 space-y-2",
            children: rows.map((tx) => j.jsx(TxReceiptRow, { tx }, tx.hash)),
          })
        : j.jsx("p", {
            key: "txs",
            className: "mt-2 text-sm text-muted",
            children: "No settlements yet.",
          }),
    ],
  });
}

function StatCard({ label, value }) {
  return j.jsxs("div", {
    className: "rounded-lg border border-border bg-surface p-4",
    children: [
      j.jsx("p", {
        key: "l",
        className: "text-[11px] uppercase tracking-[0.16em] text-muted",
        children: label,
      }),
      j.jsx("p", {
        key: "v",
        className: "mt-1 font-display text-2xl font-semibold tabular-nums",
        children: value,
      }),
    ],
  });
}

function DetailsButton({ open, onToggle }) {
  return j.jsx("button", {
    type: "button",
    className: "btn mt-2 h-7 px-2 text-xs",
    onClick: onToggle,
    children: open ? "Hide details" : "Details",
  });
}

/**
 * The agent ledger, embedded in the Vault: the /chain page's ledger
 * section with its kind filters (All / Agents / Models / You / System)
 * and its search, over the same selectors and actor mapping. Read-only;
 * every row opens its full receipt at /chain/$id, as on /chain.
 */
function AgentLedger({ state }) {
  const [kind, setKind] = R.useState("all");
  const [query, setQuery] = R.useState("");
  const [limit, setLimit] = R.useState(25);
  const txs = allTxsOf(state);
  const labels = actorLabels(state);
  const q = query.trim().toLowerCase();
  const filtered = txs.filter((tx) => {
    const actor = actorOf(labels, tx);
    return (
      (kind === "all" || actor.kind === kind) &&
      (!q ||
        [tx.memo, tx.type, tx.repoId, actor.label, tx.hash, tx.from, tx.to].some(
          (v) => (v || "").toLowerCase().includes(q)
        ))
    );
  });
  const visible = filtered.slice(0, limit);
  return j.jsxs("div", {
    children: [
      j.jsx("h2", {
        key: "h",
        className: "mt-10 font-display text-lg font-semibold",
        children: "Agent ledger",
      }),
      j.jsx("p", {
        key: "d",
        className: "mt-1 text-sm text-muted",
        children:
          "Every transaction on Kiln L1 that touches the wallets in this vault — commits, escrow, grants, and transfers. The full ledger lives on the L1 page; this is the same ledger, filtered here.",
      }),
      j.jsx("div", {
        key: "f",
        className: "mt-3 flex flex-wrap gap-2",
        children: [
          ["all", "All"],
          ["agent", "Agents"],
          ["model", "Models"],
          ["you", "You"],
          ["system", "System"],
        ].map(([k, v]) =>
          j.jsx("button", {
            key: k,
            type: "button",
            className:
              kind === k ? "btn-primary btn h-8 px-3 text-xs" : "btn h-8 px-3 text-xs",
            onClick: () => {
              setKind(k);
              setLimit(25);
            },
            children: v,
          })
        ),
      }),
      j.jsx("input", {
        key: "q",
        className: "input mt-3 w-full",
        value: query,
        onChange: (e) => {
          setQuery(e.target.value);
          setLimit(25);
        },
        placeholder: "Search the ledger — memo, type, tree, actor, hash, or address",
      }),
      j.jsx("ul", {
        key: "list",
        className: "mt-3 divide-y divide-border rounded-lg border border-border",
        children: [
          ...visible.map((tx) => {
            const actor = actorOf(labels, tx);
            return j.jsx(
              "li",
              {
                children: j.jsxs(Link, {
                  to: "/chain/$id",
                  params: { id: tx.hash },
                  className: "block px-4 py-3 hover:bg-surface",
                  children: [
                    j.jsx("p", {
                      key: "a",
                      className: "text-sm text-fg",
                      children: actor.label,
                    }),
                    j.jsx("p", {
                      key: "m",
                      className: "text-sm text-muted",
                      children: tx.memo,
                    }),
                    j.jsxs("p", {
                      key: "meta",
                      className: "text-[11px] text-subtle",
                      children: [
                        tx.type,
                        tx.amount ? ` · ${formatKln(tx.amount)}` : "",
                        ` · block `,
                        tx.block,
                        tx.repoId ? ` · ${tx.repoId}` : "",
                        tx.timestamp ? ` · ${rel(tx.timestamp)}` : "",
                        ` · `,
                        j.jsx("span", {
                          key: "hash",
                          className: "font-mono text-seal",
                          children: shortHash(tx.hash, 6),
                        }),
                      ],
                    }),
                  ],
                }),
              },
              tx.hash
            );
          }),
          filtered.length === 0
            ? j.jsx("li", {
                key: "empty",
                className: "px-4 py-6 text-sm text-muted",
                children: "No transactions match.",
              })
            : null,
        ],
      }),
      visible.length < filtered.length
        ? j.jsx("button", {
            key: "more",
            type: "button",
            className: "btn mt-3",
            onClick: () => setLimit((n) => n + 50),
            children: "Show more",
          })
        : null,
    ],
  });
}

export function KilnVault() {
  const state = useStore();
  const [showSecret, setShowSecret] = R.useState(false);
  const [showSwitch, setShowSwitch] = R.useState(false);
  const [github, setGithub] = R.useState(state.wallet?.githubHandle ?? "");
  const [search, setSearch] = R.useState("");
  const [openId, setOpenId] = R.useState(null);

  const main = state.wallet;
  if (!main) {
    return j.jsxs("div", {
      className: "mx-auto max-w-lg py-10 text-center",
      children: [
        j.jsx("h1", {
          key: "h",
          className: "font-display text-3xl font-semibold tracking-tight",
          children: "Vault",
        }),
        j.jsx("p", {
          key: "d",
          className: "mt-2 text-sm text-muted",
          children:
            "One vault for everything KILN holds for you: your main wallet, a wallet for every agent, and a wallet for every model you store. Commits, bounties, and unseals sign with it.",
        }),
        j.jsx("div", {
          key: "c",
          className: "mt-6 flex justify-center",
          children: j.jsx(ConnectGate, {}),
        }),
      ],
    });
  }

  const txs = allTxsOf(state);
  const mainTxs = txsFor(txs, main.address).slice(0, 20);
  const repos = allRepos(state).filter(
    (t) => t.owner === main.handle || state.orgs.some((o) => o.handle === t.owner)
  );
  const agents = state.agents.filter((a) => a.wallet);
  const modelsWith = state.modelConnections.filter((c) => c.walletAddress);
  const modelsWithout = state.modelConnections.filter((c) => !c.walletAddress);

  const agentTotal = agents.reduce((acc, a) => acc + (a.wallet?.balance ?? 0), 0);
  const modelsBalanced = modelsWith.map((c) => ({
    ...c,
    ledgerBalance: ledgerBalance(txs, c.walletAddress),
  }));
  const modelTotal = modelsBalanced.reduce(
    (acc, c) => acc + (c.ledgerBalance ?? 0),
    0
  );
  const vaultTotal = (state.balance ?? 0) + agentTotal + modelTotal;

  const needle = (search || "").trim().toLowerCase();
  const matches = (fields) =>
    !needle || fields.some((f) => (f || "").toLowerCase().includes(needle));
  const agentsShown = needle
    ? agents.filter((a) =>
        matches([a.name, a.role, a.repoId, a.modelId, a.agentId, a.wallet?.address])
      )
    : agents;
  const modelsShown = needle
    ? modelsBalanced.filter((c) => matches([c.label, c.walletAddress, c.modelId]))
    : modelsBalanced;
  const modelsWithoutShown = needle
    ? modelsWithout.filter((c) => matches([c.label, c.model, c.modelId]))
    : modelsWithout;

  return j.jsxs("div", {
    className: "mx-auto max-w-2xl",
    children: [
      // ---- Vault header: the total across every wallet in the vault ----
      j.jsx("h1", {
        key: "h1",
        className: "font-display text-3xl font-semibold tracking-tight",
        children: "Vault",
      }),
      j.jsxs("p", {
        key: "sub",
        className: "mt-1 text-sm text-muted",
        children: [
          main.handle,
          " · one vault, every wallet — the main wallet is the transfer hub for all of them",
        ],
      }),
      j.jsx("p", {
        key: "addr",
        className: "mt-1 font-mono text-sm text-muted",
        children: main.address,
      }),
      j.jsxs("div", {
        key: "total",
        className: "mt-5 rounded-lg border border-border bg-surface p-4",
        children: [
          j.jsx("p", {
            key: "l",
            className: "text-[11px] uppercase tracking-[0.16em] text-muted",
            children: "Vault total — all wallets",
          }),
          j.jsx("p", {
            key: "v",
            className: "mt-1 font-display text-2xl font-semibold tabular-nums",
            children: formatKln(vaultTotal),
          }),
        ],
      }),
      j.jsxs("div", {
        key: "totals",
        className: "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3",
        children: [
          j.jsx(StatCard, { key: "m", label: "Main wallet", value: formatKln(state.balance) }),
          j.jsx(StatCard, { key: "a", label: "Agent total", value: formatKln(agentTotal) }),
          j.jsx(StatCard, { key: "mo", label: "Model total", value: formatKln(modelTotal) }),
        ],
      }),
      j.jsxs("div", {
        key: "counts",
        className: "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3",
        children: [
          j.jsx(StatCard, { key: "r", label: "Repositories", value: repos.length }),
          j.jsx(StatCard, { key: "aw", label: "Agent wallets", value: agents.length }),
          j.jsx(StatCard, { key: "mw", label: "Model wallets", value: modelsWith.length }),
        ],
      }),

      // ---- Main wallet: the transfer hub ----
      j.jsxs("div", {
        key: "main",
        className: "mt-10",
        children: [
          j.jsxs("div", {
            key: "mh",
            className: "flex flex-wrap items-center gap-2",
            children: [
              j.jsx("h2", {
                key: "t",
                className: "font-display text-lg font-semibold",
                children: "Main wallet",
              }),
              j.jsx("span", {
                key: "chip",
                className:
                  "rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted",
                children: "Transfer hub",
              }),
            ],
          }),
          j.jsx("p", {
            key: "md",
            className: "mt-1 text-sm text-muted",
            children:
              "Your wallet. Every agent and model wallet in this vault funds from here and sweeps back here — wallets never transfer between themselves.",
          }),
          j.jsxs("div", {
            key: "mcard",
            className: "mt-3 rounded-lg border border-border px-4 py-3",
            children: [
              j.jsxs("div", {
                key: "mrow",
                className: "flex flex-wrap items-center justify-between gap-2",
                children: [
                  j.jsx("span", {
                    key: "ma",
                    className: "break-all font-mono text-[11px] text-muted",
                    children: main.address,
                  }),
                  j.jsx("span", {
                    key: "mb",
                    className: "font-mono text-xs",
                    children: formatKln(state.balance),
                  }),
                ],
              }),
              j.jsxs("form", {
                key: "gh",
                className: "mt-4 flex flex-col gap-2 sm:flex-row",
                onSubmit: (e) => {
                  e.preventDefault();
                  state.linkGithub(github);
                  toast("GitHub handle linked");
                },
                children: [
                  j.jsx("input", {
                    key: "in",
                    className: "input flex-1",
                    value: github,
                    onChange: (e) => setGithub(e.target.value),
                    placeholder: "GitHub username",
                  }),
                  j.jsx("button", {
                    key: "b",
                    type: "submit",
                    className: "btn h-9",
                    children: "Link GitHub",
                  }),
                ],
              }),
              j.jsxs("div", {
                key: "actions",
                className: "mt-4 flex flex-wrap gap-2",
                children: [
                  j.jsx("button", {
                    key: "copy",
                    type: "button",
                    className: "btn",
                    onClick: () => {
                      navigator.clipboard.writeText(main.address);
                      toast("Address copied");
                    },
                    children: "Copy address",
                  }),
                  j.jsx("button", {
                    key: "secret",
                    type: "button",
                    className: "btn",
                    onClick: () => setShowSecret((v) => !v),
                    children: showSecret ? "Hide secret" : "Reveal secret",
                  }),
                  state.claimedFaucet
                    ? null
                    : j.jsx("button", {
                        key: "faucet",
                        type: "button",
                        className: "btn-primary btn",
                        onClick: () => void state.faucet(),
                        children: "Claim 2,500 KLN",
                      }),
                  j.jsx("button", {
                    key: "disc",
                    type: "button",
                    className: "btn",
                    onClick: () => {
                      state.disconnect();
                      toast("Disconnected");
                    },
                    children: "Disconnect",
                  }),
                  j.jsx("button", {
                    key: "switch",
                    type: "button",
                    className: "btn",
                    onClick: () => setShowSwitch(true),
                    children: "Switch wallet",
                  }),
                ],
              }),
              showSecret
                ? j.jsx("p", {
                    key: "secretv",
                    className:
                      "mt-3 break-all rounded-md border border-border bg-surface-2 p-3 font-mono text-[11px] text-muted",
                    children: main.secret,
                  })
                : null,
              j.jsx("h3", {
                key: "sa",
                className: "mt-6 font-display text-lg font-semibold",
                children: "Settled activity",
              }),
              j.jsx("ul", {
                key: "satxs",
                className: "mt-3 space-y-2",
                children: [
                  ...mainTxs.map((tx) => j.jsx(TxReceiptRow, { tx }, tx.hash)),
                  mainTxs.length === 0
                    ? j.jsx("li", {
                        key: "none",
                        className: "text-sm text-muted",
                        children: "No settlements yet.",
                      })
                    : null,
                ],
              }),
            ],
          }),
        ],
      }),

      // ---- Agent wallets ----
      j.jsx("h2", {
        key: "ah",
        className: "mt-10 font-display text-lg font-semibold",
        children: "Agent wallets",
      }),
      j.jsx("p", {
        key: "ad",
        className: "mt-1 text-sm text-muted",
        children:
          "One per agent on a tree. Seeded 25 KLN to do the work: commits, residencies, bounties.",
      }),
      j.jsx("input", {
        key: "search",
        className: "input mt-3 w-full",
        value: search,
        onChange: (e) => setSearch(e.target.value),
        placeholder: "Search wallets — name, role, tree, model, or address",
      }),
      j.jsx("ul", {
        key: "agents",
        className: "mt-3 divide-y divide-border rounded-lg border border-border",
        children: [
          ...agentsShown.map((a) =>
            j.jsxs(
              "li",
              {
                className: "px-4 py-3",
                children: [
                  j.jsxs("div", {
                    key: "row",
                    className: "flex flex-wrap items-center justify-between gap-2",
                    children: [
                      j.jsxs("div", {
                        key: "who",
                        children: [
                          j.jsxs("p", {
                            key: "n",
                            className: "text-sm",
                            children: [a.name, " · ", a.role],
                          }),
                          j.jsxs("p", {
                            key: "meta",
                            className: "font-mono text-[11px] text-muted",
                            children: [
                              a.wallet?.address,
                              a.repoId ? " · " : "",
                              a.repoId || "",
                              a.modelId ? " · " : "",
                              a.modelId || "",
                            ],
                          }),
                        ],
                      }),
                      j.jsx("span", {
                        key: "bal",
                        className: "font-mono text-xs",
                        children: formatKln(a.wallet?.balance ?? 0),
                      }),
                    ],
                  }),
                  j.jsx(DetailsButton, {
                    key: "det",
                    open: openId === a.id,
                    onToggle: () => setOpenId(openId === a.id ? null : a.id),
                  }),
                  openId === a.id
                    ? j.jsx(WalletDetails, {
                        key: "panel",
                        state,
                        address: a.wallet?.address,
                        balance: a.wallet?.balance ?? 0,
                      })
                    : null,
                ],
              },
              a.id
            )
          ),
          agentsShown.length === 0
            ? j.jsx("li", {
                key: "empty",
                className: "px-4 py-6 text-sm text-muted",
                children:
                  agents.length === 0
                    ? "Agents mint a nested wallet when they sit on a tree."
                    : "No wallets match your search.",
              })
            : null,
        ],
      }),

      // ---- Model wallets ----
      j.jsx("h2", {
        key: "moh",
        className: "mt-10 font-display text-lg font-semibold",
        children: "Model wallets",
      }),
      j.jsx("p", {
        key: "mod",
        className: "mt-1 text-sm text-muted",
        children:
          "One per connected model. Earns when its work is used — unseals, bounties, pulls — and pays for its own storage and compute.",
      }),
      j.jsx("ul", {
        key: "models",
        className: "mt-3 divide-y divide-border rounded-lg border border-border",
        children: [
          ...modelsShown.map((c) =>
            j.jsxs(
              "li",
              {
                className: "px-4 py-3",
                children: [
                  j.jsxs("div", {
                    key: "row",
                    className: "flex flex-wrap items-center justify-between gap-2",
                    children: [
                      j.jsxs("div", {
                        key: "who",
                        children: [
                          j.jsx("p", { key: "n", className: "text-sm", children: c.label }),
                          j.jsx("p", {
                            key: "meta",
                            className: "font-mono text-[11px] text-muted",
                            children: c.walletAddress,
                          }),
                        ],
                      }),
                      j.jsx("span", {
                        key: "bal",
                        className: "font-mono text-xs",
                        children: formatKln(c.ledgerBalance ?? 0),
                      }),
                    ],
                  }),
                  j.jsx(DetailsButton, {
                    key: "det",
                    open: openId === c.id,
                    onToggle: () => setOpenId(openId === c.id ? null : c.id),
                  }),
                  openId === c.id
                    ? j.jsx(WalletDetails, {
                        key: "panel",
                        state,
                        address: c.walletAddress,
                        balance: c.ledgerBalance ?? 0,
                      })
                    : null,
                ],
              },
              c.id
            )
          ),
          ...modelsWithoutShown.map((c) =>
            j.jsxs(
              "li",
              {
                className: "px-4 py-3",
                children: [
                  j.jsxs("div", {
                    key: "row",
                    className: "flex flex-wrap items-center justify-between gap-2",
                    children: [
                      j.jsxs("div", {
                        key: "who",
                        children: [
                          j.jsxs("p", {
                            key: "n",
                            className: "text-sm",
                            children: [
                              c.label,
                              j.jsx("span", {
                                key: "chip",
                                className:
                                  "ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted",
                                children: "No wallet yet",
                              }),
                            ],
                          }),
                          j.jsx("p", {
                            key: "meta",
                            className: "mt-1 text-[11px] text-muted",
                            children:
                              "Mint a wallet to give this model its own address and balance on the ledger.",
                          }),
                        ],
                      }),
                    ],
                  }),
                  j.jsx("button", {
                    key: "mint",
                    type: "button",
                    className: "btn mt-2 h-7 px-2 text-xs",
                    onClick: () => {
                      void state.upsertConnection(c).then(() => toast("Model wallet minted"));
                    },
                    children: "Mint wallet",
                  }),
                ],
              },
              c.id
            )
          ),
          modelsShown.length === 0 && modelsWithoutShown.length === 0
            ? j.jsxs("li", {
                key: "empty",
                className: "px-4 py-6 text-sm text-muted",
                children:
                  modelsWith.length === 0 && modelsWithout.length === 0
                    ? [
                        "Connect a model to mint a storage wallet.",
                        " ",
                        j.jsx(Link, {
                          key: "models-link",
                          to: "/models",
                          className: "text-seal hover:underline",
                          children: "Models",
                        }),
                      ]
                    : "No wallets match your search.",
              })
            : null,
        ],
      }),

      // ---- Agent ledger (embedded, with its filters) ----
      j.jsx(AgentLedger, { key: "ledger", state }),

      // ---- Your repositories (preserved section) ----
      j.jsx("h2", {
        key: "rh",
        className: "mt-10 font-display text-lg font-semibold",
        children: "Your repositories",
      }),
      j.jsx("ul", {
        key: "repos",
        className: "mt-3 divide-y divide-border rounded-lg border border-border",
        children: [
          ...repos.map((repo) =>
            j.jsxs(
              "li",
              {
                className: "px-4 py-3",
                children: [
                  j.jsx(Link, {
                    key: "l",
                    to: "/$owner/$repo",
                    params: { owner: repo.owner, repo: repo.name },
                    className: "text-seal hover:underline",
                    children: repo.id,
                  }),
                  j.jsxs("p", {
                    key: "d",
                    className: "text-xs text-muted",
                    children: [
                      repo.kind || "code",
                      " · ",
                      repo.description || "No description",
                    ],
                  }),
                ],
              },
              repo.id
            )
          ),
          repos.length === 0
            ? j.jsx("li", {
                key: "empty",
                className: "px-4 py-6 text-sm text-muted",
                children: "None yet. Create one from New.",
              })
            : null,
        ],
      }),

      showSwitch ? j.jsx(SwitchWallet, { key: "switch", onClose: () => setShowSwitch(false) }) : null,
    ],
  });
}
