/**
 * Transaction receipt — the /chain/$id route.
 *
 * Until now the route re-exported the /chain list component, which ignores
 * the id entirely: tapping a transaction (or a block, or any hash chip in
 * the app) landed back on the list. This module gives the route its real
 * job: given a transaction hash it renders the WHOLE receipt — every field
 * the ledger record itself carries, untruncated — and given a block hash
 * it renders the block receipt with its transactions. Fields a record
 * does not carry are not rendered; nothing is invented. A hash that is in
 * neither the transaction list nor the block list gets an honest
 * not-found panel: the ledger view is this browser's store, and a hash
 * outside it is simply not here.
 *
 * Record shapes come from the store's own constructors (store chunk):
 *   tx    { type, from, to, amount, memo, repoId, timestamp, block,
 *           merkleRoot, hash }
 *   block { height, parent, timestamp, txs, hash }
 * Selectors and formatters are the same ones the /chain list uses.
 */
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { G as formatKln, b as useStore, p as allTxsOf, t as blocksOf } from "./store-sx46DNi5.js";
import { t as formatDistanceToNow } from "./formatDistanceToNow-SFVSzGBG.js";

const j = jsxmod();

function relTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

function fullTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
  } catch {
    return "";
  }
}

// Actor labels, the /chain list's own mapping: your wallet, your agents,
// your model connections — everything else is System.
function actorLabels(state) {
  const m = {};
  if (state.wallet?.address) m[state.wallet.address] = { kind: "you", label: state.wallet.handle || "You" };
  for (const a of state.agents || []) {
    if (a.wallet?.address) m[a.wallet.address] = { kind: "agent", label: `${a.name} · ${a.role}` };
  }
  for (const mc of state.modelConnections || []) {
    if (mc.walletAddress) m[mc.walletAddress] = { kind: "model", label: `Model · ${mc.label}` };
  }
  return m;
}

function actorOf(labels, tx) {
  return labels[tx.from] || labels[tx.to] || { kind: "system", label: "System" };
}

function Row({ label, children, mono }) {
  return j.jsxs("div", {
    className: "flex flex-col gap-2 px-4 py-3 sm:flex-row",
    children: [
      j.jsx("dt", { className: "w-32 shrink-0 text-[11px] uppercase tracking-[0.16em] text-subtle", children: label }),
      j.jsx("dd", {
        className: mono ? "min-w-0 break-all font-mono text-[13px] leading-relaxed text-fg" : "min-w-0 text-sm leading-relaxed text-fg",
        children,
      }),
    ],
  });
}

function ReceiptShell({ kind, title, children }) {
  return j.jsxs("div", {
    children: [
      j.jsx(Link, { to: "/chain", className: "text-sm text-seal hover:underline", children: "← Kiln L1" }),
      j.jsxs("div", {
        className: "mt-3 flex flex-wrap items-baseline gap-3",
        children: [
          j.jsx("h1", { className: "font-display text-3xl font-semibold tracking-tight", children: title }),
          j.jsx("span", { className: "chip", children: kind }),
        ],
      }),
      j.jsx("dl", { className: "mt-5 divide-y divide-border rounded-lg border border-border", children }),
    ],
  });
}

