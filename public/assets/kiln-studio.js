/**
 * Production Studio layer. Locked crew/chat/kernel stay as they are.
 * This seats the wallet before the Studio gate, puts home on the computer,
 * and runs the compacted loop: job → worktree → diff → tests → live → pull.
 */
import { b as useKiln } from "./store-sx46DNi5.js";

const JOBS = [
  {
    id: "readme",
    label: "Write README",
    job: "Write README.md for this computer. Who owns it, what a write is (git commit), how to run python and node here.",
  },
  {
    id: "hello",
    label: "Python hello",
    job: "Add src/hello.py that prints the kiln isolation URL and the current working tree. Keep it real, no stubs.",
  },
  {
    id: "capsule",
    label: "Capsule",
    job: "Commit a complete index.html capsule for this tree so Preview boots something you can actually open.",
  },
];

const loopState = {
  tab: "",
  jobs: [],
  jobId: "",
  patch: "",
  stat: "",
  tests: null,
  live: "",
  pulls: [],
  meta: "",
  busy: false,
  lastBoard: 0,
  treeSeen: "",
  treeRepo: "",
  crew: null,
};

function sessionToken() {
  try {
    return sessionStorage.getItem("kiln-session") || globalThis.__KILN_SESSION || "";
  } catch {
    return globalThis.__KILN_SESSION || "";
  }
}

export function nextAfterSeat() {
  try {
    const q = new URL(window.location.href).searchParams.get("next");
    if (q && q.startsWith("/") && !q.startsWith("//") && q.length < 180) return q;
  } catch {
    /* ignore */
  }
  try {
    const s = sessionStorage.getItem("kiln-next");
    if (s && s.startsWith("/") && !s.startsWith("//") && s.length < 180) return s;
  } catch {
    /* ignore */
  }
  return "/studio";
}

export function rememberStudioNext() {
  try {
    if (location.pathname === "/studio" || location.pathname.startsWith("/studio")) {
      sessionStorage.setItem("kiln-next", "/studio");
    }
  } catch {
    /* private mode */
  }
}

function peekPersist() {
  try {
    const raw = localStorage.getItem("kiln-v2");
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.state || data;
  } catch {
    return null;
  }
}

function authHeaders() {
  const token = sessionToken();
  const h = { accept: "application/json", "content-type": "application/json" };
  if (token) h.authorization = "Bearer " + token;
  return h;
}

function homeId() {
  try {
    const handle = useKiln.getState().wallet && useKiln.getState().wallet.handle;
    return handle && handle !== "kiln" ? handle + "/home" : "";
  } catch {
    return "";
  }
}

function ensureHomeStub(handle) {
  if (!handle || handle === "kiln") return;
  const id = handle + "/home";
  const st = useKiln.getState();
  const list = st.userRepos || [];
  if (list.some((r) => r.id === id)) return;
  useKiln.setState({
    userRepos: [
      {
        id,
        owner: handle,
        name: "home",
        visibility: "private",
        description: "Home computer. A write is a git commit.",
        files: [],
        fileCount: 0,
      },
      ...list,
    ],
  });
}

function hydrateWalletNow() {
  const peeked = peekPersist();
  const wallet = peeked && peeked.wallet;
  if (!wallet || !wallet.handle || wallet.handle === "kiln") return wallet || null;
  const cur = useKiln.getState().wallet;
  if (!cur || !cur.handle) {
    const patch = { wallet, hydrated: true };
    if (Array.isArray(peeked.userRepos) && peeked.userRepos.length && !(useKiln.getState().userRepos || []).length) {
      patch.userRepos = peeked.userRepos;
    }
    if (Array.isArray(peeked.agents) && peeked.agents.length && !(useKiln.getState().agents || []).length) {
      patch.agents = peeked.agents;
      if (Array.isArray(peeked.crews)) patch.crews = peeked.crews;
    }
    useKiln.setState(patch);
  }
  ensureHomeStub(wallet.handle);
  try {
    globalThis.__KILN_ACCOUNT = globalThis.__KILN_ACCOUNT || { handle: wallet.handle, address: wallet.address };
  } catch {
    /* ignore */
  }
  return wallet;
}

async function accountMe() {
  const token = sessionToken();
  if (!token) return null;
  try {
    const acc = await fetch("/api/kiln/account", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "me" }),
    }).then((r) => r.json());
    if (!acc || !acc.ok) return null;
    return acc;
  } catch {
    return null;
  }
}

async function bootHome(handle) {
  const id = handle + "/home";
  try {
    const out = await fetch("/api/kiln/computer/boot", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ repoId: id, owner: handle }),
    }).then((r) => r.json());
    if (!out || !out.ok) return;
    const files = (out.files || []).map((f) => ({
      path: f.path,
      content: typeof f.content === "string" ? f.content : "",
      size: f.size || (typeof f.content === "string" ? f.content.length : 0) || 0,
      sha: f.sha || "",
    }));
    const st = useKiln.getState();
    const list = (st.userRepos || []).slice();
    let idx = list.findIndex((r) => r.id === id);
    if (idx < 0) {
      list.unshift({
        id,
        owner: handle,
        name: "home",
        visibility: "private",
        description: "Home computer. A write is a git commit.",
        files: [],
        fileCount: 0,
      });
      idx = 0;
    }
    const cur = list[idx];
    const map = new Map((cur.files || []).map((f) => [f.path, f]));
    for (const f of files) {
      const prev = map.get(f.path);
      if (!prev) map.set(f.path, f);
      else if ((!prev.content || !String(prev.content).length) && f.content) map.set(f.path, { ...prev, ...f });
    }
    list[idx] = { ...cur, files: [...map.values()], fileCount: map.size, isolation: out.isolation || cur.isolation };
    useKiln.setState({ userRepos: list });
  } catch {
    /* computer later */
  }
}

async function seatCrewIfMissing(handle) {
  const id = handle + "/home";
  const st = useKiln.getState();
  if ((st.agents || []).some((a) => a.repoId === id)) return;
  if (typeof st.spawnCrew !== "function") return;
  try {
    await st.spawnCrew({ repoId: id, modelId: st.defaultModelId || "grok-4.6" });
  } catch {
    /* studio-tabs also seats */
  }
}

