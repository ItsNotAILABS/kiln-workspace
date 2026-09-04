#!/usr/bin/env node
/**
 * The kiln account. A real handle (`kiln`) that owns Kiln's own
 * repositories inside the forge. Every sealed tech drop becomes a
 * public tree under kiln/<name>, Merkle-committed, forkable.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { githubImportTree } from "./github-engine.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");

function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function merklePair(leaves) {
  if (!leaves.length) return sha256("");
  let layer = leaves.map((x) => sha256(x));
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const a = layer[i];
      const b = layer[i + 1] ?? a;
      next.push(sha256(a + b));
    }
    layer = next;
  }
  return layer[0];
}

function fileEntry(p, content, language) {
  const body = String(content ?? "");
  const sha = sha256(body).slice(0, 12);
  return {
    path: p,
    content: body.length <= 8192 ? body : body.slice(0, 8192),
    language: language || langOf(p),
    message: "kiln account",
    sha: `k${sha}`,
    updatedAt: new Date().toISOString(),
    size: body.length,
    merkleRoot: `0x${sha256(body).slice(0, 16)}`,
    chunkCount: 1,
    encrypted: false,
  };
}

function langOf(p) {
  if (p.endsWith(".md")) return "Markdown";
  if (p.endsWith(".js") || p.endsWith(".mjs")) return "JavaScript";
  if (p.endsWith(".ts") || p.endsWith(".tsx")) return "TypeScript";
  if (p.endsWith(".swift")) return "Swift";
  if (p.endsWith(".json")) return "JSON";
  if (p.endsWith(".html")) return "HTML";
  if (p.endsWith(".css")) return "CSS";
  if (p.endsWith(".py")) return "Python";
  if (p.endsWith(".sh")) return "Shell";
  return "text";
}

function readText(rel, max = 80_000) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  const st = fs.statSync(abs);
  if (!st.isFile() || st.size > max) return null;
  return fs.readFileSync(abs, "utf8");
}

function repo({ id, name, description, files, topics }) {
  const merkle = merklePair(files.map((f) => f.sha));
  const readme = files.find((f) => /^readme(\.md)?$/i.test(f.path.split("/").pop() || ""))?.content || "";
  return {
    id,
    owner: "kiln",
    name,
    description,
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x" + sha256(`kiln:${id}`).slice(0, 40),
    viewerGrant: true,
    chainAddress: "0x" + sha256(`kiln-addr:${id}`).slice(0, 40),
    language: files[0]?.language || "Markdown",
    languages: files.reduce((acc, f) => {
      acc[f.language] = (acc[f.language] || 0) + 1;
      return acc;
    }, {}),
    stars: 0,
    forks: 0,
    watchers: 1,
    topics,
    license: "Apache-2.0",
    defaultBranch: "main",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    tvlKln: 0,
    files,
    readme: String(readme).slice(0, 4000),
    merkleRoot: `0x${merkle.slice(0, 40)}`,
    quotaBytes: 50 * 1024 * 1024 * 1024,
    kind: "code",
    origin: name === "kiln",
  };
}

async function build(manifest) {
  const address = "0x" + sha256("kiln-addr:kiln-operator-secret-v1-3e032dea509564c25c64ddb9243c5b1b0fb0b2f8").slice(0, 40);
  const account = {
    handle: "kiln",
    displayName: "KILN",
    bio: "The forge's own account. Every sealed tech drop lands here as a public repository.",
    location: "on-chain",
    joined: "2026",
    address,
    kind: "user",
    lab: "KILN",
    website: "/",
    highlight: "Origin of the forge",
  };

  const merkle = manifest?.merkle?.root || manifest?.merkle || "";
  const branch = manifest?.branch || "HEAD";
  const filesCount = manifest?.counts?.files ?? (manifest?.files || []).length;

  const kilnFiles = [
    fileEntry(
      "README.md",
      `# kiln/kiln\n\nThis is Kiln's own repository — published by the **kiln** account.\n\n- Pin branch: recovered-20260903 (immutable pickup)\n- HEAD: \`${branch}\`\n- Merkle: \`${merkle}\`\n- Files in this freeze: ${filesCount}\n\nFork it. Remix it. Branch \`work\`. The computer on this tree is live. Agents git-commit.\n`,
      "Markdown",
    ),
    fileEntry(
      "ACCOUNT.md",
      `# kiln account\n\nHandle: kiln\nAddress: ${address}\nKind: user\n\nThis account publishes every tech drop as a repository under kiln/<name>.\nIt is not a demo profile. It is the operator that owns the forge tree.\n`,
      "Markdown",
    ),
    fileEntry("kiln.json", JSON.stringify({ name: "kiln", owner: "kiln", merkle, branch, origin: true }, null, 2), "JSON"),
    fileEntry(
      "AGENTS.md",
      `# Agents on kiln/kiln\n\nThis tree is a computer. A write is a git commit.\n\n- Spawn a crew in Studio.\n- Default job: Read the tree. Write the next real file as a git commit.\n- Tools: kiln_write_file, kiln_run, kiln_create_branch, kiln_handoff.\n- Owner: kiln. Fork if you are someone else, then commit.\n`,
      "Markdown",
    ),
    fileEntry(
      "COMPUTER.md",
      `# Computer\n\n    ls\n    cat README.md\n    node src/hello.js\n    python src/hello.py\n    write src/next.js export const ok = true\n    git log\n\nPorts: capsule 443 · mcp 7331 · node 3000 · python 8000 · webgpu 7840.\n`,
      "Markdown",
    ),
    fileEntry(
      "src/hello.js",
      `export const KILN = "kiln/kiln";\nexport function greet(handle = "kiln") {\n  return \`connected as \${handle}\`;\n}\nconsole.log(greet("kiln"));\n`,
      "JavaScript",
    ),
    fileEntry("src/hello.py", `print("kiln computer")\nprint("python:8000")\n`, "Python"),
    fileEntry(
      "src/next.js",
      `export const next = "the next real file";\nconsole.log("committed on kiln/kiln");\n`,
      "JavaScript",
    ),
    fileEntry(
      "src/forge.js",
      `export const HANDLE = "kiln";\nexport const ADDRESS = "${address}";\nexport function isKiln(handle) { return handle === HANDLE; }\n`,
      "JavaScript",
    ),
  ];
  const head = readText("public/freeze/HEAD.json", 20_000);
  if (head) kilnFiles.push(fileEntry("freeze/HEAD.json", head, "JSON"));
  for (const wp of ["KILN-WP-10.md", "KILN-WP-11.md", "KILN-WP-12.md", "KILN-WP-13.md", "KILN-WP-14.md", "KILN-WP-15.md", "KILN-WP-16.md"]) {
    const body = readText(`public/freeze/${wp}`, 60_000);
    if (body) kilnFiles.push(fileEntry(`papers/${wp}`, body, "Markdown"));
  }

  const engineSrc = readText("scripts/github-engine.mjs", 80_000);
  const engineFiles = [
    fileEntry(
      "README.md",
      `# kiln/import-engine\n\nPublic-tree import. Looks up any GitHub user, org, or owner/repo, pulls GitHub's zipball, unpacks it, seals AES-256-GCM.\n\nSame engine the New page, Studio Import tab, and Connect account-import call.\n`,
      "Markdown",
    ),
    fileEntry("package.json", JSON.stringify({ name: "kiln-import-engine", type: "module", private: true }, null, 2), "JSON"),
  ];
  if (engineSrc) engineFiles.push(fileEntry("github-engine.mjs", engineSrc.slice(0, 8000), "JavaScript"));

  const poolSrc = readText("scripts/hash-pool.mjs", 80_000);
  const poolFiles = [
    fileEntry(
      "README.md",
      `# kiln/hash-pool\n\nContent-addressed hash pools. SHA-256 leaves, pairwise Merkle, named branches.\nPickup pin recovered-20260903 is immutable.\n\nThis repository is the live ledger Kiln publishes into itself.\n`,
      "Markdown",
    ),
    fileEntry(
      "POOL.md",
      `# Current freeze\n\n- branch: \`${branch}\`\n- merkle: \`${merkle}\`\n- files: ${filesCount}\n`,
      "Markdown",
    ),
  ];
  if (poolSrc) poolFiles.push(fileEntry("hash-pool.mjs", poolSrc.slice(0, 8000), "JavaScript"));

  const lockSrc = readText("scripts/kiln-lock.mjs", 80_000);
  const lockPaper = readText("public/freeze/KILN-WP-19.md", 80_000);
  const lockJson = readText("public/freeze/LOCK.json", 80_000);
  const lockFiles = [
    fileEntry(
      "README.md",
      `# kiln/lock\n\nProtected product files restore from CAS on boot. Studio is restored, never rewritten.\n`,
      "Markdown",
    ),
    fileEntry(
      "LOCK.md",
      `# Lock\n\n- \`node scripts/kiln-lock.mjs --check\`\n- \`node scripts/kiln-lock.mjs --restore\`\n- Boot runs restore before the static server.\n- Marketing routes are not locked.\n`,
      "Markdown",
    ),
  ];
  if (lockSrc) lockFiles.push(fileEntry("kiln-lock.mjs", lockSrc.slice(0, 8000), "JavaScript"));
  if (lockJson) lockFiles.push(fileEntry("LOCK.json", lockJson.slice(0, 8000), "JSON"));
  if (lockPaper) lockFiles.push(fileEntry("papers/KILN-WP-19.md", lockPaper, "Markdown"));

  const infraPaper = readText("public/freeze/KILN-WP-20.md", 80_000);
  const infraPy = readText("python/kiln/physics.py", 80_000);
  const infraTools = readText("python/kiln/tools.py", 80_000);
  const infraFiles = [
    fileEntry(
      "README.md",
      `# kiln/infra\n\nPython infrastructure models. Merkle, lock, machine, capsule, physics. Callable as kiln_* tools during a build.\n`,
      "Markdown",
    ),
    fileEntry(
      "PHYSICS.md",
      `# Laws\n\n1. Hash conservation. Same bytes, same SHA-256.\n2. Odd merkle leaf is duplicated.\n3. A write moves the root.\n4. Isolation is the repo id. Blob origins do not cross trees.\n5. Preview is isolatePreview — unique origin, sandbox allow-scripts allow-forms.\n`,
      "Markdown",
    ),
  ];
  if (infraPy) infraFiles.push(fileEntry("python/kiln/physics.py", infraPy.slice(0, 8000), "Python"));
  if (infraTools) infraFiles.push(fileEntry("python/kiln/tools.py", infraTools.slice(0, 8000), "Python"));
  if (infraPaper) infraFiles.push(fileEntry("papers/KILN-WP-20.md", infraPaper, "Markdown"));



  const studioSrc = readText("public/assets/studio-tabs.js", 80_000);
  const studioFiles = [
    fileEntry(
      "README.md",
      `# kiln/studio\n\nAgentic Studio. Tabs: Crew · Import · One-shot · Computer · CLI.\nAgents git-commit. Import uses the same zipball engine as New.\n`,
      "Markdown",
    ),
    fileEntry(
      "STUDIO.md",
      `# Surface\n\n- Crew sits on a repository and writes files as commits.\n- Import looks up any public GitHub tree and seals it.\n- Computer is kilnsh (ls, cat, git, node, python, write).\n- CLI is the same MCP tools agents use.\n`,
      "Markdown",
    ),
  ];
  if (studioSrc) studioFiles.push(fileEntry("studio-tabs.js", studioSrc.slice(0, 8000), "JavaScript"));
  studioFiles.push(
    fileEntry(
      "constitution.json",
      JSON.stringify(
        {
          repo: "kiln/studio",
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
      "JSON",
    ),
    fileEntry(
      "graph.json",
      JSON.stringify(
        {
          repo: "kiln/studio",
          edges: [
            { from: "conductor", to: "architect", kind: "plan", label: "plan the tree" },
            { from: "conductor", to: "scout", kind: "scout", label: "find the work" },
            { from: "architect", to: "builder", kind: "build", label: "implement the map" },
            { from: "builder", to: "reviewer", kind: "review", label: "read the diff" },
            { from: "reviewer", to: "builder", kind: "build", label: "request changes" },
            { from: "reviewer", to: "deployer", kind: "ship", label: "ship on approve" },
            { from: "conductor", to: "cipher", kind: "seal", label: "verify the vault" },
            { from: "conductor", to: "indexer", kind: "index", label: "keep memory honest" },
            { from: "deployer", to: "conductor", kind: "ship", label: "report preview" },
          ],
        },
        null,
        2,
      ) + "\n",
      "JSON",
    ),
    fileEntry("mailbox.json", JSON.stringify({ repo: "kiln/studio", messages: [] }, null, 2) + "\n", "JSON"),
    fileEntry("src/index.ts", 'export const boot = () => {\n  console.log("kiln/studio kernel");\n};\nboot();\n', "TypeScript"),
    fileEntry(
      "src/kernel.ts",
      '/** Crew kernel for kiln/studio. A write is a git commit. */\nexport const ROLES = ["conductor", "architect", "builder", "reviewer", "deployer", "cipher", "indexer"] as const;\nexport function seat(role: (typeof ROLES)[number]) {\n  return { role, repo: "kiln/studio", write: "kiln_write_file" };\n}\n',
      "TypeScript",
    ),
  );

  const computerSrc = readText("public/assets/computer-G9ZCRY5O.js", 80_000);
  const computerFiles = [
    fileEntry(
      "README.md",
      `# kiln/computer\n\nKilnsh on a repository. ls, cat, git, node, python, write, machine, model, memory, domain, ledger, seal. A write is a git commit.\nPorts: capsule 443 · mcp 7331 · node 3000 · python 8000 · webgpu 7840.\n`,
      "Markdown",
    ),
    fileEntry("package.json", JSON.stringify({ name: "kiln-computer", type: "module", private: true }, null, 2), "JSON"),
  ];
  if (computerSrc) computerFiles.push(fileEntry("computer.mjs", computerSrc.slice(0, 8000), "JavaScript"));

  const machineSrc = readText("public/assets/machine-seal.js", 80_000);
  const machinePaper = readText("public/freeze/KILN-WP-14.md", 80_000);
  const machineFiles = [
    fileEntry(
      "README.md",
      `# kiln/machine\n\nKILN treats every Git tree as its own sealed machine — shell, memory, models, preview domain, ledger.\n\nIsolation is the repo id. Banks, cwd, bound model, blob origin, and ledger root do not cross trees.\n`,
      "Markdown",
    ),
    fileEntry(
      "MACHINE.md",
      `# Sealed machine\n\nFive facets:\n\n1. Shell — kilnsh, cwd, env, processes, ports\n2. Memory — working / episodic / semantic / procedural / lattice / folder, scoped to this tree\n3. Models — bound model id, agents inherit, MACHINE.json is a commit\n4. Preview domain — owner-name.kiln.app + blob origin, sandbox without allow-same-origin\n5. Ledger — Merkle of this tree's files, commits, and txs\n\n    / % machine\n    / % model\n    / % memory banks\n    / % domain\n    / % ledger\n    / % seal\n`,
      "Markdown",
    ),
    fileEntry(
      "kiln.json",
      JSON.stringify(
        {
          spec: "kiln-machine/v1",
          name: "machine",
          owner: "kiln",
          facets: ["shell", "memory", "models", "domain", "ledger"],
          isolation: "kiln://kiln/machine.git",
        },
        null,
        2,
      ),
      "JSON",
    ),
  ];
  if (machineSrc) machineFiles.push(fileEntry("machine-seal.js", machineSrc.slice(0, 8000), "JavaScript"));
  if (machinePaper) machineFiles.push(fileEntry("papers/KILN-WP-14.md", machinePaper, "Markdown"));


  const agentSrc = readText("scripts/agent-turn.mjs", 80_000);
  const agentFiles = [
    fileEntry(
      "README.md",
      `# kiln/agents\n\nSame-origin agent turn. Grok calls kiln_write_file, kiln_run, kiln_create_branch. Settlement is a git commit on the repo computer.\n`,
      "Markdown",
    ),
    fileEntry(
      "AGENTS.md",
      `# Agents\n\nA write is git commit. Sit on a repository. Use kiln_write_file. Never claim a file landed that you did not commit.\n`,
      "Markdown",
    ),
  ];
  if (agentSrc) agentFiles.push(fileEntry("agent-turn.mjs", agentSrc.slice(0, 8000), "JavaScript"));

  let mouseFiles = [
    fileEntry(
      "README.md",
      `# kiln/mouse\n\nFork of reagent-systems/mouse onto KILN. Gesture-driven iOS/Android shell treated as a live computer.\n\nImport the public GitHub zipball from Studio → Import, or sit a builder here.\n`,
      "Markdown",
    ),
    fileEntry(
      "FORK.md",
      `# Experiment\n\nSource: https://github.com/reagent-systems/mouse\nSealed under the kiln account. Agents write the next file as a git commit on this tree.\n`,
      "Markdown",
    ),
  ];
  try {
    const packed = await githubImportTree({ owner: "reagent-systems", repo: "mouse" });
    if (packed?.ok && Array.isArray(packed.files) && packed.files.length) {
      const take = packed.files.slice(0, 80);
      mouseFiles = [
        fileEntry(
          "README.md",
          `# kiln/mouse\n\nSealed from reagent-systems/mouse (${packed.via || "zip"}, ${packed.files.length} files).\nThis tree is a Kiln computer. Fork it. Sit a builder on it.\n`,
          "Markdown",
        ),
        fileEntry(
          "IMPORT.json",
          JSON.stringify(
            {
              source: "https://github.com/reagent-systems/mouse",
              via: packed.via,
              files: packed.files.length,
              kept: take.length,
              sha: packed.meta?.sha || packed.sha,
              branch: packed.meta?.defaultBranch || packed.branch,
            },
            null,
            2,
          ),
          "JSON",
        ),
        ...take.map((f) => fileEntry(f.path, String(f.content || "").slice(0, 4000), langOf(f.path))),
      ];
    }
  } catch (e) {
    mouseFiles.push(fileEntry("IMPORT_ERROR.md", String(e?.message || e), "Markdown"));
  }

  const dropName =
    String(branch)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "sealed";
  const dropFiles = [
    fileEntry(
      "README.md",
      `# kiln/${dropName}\n\nTech drop published by the kiln account.\n\nMerkle \`${merkle}\`\nBranch \`${branch}\`\n`,
      "Markdown",
    ),
    fileEntry("MANIFEST.json", JSON.stringify({ pool: manifest?.pool, branch, merkle, files: filesCount }, null, 2), "JSON"),
  ];

  const repos = [
    repo({
      id: "kiln/kiln",
      name: "kiln",
      description: "Origin repository of the forge. Published by the kiln account. Fork, remix, branch, computer, agents.",
      files: kilnFiles,
      topics: ["origin", "kiln", "forge", "merkle"],
    }),
    repo({
      id: "kiln/import-engine",
      name: "import-engine",
      description: "Public GitHub zipball import engine. Account import, lookup, seal. Same engine as Studio Import.",
      files: engineFiles,
      topics: ["import", "github", "zipball"],
    }),
    repo({
      id: "kiln/hash-pool",
      name: "hash-pool",
      description: "Content-addressed hash pools and Merkle freeze branches.",
      files: poolFiles,
      topics: ["hash-pool", "merkle", "cas"],
    }),
    repo({
      id: "kiln/lock",
      name: "lock",
      description: "Boot-time restore of Studio, Grok chat, and the original HTML from CAS.",
      files: lockFiles,
      topics: ["lock", "cas", "studio", "grok"],
    }),
    repo({
      id: "kiln/infra",
      name: "infra",
      description: "Python infrastructure models. Real hashes. Grok calls them as tools.",
      files: infraFiles,
      topics: ["python", "physics", "merkle", "capsule", "preview"],
    }),
    repo({
      id: "kiln/studio",
      name: "studio",
      description: "Agentic Studio: crew, GitHub import, one-shot, computer, CLI. Agents git-commit.",
      files: studioFiles,
      topics: ["studio", "agents", "crew", "import"],
    }),
    repo({
      id: "kiln/mouse",
      name: "mouse",
      description: "reagent-systems/mouse sealed onto KILN. Gesture shell as a live computer.",
      files: mouseFiles,
      topics: ["mouse", "imported", "swift", "fork"],
    }),
    repo({
      id: "kiln/computer",
      name: "computer",
      description: "Kilnsh: ls, cat, git, node, python, write. Every repository is a computer.",
      files: computerFiles,
      topics: ["computer", "kilnsh", "node", "python"],
    }),
    repo({
      id: "kiln/agents",
      name: "agents",
      description: "Agent turn kernel. kiln_write_file is a git commit. Crews code on the tree.",
      files: agentFiles,
      topics: ["agents", "kernel", "grok", "mcp"],
    }),
    repo({
      id: "kiln/machine",
      name: "machine",
      description: "Every Git tree is its own sealed machine — shell, memory, models, preview domain, ledger.",
      files: machineFiles,
      topics: ["machine", "seal", "isolation", "ledger", "domain"],
    }),
  ];
  if (!["kiln", "import-engine", "hash-pool", "lock", "infra", "studio", "mouse", "computer", "agents", "machine"].includes(dropName)) {
    repos.push(
      repo({
        id: `kiln/${dropName}`,
        name: dropName,
        description: `Sealed tech drop ${branch}. Merkle ${String(merkle).slice(0, 16)}.`,
        files: dropFiles,
        topics: ["release", "freeze", branch],
      }),
    );
  }

  return {
    spec: "kiln-account/v1",
    account,
    publishedAt: new Date().toISOString(),
    branch,
    merkle,
    repos,
  };
}

export async function publishKilnAccount(manifest) {
  const doc = await build(manifest || {});
  const out = path.join(ROOT, "public", "kiln-account.json");
  fs.writeFileSync(out, JSON.stringify(doc));
  return doc;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const headPath = path.join(ROOT, "public", "freeze", "HEAD.json");
  const manifest = fs.existsSync(headPath) ? JSON.parse(fs.readFileSync(headPath, "utf8")) : {};
  const doc = await publishKilnAccount(manifest);
  console.log(`kiln account ${doc.account.handle} ${doc.repos.length} repos ${doc.repos.map((r) => r.id).join(" ")}`);
}