export function KilnReceipt() {
  const state = useStore();
  const seg = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean).pop() || "" : "";
  const id = decodeURIComponent(seg).toLowerCase();
  const blocks = blocksOf(state) || [];
  const txs = allTxsOf(state) || [];
  const labels = actorLabels(state);

  const tx =
    txs.find((t) => t.hash && t.hash.toLowerCase() === id) ||
    (id.length >= 8 ? txs.find((t) => t.hash && t.hash.toLowerCase().startsWith(id)) : undefined);
  const block =
    blocks.find((b) => b.hash && b.hash.toLowerCase() === id) ||
    (id.length >= 8 ? blocks.find((b) => b.hash && b.hash.toLowerCase().startsWith(id)) : undefined);

  if (!tx && !block) {
    if (!state.hydrated) {
      return j.jsx("p", { className: "text-sm text-muted", children: "Loading the ledger…" });
    }
    return j.jsxs("div", {
      children: [
        j.jsx(Link, { to: "/chain", className: "text-sm text-seal hover:underline", children: "← Kiln L1" }),
        j.jsx("h1", { className: "mt-3 font-display text-3xl font-semibold tracking-tight", children: "Not in this ledger" }),
        j.jsx("p", {
          className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
          children:
            "No transaction or block with that hash is in this browser's ledger view. The L1 history here is the local store — a hash from another session or device won't resolve until it is part of this view.",
        }),
        id
          ? j.jsx("p", { className: "mt-3 break-all font-mono text-xs text-subtle", children: id })
          : null,
      ],
    });
  }

  if (block && !tx) {
    const parentBlock = block.parent ? blocks.find((b) => b.hash === block.parent) : undefined;
    return j.jsxs(ReceiptShell, {
      kind: "Block",
      title: `Block #${block.height}`,
      children: [
        j.jsx(Row, { label: "Block hash", mono: true, children: block.hash }),
        block.parent
          ? j.jsx(Row, {
              label: "Parent hash",
              mono: true,
              children: parentBlock
                ? j.jsx(Link, { to: "/chain/$id", params: { id: block.parent }, className: "text-seal hover:underline", children: block.parent })
                : block.parent,
            })
          : null,
        block.timestamp
          ? j.jsx(Row, { label: "Timestamp", children: `${fullTime(block.timestamp)} · ${relTime(block.timestamp)}` })
          : null,
        j.jsx(Row, { label: "Transactions", children: `${(block.txs || []).length} tx` }),
        (block.txs || []).length
          ? j.jsx(Row, {
              label: "Included",
              children: j.jsx("ul", {
                className: "divide-y divide-border rounded-lg border border-border",
                children: (block.txs || []).map((t) => {
                  const a = actorOf(labels, t);
                  return j.jsx(
                    "li",
                    {
                      children: j.jsxs(Link, {
                        to: "/chain/$id",
                        params: { id: t.hash },
                        className: "block px-3 py-2 hover:bg-surface",
                        children: [
                          j.jsx("span", { className: "block truncate text-sm text-fg", children: `${a.label} — ${t.memo || t.type}` }),
                          j.jsx("span", { className: "block break-all font-mono text-[11px] text-subtle", children: t.hash }),
                        ],
                      }),
                    },
                    t.hash,
                  );
                }),
              }),
            })
          : null,
      ],
    });
  }

  const inBlock = blocks.find((b) => b.height === tx.block);
  const actor = actorOf(labels, tx);
  const repoParts = typeof tx.repoId === "string" && tx.repoId.includes("/") ? tx.repoId.split("/") : null;
  return j.jsxs(ReceiptShell, {
    kind: tx.type || "Transaction",
    title: "Transaction receipt",
    children: [
      j.jsx(Row, { label: "Hash", mono: true, children: tx.hash }),
      tx.memo ? j.jsx(Row, { label: "Memo", children: tx.memo }) : null,
      j.jsx(Row, { label: "Actor", children: `${actor.label} · ${actor.kind}` }),
      typeof tx.amount === "number" ? j.jsx(Row, { label: "Amount", children: formatKln(tx.amount) }) : null,
      tx.from
        ? j.jsx(Row, { label: "From", mono: true, children: labels[tx.from] ? `${tx.from} (${labels[tx.from].label})` : tx.from })
        : null,
      tx.to
        ? j.jsx(Row, { label: "To", mono: true, children: labels[tx.to] ? `${tx.to} (${labels[tx.to].label})` : tx.to })
        : null,
      tx.repoId
        ? j.jsx(Row, {
            label: "Repository",
            children: repoParts
              ? j.jsx(Link, {
                  to: "/$owner/$repo",
                  params: { owner: repoParts[0], repo: repoParts.slice(1).join("/") },
                  className: "font-mono text-[13px] text-seal hover:underline",
                  children: tx.repoId,
                })
              : tx.repoId,
          })
        : null,
      typeof tx.block === "number"
        ? j.jsx(Row, {
            label: "Block",
            children: inBlock
              ? j.jsx(Link, { to: "/chain/$id", params: { id: inBlock.hash }, className: "text-seal hover:underline", children: `#${tx.block}` })
              : `#${tx.block}`,
          })
        : null,
      inBlock ? j.jsx(Row, { label: "Block hash", mono: true, children: inBlock.hash }) : null,
      tx.merkleRoot ? j.jsx(Row, { label: "Merkle root", mono: true, children: tx.merkleRoot }) : null,
      tx.timestamp ? j.jsx(Row, { label: "Timestamp", children: `${fullTime(tx.timestamp)} · ${relTime(tx.timestamp)}` }) : null,
    ],
  });
}