function installStudioCss() {
  if (document.getElementById("kiln-studio-css")) return;
  const css = document.createElement("style");
  css.id = "kiln-studio-css";
  css.textContent = `
.k-studio{min-height:calc(100dvh - 3.5rem)}
.k-studio .k-composer,.k-studio [role="textbox"].input{
  min-height:44px;
}
.k-studio .k-agent-chat{
  display:flex;
  flex-direction:column;
  min-height:0;
}
.k-studio-start{
  display:flex;flex-wrap:wrap;align-items:center;gap:.45rem .6rem;
  margin-top:auto;
  padding:.45rem .75rem .55rem;
  border-top:1px solid var(--color-border);
  background:color-mix(in srgb, var(--color-surface) 55%, var(--color-bg));
}
.k-studio-start p{
  margin:0;flex:1 1 12rem;
  color:var(--color-muted);
  font-size:12px;line-height:1.45;
}
.k-studio-start button,.k-loop-tabs button,.k-loop-pane button,.k-point-actions button,.k-bench-actions button{
  min-height:36px;padding:0 .7rem;
  border:1px solid var(--color-border);
  border-radius:999px;
  background:transparent;color:var(--color-fg);
  font-size:11px;letter-spacing:.04em;
  cursor:pointer;
}
.k-studio-start button:hover,.k-loop-tabs button:hover,.k-loop-pane button:hover{background:var(--color-surface)}
.k-studio-start button[data-kiln-walk]{
  border-color:color-mix(in srgb, var(--color-fg) 28%, var(--color-border));
}
.k-studio-live{
  margin:.2rem 0 0;
  color:var(--color-muted);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:10px;letter-spacing:.04em;
}
.k-loop{
  border-top:1px solid var(--color-border);
  background:var(--color-bg);
  flex:0 0 auto;
}
.k-loop-tabs{
  display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .45rem;
  padding:.4rem .75rem;
}
.k-loop-tabs button[aria-pressed="true"]{
  background:var(--color-fg);color:var(--color-bg);
  border-color:var(--color-fg);
}
.k-loop-meta{
  margin-left:auto;
  color:var(--color-muted);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:10px;letter-spacing:.04em;
}
.k-loop-pane{
  padding:.15rem .75rem .85rem;
  max-height:min(42vh,22rem);
  overflow:auto;
}
.k-loop-pane.k-loop-open-live{
  max-height:min(64vh,34rem);
}
.k-loop-pane[hidden]{display:none}
.k-loop-list{list-style:none;margin:0;padding:0}
.k-loop-list li{
  display:flex;flex-wrap:wrap;align-items:baseline;gap:.35rem .7rem;
  padding:.45rem 0;
  border-bottom:1px solid var(--color-border);
  font-size:12px;line-height:1.45;
}
.k-loop-list button{min-height:32px}
.k-loop-status{
  color:var(--color-muted);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:10px;letter-spacing:.06em;text-transform:uppercase;
}
.k-loop-patch{
  margin:0;
  padding:.7rem .8rem;
  border:1px solid var(--color-border);
  border-radius:.75rem;
  background:color-mix(in srgb, var(--color-surface) 70%, var(--color-bg));
  color:var(--color-fg);
  font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  white-space:pre-wrap;word-break:break-word;
  max-height:14rem;overflow:auto;
}
.k-loop-actions{display:flex;flex-wrap:wrap;gap:.4rem;margin:.55rem 0}
.k-loop-live{
  width:100%;height:min(52vh,26rem);
  border:1px solid var(--color-border);
  border-radius:.75rem;background:#0b0b0d;
}
.k-loop-url{
  display:block;margin:.45rem 0 0;
  color:var(--color-muted);
  font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
  word-break:break-all;
}
.k-loop-empty{margin:.4rem 0;color:var(--color-muted);font-size:12px}
@media (min-width:1024px){
  .k-kernel-wrap{width:min(22rem,36vw)}
  .k-agent-chat{flex:1 1 58%}
}
@media (max-width:767px){
  .k-studio-start,.k-loop-tabs{padding:.55rem .75rem}
  .k-studio-start button,.k-loop-tabs button,.k-loop-pane button,.k-point-actions button,.k-bench-actions button{min-height:44px}
  .k-loop-pane{max-height:min(58vh,30rem);padding-bottom:calc(.85rem + env(safe-area-inset-bottom))}
  .k-loop-live{height:min(46vh,22rem)}
}
.k-bench{
  margin:0 0 1rem;
  padding:.85rem .9rem .75rem;
  border:1px solid var(--color-border);
  border-radius:.9rem;
  background:color-mix(in srgb, var(--color-surface) 72%, var(--color-bg));
}
.k-bench-strip{
  padding:.45rem .75rem;
  border-bottom:1px solid var(--color-border);
  color:var(--color-fg);
  font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.03em;
}
.k-bench-strip[hidden]{display:none}
.k-bench-list{list-style:none;margin:.7rem 0 0;padding:0;border-top:1px solid var(--color-border)}
.k-bench-list li{
  display:flex;justify-content:space-between;gap:.8rem;
  padding:.45rem 0;border-bottom:1px solid var(--color-border);
  font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
}
.k-bench-list li span:first-child{
  color:var(--color-muted);letter-spacing:.08em;text-transform:uppercase;
}
.k-bench-actions{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.75rem}
.k-bench-actions button{min-height:36px}
@media (max-width:767px){
  .k-bench-actions button{min-height:44px}
}
.k-point{
  margin:0 0 .45rem;
  padding:.7rem .8rem .75rem;
  border:1px solid var(--color-border);
  border-radius:.9rem;
  background:color-mix(in srgb, var(--color-surface) 72%, var(--color-bg));
}
.k-point p{margin:0;color:var(--color-muted);font-size:13px;line-height:1.45}
.k-point-actions{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.65rem}
.k-point-actions button{min-height:36px}
.k-point-meta{
  margin:.55rem 0 0;
  color:var(--color-muted);
  font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
  word-break:break-word;
}
@media (max-width:767px){
  .k-point-actions button{min-height:44px}
}
.k-repos{
  margin:0 0 .45rem;
  padding:.75rem .85rem .8rem;
  border:1px solid var(--color-border);
  border-radius:.9rem;
  background:#121214;
  color:#ecece8;
}
.k-receipt{
  margin:0 0 .75rem;
  padding:0 0 .15rem .7rem;
  border-left:2px solid #c4a574;
  font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
}
.k-receipt .k-r-mark{color:#c4a574}
.k-receipt .k-r-sub{color:#a3a3ab}
.k-repos h3{margin:.15rem 0 .35rem;font-size:13px;font-weight:600;letter-spacing:.01em}
.k-repos ul{margin:0 0 .65rem;padding:0 0 0 1.05rem}
.k-repos li{margin:.28rem 0;font-size:12.5px;line-height:1.4}
.k-repos .k-scratch{
  margin:0;
  color:#bdbdc4;
  font:11.5px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  word-break:break-word;
}
.k-pass{color:#8fbfa0}
.k-fail{color:#d98989}
@media (prefers-reduced-motion:reduce){
  .k-studio-start button,.k-loop-tabs button{transition:none}
}
`;
  document.head.appendChild(css);
}

