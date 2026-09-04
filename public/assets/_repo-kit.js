import { i as R, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { o as Chrome, r as Tree, t as About, a as Readme } from "./RepoChrome-BaVvC5oG.js";
import { b as useKiln, d as allRepos } from "./store-sx46DNi5.js";
import { t as useMatch } from "./useMatch-CaN9MMxo.js";
import { t as Markdown } from "./Markdown-4Ln3G1u7.js";
var rr = R(React(), 1);
var j = jsxmod();
export function params() {
  try {
    const m = useMatch({ select: (s) => s });
    const p = m?.params || m?.matches?.at?.(-1)?.params || {};
    if (p.owner && p.repo) return p;
  } catch {}
  const m = (typeof location < "u" ? location.pathname : "").match(/^\/([^/]+)\/([^/]+)/);
  return { owner: m?.[1] || "", repo: m?.[2] || "", splat: (typeof location < "u" ? location.pathname : "").split("/").slice(3).join("/") };
}
export function useRepo() {
  const p = params();
  const s = useKiln();
  const list = allRepos(s) || [];
  const repo =
    list.find((r) => r.owner === p.owner && r.name === p.repo) ||
    list.find((r) => r.id === p.owner + "/" + p.repo) ||
    list.find((r) => r.owner?.toLowerCase() === p.owner?.toLowerCase() && r.name?.toLowerCase() === p.repo?.toLowerCase());
  return { p, s, repo };
}
export function Shell({ children }) {
  const { repo } = useRepo();
  if (!repo) return j.jsx("p", { className: "py-16 text-center text-muted", children: "No public tree with that name." });
  return j.jsxs("div", { children: [j.jsx(Chrome, { repo }), children] });
}
export function Empty({ title, hint, cta, onCta }) {
  return j.jsxs("div", { className: "mt-6 rounded-xl border border-border bg-surface px-6 py-10 text-center", children: [
    j.jsx("h3", { className: "font-display text-xl", children: title }),
    j.jsx("p", { className: "mt-2 text-sm text-muted", children: hint }),
    cta ? j.jsx("button", { type: "button", className: "btn-primary btn mt-4 h-9 px-4", onClick: onCta, children: cta }) : null
  ]});
}
export { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useKiln, allRepos };
