import { i as R, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { o as Chrome, t as About } from "./RepoChrome-BaVvC5oG.js";
import { b as useKiln, d as allRepos } from "./store-sx46DNi5.js";
import { i as lattice, a as coherence } from "./pxm-D_rOQ1Ty.js";
import { t as Lattice } from "./Lattice-D7_ohVJx.js";
import { t as useMatch } from "./useMatch-CaN9MMxo.js";
import { gpuPaint, probeGpu } from "./gpu-Bs1r2h0p.js";

var rr = R(React(), 1);
var j = jsxmod();

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
  const list = allRepos(s) || [];
  const repo =
    list.find((r) => r.owner === p.owner && r.name === p.repo) ||
    list.find((r) => r.id === p.owner + "/" + p.repo) ||
    list.find((r) => r.owner?.toLowerCase() === p.owner?.toLowerCase() && r.name?.toLowerCase() === p.repo?.toLowerCase());
  return { p, s, repo };
}

function component() {
  const { repo, s } = useRepo();
  const [sel, setSel] = rr.useState(null);
  const [gpu, setGpu] = rr.useState(null);
  rr.useEffect(() => {
    probeGpu().then(setGpu).catch(() => {});
  }, []);
  if (!repo)
    return j.jsx("p", { className: "py-16 text-center text-muted", children: "No lattice for that tree." });
  const agents = (s.agents || []).filter((a) => a.repoId === repo.id);
  const leaves = (repo.files || []).map((f) => ({
    ...f,
    path: String(f.path || "").replace(/\//g, "∕"),
  }));
  const lat = lattice(leaves.length ? leaves : repo.files || [], "", agents);
  const co = coherence(lat);
  async function paint() {
    const r = await gpuPaint((repo.files || []).slice(0, 128).map((f) => f.sha || f.path));
    setGpu((g) => ({ ...(g || {}), paint: r }));
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
                children: "PXM · Hilbert",
              }),
              j.jsx("h2", {
                className: "mt-1 font-display text-3xl tracking-tight",
                children: "4D world",
              }),
              j.jsx("p", {
                className: "mt-2 max-w-xl text-sm text-muted",
                children:
                  "Memory is a coordinate. Agents hop cells on the sealed tree. Pixelated folder memory — each cell is a 4 MiB AES-256-GCM leaf on a Hilbert curve.",
              }),
              j.jsx("div", { className: "mt-6 max-w-xl", children: j.jsx(Lattice, { lattice: lat, selected: sel, onSelect: setSel }) }),
              j.jsx("p", {
                className: "mt-4 font-mono text-[11px] text-muted",
                children: `PXM coherence ${Math.round((co.coherence || 0) * 100)}% · ${co.cells || 0} cells · ${co.occupied || 0} occupied · ${co.sealed || 0} sealed · folder ${((lat.used || 0) / 1e9).toFixed(4)} GB / 50 GB`,
              }),
              gpu
                ? j.jsx("p", {
                    className: "mt-1 font-mono text-[11px] text-subtle",
                    children: `WebGPU ${gpu.available ? "adapter " + (gpu.adapter || "yes") : "cpu fallback"} · port 7840${gpu.paint ? " · paint " + gpu.paint.via + " " + (gpu.paint.cells || 0) + " cells" : ""}`,
                  })
                : null,
              j.jsx("button", {
                type: "button",
                className: "btn mt-3 h-9",
                onClick: () => void paint(),
                children: "Paint lattice on GPU",
              }),
              sel
                ? j.jsxs("pre", {
                    className: "mt-4 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[11px] text-muted",
                    children: [
                      `cell (${sel.x}, ${sel.y})  ρ ${sel.rho}  ${sel.state}\n`,
                      sel.path,
                      "\n",
                      sel.hash || "",
                      sel.occupant ? `\noccupant ${sel.occupant}` : "",
                    ],
                  })
                : null,
            ],
          }),
          j.jsx(About, { repo }),
        ],
      }),
    ],
  });
}
export { component };