function fillComposer(text) {
  const box =
    document.querySelector(".k-agent-chat [role='textbox']") ||
    document.querySelector(".k-studio [role='textbox']");
  if (!box) return false;
  box.textContent = text;
  try {
    box.focus();
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    /* ignore */
  }
  return true;
}

function composerText() {
  const box =
    document.querySelector(".k-agent-chat [role='textbox']") ||
    document.querySelector(".k-studio [role='textbox']");
  return ((box && box.textContent) || "").trim();
}

function fileCount() {
  try {
    const st = useKiln.getState();
    const handle = st.wallet && st.wallet.handle;
    const id = handle ? handle + "/home" : "";
    const repo = (st.userRepos || []).find((r) => r.id === id) || (st.userRepos || [])[0];
    return (repo && (repo.files || []).length) || 0;
  } catch {
    return 0;
  }
}

function crewCount() {
  try {
    const st = useKiln.getState();
    const handle = st.wallet && st.wallet.handle;
    const id = handle ? handle + "/home" : "";
    return (st.agents || []).filter((a) => !id || a.repoId === id).length;
  } catch {
    return 0;
  }
}

function paintLive() {
  const bar = document.querySelector(".k-space-bar > div");
  if (!bar) return;
  let live = bar.querySelector(".k-studio-live");
  if (!live) {
    live = document.createElement("p");
    live.className = "k-studio-live";
    bar.appendChild(live);
  }
  const files = fileCount();
  const crew = crewCount();
  const jobs = (loopState.jobs || []).length;
  const open = (loopState.jobs || []).filter((j) => j.status === "queued" || j.status === "running" || j.status === "needs_review").length;
  const next = crew
    ? `${crew} seated · ${files} files · ${open || jobs} jobs · a write is a git commit`
    : "Opening your computer…";
  if (live.textContent !== next) live.textContent = next;
}

function paintStart() {
  const chat = document.querySelector(".k-agent-chat");
  if (!chat) return;
  if (chat.querySelector(".k-studio-start")) return;
  const form = chat.querySelector("form");
  if (!form) return;
  const wrap = document.createElement("div");
  wrap.className = "k-studio-start";
  wrap.innerHTML =
    `<p>Type a job. Grok writes on a worktree. Diff, tests, then merge. Walk away and come back to a commit.</p>` +
    JOBS.map((j) => `<button type="button" data-kiln-job="${j.id}">${j.label}</button>`).join("") +
    `<button type="button" data-kiln-walk="1">Walk away</button>`;
  wrap.addEventListener("click", (ev) => {
    const walk = ev.target && ev.target.closest("[data-kiln-walk]");
    if (walk) {
      const brief = composerText() || JOBS[0].job;
      void walkAway(brief);
      return;
    }
    const btn = ev.target && ev.target.closest("[data-kiln-job]");
    if (!btn) return;
    const spec = JOBS.find((j) => j.id === btn.getAttribute("data-kiln-job"));
    if (!spec) return;
    fillComposer(spec.job);
  });
  form.parentNode.insertBefore(wrap, form);
}

function benchLabel(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const swaps = [
    ["One-shot a project", "Open a bench"],
    ["One-shot repository", "Open bench"],
    ["Sealing…", "Opening…"],
    [
      "Describe it once. Kiln writes the tree — including index.html — seals it, and boots the capsule under the connected wallet.",
      "Name the work. A bench stays open. It commits one phase at a time — code, a crypto backend, an agent, or a model — and the cursor is still there when you come back.",
    ],
    ["generating a complete tree…", "opening the bench…"],
    ["files sealed", "on the cursor"],
  ];
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue || "";
    if (!/One-shot|one-shot|generating a complete tree|files sealed|Sealing…/.test(raw)) continue;
    let next = raw;
    for (const [from, to] of swaps) {
      if (next.includes(from)) next = next.replace(from, to);
    }
    next = next.replaceAll("One-shot", "Bench").replaceAll("one-shot", "bench");
    if (next !== raw) node.nodeValue = next;
  }
}

const benchSeen = new Map();
let benchPulling = false;

function slugBench(name, prompt) {
  const raw = String(name || prompt || "bench")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return raw || "bench";
}

async function commitBenchFiles(repoId, files) {
  const commitFile = useKiln.getState().commitFile;
  if (!repoId || !files || typeof commitFile !== "function") return;
  for (const file of files) {
    if (!file || !file.path || typeof file.content !== "string") continue;
    if (benchSeen.get(repoId + ":" + file.path) === file.content) continue;
    benchSeen.set(repoId + ":" + file.path, file.content);
    try {
      await commitFile(repoId, file.path, file.content, "bench: " + file.path);
    } catch {
      /* the server tree still has the commit */
    }
  }
}

function rememberBench(bench) {
  if (!bench) return;
  loopState.bench = bench;
  const n = (bench.phases || []).length;
  const mark = bench.status === "working" ? "working" : bench.status === "held" ? "held" : "open";
  loopState.meta = `bench ${bench.cursor}/${n} · ${bench.kind} · ${mark}`;
}

async function pullBench(repoId) {
  if (!repoId || benchPulling) return null;
  benchPulling = true;
  try {
    const st = await loopApi({ action: "benchStatus", repoId });
    if (!st || !st.ok) return st;
    await commitBenchFiles(repoId, st.files);
    rememberBench(st.bench);
    paintBench();
    paintDock(false);
    return st;
  } finally {
    benchPulling = false;
  }
}

function watchBench(repoId) {
  loopState.benchRepo = repoId;
  if (watchBench._timer) clearInterval(watchBench._timer);
  watchBench._timer = setInterval(() => {
    if (loopState.benchRepo !== repoId) return;
    void pullBench(repoId).then((st) => {
      const status = st && st.bench && st.bench.status;
      if (status && status !== "working" && watchBench._timer) {
        clearInterval(watchBench._timer);
        watchBench._timer = 0;
      }
    });
  }, 1200);
}

async function startBench(repoId, args) {
  loopState.benchRepo = repoId;
  const opened = await loopApi({
    action: "bench",
    repoId,
    kind: (args && args.kind) || "code",
    prompt: (args && args.prompt) || "",
    name: (args && args.name) || "",
  });
  if (!opened || !opened.ok) {
    loopState.meta = (opened && opened.error) || "bench needs a seat";
    paintBench();
    return opened;
  }
  await commitBenchFiles(repoId, opened.files);
  rememberBench(opened.bench);
  paintBench();
  if (opened.bench && opened.bench.status === "working") watchBench(repoId);
  return opened;
}

