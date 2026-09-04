import { i as R, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { o as Chrome, r as Tree, t as About } from "./RepoChrome-BaVvC5oG.js";
import { b as useKiln, d as allRepos } from "./store-sx46DNi5.js";
import { i as lattice, a as coherence } from "./pxm-D_rOQ1Ty.js";
import { o as readFile } from "./fs-ri9Mkfbm.js";
import { t as useMatch } from "./useMatch-CaN9MMxo.js";
import { t as Lattice } from "./Lattice-D7_ohVJx.js";

var rr = R(React(), 1);
var j = jsxmod();

async function fileText(file, secret) {
  if (file?.content && !file.encrypted) return String(file.content);
  try {
    const t = await readFile(file, secret);
    return t == null ? "" : String(t);
  } catch {
    return file?.content ? String(file.content) : "";
  }
}

export async function searchMemory(repo, q, secret) {
  if (!repo) return [];
  const needle = String(q || "").toLowerCase();
  if (!needle) return [];
  const lat = lattice(repo.files || [], "", []);
  const hits = [];
  for (const file of repo.files || []) {
    const text = await fileText(file, secret);
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length && hits.length < 40; i++) {
      if (!lines[i].toLowerCase().includes(needle)) continue;
      const cell = (lat.pixels || []).find((p) => p.path === file.path);
      hits.push({
        path: file.path,
        line: i + 1,
        cell: cell ? `${cell.x},${cell.y}` : "—",
        snippet: lines[i].trim().slice(0, 160),
        kind: "folder",
      });
    }
    if (hits.length >= 40) break;
  }
  return hits;
}

export async function searchAllMemory(repo, q, secret, extras = {}, kind) {
  const needle = String(q || "").toLowerCase();
  const out = [];
  const want = (k) => !kind || kind === k || String(kind).includes(k);
  if (want("folder") || want("memory:folder") || !kind) {
    out.push(...(await searchMemory(repo, q, secret)));
  }
  if (needle && (want("lattice") || want("memory:lattice") || !kind)) {
    const lat = lattice(repo.files || [], "", extras.agents || []);
    for (const px of lat.pixels || []) {
      if (String(px.path || "").toLowerCase().includes(needle) || String(px.state || "").includes(needle)) {
        out.push({
          kind: "lattice",
          path: px.path,
          line: px.i + 1,
          cell: `${px.x},${px.y}`,
          snippet: `${px.state} chunk ${px.chunk} ${px.hash || ""}`.slice(0, 160),
        });
      }
    }
  }
  const pushExtra = (kindName, items, fmt) => {
    if (!needle || (kind && !want(kindName))) return;
    for (const item of items || []) {
      const text = fmt(item);
      if (text.toLowerCase().includes(needle)) {
        out.push({ kind: kindName, path: kindName, line: 1, cell: "—", snippet: text.slice(0, 160) });
      }
    }
  };
  pushExtra("mailbox", extras.mailbox, (x) => String(x));
  pushExtra("cwd", extras.cwd != null ? [extras.cwd] : [], (x) => String(x));
  pushExtra("computer", extras.logs, (x) => String(x));
  pushExtra("messages", extras.messages, (x) => String(x?.content ?? x));
  pushExtra("procedural", extras.toolsUsed, (x) => String(x));
  return out.slice(0, 60);
}

export const n = { searchMemory, searchAllMemory };

function params() {
  try {
    const m = useMatch({ select: (s) => s });
    const p = m?.params || m?.matches?.at?.(-1)?.params || {};
    if (p.owner && p.repo) return p;
  } catch {}
  const m = (typeof location < "u" ? location.pathname : "").match(/^\/([^/]+)\/([^/]+)/);
  return { owner: m?.[1] || "", repo: m?.[2] || "" };
}

function useRepo() {
  const p = params();
  const s = useKiln();
  const repo =
    (allRepos(s) || s.userRepos || []).find((r) => r.owner === p.owner && r.name === p.repo) ||
    (allRepos(s) || []).find((r) => r.id === p.owner + "/" + p.repo);
  return { p, s, repo };
}

function component() {
  const { repo, s } = useRepo();
  const [q, setQ] = rr.useState("");
  const [hits, setHits] = rr.useState([]);
  if (!repo)
    return j.jsx("p", { className: "py-16 text-center text-muted", children: "No folder memory." });
  const lat = lattice(repo.files || [], "", (s.agents || []).filter((a) => a.repoId === repo.id));
  const co = coherence(lat);
  async function go(e) {
    e?.preventDefault?.();
    setHits(await searchAllMemory(repo, q, s.wallet?.secret, { agents: s.agents }));
  }
  return j.jsxs("div", {
    children: [
      j.jsx(Chrome, { repo }),
      j.jsxs("div", {
        className: "mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",
        children: [
          j.jsxs("div", {
            children: [
              j.jsx("p", {
                className: "text-[11px] uppercase tracking-[0.16em] text-muted",
                children: "PXM · folder memory",
              }),
              j.jsx("h2", {
                className: "mt-1 font-display text-3xl tracking-tight",
                children: "File bytes live in this tree.",
              }),
              j.jsx("p", {
                className: "mt-2 max-w-xl text-sm text-muted",
                children:
                  "Drop files onto a repo you own (up to 50 GB / folder, 4 MiB AES-256-GCM leaves). Agents and the CLI see the same tree. Hilbert cells are the leaves.",
              }),
              j.jsxs("form", {
                className: "mt-4 flex gap-2",
                onSubmit: go,
                children: [
                  j.jsx("input", {
                    className: "input h-9 flex-1",
                    placeholder: "Search this project",
                    value: q,
                    onChange: (e) => setQ(e.target.value),
                  }),
                  j.jsx("button", { type: "submit", className: "btn h-9", children: "Search" }),
                ],
              }),
              j.jsx("p", {
                className: "mt-2 font-mono text-[11px] text-muted",
                children: `${(repo.files || []).length} files · ${co.cells || 0} cells · coherence ${Math.round((co.coherence || 0) * 100)}% · 50 GB cap`,
              }),
              hits.length
                ? j.jsx("ul", {
                    className: "mt-4 divide-y divide-border rounded-xl border border-border",
                    children: hits.map((h, i) =>
                      j.jsxs(
                        "li",
                        {
                          className: "px-3 py-2 font-mono text-[12px]",
                          children: [
                            j.jsx("span", { className: "text-seal", children: h.kind || "folder" }),
                            "  ",
                            h.path,
                            ":",
                            h.line,
                            "  cell ",
                            h.cell,
                            j.jsx("div", { className: "text-muted", children: h.snippet }),
                          ],
                        },
                        i,
                      ),
                    ),
                  })
                : null,
              j.jsx("div", { className: "mt-6 max-w-xl", children: j.jsx(Lattice, { lattice: lat }) }),
              j.jsx("div", { className: "mt-6", children: j.jsx(Tree, { repo }) }),
            ],
          }),
          j.jsx(About, { repo }),
        ],
      }),
    ],
  });
}
export { component };
