import { i as R, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { o as Chrome, t as About } from "./RepoChrome-BaVvC5oG.js";
import { b as useKiln, d as allRepos } from "./store-sx46DNi5.js";
import { t as useMatch } from "./useMatch-CaN9MMxo.js";
import { bootMachine, runOnMachine } from "./computer-G9ZCRY5O.js";
import { searchMemory } from "./memory-DWov_Aom.js";

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

function termsOf(files) {
  return (files || []).reduce((a, f) => a + (f.content ? String(f.content).split(/\s+/).filter(Boolean).length : 0), 0);
}

function component() {
  const { repo, s } = useRepo();
  const [cmd, setCmd] = rr.useState("");
  const [q, setQ] = rr.useState("");
  const [hits, setHits] = rr.useState(null);
  const machine = repo ? bootMachine(repo) : null;
  const files = repo?.files || [];
  const nFiles = files.length;
  const terms = termsOf(files);
  const banner = repo
    ? `${repo.owner}.${repo.name} kilnsh ${nFiles} files\nkiln computer  ${repo.id}\ncipher AES-256-GCM\nmodel ${repo.modelId || "grok-4.6"}\ndomain https://${repo.owner}-${repo.name}.kiln.app\nports 443,7331,7840,8000,8443\n${repo.githubUrl ? "origin " + repo.githubUrl + "\n" : ""}type help. this computer belongs to this repository.`
    : "";
  const [log, setLog] = rr.useState(banner);
  rr.useEffect(() => {
    if (repo) setLog(banner);
  }, [repo?.id]);
  if (!repo)
    return j.jsx("p", { className: "py-16 text-center text-muted", children: "No computer for that tree." });

  async function run(raw) {
    const line = (raw || "help").trim();
    const r = await runOnMachine(repo.id, line);
    setLog((p) => p + "\n\n/ % " + line + "\n" + (r.out || ""));
    setCmd("");
  }
  async function search(e) {
    e?.preventDefault?.();
    const h = await searchMemory(repo, q, s.wallet?.secret);
    setHits(h);
  }
  const agents = (s.agents || []).filter((a) => a.repoId === repo.id);
  const processes = machine?.processes || [
    { pid: 1, name: "init", status: "running" },
    { pid: 2, name: "kiln-agentd", status: "running" },
    { pid: 3, name: "kiln-memoryd", status: "running" },
    { pid: 4, name: "kiln-edged", status: "running" },
    { pid: 5, name: "kiln-indexerd", status: "running" },
  ];
  const ports = machine?.ports || [];

  return j.jsxs("div", {
    children: [
      j.jsx(Chrome, { repo }),
      j.jsxs("div", {
        className: "mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",
        children: [
          j.jsxs("div", {
            children: [
              j.jsx("h2", {
                className: "font-display text-3xl tracking-tight",
                children: "This repository is its own computer.",
              }),
              j.jsx("p", {
                className: "mt-2 max-w-2xl text-sm text-muted",
                children:
                  "Not a sandbox on a shared box. A machine that belongs to this tree — shell, memory, agents, ports, and a live domain.",
              }),
              j.jsxs("div", {
                className: "mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]",
                children: [
                  j.jsxs("div", {
                    className: "overflow-hidden rounded-xl border border-border bg-surface",
                    children: [
                      j.jsxs("div", {
                        className: "flex items-center justify-between border-b border-border px-3 py-2 font-mono text-[11px] text-muted",
                        children: [
                          j.jsx("span", { children: `${repo.owner}.${repo.name} kilnsh ${nFiles} files` }),
                          j.jsx("span", { children: "_ kilnsh" }),
                        ],
                      }),
                      j.jsx("pre", {
                        className: "max-h-[420px] overflow-auto p-3 font-mono text-[12px] leading-5",
                        children: log,
                      }),
                      j.jsxs("form", {
                        className: "border-t border-border px-3 py-2",
                        onSubmit: (e) => {
                          e.preventDefault();
                          run(cmd);
                        },
                        children: [
                          j.jsxs("label", {
                            className: "flex items-center gap-2 font-mono text-[12px]",
                            children: [
                              j.jsx("span", { className: "text-muted", children: "/ %" }),
                              j.jsx("input", {
                                className: "min-h-10 flex-1 bg-transparent outline-none",
                                value: cmd,
                                onChange: (e) => setCmd(e.target.value),
                                placeholder: "help · ls · git status · python · memory search",
                                autoCapitalize: "off",
                                autoCorrect: "off",
                                spellCheck: false,
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  j.jsxs("div", {
                    className: "space-y-4",
                    children: [
                      j.jsxs("section", {
                        className: "rounded-xl border border-border bg-surface p-3",
                        children: [
                          j.jsx("p", {
                            className: "text-[11px] uppercase tracking-[0.16em] text-muted",
                            children: "Folder memory",
                          }),
                          j.jsxs("form", {
                            className: "mt-2",
                            onSubmit: search,
                            children: [
                              j.jsx("input", {
                                className: "input h-9",
                                placeholder: "Search this project",
                                value: q,
                                onChange: (e) => setQ(e.target.value),
                              }),
                            ],
                          }),
                          j.jsx("p", {
                            className: "mt-2 font-mono text-[11px] text-subtle",
                            children: `${nFiles} files · ${terms.toLocaleString()} terms · 50 GB cap`,
                          }),
                          hits
                            ? j.jsx("ul", {
                                className: "mt-2 max-h-32 overflow-auto font-mono text-[11px] text-muted",
                                children: hits.length
                                  ? hits.slice(0, 8).map((h, i) =>
                                      j.jsxs("li", { children: [h.path, ":", h.line, "  ", h.snippet] }, i),
                                    )
                                  : j.jsx("li", { children: "No memory hits." }),
                              })
                            : null,
                        ],
                      }),
                      j.jsxs("section", {
                        className: "rounded-xl border border-border bg-surface p-3",
                        children: [
                          j.jsx("p", {
                            className: "text-[11px] uppercase tracking-[0.16em] text-muted",
                            children: "Processes",
                          }),
                          j.jsx("ul", {
                            className: "mt-2 space-y-1 font-mono text-[12px]",
                            children: processes.map((p) =>
                              j.jsxs(
                                "li",
                                {
                                  className: "flex justify-between",
                                  children: [
                                    j.jsx("span", { children: `${p.pid} ${p.name}` }),
                                    j.jsx("span", { className: "text-ok", children: p.status }),
                                  ],
                                },
                                p.pid,
                              ),
                            ),
                          }),
                        ],
                      }),
                      j.jsxs("section", {
                        className: "rounded-xl border border-border bg-surface p-3",
                        children: [
                          j.jsx("p", {
                            className: "text-[11px] uppercase tracking-[0.16em] text-muted",
                            children: "Agents on this machine",
                          }),
                          agents.length
                            ? agents.map((a) =>
                                j.jsxs(
                                  "p",
                                  {
                                    className: "mt-2",
                                    children: [
                                      a.name || a.role,
                                      " ",
                                      j.jsx("span", { className: "text-muted", children: a.role }),
                                    ],
                                  },
                                  a.id,
                                ),
                              )
                            : j.jsxs("p", {
                                className: "mt-2",
                                children: ["Indra ", j.jsx("span", { className: "text-muted", children: "indexer" })],
                              }),
                          j.jsx(Link, {
                            to: "/studio",
                            search: { prompt: "open " + repo.id },
                            className: "mt-3 inline-block text-sm text-seal hover:underline",
                            children: "Open Studio",
                          }),
                        ],
                      }),
                      j.jsxs("section", {
                        className: "rounded-xl border border-border bg-surface p-3",
                        children: [
                          j.jsx("p", {
                            className: "text-[11px] uppercase tracking-[0.16em] text-muted",
                            children: "Ports",
                          }),
                          j.jsx("ul", {
                            className: "mt-2 space-y-1 font-mono text-[12px]",
                            children: ports.map((p) =>
                              j.jsxs(
                                "li",
                                {
                                  className: "flex justify-between",
                                  children: [
                                    j.jsx("span", { children: p.port }),
                                    j.jsx("span", { className: "text-muted", children: p.service }),
                                  ],
                                },
                                p.port,
                              ),
                            ),
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
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