function benchPanelHtml() {
  const b = loopState.bench;
  if (!b) {
    return `<p class="k-bench-lead">A bench stays open. The first commit is the charter. Later phases land one at a time — code, a crypto backend, an agent, or a model. Hold keeps the cursor. It does not seal the whole tree in one pass.</p>`;
  }
  const phases = b.phases || [];
  const rows = phases
    .map((p, i) => {
      const mark = p.done ? "done" : i === b.cursor ? "now" : "later";
      return `<li><span>${mark}</span><span>${esc(p.title)}</span></li>`;
    })
    .join("");
  const working = b.status === "working";
  const landed = b.cursor >= phases.length;
  const lead = landed
    ? "Horizon landed. The bench stays open. Nothing was sealed in one pass."
    : working
      ? `Working · phase ${Math.min(b.cursor + 1, phases.length)} of ${phases.length}. One commit, then the next. Hold if you want the cursor to wait.`
      : "Held at the cursor. Next phase commits one. Keep working resumes the horizon.";
  return `<p class="k-bench-lead">${lead}</p>
<ul class="k-bench-list">${rows}</ul>
<div class="k-bench-actions">
  <button type="button" data-k-bench="hold"${working ? "" : " disabled"}>Hold</button>
  <button type="button" data-k-bench="step"${landed ? " disabled" : ""}>Next phase</button>
  <button type="button" data-k-bench="work"${landed || working ? " disabled" : ""}>Keep working</button>
</div>`;
}

function oneshotColumn() {
  const heads = [...document.querySelectorAll("h2")];
  const h = heads.find((el) => /Open a bench|One-shot a project|Bench a project/.test(el.textContent || ""));
  return h ? h.parentElement : null;
}

async function onBenchAct(kind) {
  const repoId = loopState.benchRepo;
  if (!repoId || loopState.benchBusy) return;
  loopState.benchBusy = true;
  paintBench();
  try {
    const action = kind === "hold" ? "benchHold" : kind === "step" ? "benchStep" : "benchWork";
    const out = await loopApi({ action, repoId });
    if (out && out.ok) {
      await commitBenchFiles(repoId, out.files);
      rememberBench(out.bench);
      if (out.bench && out.bench.status === "working") watchBench(repoId);
      else if (watchBench._timer) {
        clearInterval(watchBench._timer);
        watchBench._timer = 0;
      }
    }
  } finally {
    loopState.benchBusy = false;
    paintBench();
    paintDock(false);
  }
}

function paintBench() {
  const col = oneshotColumn();
  if (!col) return;
  let box = col.querySelector("[data-kiln-bench]");
  if (!box) {
    box = document.createElement("div");
    box.className = "k-bench";
    box.setAttribute("data-kiln-bench", "1");
    box.addEventListener("click", (ev) => {
      const btn = ev.target && ev.target.closest("[data-k-bench]");
      if (!btn || btn.disabled) return;
      ev.preventDefault();
      ev.stopPropagation();
      void onBenchAct(btn.getAttribute("data-k-bench"));
    });
    const head = col.querySelector("h2");
    if (head) head.insertAdjacentElement("afterend", box);
    else col.insertBefore(box, col.firstChild);
  }
  const html = benchPanelHtml();
  if (box.getAttribute("data-html") !== html) {
    box.innerHTML = html;
    box.setAttribute("data-html", html);
  }
}

function installBench() {
  const st = useKiln.getState();
  if (!st || typeof st.oneShotRepo !== "function" || st.oneShotRepo._bench) return;
  const wrapped = async function openBenchInstead(args) {
    const a = args || {};
    const live = useKiln.getState();
    const w = live.wallet;
    if (!w || !w.handle) throw new Error("Connect a wallet first");
    const owner = String(a.owner || w.handle).toLowerCase();
    const base = slugBench(a.name, a.prompt);
    let name = base;
    let repo = null;
    for (let i = 0; i < 8; i++) {
      try {
        repo = await live.createRepo({
          name,
          description: String(a.prompt || "Bench").trim().slice(0, 160),
          visibility: a.visibility || "public",
          encrypted: true,
          license: "MIT",
          modelId: a.modelId,
          owner,
          kind: a.kind || "code",
        });
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/exists/i.test(msg)) throw e;
        name = base + "-" + (i + 2);
      }
    }
    if (!repo || !repo.id) throw new Error("Could not open a bench");
    const opened = await startBench(repo.id, { ...a, name });
    const files = (opened && opened.files) || [{ path: "BENCH.md" }, { path: "index.html" }, { path: "kiln.json" }];
    const current = (useKiln.getState().userRepos || []).find((r) => r.id === repo.id) || repo;
    return { repo: current, pack: { via: "bench", files, kind: a.kind || "code" } };
  };
  wrapped._bench = true;
  useKiln.setState({ oneShotRepo: wrapped });
}

function installTreeSync() {
  const st = useKiln.getState();
  if (!st || typeof st.commitFile !== "function" || st.commitFile._tree) return;
  const orig = st.commitFile;
  const wrapped = async function commitOnComputer(repoId, filePath, content, message) {
    const local = await orig.call(useKiln.getState(), repoId, filePath, content, message);
    const msg = String(message || "");
    if (!msg.startsWith("bench:") && sessionToken()) {
      try {
        await loopApi({
          action: "write",
          repoId,
          path: filePath,
          content,
          message: msg || "studio: " + filePath,
        });
      } catch {
        /* the screen still has the file */
      }
    }
    return local;
  };
  wrapped._tree = true;
  useKiln.setState({ commitFile: wrapped });
}

async function loopApi(body) {
  const res = await fetch("/api/kiln/loop", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ repoId: homeId(), ...body }),
  });
  return res.json().catch(() => ({ ok: false, error: "loop failed" }));
}

async function refreshBoard(force) {
  if (!sessionToken() || !homeId()) return;
  const now = Date.now();
  if (!force && now - loopState.lastBoard < 2500) return;
  loopState.lastBoard = now;
  try {
    const prev = (loopState.jobs || []).slice();
    const out = await loopApi({ action: "board" });
    if (!out || !out.ok) return;
    loopState.jobs = out.jobs || [];
    loopState.live = out.live || loopState.live;
    loopState.pulls = out.pulls || [];
    const open = (loopState.jobs || []).filter((j) => j.status === "needs_review" || j.status === "queued" || j.status === "running" || j.status === "tests_failed");
    if (!loopState.jobId && open[0]) loopState.jobId = open[0].id;
    const n = (loopState.jobs || []).length;
    const review = (loopState.jobs || []).filter((j) => j.status === "needs_review").length;
    const failed = (loopState.jobs || []).filter((j) => j.status === "tests_failed").length;
    const running = (loopState.jobs || []).filter((j) => j.status === "queued" || j.status === "running").length;
    loopState.meta = running
      ? `${running} running`
      : failed
        ? `${failed} failed`
        : review
          ? `${review} to review`
          : n
            ? `${n} jobs`
            : "board empty";
    if (loopState.bench) {
      const b = loopState.bench;
      const mark = b.status === "working" ? "working" : b.status === "held" ? "held" : "open";
      loopState.meta = `bench ${b.cursor}/${(b.phases || []).length} · ${b.kind} · ${mark}`;
    }
    for (const j of loopState.jobs) {
      const old = prev.find((p) => p.id === j.id);
      if (old && (old.status === "running" || old.status === "queued") && j.status !== old.status) {
        if (j.status === "needs_review" || j.status === "merged") loopState.tab = "live";
        if (j.status === "tests_failed") loopState.tab = "diff";
      }
    }
    paintLive();
    paintDock(true);
  } catch {
    /* later */
  }
}

