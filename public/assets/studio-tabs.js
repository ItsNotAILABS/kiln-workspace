/**
 * Agentic Studio — crew, GitHub import, one-shot, computer, CLI.
 * Restores the tabbed studio that commits on the kiln wallet.
 *
 * Architecture (KILN-WP-09 / homepage): a crew on a computer, not a
 * copilot in a sidebar. Conductor owns the graph. Builder writes files
 * as git commits. Reviewer gates. Cipher attests the Merkle root.
 * MCP is the same tool vocabulary the CLI uses.
 */
import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { n as toast } from "./dist-gk9u-W-R.js";
import { a as ConnectBtn } from "./AppShell-H-m5HQPd.js";
import { t as cn } from "./cn-DojpP95n.js";
import { A as MODELS, U as ROLES, W as KINDS, E as CREW_GRAPH, b as useKiln, d as allRepos, k as DEFAULT_MODEL, m as owns, t as chainBlocks, p as chainTxs } from "./store-sx46DNi5.js";
import { n as runKernel } from "./kernel-Y7F91935.js";
import { githubImportTree, githubListRepos } from "./github-import.js";
import { bootMachine, runOnMachine } from "./computer-G9ZCRY5O.js";
import { isolatePreview, sealMachine } from "./machine-seal.js";
import { t as callTool } from "./tools-CJzwF1Kq.js";
import { ChatList } from "./chat-ui.js";
import { IsolationExplorer } from "./isolation-ui.js";

function readSearch() {
  try {
    const u = new URL(window.location.href);
    return {
      tab: u.searchParams.get("tab") || undefined,
      prompt: u.searchParams.get("prompt") || undefined,
    };
  } catch {
    return {};
  }
}

const R = reactNs(React(), 1);
const j = jsxmod();
const TABS = [
  { id: "crew", label: "Crew" },
  { id: "import", label: "Import" },
  { id: "oneshot", label: "One-shot" },
  { id: "computer", label: "Computer" },
  { id: "cli", label: "CLI" },
];
const KERNEL_PANES = [
  { id: "tree", label: "Computer" },
  { id: "graph", label: "Graph" },
  { id: "constitution", label: "Constitution" },
  { id: "mailbox", label: "Mailbox" },
  { id: "l1", label: "L1" },
  { id: "preview", label: "Preview" },
];
const CHIPS = ["ItsNotAILABS", "FreddyCreates", "reagent-systems/mouse", "ethereum", "bitcoin"];
const SHOTS = [
  "A sealed vault dashboard with Merkle proofs and a live KLN ticker",
  "An agent that indexes a research tree and sits on Hilbert cells",
  "A protocol landing with escrow stats and a Solidity lock",
  "Fork mouse onto this kiln and sit a builder on the Swift shell",
];

function pickRepoId(mine, repos) {
  const all = [...(mine || []), ...(repos || [])];
  const kiln = all.find((r) => r.id === "kiln/kiln" && (r.files || []).length);
  if (kiln) return kiln.id;
  const richest = all
    .filter((r) => (r.files || []).length > 0)
    .sort((a, b) => (b.files.length || 0) - (a.files.length || 0))[0];
  return richest?.id || all.find((r) => r.id === "kiln/studio")?.id || mine[0]?.id || repos[0]?.id || "kiln/kiln";
}

async function wallet() {
  const st = useKiln.getState();
  if (st.wallet) return st.wallet;
  throw new Error("SIGNIN_REQUIRED");
}

function holdSubmit(e) {
  if (!e) return;
  if (typeof e.preventDefault === "function") e.preventDefault();
  if (typeof e.stopPropagation === "function") e.stopPropagation();
}

async function bootForge() {
  try {
    if (typeof globalThis.__KILN_BOOT === "function") await globalThis.__KILN_BOOT();
  } catch {
    /* forge boot is best-effort */
  }
}

function statusDot(status) {
  return j.jsx("span", {
    className: cn(
      "size-2 shrink-0 rounded-full",
      status === "thinking" || status === "tooling" ? "bg-seal animate-pulse" : status === "done" ? "bg-ok" : status === "error" ? "bg-danger" : "bg-subtle",
    ),
  });
}

function leadAgent(agents) {
  return agents.find((a) => a.role === "conductor") || agents.find((a) => a.role === "builder") || agents[0] || null;
}

function messagesForAgent(st, agent) {
  const map = st.agentMessages || {};
  const mine = map[agent.id] || [];
  if (mine.length) return mine;
  const mates = (st.agents || []).filter((a) => a.repoId === agent.repoId);
  for (const a of mates) {
    const list = map[a.id] || [];
    if (list.length) return list;
  }
  const live = new Set((st.agents || []).map((a) => a.id));
  let best = [];
  for (const [id, list] of Object.entries(map)) {
    if (live.has(id) || !list || !list.length) continue;
    if (list.length > best.length) best = list;
  }
  return best;
}

const GRAPH_LAYOUT = {
  conductor: [72, 40],
  agi: [24, 96],
  architect: [168, 36],
  builder: [248, 64],
  reviewer: [268, 128],
  deployer: [176, 156],
  cipher: [96, 132],
  indexer: [312, 88],
};

function uniqueByRole(agents) {
  const seen = new Map();
  const extras = [];
  for (const a of agents || []) {
    if (!a?.role) continue;
    if (a.parentId || a.resident === false) {
      extras.push(a);
      continue;
    }
    const cur = seen.get(a.role);
    if (!cur) seen.set(a.role, a);
    else if ((a.mailbox || []).length > (cur.mailbox || []).length) seen.set(a.role, a);
  }
  const order = ["conductor", "agi", "architect", "builder", "reviewer", "deployer", "cipher", "indexer", "scout"];
  const out = order.map((r) => seen.get(r)).filter(Boolean);
  for (const a of seen.values()) if (!order.includes(a.role)) out.push(a);
  for (const a of extras) if (!out.some((x) => x.id === a.id)) out.push(a);
  return out;
}

function attachOnConductor(repoId, child, mailboxAccess) {
  const st = useKiln.getState();
  const conductor = st.agents.find((a) => a.repoId === repoId && a.role === "conductor");
  const crew = st.crews.find((c) => c.repoId === repoId);
  st.patchAgent(child.id, {
    parentId: conductor?.id || child.parentId,
    mailboxAccess: mailboxAccess !== false,
  });
  if (crew) {
    const edge = { from: "conductor", to: child.role, kind: "spawn", label: `${child.name} on conductor` };
    const edges = [...(crew.edges || [])];
    if (!edges.some((e) => e.kind === "spawn" && e.label === edge.label)) edges.push(edge);
    useKiln.setState({
      crews: st.crews.map((c) =>
        c.id === crew.id ? { ...c, edges, memberIds: [...new Set([...(c.memberIds || []), child.id])] } : c,
      ),
    });
  }
  return conductor;
}

function chatModels() {
  const chat = MODELS.filter((m) => m.family === "chat");
  const grok = chat.filter((m) => m.kind === "xai" || m.native);
  const rest = chat.filter((m) => !(m.kind === "xai" || m.native));
  return grok.length ? [...grok, ...rest] : chat;
}

