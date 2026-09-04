import { i as R, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { o as Chrome, t as About } from "./RepoChrome-BaVvC5oG.js";
import { b as useKiln, d as allRepos } from "./store-sx46DNi5.js";
import { t as useMatch } from "./useMatch-CaN9MMxo.js";
import { n as toast } from "./dist-gk9u-W-R.js";

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
  const [busy, setBusy] = rr.useState(false);
  if (!repo) return j.jsx("p", { className: "py-16 text-center text-muted", children: "No project." });
  const host = `${repo.owner}-${repo.name}.kiln.app`;
  const domain = (s.domains || []).find((d) => d.repoId === repo.id) || {
    host,
    status: "live",
  };
  async function deploy() {
    setBusy(true);
    try {
      const d = await s.deployRepo(repo.id);
      toast(d.status === "error" ? d.logs?.at?.(-1) || "Deploy failed" : `https://${d.host}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Connect a wallet to deploy");
    } finally {
      setBusy(false);
    }
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
                children: "Project · production",
              }),
              j.jsxs("div", {
                className: "mt-2 flex flex-wrap items-start justify-between gap-4",
                children: [
                  j.jsxs("div", {
                    children: [
                      j.jsx("h2", {
                        className: "font-display text-3xl tracking-tight",
                        children: "Windows on this computer.",
                      }),
                      j.jsx("p", {
                        className: "mt-2 max-w-xl text-sm text-muted",
                        children:
                          "GitHub is the tree. Cloudflare is the edge. Vercel is the deploy. Here they are one machine with a live domain, a crew kernel, and a capsule.",
                      }),
                    ],
                  }),
                  j.jsx("button", {
                    type: "button",
                    className: "btn-primary btn h-9 px-4",
                    disabled: busy,
                    onClick: () => void deploy(),
                    children: busy ? "Deploying…" : "▶ Deploy",
                  }),
                ],
              }),
              j.jsxs("section", {
                className: "mt-6 rounded-xl border border-border bg-surface p-4",
                children: [
                  j.jsx("p", {
                    className: "text-[11px] uppercase tracking-[0.16em] text-muted",
                    children: "Active domains",
                  }),
                  j.jsxs("p", {
                    className: "mt-2",
                    children: [
                      j.jsx("a", {
                        className: "text-seal hover:underline",
                        href: "https://" + (domain.host || host),
                        children: "https://" + (domain.host || host),
                      }),
                      " ",
                      j.jsx("span", {
                        className: "ml-2 text-[11px] uppercase tracking-[0.14em] text-ok",
                        children: domain.status || "live",
                      }),
                    ],
                  }),
                  j.jsx("p", {
                    className: "mt-1 font-mono text-[11px] text-subtle",
                    children: "https:443 capsule · mcp:7331 mcp · gpu:7840 webgpu · python:8000 python · cloud:8443 sealed-cloud",
                  }),
                ],
              }),
              j.jsx("p", {
                className: "mt-6 text-[11px] uppercase tracking-[0.16em] text-muted",
                children: "Project windows",
              }),
              j.jsx("div", {
                className: "mt-2 grid gap-3 sm:grid-cols-3",
                children: [
                  ["Code", `${(repo.files || []).length} files`, `/${repo.owner}/${repo.name}`],
                  ["Computer", `kiln.${repo.owner}.${repo.name}`, `/${repo.owner}/${repo.name}/computer`],
                  ["Capsule", host, `/${repo.owner}/${repo.name}/preview`],
                  ["4D", "PXM lattice", `/${repo.owner}/${repo.name}/world`],
                  ["Actions", "settle · deploy", `/${repo.owner}/${repo.name}/actions`],
                  ["Crew", "spawn crew", "/studio"],
                ].map(([t, d, to]) =>
                  j.jsxs(
                    Link,
                    {
                      to,
                      className: "rounded-xl border border-border bg-surface p-4 hover:border-seal",
                      children: [
                        j.jsx("h3", { className: "font-medium", children: t }),
                        j.jsx("p", { className: "mt-1 font-mono text-[12px] text-muted", children: d }),
                      ],
                    },
                    t,
                  ),
                ),
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