async function walkAway(brief) {
  if (loopState.busy) return;
  loopState.busy = true;
  try {
    const out = await loopApi({ action: "run", brief, walkAway: true });
    if (out && out.job) {
      loopState.jobId = out.job.id;
      loopState.tab = "board";
    }
    await refreshBoard(true);
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 900));
      await refreshBoard(true);
      const job = (loopState.jobs || []).find((j) => j.id === loopState.jobId);
      if (job && job.status !== "queued" && job.status !== "running") break;
    }
  } catch {
    /* keep studio moving */
  } finally {
    loopState.busy = false;
    paintDock(true);
  }
}

async function loadDiff(jobId) {
  const id = jobId || loopState.jobId;
  if (!id) {
    loopState.patch = "";
    loopState.stat = "No job on the board.";
    paintDock(true);
    return;
  }
  loopState.jobId = id;
  try {
    const out = await loopApi({ action: "diff", jobId: id });
    loopState.patch = (out && out.patch) || "";
    loopState.stat = (out && (out.stat || (out.files || []).map((f) => f.path).join(" · "))) || "empty diff";
    paintDock(true);
  } catch {
    /* later */
  }
}

async function runTestsGate() {
  if (!loopState.jobId) return;
  loopState.busy = true;
  paintDock(true);
  try {
    const out = await loopApi({ action: "test", jobId: loopState.jobId });
    loopState.tests = out;
    paintDock(true);
  } finally {
    loopState.busy = false;
  }
}

async function mergeJob() {
  if (!loopState.jobId) return;
  loopState.busy = true;
  paintDock(true);
  try {
    const out = await loopApi({ action: "merge", jobId: loopState.jobId });
    if (out && out.ok) {
      loopState.live = out.live || loopState.live;
      loopState.tab = "live";
    } else {
      loopState.tests = out && out.tests;
    }
    await refreshBoard(true);
    await loadDiff(loopState.jobId);
  } finally {
    loopState.busy = false;
  }
}