function kernelFilesFor(repoId) {
  const edges = CREW_GRAPH || [];
  return [
    {
      path: "constitution.json",
      body:
        JSON.stringify(
          {
            repo: repoId,
            rules: [
              "One computer per repository.",
              "A write is git commit. Use kiln_write_file.",
              "Handoff, do not impersonate.",
              "Seat yourself after a write.",
              "Never exfiltrate vault keys.",
              "Folder quota is 50 GiB. Cipher verifies.",
              "The capsule boots index.html. Deployer ships it.",
              "Speak git: clone, commit, push, pull, branch.",
            ],
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: "graph.json",
      body: JSON.stringify({ repo: repoId, edges }, null, 2) + "\n",
    },
    {
      path: "mailbox.json",
      body: JSON.stringify({ repo: repoId, messages: [] }, null, 2) + "\n",
    },
    {
      path: "src/index.ts",
      body: `export const boot = () => {\n  console.log(${JSON.stringify(repoId + " kernel")});\n};\nboot();\n`,
    },
    {
      path: "src/kernel.ts",
      body: `/** Crew kernel for ${repoId}. A write is a git commit. */\nexport const ROLES = ["conductor", "agi", "architect", "builder", "reviewer", "deployer", "cipher", "indexer"] as const;\nexport function seat(role: (typeof ROLES)[number]) {\n  return { role, repo: ${JSON.stringify(repoId)}, write: "kiln_write_file" };\n}\n`,
    },
  ];
}

async function ensureKernelFiles(repoId) {
  if (!repoId) return;
  const live = useKiln.getState();
  if (typeof live.commitFile !== "function") return;
  const repo = allRepos(live).find((r) => r.id === repoId);
  if (!repo) return;
  const have = new Set((repo.files || []).map((f) => f.path));
  for (const file of kernelFilesFor(repoId)) {
    if (have.has(file.path)) continue;
    try {
      await useKiln.getState().commitFile(repoId, file.path, file.body, `seat ${file.path}`);
      have.add(file.path);
    } catch {
      /* seating is best-effort */
    }
  }
}

export function StudioTabs({ initialPrompt = "" }) {
  const st = useKiln();
  const search = readSearch();
  const walletHandle = st.wallet?.handle;
  const repos = allRepos(st).filter((r) => r.visibility === "public" || owns(r, st) || r.owner === walletHandle);
  const mine = repos.filter((r) => owns(r, st) || r.owner === walletHandle);
  const [tab, setTab] = R.useState(search.tab || "crew");
  const [repoId, setRepoId] = R.useState(() => pickRepoId(mine, repos));
  const [role, setRole] = R.useState("builder");
  const [model, setModel] = R.useState(st.defaultModelId || DEFAULT_MODEL || "grok-4.6");
  const [busy, setBusy] = R.useState(false);
  const [active, setActive] = R.useState(st.agents[0]?.id || null);
  const [booting, setBooting] = R.useState(true);
  const [mailOn, setMailOn] = R.useState(true);
  const agents = st.agents;
  const repo = repos.find((r) => r.id === repoId) || repos[0];

  R.useEffect(() => {
    if (search.tab && search.tab !== tab) setTab(search.tab);
  }, [search.tab]);
  R.useEffect(() => {
    if (!active && agents[0]) setActive(agents[0].id);
  }, [agents, active]);
  R.useEffect(() => {
    if (repo && !repos.some((r) => r.id === repoId) && repos[0]) setRepoId(repos[0].id);
  }, [repos, repoId, repo]);

  R.useEffect(() => {
    let dead = false;
    (async () => {
      setBooting(true);
      try {
        if (!useKiln.getState().wallet) {
          if (!dead) setBooting(false);
          return;
        }
        await wallet();
        if (dead) return;
        const live = useKiln.getState();
        const nextRepos = allRepos(live);
        const preferred = pickRepoId(
          nextRepos.filter((r) => r.owner === live.wallet?.handle || owns(r, live)),
          nextRepos,
        );
        if (!dead && preferred && preferred !== repoId) setRepoId(preferred);
        const id = preferred || repoId;
        const seat = async () => {
          const live2 = useKiln.getState();
          const seated = live2.agents.filter((a) => a.repoId === id);
          const have = new Set(seated.map((a) => a.role));
          const need = ["conductor", "agi", "architect", "builder", "reviewer", "deployer", "cipher", "indexer"];
          const missing = need.filter((r) => !have.has(r));
          const crew = live2.crews.find((c) => c.repoId === id);
          if (missing.length && id) {
            if (!seated.length && !crew) {
              await live2.spawnCrew({ repoId: id, modelId: live2.defaultModelId || model });
            } else {
              for (const role of missing) {
                await live2.spawnAgent({
                  role,
                  repoId: id,
                  resident: true,
                  modelId: live2.defaultModelId || model,
                  crewId: crew?.id,
                });
              }
            }
          }
          const lead = leadAgent(useKiln.getState().agents.filter((a) => a.repoId === id));
          if (!dead && lead) setActive(lead.id);
        };
        await seat();
        if (!dead && id) await ensureKernelFiles(id);
        if (!dead) setBooting(false);
        bootForge().then(async () => {
          if (dead) return;
          await seat();
          const live = useKiln.getState();
          const next = pickRepoId(
            allRepos(live).filter((r) => r.owner === live.wallet?.handle || owns(r, live)),
            allRepos(live),
          );
          if (next) await ensureKernelFiles(next);
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Studio boot failed";
        if (msg !== "SIGNIN_REQUIRED") toast(msg);
        if (!dead) setBooting(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  if (!st.wallet) {
    return j.jsxs("div", {
      className: "flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center",
      children: [
        j.jsx("p", { className: "font-display text-3xl tracking-tight", children: "Studio is a kiln account" }),
        j.jsx("p", {
          className: "max-w-md text-sm leading-relaxed text-muted",
          children: "Sign in to open the workshop. Import, crew, computer, and commits live on your wallet. The rest of Kiln stays public — visitors are not kiln accounts.",
        }),
        j.jsx(ConnectBtn, { label: "Sign in" }),
      ],
    });
  }

  const spawn = async (roles) => {
    await wallet();
    setBusy(true);
    try {
      let st = useKiln.getState();
      if (!st.crews.find((c) => c.repoId === repoId)) {
        await st.spawnCrew({ repoId, modelId: model });
      }
      let last = active;
      for (const r of roles) {
        const n = useKiln.getState().agents.filter((a) => a.repoId === repoId && a.role === r).length;
        const label = (ROLES.find((x) => x.id === r) || { label: r }).label;
        const child = await useKiln.getState().spawnAgent({
          role: r,
          repoId,
          modelId: model,
          crewId: useKiln.getState().crews.find((c) => c.repoId === repoId)?.id,
          resident: false,
          name: n ? `${label} ${n + 1}` : `${label} · seated`,
          mailboxAccess: mailOn,
        });
        attachOnConductor(repoId, child, mailOn);
        last = child.id;
      }
      setActive(last);
      toast(roles.length > 1 ? "Agents seated on conductor" : "Agent seated on conductor");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not spawn");
    } finally {
      setBusy(false);
    }
  };

  const spawnFull = async () => {
    setBusy(true);
    try {
      await wallet();
      await useKiln.getState().spawnCrew({ repoId, modelId: model });
      toast("Crew kernel online");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Crew failed");
    } finally {
      setBusy(false);
    }
  };

  return j.jsxs("div", {
    className: "k-studio",
    children: [
      j.jsxs("div", {
        className: "flex flex-wrap items-center gap-2 border-b border-border px-3 py-2",
        children: [
          j.jsx("p", { className: "font-display text-sm font-semibold tracking-tight", children: "Studio" }),
          j.jsx("span", { className: "hidden text-xs text-muted sm:inline", children: "A crew on a computer. Writes are git commits." }),
          j.jsxs("div", {
            className: "ml-auto flex flex-wrap items-center gap-2",
            children: [
              j.jsx("select", {
                className: "input h-8 w-[9.5rem] text-xs sm:w-[11rem]",
                value: repoId,
                onChange: (e) => setRepoId(e.target.value),
                children: repos.map((r) => j.jsx("option", { value: r.id, children: r.id }, r.id)),
              }),
              j.jsx("select", {
                className: "input hidden h-8 w-[8.5rem] text-xs sm:block",
                value: role,
                onChange: (e) => setRole(e.target.value),
                children: ROLES.map((r) => j.jsx("option", { value: r.id, children: r.label }, r.id)),
              }),
              j.jsx("select", {
                className: "input hidden h-8 w-[9.5rem] text-xs md:block",
                value: model,
                onChange: (e) => setModel(e.target.value),
                children: chatModels().map((m) => j.jsx("option", { value: m.id, children: m.label }, m.id)),
              }),
              j.jsxs("label", {
                className: "hidden items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-muted lg:flex",
                children: [
                  j.jsx("input", { type: "checkbox", checked: mailOn, onChange: (e) => setMailOn(e.target.checked) }),
                  "Mailbox",
                ],
              }),
              j.jsxs("button", { type: "button", className: "btn hidden h-8 sm:inline-flex", disabled: busy, onClick: () => void spawn([role]), children: ["Spawn"] }),
              j.jsx("button", {
                type: "button",
                className: "btn-primary btn h-8",
                disabled: busy,
                onClick: () => void spawnFull(),
                children: "Spawn crew",
              }),
            ],
          }),
        ],
      }),
      j.jsx("div", {
        className: "flex gap-1 overflow-x-auto border-b border-border px-3",
        children: TABS.map((t) =>
          j.jsxs(
            "button",
            {
              type: "button",
              onClick: () => setTab(t.id),
              className: cn("relative shrink-0 px-3 py-2 text-sm", tab === t.id ? "text-fg" : "text-muted hover:text-fg"),
              children: [t.label, tab === t.id ? j.jsx("span", { className: "absolute inset-x-2 -bottom-px h-0.5 bg-accent" }) : null],
            },
            t.id,
          ),
        ),
      }),
      tab === "crew" ? j.jsx(CrewPane, { agents, active, setActive, repoId, model, booting, onSpawn: spawnFull }) : null,
      tab === "import" ? j.jsx(ImportPane, { ownerDefault: st.wallet?.handle || "kiln" }) : null,
      tab === "oneshot" ? j.jsx(OneshotPane, { initialPrompt: search.prompt || initialPrompt, modelId: model, onLanded: (id) => { setRepoId(id); setTab("crew"); } }) : null,
      tab === "computer" ? j.jsx(ComputerPane, { repoId }) : null,
      tab === "cli" ? j.jsx(CliPane, { repoId }) : null,
    ],
  });
}

function CrewPane({ agents, active, setActive, repoId, model, booting, onSpawn }) {
  const st = useKiln();
  const crew = uniqueByRole(agents.filter((a) => a.repoId === repoId));
  const shown = crew.length ? crew : uniqueByRole(agents);
  const [job, setJob] = R.useState("");
  const [running, setRunning] = R.useState(false);
  const stop = R.useRef(false);

  const dispatch = async (text) => {
    const task = String(text || job || "").trim();
    if (!task) {
      toast("Type a job for Grok first.");
      return;
    }
    if (running) return;
    stop.current = false;
    setRunning(true);
    try {
      await wallet();
      let seated = useKiln.getState().agents.filter((a) => a.repoId === repoId);
      if (!seated.length) {
        await useKiln.getState().spawnCrew({ repoId, modelId: model });
        seated = useKiln.getState().agents.filter((a) => a.repoId === repoId);
      }
      const seatedNow = seated.length ? seated : useKiln.getState().agents;
      const focus = seatedNow.find((a) => a.id === active) || leadAgent(seatedNow);
      if (!focus) throw new Error("No crew process on this tree");
      setActive(focus.id);
      try {
        globalThis.__KILN_LAST_DISPATCH = { id: focus.id, role: focus.role, task: task.slice(0, 80) };
      } catch {}
      await runKernel(focus.id, task, { stopped: () => stop.current });
      setJob("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Crew failed");
    } finally {
      setRunning(false);
    }
  };

  if (shown.length === 0) {
    return j.jsxs("div", {
      className: "grid flex-1 place-items-center overflow-auto px-6 py-10",
      children: [
        j.jsxs("div", {
          className: "w-full max-w-lg text-center",
          children: [
            j.jsx("p", { className: "text-[11px] font-medium uppercase tracking-[0.2em] text-muted", children: booting ? "Seating crew…" : "No crew yet" }),
            j.jsx("h1", { className: "mt-3 font-display text-3xl font-semibold tracking-tight", children: "A studio, not a copilot." }),
            j.jsx("p", {
              className: "mt-2 text-sm leading-relaxed text-muted",
              children: "Describe what to build — Kiln writes the initial tree, then a crew of specialists works the same repo. The Git tree is the computer. A write is a commit.",
            }),
            j.jsxs("form", {
              className: "mt-5 flex flex-col gap-2 text-left",
              action: "#",
              onSubmit: (e) => {
                holdSubmit(e);
                void dispatch(job);
              },
              children: [
                j.jsx("input", {
                  className: "input",
                  value: job,
                  onChange: (e) => setJob(e.target.value),
                  placeholder: "What should this computer do?",
                  disabled: running || booting,
                }),
                j.jsxs("div", {
                  className: "flex flex-wrap justify-center gap-2",
                  children: [
                    j.jsx("button", { type: "button", className: "btn-primary btn", disabled: running || booting || !job.trim(), onClick: () => void dispatch(job), children: running ? "Working…" : "Run crew" }),
                    j.jsx("button", { type: "button", className: "btn", disabled: running || booting, onClick: () => void onSpawn(), children: "Spawn crew" }),
                    j.jsx("button", { type: "button", className: "btn", onClick: () => (window.location.search = "?tab=oneshot"), children: "One-shot" }),
                    j.jsx(Link, { to: "/new", className: "btn", children: "Import GitHub" }),
                  ],
                }),
              ],
            }),
            j.jsx("ul", {
              className: "mt-8 grid gap-2 text-left text-xs text-muted sm:grid-cols-2",
              children: ROLES.map((r) =>
                j.jsxs("li", { className: "rounded-md border border-border bg-surface px-3 py-2", children: [j.jsx("p", { className: "font-medium text-fg", children: r.label }), j.jsx("p", { className: "mt-0.5", children: r.blurb })] }, r.id),
              ),
            }),
          ],
        }),
      ],
    });
  }
  const focus = shown.find((a) => a.id === active) || shown[0];
  return j.jsxs("div", {
    className: "k-studio-crew",
    children: [
      j.jsx("div", {
        className: "flex gap-1 overflow-x-auto border-b border-border px-2 py-1 md:hidden",
        children: shown.map((a) =>
          j.jsxs(
            "button",
            {
              type: "button",
              onClick: () => setActive(a.id),
              className: cn("flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px]", focus?.id === a.id ? "bg-surface text-fg" : "text-muted"),
              children: [statusDot(a.status), a.name],
            },
            a.id,
          ),
        ),
      }),
      j.jsxs("div", {
        className: "k-studio-body",
        children: [
          j.jsx("aside", {
            className: "k-crew-aside",
            children: j.jsx("ul", {
              className: "p-1",
              children: shown.map((a) =>
                j.jsx(
                  "li",
                  {
                    children: j.jsxs("button", {
                      type: "button",
                      onClick: () => setActive(a.id),
                      className: cn("flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs", focus?.id === a.id ? "bg-surface text-fg" : "text-muted hover:bg-surface/60 hover:text-fg"),
                      children: [
                        statusDot(a.status),
                        j.jsxs("span", { className: "min-w-0 flex-1 truncate", children: [a.name, j.jsxs("span", { className: "block text-[10px] uppercase tracking-wide text-subtle", children: [a.role, " · ", a.modelId || "grok-4.6"] })] }),
                      ],
                    }),
                  },
                  a.id,
                ),
              ),
            }),
          }),
          focus ? j.jsx(AgentChat, { agent: focus, running, onRun: dispatch, onStop: () => (stop.current = true) }) : null,
          focus ? j.jsx("div", { className: "k-kernel-wrap", children: j.jsx(KernelPane, { repoId, agents: shown, focus, onPick: (a) => setActive(a.id), files: (allRepos(st).find((r) => r.id === repoId)?.files || []).slice().sort((a, b) => a.path.localeCompare(b.path)) }) }) : null,
        ],
      }),
    ],
  });
}

function AgentChat({ agent, running, onRun, onStop }) {
  const st = useKiln();
  const messages = messagesForAgent(st, agent);
  const [text, setText] = R.useState("Read the tree. Write the next real file as a git commit.");
  const box = R.useRef(null);
  const repo = allRepos(st).find((r) => r.id === agent.repoId);
  R.useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [messages.length, messages[messages.length - 1]?.content, agent.status]);
  const shown =
    messages.length > 0
      ? messages
      : [
          {
            id: "grok-idle",
            role: "assistant",
            content: "I'm on this computer. Give me a job. A write is a git commit.",
          },
        ];
  return j.jsxs("section", {
    className: "k-agent-chat",
    children: [
      j.jsxs("header", {
        className: "flex items-center gap-2 border-b border-border px-3 py-1.5",
        children: [
          statusDot(agent.status),
          j.jsxs("div", {
            className: "min-w-0 flex-1",
            children: [
              j.jsxs("p", {
                className: "truncate text-sm font-medium",
                children: [
                  "Grok",
                  j.jsx("span", { className: "ml-2 text-[11px] uppercase tracking-[0.14em] text-muted", children: agent.role }),
                ],
              }),
              j.jsxs("p", {
                className: "truncate font-mono text-[11px] text-subtle",
                children: [agent.repoId, " · ", agent.modelId || "grok-4.6"],
              }),
            ],
          }),
          j.jsx("select", {
            className: "input h-7 w-[8.2rem] shrink-0 text-[11px]",
            value: agent.modelId || "grok-4.6",
            title: "Model for this chat",
            onChange: (e) => useKiln.getState().patchAgent(agent.id, { modelId: e.target.value }),
            children: chatModels().map((m) => j.jsx("option", { value: m.id, children: m.label }, m.id)),
          }),
          j.jsx("button", {
            type: "button",
            className: cn("btn h-7 px-2 text-[11px]", agent.mailboxAccess === false ? "text-muted" : ""),
            title: "Mailbox access",
            onClick: () => useKiln.getState().patchAgent(agent.id, { mailboxAccess: agent.mailboxAccess === false }),
            children: agent.mailboxAccess === false ? "Mail off" : "Mail on",
          }),
          repo
            ? j.jsx(Link, { to: "/$owner/$repo/computer", params: { owner: repo.owner, repo: repo.name }, className: "btn h-7 px-2 text-[11px]", children: "Computer" })
            : null,
          running
            ? j.jsx("button", { type: "button", className: "btn h-7 px-2", onClick: () => onStop?.(), children: "Stop" })
            : j.jsx("button", {
                type: "button",
                className: "btn h-7 px-2 text-[11px]",
                onClick: () =>
                  void (async () => {
                    await wallet();
                    const child = await useKiln.getState().spawnAgent({
                      role: "builder",
                      repoId: agent.repoId,
                      modelId: agent.modelId,
                      name: "Sub " + (agent.name || "agent"),
                      resident: false,
                      mailboxAccess: true,
                    });
                    attachOnConductor(agent.repoId, child, true);
                    toast("Sub-agent " + child.name + " seated on conductor");
                    await runKernel(child.id, "Read the tree. Write the next real file as a git commit.", { stopped: () => false });
                  })(),
                children: "Sub-agent",
              }),
        ],
      }),
      j.jsx("div", {
        ref: box,
        className: "min-h-0 flex-1 overflow-auto px-3 py-3",
        children: j.jsx(ChatList, {
          messages: shown,
          running,
          status: agent.status,
          lastError: agent.lastError,
          agentName: "Grok",
        }),
      }),
      j.jsxs("form", {
        className: "flex gap-2 border-t border-border p-2",
        action: "#",
        onSubmit: (e) => {
          holdSubmit(e);
          onRun?.(text);
        },
        children: [
          j.jsx("input", {
            className: "input",
            value: text,
            onChange: (e) => setText(e.target.value),
            placeholder: "Message Grok",
            disabled: running,
            onKeyDown: (e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                holdSubmit(e);
                onRun?.(text);
              }
            },
          }),
          j.jsx("button", {
            type: "button",
            className: "btn-primary btn shrink-0",
            disabled: running || !text.trim(),
            onClick: () => {
              if (typeof onRun === "function") onRun(text);
              else toast("Grok is not seated on this computer.");
            },
            children: running ? "Grok is writing…" : "Run",
          }),
        ],
      }),
    ],
  });
}

function KernelPreview({ repoId }) {
  const st = useKiln();
  const found = allRepos(st).find((r) => r.id === repoId);
  const files = found?.files || [];
  const sig = files.map((f) => `${f.path}:${f.sha || f.size || (f.content || "").length}`).join("|");
  const [cap, setCap] = R.useState(null);
  const [err, setErr] = R.useState("");
  const [busy, setBusy] = R.useState(true);
  const mint = R.useCallback(async () => {
    if (!found) {
      setErr("No repository on this computer.");
      setCap(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await sealMachine(found);
      const iso = await isolatePreview(found);
      setCap(iso);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [repoId, sig]);
  R.useEffect(() => {
    void mint();
  }, [mint]);
  const host = cap?.host || (found ? `${found.owner}-${found.name}.kiln.app` : "—");
  const root = String(cap?.machine?.ledger?.root || found?.merkleRoot || "").slice(0, 18);
  return j.jsxs("div", {
    className: "k-preview",
    children: [
      j.jsxs("div", {
        className: "k-preview-meta",
        children: [
          j.jsx("span", { className: "k-preview-host", children: host }),
          j.jsx("span", { children: root || (busy ? "minting" : "—") }),
          j.jsx("button", {
            type: "button",
            className: "btn h-7 px-2",
            onClick: () => void mint(),
            disabled: busy,
            children: busy ? "Minting…" : "Remint",
          }),
        ],
      }),
      err ? j.jsx("p", { className: "k-preview-err", children: err }) : null,
      cap?.url
        ? j.jsx("iframe", {
            title: `preview ${repoId}`,
            src: cap.url,
            className: "k-preview-frame",
            sandbox: cap.sandbox || "allow-scripts allow-forms",
            referrerPolicy: "no-referrer",
          })
        : j.jsx("p", { className: "k-preview-wait", children: busy ? "booting isolated origin…" : "No capsule." }),
    ],
  });
}

function KernelPane({ repoId, agents, focus, files, onPick }) {
  const st = useKiln();
  const [pane, setPane] = R.useState("tree");
  const [openPath, setOpenPath] = R.useState("");
  const [wpath, setWpath] = R.useState("src/index.ts");
  const [wbody, setWbody] = R.useState("");
  const [wbusy, setWbusy] = R.useState(false);
  R.useEffect(() => {
    if (!openPath && files[0]) setOpenPath(files[0].path);
    if (openPath && files.length && !files.some((f) => f.path === openPath)) setOpenPath(files[0]?.path || "");
  }, [files, openPath]);
  R.useEffect(() => {
    const open = files.find((f) => f.path === openPath);
    if (open) {
      setWpath(open.path);
      setWbody(open.content || open.body || "");
    }
  }, [openPath]);
  const crew = (st.crews || []).find((c) => c.repoId === repoId);
  const edges = (crew?.edges?.length ? crew.edges : CREW_GRAPH) || [];
  const constitution =
    crew?.constitution ||
    `# Constitution · ${repoId}\n\nThis repository is a sealed machine. The crew are processes on it.\n\n1. One computer per repository.\n2. A write is git commit. Use kiln_write_file.\n3. Handoff, do not impersonate.\n4. Seat yourself after a write.\n5. Never exfiltrate vault keys.\n6. Folder quota is 50 GiB. Cipher verifies.\n7. The capsule boots index.html. Deployer ships it.\n8. Speak git: clone, commit, push, pull, branch.\n`;
  const mail = agents.flatMap((a) => (a.mailbox || []).map((m, i) => ({ ...m, agent: a.name, role: a.role, key: (m.id || a.id) + ":" + i })));
  const handoffs = (st.handoffs || []).filter((h) => h.repoId === repoId).slice(0, 24);
  const open = files.find((f) => f.path === openPath) || files[0];
  const bytes = files.reduce((n, f) => n + (f.size || (f.content || "").length || 0), 0);
  const blocks = typeof chainBlocks === "function" ? chainBlocks(st).slice(0, 8) : [];
  const txs = typeof chainTxs === "function" ? chainTxs(st).filter((tx) => !tx.repoId || tx.repoId === repoId).slice(0, 12) : [];

  const writeFile = async () => {
    const path = (wpath || "").trim().replace(/^\/+/, "");
    if (!path || wbusy) return;
    setWbusy(true);
    try {
      await wallet();
      const rec = await useKiln.getState().commitFile(repoId, path, wbody, `studio write ${path}`);
      if (!rec) throw new Error("Write failed — own the repo or connect a wallet.");
      toast(`Wrote ${path} · ${String(rec.sha || "").slice(0, 10)}`);
      setOpenPath(path);
      setPane("tree");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Write failed");
    } finally {
      setWbusy(false);
    }
  };

  const graph = j.jsx(CrewGraph, { agents, edges, focus, onPick });

  const kernelBody =
    pane === "graph"
      ? graph
      : pane === "constitution"
        ? j.jsx("pre", { className: "overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11px] leading-5 text-fg", children: constitution })
        : pane === "mailbox"
          ? j.jsxs("div", {
              className: "overflow-auto px-3 py-2",
              children: [
                mail.length === 0 && handoffs.length === 0
                  ? j.jsx("p", {
                      className: "text-xs text-muted",
                      children: focus?.mailboxAccess === false ? "Mailbox off for this process. Toggle Mail on the chat." : "Mailbox empty. Handoffs land here.",
                    })
                  : null,
                mail.map((m) =>
                  j.jsxs(
                    "article",
                    {
                      className: "mb-2 rounded-md border border-border bg-bg px-2 py-1.5 text-xs",
                      children: [
                        j.jsxs("p", { className: "text-[10px] uppercase tracking-[0.14em] text-muted", children: [m.agent, " · ", m.role] }),
                        j.jsx("p", { className: "mt-0.5 text-fg", children: m.body || m.task || m.kind || "mail" }),
                      ],
                    },
                    m.key,
                  ),
                ),
                handoffs.map((h) =>
                  j.jsxs(
                    "article",
                    {
                      className: "mb-2 font-mono text-[11px]",
                      children: [
                        j.jsxs("p", { className: "text-seal", children: [h.fromRole, " → ", h.toRole, " · ", h.state] }),
                        j.jsx("p", { className: "mt-0.5 text-fg", children: h.task || h.body || h.kind }),
                      ],
                    },
                    h.id,
                  ),
                ),
              ],
            })
          : pane === "l1"
            ? j.jsxs("div", {
                className: "overflow-auto px-3 py-2 font-mono text-[11px]",
                children: [
                  j.jsx("p", { className: "text-[11px] uppercase tracking-[0.16em] text-muted", children: "Kiln L1" }),
                  blocks.map((b) =>
                    j.jsxs(
                      "p",
                      {
                        className: "mt-1 text-fg",
                        children: [
                          "#",
                          b.height,
                          " · ",
                          String(b.hash || "").slice(0, 16),
                          " · ",
                          (b.txs || []).length,
                          " tx",
                        ],
                      },
                      b.hash || b.height,
                    ),
                  ),
                  txs.length
                    ? j.jsx("p", { className: "mt-3 text-[11px] uppercase tracking-[0.16em] text-muted", children: "Transactions" })
                    : null,
                  txs.map((tx) =>
                    j.jsxs(
                      "p",
                      {
                        className: "mt-1 text-fg",
                        children: [tx.type || "tx", " · ", String(tx.hash || tx.txHash || "").slice(0, 14), tx.memo ? ` · ${tx.memo}` : ""],
                      },
                      tx.hash || tx.txHash || tx.id,
                    ),
                  ),
                  !blocks.length && !txs.length ? j.jsx("p", { className: "mt-2 text-muted", children: "No blocks yet. A write settles a merkle_commit." }) : null,
                ],
              })
            : null;

  return j.jsxs("div", {
    className: "flex min-h-0 flex-col bg-surface",
    children: [
      j.jsxs("div", {
        className: "flex items-center gap-1 overflow-x-auto border-b border-border px-2",
        children: [
          KERNEL_PANES.map((p) =>
            j.jsx(
              "button",
              {
                type: "button",
                onClick: () => setPane(p.id),
                className: cn("relative shrink-0 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.14em]", pane === p.id ? "text-fg" : "text-muted hover:text-fg"),
                children: p.label,
              },
              p.id,
            ),
          ),
          j.jsxs("span", { className: "ml-auto shrink-0 px-2 font-mono text-[10px] text-subtle", children: [files.length, " files · ", bytes, "B"] }),
        ],
      }),
      pane === "preview"
        ? j.jsx(KernelPreview, { repoId })
        : null,
      pane !== "tree" && pane !== "preview" && kernelBody
        ? j.jsx("div", { className: "min-h-[11rem] shrink-0 overflow-auto border-b border-border", children: kernelBody })
        : null,
      pane === "preview"
        ? null
        : j.jsxs("div", {
        className: "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(5rem,34%)_auto]",
        children: [
          j.jsxs("ul", {
            className: "min-h-0 overflow-auto text-xs",
            children: [
              files.map((f) =>
                j.jsx(
                  "li",
                  {
                    children: j.jsxs("button", {
                      type: "button",
                      onClick: () => {
                        setOpenPath(f.path);
                        setPane("tree");
                      },
                      className: cn(
                        "flex w-full items-center gap-2 px-3 py-1 text-left font-mono hover:bg-surface-2 hover:text-fg",
                        open?.path === f.path ? "bg-bg text-fg" : "text-muted",
                      ),
                      style: { paddingLeft: 10 + Math.min(String(f.path).split("/").length - 1, 5) * 10 },
                      children: [
                        j.jsx("span", { className: "min-w-0 flex-1 truncate", children: f.path }),
                        j.jsx("span", { className: "shrink-0 text-[10px] text-subtle", children: f.size != null ? f.size + "B" : "" }),
                      ],
                    }),
                  },
                  f.path,
                ),
              ),
              files.length === 0
                ? j.jsx("li", { className: "px-3 py-4 text-muted", children: "Empty tree — write a file below. A write is a git commit." })
                : null,
            ],
          }),
          j.jsxs("div", {
            className: "min-h-0 overflow-auto border-t border-border bg-bg",
            children: [
              open
                ? j.jsxs("div", {
                    className: "flex items-center gap-2 border-b border-border px-3 py-1",
                    children: [
                      j.jsx("p", { className: "min-w-0 flex-1 truncate font-mono text-[11px] text-fg", children: open.path }),
                      j.jsx(Link, {
                        to: "/$owner/$repo/blob/$",
                        params: { owner: repoId.split("/")[0], repo: repoId.split("/")[1], _splat: open.path },
                        className: "text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg",
                        children: "Open",
                      }),
                    ],
                  })
                : null,
              j.jsx("pre", {
                className: "whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-5 text-fg",
                children: open ? open.content || open.body || "(empty file)" : "Pick a file.",
              }),
            ],
          }),
          j.jsxs("form", {
            className: "border-t border-border bg-bg px-3 py-2",
            action: "#",
            onSubmit: (e) => {
              holdSubmit(e);
              void writeFile();
            },
            children: [
              j.jsx("p", { className: "text-[10px] uppercase tracking-[0.16em] text-muted", children: "Write file" }),
              j.jsx("input", {
                className: "input mt-1 h-8 font-mono text-[11px]",
                value: wpath,
                onChange: (e) => setWpath(e.target.value),
                placeholder: "src/index.ts",
                disabled: wbusy,
              }),
              j.jsx("textarea", {
                className: "input mt-1 min-h-[4.5rem] resize-y py-1.5 font-mono text-[11px] leading-5",
                value: wbody,
                onChange: (e) => setWbody(e.target.value),
                placeholder: "contents — a write is a git commit",
                disabled: wbusy,
              }),
              j.jsx("button", {
                type: "button",
                className: "btn-primary btn mt-1.5 h-8",
                disabled: wbusy || !wpath.trim(),
                onClick: () => void writeFile(),
                children: wbusy ? "Writing…" : "Write file",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function CrewGraph({ agents, edges, focus, onPick }) {
  const byRole = new Map();
  const extras = [];
  for (const a of agents || []) {
    if (a.parentId || (byRole.has(a.role) && byRole.get(a.role).id !== a.id)) extras.push(a);
    else if (!GRAPH_LAYOUT[a.role]) extras.push(a);
    else byRole.set(a.role, a);
  }
  const conductorPos = GRAPH_LAYOUT.conductor || [72, 40];
  const extraLayout = extras.map((a, i) => {
    const n = extras.length || 1;
    const x = Math.max(16, Math.min(344, conductorPos[0] + (i - (n - 1) / 2) * 36));
    return { agent: a, x, y: 14 };
  });
  const extraPos = new Map(extraLayout.map((e) => [e.agent.id, [e.x, e.y]]));
  const roles = Object.keys(GRAPH_LAYOUT);
  const posOf = (role, agentId) => extraPos.get(agentId) || GRAPH_LAYOUT[role];
  return j.jsxs("svg", {
    className: "k-graph",
    viewBox: "0 0 360 190",
    role: "img",
    "aria-label": "Crew graph",
    children: [
      j.jsx("title", { children: "Crew graph" }),
      extraLayout.map((ex) =>
        j.jsx(
          "line",
          {
            x1: conductorPos[0],
            y1: conductorPos[1],
            x2: ex.x,
            y2: ex.y,
            className: "k-graph-edge",
          },
          `spawn-${ex.agent.id}`,
        ),
      ),
      edges.map((e, i) => {
        const a = GRAPH_LAYOUT[e.from];
        const b = GRAPH_LAYOUT[e.to];
        if (!a || !b) return null;
        return j.jsx(
          "line",
          {
            x1: a[0],
            y1: a[1],
            x2: b[0],
            y2: b[1],
            className: "k-graph-edge",
          },
          `${e.from}-${e.to}-${e.kind}-${i}`,
        );
      }),
      extraLayout.map((ex) => {
        const agent = ex.agent;
        const status = agent.status || "idle";
        const live = status === "thinking" || status === "tooling";
        const on = focus?.id === agent.id;
        return j.jsxs(
          "g",
          {
            transform: `translate(${ex.x} ${ex.y})`,
            className: "k-graph-hit",
            style: { cursor: "pointer" },
            onClick: onPick ? () => onPick(agent) : undefined,
            children: [
              j.jsx("circle", { r: 16, fill: "transparent" }),
              live ? j.jsx("circle", { r: 14, className: "k-graph-pulse", fill: "none" }) : null,
              j.jsx("circle", { r: 8, className: cn("k-graph-node", live && "k-graph-node-live", on && "k-graph-node-on") }),
              j.jsx("text", { y: 20, textAnchor: "middle", className: "k-graph-label", children: agent.name || agent.role }),
            ],
          },
          agent.id,
        );
      }),
      roles.map((role) => {
        const [x, y] = GRAPH_LAYOUT[role];
        const agent = byRole.get(role);
        const status = agent?.status || "idle";
        const live = status === "thinking" || status === "tooling";
        const on = focus?.role === role;
        const label = (ROLES.find((r) => r.id === role) || { label: role }).label;
        return j.jsxs(
          "g",
          {
            transform: `translate(${x} ${y})`,
            className: agent ? "k-graph-hit" : undefined,
            style: { cursor: agent ? "pointer" : "default" },
            onClick: agent && onPick ? () => onPick(agent) : undefined,
            children: [
              j.jsx("circle", { r: 18, fill: "transparent" }),
              live
                ? j.jsx("circle", { r: 16, className: "k-graph-pulse", fill: "none" })
                : null,
              j.jsx("circle", {
                r: 9,
                className: cn("k-graph-node", live && "k-graph-node-live", on && "k-graph-node-on"),
              }),
              j.jsx("text", {
                y: 24,
                textAnchor: "middle",
                className: "k-graph-label",
                children: label,
              }),
            ],
          },
          role,
        );
      }),
    ],
  });
}

function ImportPane({ ownerDefault }) {
  const st = useKiln();
  const [q, setQ] = R.useState("reagent-systems/mouse");
  const [items, setItems] = R.useState([]);
  const [log, setLog] = R.useState([]);
  const [busy, setBusy] = R.useState(false);
  const [kind, setKind] = R.useState("code");
  const lookup = async (query) => {
    const needle = (query ?? q).trim();
    if (!needle) return;
    setBusy(true);
    try {
      const r = await githubListRepos({ query: needle });
      if (!r.ok) {
        toast(r.error);
        setItems([]);
        return;
      }
      setItems(r.items || []);
      if (!(r.items || []).length) toast("No public repositories for that query.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "GitHub lookup failed");
    } finally {
      setBusy(false);
    }
  };
  R.useEffect(() => {
    lookup(q);
  }, []);
  const seal = async (item) => {
    const w = await wallet();
    setBusy(true);
    setLog((l) => [...l, `fetching GitHub zip for ${item.fullName}…`]);
    try {
      const packed = await githubImportTree({ owner: item.owner, repo: item.name });
      if (!packed.ok) throw new Error(packed.error);
      setLog((l) => [...l, `unpacked ${packed.files.length} files via ${packed.via === "zip" ? "GitHub zipball" : "git tree"}`]);
      const repo = await useKiln.getState().importGithub({
        meta: packed.meta,
        files: packed.files,
        owner: w.handle,
        kind,
      });
      setLog((l) => [...l, `settled ${repo.id} · merkle ${String(repo.merkleRoot || "").slice(0, 12)}`]);
      toast(`Imported ${repo.id}`);
      window.location.assign(`/${repo.owner}/${repo.name}/computer`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setLog((l) => [...l, msg]);
      toast(msg);
    } finally {
      setBusy(false);
    }
  };
  return j.jsxs("div", {
    className: "mx-auto w-full max-w-3xl flex-1 overflow-auto px-4 py-6",
    children: [
      j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: "Import from GitHub" }),
      j.jsx("p", {
        className: "mt-1 text-sm leading-relaxed text-muted",
        children: "Paste a github.com URL, owner/repo, or a username. Kiln downloads GitHub's own zipball, seals every file under the connected wallet, and boots a computer. Same engine as New.",
      }),
      j.jsxs("form", {
        className: "mt-4 flex flex-col gap-2 sm:flex-row",
        action: "#",
        onSubmit: (e) => {
          holdSubmit(e);
          lookup();
        },
        children: [
          j.jsx("input", { className: "input flex-1", value: q, onChange: (e) => setQ(e.target.value), placeholder: "https://github.com/reagent-systems/mouse" }),
          j.jsx("button", { type: "button", className: "btn-primary btn h-9 px-4", disabled: busy, onClick: () => lookup(), children: busy ? "Looking up…" : "Look up" }),
        ],
      }),
      j.jsx("div", {
        className: "mt-3 flex flex-wrap gap-2",
        children: CHIPS.map((c) =>
          j.jsx("button", { type: "button", className: "chip", onClick: () => { setQ(c); lookup(c); }, children: c }, c),
        ),
      }),
      j.jsxs("label", {
        className: "mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted",
        children: [
          "Kind",
          j.jsx("select", {
            className: "input mt-1 max-w-xs",
            value: kind,
            onChange: (e) => setKind(e.target.value),
            children: KINDS.map((k) => j.jsx("option", { value: k.id, children: k.label }, k.id)),
          }),
        ],
      }),
      items.length
        ? j.jsx("ul", {
            className: "mt-4 divide-y divide-border rounded-lg border border-border",
            children: items.map((it) =>
              j.jsxs(
                "li",
                {
                  className: "flex flex-wrap items-center gap-3 px-3 py-2.5",
                  children: [
                    j.jsxs("div", { className: "min-w-0 flex-1", children: [j.jsx("p", { className: "truncate font-medium", children: it.fullName }), j.jsx("p", { className: "truncate text-xs text-muted", children: it.description || it.language || "public tree" })] }),
                    j.jsx("span", { className: "hidden font-mono text-[11px] text-subtle sm:inline", children: `★${it.stars || 0}` }),
                    j.jsx("button", { type: "button", className: "btn-primary btn h-8 px-3 text-xs", disabled: busy || !st.wallet, onClick: () => void seal(it), children: "Import" }),
                  ],
                },
                it.fullName,
              ),
            ),
          })
        : j.jsx("p", { className: "mt-6 text-sm text-muted", children: busy ? "Reading public GitHub…" : "Look up an account or owner/repo." }),
      log.length ? j.jsx("pre", { className: "mt-4 max-h-40 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[11px] leading-5 text-muted", children: log.join("\n") }) : null,
      !st.wallet ? j.jsx("div", { className: "mt-4", children: j.jsx(ConnectBtn, { label: "Connect to import" }) }) : null,
    ],
  });
}

function OneshotPane({ initialPrompt, modelId, onLanded }) {
  const st = useKiln();
  const [prompt, setPrompt] = R.useState(initialPrompt || "");
  const [name, setName] = R.useState("");
  const [kind, setKind] = R.useState("code");
  const [log, setLog] = R.useState([]);
  const [busy, setBusy] = R.useState(false);
  const go = async () => {
    const w = await wallet();
    if (!prompt.trim()) {
      toast("Describe the project");
      return;
    }
    setBusy(true);
    setLog(["generating a complete tree…"]);
    try {
      const { repo, pack } = await useKiln.getState().oneShotRepo({
        prompt: prompt.trim(),
        name: name.trim() || undefined,
        owner: w.handle,
        kind,
        visibility: "public",
        modelId,
      });
      setLog((l) => [...l, `${pack.via} · ${pack.files.length} files sealed`, `capsule ${repo.id}`]);
      toast(`One-shot ${repo.id}`);
      try {
        await useKiln.getState().spawnCrew({ repoId: repo.id, modelId });
      } catch {
        /* builder already seated by oneshot */
      }
      onLanded?.(repo.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "One-shot failed";
      setLog((l) => [...l, msg]);
      toast(msg);
    } finally {
      setBusy(false);
    }
  };
  return j.jsxs("div", {
    className: "mx-auto w-full max-w-3xl flex-1 overflow-auto px-4 py-6",
    children: [
      j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: "One-shot a project" }),
      j.jsx("p", { className: "mt-1 text-sm text-muted", children: "Describe it once. Kiln writes the tree — including index.html — seals it, and boots the capsule under the connected wallet." }),
      j.jsx("textarea", { className: "input mt-4 min-h-[6rem] resize-y py-2", value: prompt, onChange: (e) => setPrompt(e.target.value), placeholder: "A Hilbert lattice explorer with live Merkle cells…" }),
      j.jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: SHOTS.map((s) => j.jsx("button", { type: "button", className: "chip text-left", onClick: () => setPrompt(s), children: s }, s)) }),
      j.jsxs("div", {
        className: "mt-3 grid gap-2 sm:grid-cols-2",
        children: [
          j.jsxs("label", { className: "text-[11px] uppercase tracking-[0.14em] text-muted", children: ["Name", j.jsx("input", { className: "input mt-1", value: name, onChange: (e) => setName(e.target.value), placeholder: "auto from prompt" })] }),
          j.jsxs("label", { className: "text-[11px] uppercase tracking-[0.14em] text-muted", children: ["Kind", j.jsx("select", { className: "input mt-1", value: kind, onChange: (e) => setKind(e.target.value), children: KINDS.map((k) => j.jsx("option", { value: k.id, children: k.label }, k.id)) })] }),
        ],
      }),
      j.jsx("button", { type: "button", className: "btn-primary btn mt-4", disabled: busy || !prompt.trim(), onClick: () => void go(), children: busy ? "Sealing…" : "One-shot repository" }),
      log.length ? j.jsx("pre", { className: "mt-4 max-h-32 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] text-muted", children: log.join("\n") }) : null,
    ],
  });
}

function ComputerPane({ repoId }) {
  const st = useKiln();
  const repo = allRepos(st).find((r) => r.id === repoId);
  const [cmd, setCmd] = R.useState("ls");
  const [out, setOut] = R.useState("");
  const [history, setHistory] = R.useState([]);
  R.useEffect(() => {
    if (repo) bootMachine(repo);
  }, [repo]);
  const run = async (line) => {
    if (!repo) return;
    await wallet();
    const r = await runOnMachine(repo.id, line);
    const block = `$ ${line}\n${r.out}`;
    setOut(block);
    setHistory((h) => [...h, block].slice(-24));
  };
  if (!repo) return j.jsx("p", { className: "p-6 text-sm text-muted", children: "Pick a repository." });
  return j.jsxs("div", {
    className: "flex min-h-0 flex-1 flex-col overflow-auto",
    children: [
      j.jsxs("div", { className: "border-b border-border px-4 py-2 text-xs text-muted", children: ["Computer on ", j.jsx("span", { className: "font-mono text-fg", children: repo.id }), " · python:8000 · node:3000 · mcp:7331"] }),
      j.jsx("div", { className: "px-4 py-3", children: j.jsx(IsolationExplorer, { repoId: repo.id }) }),
      j.jsx("pre", { className: "min-h-0 flex-1 overflow-auto bg-bg px-4 py-3 font-mono text-[12px] leading-6 text-fg", children: history.join("\n\n") || out || "type help · seal · compare kiln/studio · probe kiln/studio" }),
      j.jsxs("form", {
        className: "flex gap-2 border-t border-border p-2",
        action: "#",
        onSubmit: (e) => {
          holdSubmit(e);
          run(cmd);
        },
        children: [
          j.jsxs("span", { className: "self-center font-mono text-xs text-subtle", children: [repo.id, " $"] }),
          j.jsx("input", { className: "input font-mono text-xs", value: cmd, onChange: (e) => setCmd(e.target.value), placeholder: "ls · cat README.md · git status · node src/hello.js" }),
          j.jsx("button", { type: "button", className: "btn-primary btn", onClick: () => run(cmd), children: "Run" }),
        ],
      }),
    ],
  });
}

function CliPane({ repoId }) {
  const [line, setLine] = R.useState(`kiln ls ${repoId}`);
  const [out, setOut] = R.useState("kiln — forge CLI. Same git surface agents use via MCP.\n  kiln help\n  kiln ls owner/name\n  kiln cat owner/name path\n  kiln write owner/name path --body TEXT");
  const run = async () => {
    await wallet();
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0] === "kiln" ? parts[1] : parts[0];
    const arg1 = parts[0] === "kiln" ? parts[2] : parts[1];
    const arg2 = parts[0] === "kiln" ? parts.slice(3).join(" ") : parts.slice(2).join(" ");
    let r;
    if (cmd === "ls" || cmd === "list") r = await callTool("kiln_list_files", { repo: arg1 || repoId, path: arg2 || "" });
    else if (cmd === "cat") r = await callTool("kiln_read_file", { repo: arg1 || repoId, path: arg2 });
    else if (cmd === "write") r = await callTool("kiln_write_file", { repo: arg1 || repoId, path: arg2.split(" ")[0], content: arg2.split(" ").slice(1).join(" ") || "ok\n" });
    else if (cmd === "run") r = await callTool("kiln_run", { repo: arg1 || repoId, command: arg2 || "ls" });
    else if (cmd === "help") r = { ok: true, text: out };
    else r = await callTool("kiln_run", { repo: repoId, command: parts.slice(parts[0] === "kiln" ? 1 : 0).join(" ") });
    setOut(`$ ${line}\n${r.text || r.error || ""}`);
  };
  return j.jsxs("div", {
    className: "flex min-h-0 flex-1 flex-col bg-bg",
    children: [
      j.jsx("pre", { className: "min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-[12px] leading-6 text-fg", children: out }),
      j.jsxs("form", {
        className: "flex gap-2 border-t border-border p-2",
        action: "#",
        onSubmit: (e) => {
          holdSubmit(e);
          run();
        },
        children: [
          j.jsx("span", { className: "self-center font-mono text-xs text-subtle", children: "kiln $" }),
          j.jsx("input", { className: "input font-mono text-xs", value: line, onChange: (e) => setLine(e.target.value) }),
          j.jsx("button", { type: "button", className: "btn-primary btn", onClick: () => void run(), children: "Run" }),
        ],
      }),
    ],
  });
}

export { StudioTabs as component };
