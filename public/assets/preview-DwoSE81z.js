import { i as R, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { o as Chrome, t as About } from "./RepoChrome-BaVvC5oG.js";
import { b as useKiln, d as allRepos } from "./store-sx46DNi5.js";
import { t as useMatch } from "./useMatch-CaN9MMxo.js";

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
    list.find((r) => r.id === p.owner + "/" + p.repo);
  return { p, s, repo };
}

function component() {
  const { repo, s } = useRepo();
  if (!repo) return j.jsx("p", { className: "py-16 text-center text-muted", children: "No capsule." });
  const html =
    (repo.files || []).find((f) => f.path === "index.html")?.content ||
    `<!doctype html><title>${repo.name}</title><body style="font-family:IBM Plex Sans,system-ui;padding:2rem;background:#111;color:#eee"><p style="letter-spacing:.2em;text-transform:uppercase;opacity:.6">capsule</p><h1>${repo.name}</h1><p>${repo.description || ""}</p><pre>kiln://${repo.id}.git\nhttps://${repo.owner}-${repo.name}.kiln.app</pre></body>`;
  const src = "data:text/html;charset=utf-8," + encodeURIComponent(html);
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
                children: "Capsule · port 443",
              }),
              j.jsx("h2", { className: "mt-1 font-display text-2xl tracking-tight", children: "Preview" }),
              j.jsx("p", {
                className: "mt-2 max-w-xl text-sm text-muted",
                children: "The working tree executes. Bound models and called agents ship inside the iframe.",
              }),
              j.jsx("iframe", {
                title: "preview",
                src,
                className: "mt-4 min-h-[480px] w-full rounded-xl border border-border bg-white",
                sandbox: "allow-scripts allow-forms allow-same-origin",
              }),
            ],
          }),
          j.jsx(About, { repo }),
        ],
      }),
    ],
  });
}
export { component };