async function openPull() {
  loopState.busy = true;
  paintDock(true);
  try {
    const out = await loopApi({ action: "pull", jobId: loopState.jobId || undefined });
    if (out && out.pull) loopState.pulls = [out.pull, ...(loopState.pulls || [])];
    loopState.tab = "pull";
    await refreshBoard(true);
  } finally {
    loopState.busy = false;
  }
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function liveSrc() {
  const id = homeId();
  if (!id) return "";
  const [owner, ...rest] = id.split("/");
  const name = rest.join("/") || "home";
  const tok = sessionToken();
  const rec = (loopState.jobs || []).find((j) => j.id === loopState.jobId);
  const job = loopState.jobId && rec && rec.status !== "merged" && rec.status !== "abandoned" ? loopState.jobId : "";
  let href = `/live/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/`;
  const q = [];
  if (job) q.push("job=" + encodeURIComponent(job));
  if (tok) q.push("token=" + encodeURIComponent(tok));
  if (q.length) href += "?" + q.join("&");
  return href;
}

function paneHtml() {
  const tab = loopState.tab;
  if (!tab) return "";
  if (tab === "board") {
    const jobs = loopState.jobs || [];
    if (!jobs.length) {
      return `<p class="k-loop-empty">No jobs yet. Type a job and Walk away — come back to a commit on a worktree.</p>`;
    }
    return `<ul class="k-loop-list">${jobs
      .slice(0, 16)
      .map((j) => {
        const on = j.id === loopState.jobId ? " aria-pressed=\"true\"" : "";
        const n = (j.filesChanged || j.writes || []).length;
        const extra = n ? ` · ${n} file${n === 1 ? "" : "s"}` : "";
        return `<li><span class="k-loop-status">${esc(j.status)}${esc(extra)}</span><span>${esc(j.brief || j.id)}</span><button type="button" data-k-job="${esc(j.id)}"${on}>Diff</button></li>`;
      })
      .join("")}</ul>`;
  }
  if (tab === "diff") {
    const tests = loopState.tests;
    const testLine = tests
      ? tests.ok
        ? `${tests.passed} checks passed`
        : `${tests.failed} failed · ${tests.passed || 0} passed`
      : "Tests gate the merge.";
    return `<p class="k-loop-empty">${esc(loopState.stat || "Pick a job on the board.")}</p>
<pre class="k-loop-patch">${esc(loopState.patch || "No patch yet. Queue a job.")}</pre>
<div class="k-loop-actions">
  <button type="button" data-k-act="test"${loopState.busy ? " disabled" : ""}>Run tests</button>
  <button type="button" data-k-act="merge"${loopState.busy ? " disabled" : ""}>Merge</button>
</div>
<p class="k-loop-empty">${esc(testLine)}</p>`;
  }
  if (tab === "live") {
    const src = liveSrc();
    const rec = (loopState.jobs || []).find((j) => j.id === loopState.jobId);
    const note =
      rec && rec.status !== "merged"
        ? "Worktree origin — merge to pin this capsule on the computer."
        : "Live origin of this computer.";
    return `<iframe class="k-loop-live" title="Live capsule" sandbox="allow-scripts allow-forms allow-same-origin" src="${esc(src)}"></iframe>
<a class="k-loop-url" href="${esc(src)}" target="_blank" rel="noreferrer">${esc(src.split("?")[0])}</a>
<p class="k-loop-empty">${esc(note)}</p>`;
  }
  if (tab === "pull") {
    const pulls = loopState.pulls || [];
    const rows = pulls.length
      ? `<ul class="k-loop-list">${pulls
          .slice(0, 8)
          .map((p) => {
            const href = p.url || p.compareUrl || "";
            const label = p.title || p.branch || p.id;
            return `<li><span class="k-loop-status">${esc(p.github && p.github.ok ? "github" : "kiln")}</span>${href ? `<a href="${esc(href)}" target="_blank" rel="noreferrer">${esc(label)}</a>` : esc(label)}</li>`;
          })
          .join("")}</ul>`
      : `<p class="k-loop-empty">No pull yet. Open one after a job has a diff. If this computer has a GitHub twin, Kiln pushes the branch. Otherwise the pull lives here.</p>`;
    return `<div class="k-loop-actions"><button type="button" data-k-act="pull"${loopState.busy ? " disabled" : ""}>Open pull</button></div>${rows}`;
  }
  return "";
}

function paintDock(force) {
  const chat = document.querySelector(".k-agent-chat");
  if (!chat) return;
  let dock = chat.querySelector("[data-kiln-loop]");
  if (!dock) {
    const start = chat.querySelector(".k-studio-start");
    const form = chat.querySelector("form");
    dock = document.createElement("div");
    dock.className = "k-loop";
    dock.setAttribute("data-kiln-loop", "1");
    dock.innerHTML =
      `<div class="k-bench-strip" data-kiln-bench-strip hidden></div>` +
      `<div class="k-loop-tabs">` +
      ["board", "diff", "live", "pull"]
        .map((t) => `<button type="button" data-k-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`)
        .join("") +
      `<span class="k-loop-meta"></span></div><div class="k-loop-pane" hidden></div>`;
    dock.addEventListener("click", (ev) => {
      const tabBtn = ev.target && ev.target.closest("[data-k-tab]");
      if (tabBtn) {
        const tab = tabBtn.getAttribute("data-k-tab");
        loopState.tab = tab;
        if (loopState.tab === "diff") void loadDiff(loopState.jobId);
        if (loopState.tab === "board" || loopState.tab === "live" || loopState.tab === "pull") void refreshBoard(true);
        paintDock(true);
        return;
      }
      const jobBtn = ev.target && ev.target.closest("[data-k-job]");
      if (jobBtn) {
        loopState.jobId = jobBtn.getAttribute("data-k-job");
        loopState.tab = "diff";
        void loadDiff(loopState.jobId);
        return;
      }
      const act = ev.target && ev.target.closest("[data-k-act]");
      if (!act) return;
      const kind = act.getAttribute("data-k-act");
      if (kind === "test") void runTestsGate();
      if (kind === "merge") void mergeJob();
      if (kind === "pull") void openPull();
    });
    const header = chat.querySelector("header");
    if (header && header.parentNode) header.insertAdjacentElement("afterend", dock);
    else chat.insertBefore(dock, chat.firstElementChild || null);
  }
  const meta = dock.querySelector(".k-loop-meta");
  if (meta && meta.textContent !== (loopState.meta || "")) meta.textContent = loopState.meta || "";
  const strip = dock.querySelector("[data-kiln-bench-strip]");
  if (strip) {
    const b = loopState.bench;
    if (!b) {
      if (!strip.hidden) strip.hidden = true;
    } else {
      strip.hidden = false;
      const phases = b.phases || [];
      const now = phases[Math.min(b.cursor, phases.length - 1)];
      const mark = b.status === "working" ? "working" : b.status === "held" ? "held" : "open";
      const line = `${b.kind} bench · ${b.cursor}/${phases.length} · ${mark}${now ? " · " + now.title : ""}`;
      if (strip.textContent !== line) strip.textContent = line;
    }
  }
  dock.querySelectorAll("[data-k-tab]").forEach((b) => {
    b.setAttribute("aria-pressed", b.getAttribute("data-k-tab") === loopState.tab ? "true" : "false");
  });
  const pane = dock.querySelector(".k-loop-pane");
  if (!pane) return;
  if (!loopState.tab) {
    if (!pane.hidden) pane.hidden = true;
    return;
  }
  pane.hidden = false;
  pane.classList.toggle("k-loop-open-live", loopState.tab === "live");
  const html = paneHtml();
  if (force || pane.getAttribute("data-html") !== html) {
    pane.innerHTML = html;
    pane.setAttribute("data-html", html);
  }
  if (force && loopState.tab) {
    try {
      dock.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch {
      /* ignore */
    }
  }
}

function activeRepo() {
  try {
    const text = document.body ? document.body.innerText || "" : "";
    const m = text.match(/kiln:\/\/([a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*)\.git/i);
    if (m) return m[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return homeId();
}

function pointCopy(kind) {
  const origin = location.origin;
  const mcp = origin + "/api/mcp";
  const token = sessionToken();
  const repo = activeRepo() || "your-handle/home";
  const bearer = token || "<sign in, then copy again>";
  if (kind === "claude") {
    return `claude mcp add --transport http kiln ${mcp} --header "Authorization: Bearer ${bearer}"`;
  }
  if (kind === "muse") {
    return JSON.stringify(
      {
        mcp_servers: {
          kiln: {
            transport: "streamable_http",
            url: mcp,
            headers: { Authorization: "Bearer " + bearer },
          },
        },
      },
      null,
      2,
    );
  }
  return [
    "Build in Kiln Studio. Do not clone this tree and do not write only on your machine.",
    "Webapp: " + origin,
    "Computer: " + repo,
    "MCP: POST " + mcp,
    "Header: Authorization: Bearer " + bearer,
    "Call tools/list, then kiln_list_files and kiln_read_file.",
    "Open the horizon with kiln_bench. It lands the charter and stops.",
    "kiln_bench_step commits the next phase only. Read the tree, then step again. kiln_bench_hold parks the cursor.",
    "kiln_diff and kiln_test read this computer. kiln_create_branch, kiln_bind_model, and kiln_open_pr settle here too.",
    "kiln_wallet is the Kiln-note till, not a card. kiln_list_product prices a file here. kiln_buy pays the seller and commits that file onto your computer.",
    "No seat yet? kiln_open_seat. Save the secret. kiln_map is the webapp. kiln_go opens one page. data-kiln-go is the control. Every mode uses that map.",
    "kiln_review prints this seat: Active, Bench & scratch, one forge probe, honest limits. Pass question to quote files. Print text. Do not add a port.",
    "kiln_ship runs the checks on this Kiln, opens the live app, and pushes a GitHub branch. Pass github as owner/name. It does not push main.",
    "Write with kiln_write_file. A write is a git commit. Studio is open on this computer and shows the file.",
  ].join("\n");
}

function paintPoint() {
  const chat = document.querySelector(".k-agent-chat");
  if (!chat || (location.pathname !== "/studio" && !location.pathname.startsWith("/studio"))) return;
  let box = chat.querySelector("[data-kiln-point]");
  if (!box) {
    box = document.createElement("div");
    box.className = "k-point";
    box.setAttribute("data-kiln-point", "1");
    box.addEventListener("click", (ev) => {
      const btn = ev.target && ev.target.closest("[data-k-point]");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      const kind = btn.getAttribute("data-k-point");
      const text = pointCopy(kind);
      const done = () => {
        const prev = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = prev === "Copied" ? btn.getAttribute("data-label") || prev : btn.getAttribute("data-label") || prev;
        }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => done());
      } else done();
    });
    const header = chat.querySelector("header");
    if (header && header.parentNode) header.insertAdjacentElement("afterend", box);
    else chat.insertBefore(box, chat.firstChild);
  }
  const repo = activeRepo() || "this computer";
  const writes = loopState.outside || [];
  const last = writes[0];
  const members = ((loopState.crew && loopState.crew.members) || []).map((m) => m.name || m.id).filter(Boolean);
  const seat = members.length ? ` Seated · ${members.join(", ")}.` : "";
  const meta = (last
    ? `Last outside commit · ${last.path} · ${last.bytes || 0} bytes`
    : "No outside commit yet. After you point them here, the file shows up on this computer.") + seat;
  const html =
    `<p>Point Claude or Muse at this webapp. They build in Studio on <strong>${esc(repo)}</strong>. A write is a git commit. A bench steps one phase at a time. They do not clone.</p>` +
    `<div class="k-point-actions">` +
    `<button type="button" data-k-point="claude" data-label="Copy Claude">Copy Claude</button>` +
    `<button type="button" data-k-point="muse" data-label="Copy Muse">Copy Muse</button>` +
    `<button type="button" data-k-point="prompt" data-label="Copy prompt">Copy prompt</button>` +
    `</div>` +
    `<p class="k-point-meta">${esc(meta)}</p>`;
  if (box.getAttribute("data-html") !== html) {
    box.innerHTML = html;
    box.setAttribute("data-html", html);
  }
}

function mergeServerFiles(repoId, serverFiles) {
  const st = useKiln.getState();
  const list = (st.userRepos || []).slice();
  let idx = list.findIndex((r) => r.id === repoId);
  if (idx < 0) {
    const [owner, ...rest] = repoId.split("/");
    list.unshift({
      id: repoId,
      owner,
      name: rest.join("/") || "home",
      visibility: "public",
      description: "This computer.",
      files: [],
      fileCount: 0,
    });
    idx = 0;
  }
  const cur = list[idx];
  const files = (cur.files || []).slice();
  let changed = false;
  for (const f of serverFiles || []) {
    if (!f || !f.path || typeof f.content !== "string") continue;
    const row = { path: f.path, content: f.content, size: f.size || f.content.length, message: "this computer" };
    const i = files.findIndex((x) => x.path === f.path);
    if (i >= 0) {
      if (files[i].content === row.content) continue;
      files[i] = { ...files[i], ...row };
    } else files.push(row);
    changed = true;
  }
  if (!changed) return;
  list[idx] = { ...cur, files, fileCount: files.length };
  useKiln.setState({ userRepos: list });
}

async function syncTree(repoId) {
  const out = await loopApi({ action: "tree", repoId });
  if (!out || !out.ok || !Array.isArray(out.files)) return;
  const sig = out.files.map((f) => f.path + ":" + (typeof f.content === "string" ? f.content.length : 0)).join("|");
  if (loopState.treeRepo === repoId && loopState.treeSeen === sig) return;
  loopState.treeRepo = repoId;
  loopState.treeSeen = sig;
  mergeServerFiles(repoId, out.files);
}

const seatedOnce = new Set();

async function seatReportedCrew(repoId, crew) {
  const st = useKiln.getState();
  if (!crew || typeof st.spawnAgent !== "function") return;
  for (const member of crew.members || []) {
    if (!member || member.outside === false || member.id === "conductor") continue;
    const key = repoId + ":" + member.id;
    if (seatedOnce.has(key)) continue;
    const already = (st.agents || []).some((a) => a && a.repoId === repoId && (a.name === member.name || a.id === member.id));
    seatedOnce.add(key);
    if (already) continue;
    try {
      await st.spawnAgent({ role: member.role || "builder", repoId, name: member.name || member.id });
    } catch {
      /* crew.json is the seat */
    }
  }
}

async function pullOutside() {
  if (!sessionToken()) return;
  const repoId = activeRepo();
  if (!repoId) return;
  const out = await loopApi({ action: "outside", repoId });
  if (out && out.ok) {
    loopState.outside = out.writes || [];
    loopState.outsideRepo = repoId;
  }
  const crew = await loopApi({ action: "crew", repoId });
  if (crew && crew.ok) {
    loopState.crew = crew.crew;
    await seatReportedCrew(repoId, crew.crew);
  }
  const watching = !loopState.benchRepo || loopState.benchRepo === repoId;
  if (watching) {
    const bench = await loopApi({ action: "benchStatus", repoId });
    if (bench && bench.ok && bench.bench) {
      const sig = `${bench.bench.cursor}:${bench.bench.status}:${bench.bench.prompt || ""}`;
      if (loopState.benchSig !== sig) {
        loopState.benchSig = sig;
        loopState.benchRepo = repoId;
        await commitBenchFiles(repoId, bench.files);
        rememberBench(bench.bench);
        paintBench();
        paintDock(false);
      }
    }
  }
  await syncTree(repoId);
  paintPoint();
  void refreshRepos();
}

function repoLine(row) {
  const mark = row.checks ? (row.checks.ok ? " · checks pass" : " · checks fail") : "";
  const subject = row.subject ? " · " + row.subject : "";
  const age = row.age ? " · " + row.age : "";
  return `${row.repo} — ${row.branch} @ ${row.head}${age}${subject}${mark}`;
}

function renderRepos(board) {
  const rec = board.receipt;
  let receipt = "";
  if (rec && rec.ok) {
    const move = rec.from ? `${esc(rec.from)} → ${esc(rec.to)}` : esc(rec.to);
    const checks = rec.checks
      ? `<div class="${rec.checks.ok ? "k-pass" : "k-fail"}">${rec.checks.ok ? "checks pass" : "checks fail"} · ${esc(rec.checks.ms < 1000 ? rec.checks.ms + "ms" : (rec.checks.ms / 1000).toFixed(1) + "s")}</div>`
      : "";
    receipt =
      `<div class="k-receipt">` +
      `<div><span class="k-r-mark">KILN</span> · ${esc(rec.repo)}</div>` +
      `<div>${esc(rec.branch)} · ${move}</div>` +
      checks +
      (rec.subject ? `<div class="k-r-sub">${esc(rec.subject)}</div>` : "") +
      (rec.app ? `<div class="k-r-sub">App: ${esc(rec.app)}</div>` : "") +
      (rec.githubUrl ? `<div class="k-r-sub">GitHub: ${esc(rec.githubUrl)}</div>` : "") +
      (!rec.app && !rec.githubUrl ? `<div class="k-r-sub">Destination: KILN-local</div>` : "") +
      `</div>`;
  }
  const group = (title, rows) => {
    if (!rows || !rows.length) return title === "Active" ? `<h3>Active</h3><p class="k-r-sub">none</p>` : "";
    return `<h3>${title}</h3><ul>${rows.map((row) => `<li>${esc(repoLine(row))}</li>`).join("")}</ul>`;
  };
  const scratch = (board.scratch || []).length
    ? `<h3>Scratch</h3><p class="k-scratch">${esc((board.scratch || []).map((row) => row.repo + " @ " + row.head).join(" · "))}</p>`
    : "";
  return receipt + group("Active", board.active) + group("Bench", board.bench) + scratch;
}

function paintRepos() {
  const chat = document.querySelector(".k-agent-chat");
  if (!chat || (location.pathname !== "/studio" && !location.pathname.startsWith("/studio"))) return;
  let box = chat.querySelector("[data-kiln-repos]");
  if (!box) {
    box = document.createElement("div");
    box.className = "k-repos";
    box.setAttribute("data-kiln-repos", "1");
    const point = chat.querySelector("[data-kiln-point]");
    if (point && point.parentNode) point.insertAdjacentElement("afterend", box);
    else chat.insertBefore(box, chat.firstChild);
  }
  const board = loopState.repos;
  if (!board || !board.ok) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const html = renderRepos(board);
  if (box.getAttribute("data-html") !== html) {
    box.innerHTML = html;
    box.setAttribute("data-html", html);
  }
}

async function refreshRepos() {
  if (!sessionToken()) return;
  const now = Date.now();
  if (now - (loopState.reposAt || 0) < 8000) return;
  loopState.reposAt = now;
  try {
    const out = await loopApi({ action: "repos", repoId: activeRepo() || homeId() });
    if (!out || !out.ok) return;
    loopState.repos = out;
    paintRepos();
  } catch {
    /* the board waits */
  }
}

function paintStudio() {
  if (location.pathname !== "/studio" && !location.pathname.startsWith("/studio")) return;
  if (paintStudio._busy) return;
  paintStudio._busy = true;
  try {
    installStudioCss();
    benchLabel(document.body);
    installBench();
    installTreeSync();
    paintPoint();
    paintRepos();
    paintBench();
    paintLive();
    paintStart();
    paintDock(false);
  } finally {
    paintStudio._busy = false;
  }
}

function lastUserText(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && (m.role === "user" || m.role === "human")) return String(m.content || m.text || "").slice(0, 4000);
  }
  return "";
}

function installLoopFetch() {
  if (installLoopFetch._on) return;
  installLoopFetch._on = true;
  const orig = globalThis.fetch;
  if (typeof orig !== "function") return;
  globalThis.fetch = async function kilnLoopFetch(input, init) {
    const url = String(typeof input === "string" ? input : input && input.url ? input.url : "");
    const method = String((init && init.method) || (typeof input !== "string" && input && input.method) || "GET").toUpperCase();
    const isTurn = /\/api\/kiln\/agent-turn(?:\?|$)/.test(url) && method === "POST";
    if (!isTurn) return orig.call(this, input, init);
    let body = {};
    try {
      body = JSON.parse((init && init.body) || "{}");
    } catch {
      body = {};
    }
    let job = null;
    try {
      if (sessionToken() && homeId()) {
        const brief = lastUserText(body.messages) || body.brief || "write the next real file";
        const queued = await orig.call(this, "/api/kiln/loop", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ action: "queue", repoId: body.repoId || homeId(), brief, walkAway: false }),
        });
        const out = await queued.json().catch(() => null);
        if (out && out.job) {
          job = out.job;
          loopState.jobId = job.id;
          loopState.tab = loopState.tab || "diff";
        }
      }
    } catch {
      /* turn still runs */
    }
    const res = await orig.call(this, input, init);
    if (job && job.id) {
      try {
        const clone = await res.clone().json();
        const calls = clone && Array.isArray(clone.toolCalls) ? clone.toolCalls : [];
        if (calls.length) {
          void orig.call(this, "/api/kiln/loop", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ action: "apply", repoId: job.repoId || homeId(), jobId: job.id, toolCalls: calls }),
          }).then(() => refreshBoard(true));
        } else {
          void refreshBoard(true);
        }
      } catch {
        /* ignore */
      }
    }
    return res;
  };
}

