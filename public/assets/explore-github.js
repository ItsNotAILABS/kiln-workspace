/**
 * Explore GitHub — same lookup as Import, view-only.
 * Does not seal, does not write the ledger. Tree is shown through Kiln.
 */
import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { githubListRepos, githubImportTree } from "./github-import.js";

const R = reactNs(React(), 1);
const j = jsxmod();
const CHIPS = ["ItsNotAILABS", "ethereum", "bitcoin", "solana-labs", "OpenZeppelin", "Uniswap"];

export function GithubExplorer() {
  const [q, setQ] = R.useState("ethereum");
  const [items, setItems] = R.useState([]);
  const [busy, setBusy] = R.useState(false);
  const [err, setErr] = R.useState("");
  const [open, setOpen] = R.useState(null);
  const [tree, setTree] = R.useState(null);
  const [file, setFile] = R.useState(null);

  const lookup = async (query) => {
    const needle = String(query ?? q).trim();
    if (!needle) return;
    setBusy(true);
    setErr("");
    setOpen(null);
    setTree(null);
    setFile(null);
    try {
      const r = await githubListRepos({ query: needle });
      if (!r.ok) {
        setErr(r.error || "No public repositories");
        setItems([]);
        return;
      }
      setItems(r.items || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "GitHub lookup failed");
      setItems([]);
    } finally {
      setBusy(false);
    }
  };

  R.useEffect(() => {
    lookup(q);
  }, []);

  const view = async (item) => {
    setBusy(true);
    setErr("");
    setOpen(item);
    setFile(null);
    try {
      const packed = await githubImportTree({ owner: item.owner, repo: item.name });
      if (!packed.ok) throw new Error(packed.error || "Could not read tree");
      const files = packed.files || [];
      const readme = files.find((f) => /^readme(\.md)?$/i.test((f.path.split("/").pop() || "")));
      setTree({ files, via: packed.via, meta: packed.meta, readme });
      setFile(readme || files[0] || null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "View failed");
      setTree(null);
    } finally {
      setBusy(false);
    }
  };

  return j.jsxs("div", {
    className: "mb-10",
    children: [
      j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: "Browse GitHub" }),
      j.jsx("p", {
        className: "mt-1 text-sm leading-relaxed text-muted",
        children: "Look up any public GitHub user, org, or owner/repo. This is Explore — you read the tree through Kiln. Import (signed in) is what seals it onto your ledger.",
      }),
      j.jsxs("form", {
        className: "mt-4 flex flex-col gap-2 sm:flex-row",
        action: "#",
        onSubmit: (e) => {
          e.preventDefault();
          lookup();
        },
        children: [
          j.jsx("input", {
            className: "input flex-1",
            value: q,
            onChange: (e) => setQ(e.target.value),
            placeholder: "ethereum / bitcoin / owner/repo",
          }),
          j.jsx("button", {
            type: "button",
            className: "btn-primary btn h-9 px-4",
            disabled: busy,
            onClick: () => lookup(),
            children: busy ? "Looking up…" : "Look up",
          }),
        ],
      }),
      j.jsx("div", {
        className: "mt-3 flex flex-wrap gap-2",
        children: CHIPS.map((c) =>
          j.jsx("button", { type: "button", className: "chip", onClick: () => { setQ(c); lookup(c); }, children: c }, c),
        ),
      }),
      err ? j.jsx("p", { className: "mt-3 text-sm text-red-400", children: err }) : null,
      items.length
        ? j.jsx("ul", {
            className: "mt-4 divide-y divide-border rounded-lg border border-border",
            children: items.map((it) =>
              j.jsxs(
                "li",
                {
                  className: "flex flex-wrap items-center gap-3 px-3 py-2.5",
                  children: [
                    j.jsxs("div", {
                      className: "min-w-0 flex-1",
                      children: [
                        j.jsx("p", { className: "truncate font-medium", children: it.fullName }),
                        j.jsx("p", { className: "truncate text-xs text-muted", children: it.description || it.language || "public tree" }),
                      ],
                    }),
                    j.jsx("span", { className: "hidden font-mono text-[11px] text-subtle sm:inline", children: `★${it.stars || 0}` }),
                    j.jsx("button", {
                      type: "button",
                      className: "btn h-8 px-3 text-xs",
                      disabled: busy,
                      onClick: () => void view(it),
                      children: open && open.fullName === it.fullName ? "Viewing" : "View",
                    }),
                  ],
                },
                it.fullName,
              ),
            ),
          })
        : j.jsx("p", { className: "mt-6 text-sm text-muted", children: busy ? "Reading public GitHub…" : "Look up an account or owner/repo." }),
      tree
        ? j.jsxs("div", {
            className: "mt-4 grid gap-3 lg:grid-cols-[220px_1fr]",
            children: [
              j.jsxs("div", {
                className: "max-h-[420px] overflow-auto rounded-lg border border-border",
                children: [
                  j.jsxs("p", {
                    className: "border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-muted",
                    children: [open?.fullName, " · ", tree.files.length, " files · ", tree.via],
                  }),
                  tree.files.map((f) =>
                    j.jsx(
                      "button",
                      {
                        type: "button",
                        className: "block w-full truncate px-3 py-1.5 text-left font-mono text-[11px] hover:bg-surface " + (file && file.path === f.path ? "text-fg" : "text-muted"),
                        onClick: () => setFile(f),
                        children: f.path,
                      },
                      f.path,
                    ),
                  ),
                ],
              }),
              j.jsxs("div", {
                className: "max-h-[420px] overflow-auto rounded-lg border border-border bg-surface p-3",
                children: [
                  j.jsx("p", { className: "mb-2 font-mono text-[11px] text-muted", children: file?.path || "select a file" }),
                  j.jsx("pre", {
                    className: "whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-fg",
                    children: file?.content || "",
                  }),
                ],
              }),
            ],
          })
        : null,
    ],
  });
}
