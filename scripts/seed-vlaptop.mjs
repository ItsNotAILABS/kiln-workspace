#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const filesDir = "/tmp/vlaptop-files";
function walk(dir, prefix = "") {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const rel = prefix ? prefix + "/" + name : name;
    if (fs.statSync(p).isDirectory()) out.push(...walk(p, rel));
    else out.push({ path: rel, content: fs.readFileSync(p, "utf8") });
  }
  return out;
}
function lang(p) {
  if (/\.py$/.test(p)) return "Python";
  if (/\.md$/.test(p)) return "Markdown";
  if (/toml$/.test(p)) return "TOML";
  if (/LICENSE/i.test(p)) return "Text";
  return "Text";
}
function sha(s, p) {
  let t = 0;
  const x = p + s;
  for (let i = 0; i < x.length; i++) t = (t * 31 + x.charCodeAt(i)) | 0;
  return "k" + Math.abs(t).toString(16).padStart(7, "0");
}

const raw = walk(filesDir);
const now = "2026-09-03T03:42:33Z";
const files = raw.map((f) => {
  const h = sha(f.content, f.path);
  return {
    path: f.path,
    language: lang(f.path),
    message: "import ItsNotAILABS/vlaptop",
    sha: h,
    updatedAt: now,
    content: f.content,
    size: f.content.length,
    merkleRoot: "0x" + h.slice(1),
    chunkCount: 1,
    encrypted: false,
  };
});
const readme = files.find((f) => /^readme\.md$/i.test(f.path))?.content || "";
const repo = {
  id: "itsnotailabs/vlaptop",
  owner: "itsnotailabs",
  name: "vlaptop",
  description:
    "Screen kernel for people and agents: see, touch, type, click named buttons. vLaptop is an agent's personal computer on that kernel.",
  visibility: "public",
  encrypted: true,
  keyCommitment: "0xvlaptop00000000000000000000000000000000",
  viewerGrant: true,
  chainAddress: "0x4c1e7a91b0c3d2e8f5a6478901234567890abcde",
  language: "Python",
  languages: { Markdown: 50, Python: 31, TOML: 12, Text: 7 },
  stars: 12,
  forks: 1,
  watchers: 4,
  topics: ["imported", "github", "screen-kernel", "agents", "vlaptop"],
  license: "MIT",
  defaultBranch: "main",
  updatedAt: now,
  createdAt: "2026-09-03T00:00:53Z",
  tvlKln: 0,
  files,
  readme,
  website: "https://github.com/ItsNotAILABS/vlaptop",
  merkleRoot: "0x" + sha(readme, "root").slice(1),
  quotaBytes: 53687091200,
  modelId: "grok-4.6",
  githubUrl: "https://github.com/ItsNotAILABS/vlaptop",
  githubSha: "HEAD",
  githubOwner: "ItsNotAILABS",
  githubRepo: "vlaptop",
  kind: "code",
};

const storePath = "/workspace/public/assets/store-sx46DNi5.js";
let store = fs.readFileSync(storePath, "utf8");
if (!store.includes("itsnotailabs/vlaptop")) {
  const injected = "JSON.parse(" + JSON.stringify(JSON.stringify(repo)) + ")";
  const needle = "var R=[{id:`kiln-labs/protocol`";
  if (!store.includes(needle)) throw new Error("catalog needle missing");
  store = store.replace(needle, "var R=[" + injected + ",{id:`kiln-labs/protocol`");
  fs.writeFileSync(storePath, store);
  console.log("injected vlaptop into catalog");
} else {
  console.log("vlaptop already in catalog");
}

const boot = `import { b as store } from "./store-sx46DNi5.js";

const VLAPTOP = ${JSON.stringify(repo, null, 0)};

function ensure() {
  const s = store.getState?.();
  if (!s || typeof s.connect !== "function") return false;
  if (!s.wallet) {
    try { s.connect("itsnotailabs"); } catch {}
  }
  const st = store.getState();
  const repos = st.userRepos || [];
  if (!repos.some((r) => r.id === VLAPTOP.id || (r.owner === "itsnotailabs" && r.name === "vlaptop"))) {
    store.setState({ userRepos: [VLAPTOP, ...repos] });
  }
  const agents = st.agents || [];
  if (!agents.some((a) => a.repoId === VLAPTOP.id)) {
    store.setState({
      agents: [
        { id: "agent_indra_vlaptop", repoId: VLAPTOP.id, name: "Indra", role: "indexer", resident: true, modelId: "grok-4.6" },
        ...agents,
      ],
    });
  }
  const domains = st.domains || [];
  if (!domains.some((d) => d.repoId === VLAPTOP.id)) {
    store.setState({
      domains: [
        { id: "dom_itsnotailabs-vlaptop", repoId: VLAPTOP.id, host: "itsnotailabs-vlaptop.kiln.app", kind: "kiln", status: "live", https: true, createdAt: VLAPTOP.createdAt },
        ...domains,
      ],
    });
  }
  const issues = st.userIssues || [];
  if (!issues.some((i) => i.repoId === VLAPTOP.id)) {
    store.setState({
      userIssues: [
        { id: VLAPTOP.id+"#1", number: 1, repoId: VLAPTOP.id, title: "SCREEN-KERNEL/1.1 verb table as the public contract", state: "open", author: "itsnotailabs", createdAt: VLAPTOP.createdAt },
        ...issues,
      ],
    });
  }
  try {
    if ((store.getState().balance || 0) < 2500) store.setState({ balance: 2500 });
  } catch {}
  return true;
}

let n = 0;
const t = setInterval(() => {
  n += 1;
  if (ensure() || n > 40) clearInterval(t);
}, 200);
`;
fs.writeFileSync("/workspace/public/assets/boot-kiln.js", boot);
console.log("wrote boot-kiln.js", boot.length);