async function restoreStudioSeat() {
  const local = hydrateWalletNow();
  const me = await accountMe();
  const handle = (me && me.account && me.account.handle) || (local && local.handle);
  if (!handle || handle === "kiln") return;
  const cur = useKiln.getState().wallet;
  if (!cur || cur.handle !== handle) {
    useKiln.setState({
      wallet: {
        handle,
        address: (me && me.account && me.account.address) || (local && local.address) || "",
        secret: (cur && cur.handle === handle && cur.secret) || (local && local.handle === handle && local.secret) || "",
        createdAt: (me && me.account && me.account.createdAt) || (local && local.createdAt) || new Date().toISOString(),
      },
      hydrated: true,
    });
  }
  if (me && me.account) {
    try {
      globalThis.__KILN_ACCOUNT = me.account;
    } catch {
      /* ignore */
    }
    try {
      useKiln.getState().upsertProfile?.(me.account);
    } catch {
      /* ignore */
    }
  }
  ensureHomeStub(handle);
  await bootHome(handle);
  if (location.pathname === "/studio" || location.pathname.startsWith("/studio")) {
    window.setTimeout(() => {
      void seatCrewIfMissing(handle).then(() => {
        paintStudio();
        void refreshBoard(true);
        if (document.querySelector(".k-agent-chat")) return;
        const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Spawn crew");
        if (btn && !btn.disabled) btn.click();
      });
    }, 1400);
  }
  paintStudio();
  void refreshBoard(true);
}

export function installKilnStudio() {
  if (installKilnStudio._on) return;
  installKilnStudio._on = true;
  hydrateWalletNow();
  installStudioCss();
  installLoopFetch();
  installBench();
  installTreeSync();
  const boot = () => {
    try {
      paintStudio();
    } catch {
      /* keep the page moving */
    }
  };
  boot();
  let scheduled = 0;
  const mo = new MutationObserver(() => {
    if (paintStudio._busy) return;
    const now = Date.now();
    if (now - scheduled < 250) return;
    scheduled = now;
    boot();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  void restoreStudioSeat();
  window.addEventListener("popstate", () => {
    boot();
    void restoreStudioSeat();
  });
  window.setInterval(() => {
    if (location.pathname !== "/studio" && !location.pathname.startsWith("/studio")) return;
    const hot = (loopState.jobs || []).some((j) => j.status === "queued" || j.status === "running");
    void refreshBoard(hot);
    void pullOutside();
  }, 2500);
}

installKilnStudio();
