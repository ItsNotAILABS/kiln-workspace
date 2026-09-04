import { b as store, d as allRepos } from "./store-sx46DNi5.js";
import { c as fmtBytes, n as FOLDER_QUOTA, o as readFile, s as folderUsed } from "./fs-ri9Mkfbm.js";
import { n as runPython } from "./python-EZBTjN7I.js";
import { gpuMix, probeGpu } from "./gpu-Bs1r2h0p.js";
import { r as listDir } from "./model-dm89L9bG.js";

const machines = new Map();

function state() {
  return store.getState();
}
function repoOf(id) {
  return allRepos(state()).find((r) => r.id === id);
}
function hostOf(repo) {
  return `${repo.owner}-${repo.name}.kiln.app`;
}
function banner(repo) {
  const n = (repo.files || []).length;
  return [
    `kiln computer  ${repo.id}`,
    `cipher AES-256-GCM`,
    `model ${repo.modelId || "grok-4.6"}`,
    `domain https://${hostOf(repo)}`,
    `ports 443,7331,7840,8000,8443`,
    repo.githubUrl ? `origin ${repo.githubUrl}` : `origin kiln://${repo.id}.git`,
    `type help. this computer belongs to this repository.`,
  ].join("\n");
}

export function bootMachine(repo) {
  if (!repo) return { cwd: "/", history: [], processes: [], ports: [], env: {} };
  let m = machines.get(repo.id);
  if (!m) {
    m = {
      repoId: repo.id,
      cwd: "/",
      env: {
        KILN_REPO: repo.id,
        KILN_OWNER: repo.owner,
        KILN_NAME: repo.name,
        MODEL: repo.modelId || "grok-4.6",
        DOMAIN: hostOf(repo),
        HOME: "/",
        PATH: "/bin:/usr/bin:/kiln/bin",
      },
      history: [],
      processes: [
        { pid: 1, name: "init", status: "running" },
        { pid: 2, name: "kiln-agentd", status: "running" },
        { pid: 3, name: "kiln-memoryd", status: "running" },
        { pid: 4, name: "kiln-edged", status: "running" },
        { pid: 5, name: "kiln-indexerd", status: "running" },
      ],
      ports: [
        { port: 443, service: "capsule", proto: "https" },
        { port: 7331, service: "mcp", proto: "mcp" },
        { port: 7840, service: "webgpu", proto: "gpu" },
        { port: 8000, service: "python", proto: "python" },
        { port: 8443, service: "sealed-cloud", proto: "cloud" },
      ],
      bootAt: new Date().toISOString(),
    };
    machines.set(repo.id, m);
  }
  return m;
}

function help() {
  return [
    "help                 this list",
    "ls                   list the working tree",
    "tree                 same, nested",
    "pwd  env  ps  date  whoami  uname",
    "git status | log | clone | remote | branch",
    "node [file.js]       run JavaScript on this computer",
    "python [file.py]     run Python on port 8000",
    "gpu                  probe WebGPU + mix a Merkle leaf",
    "memory search [q]    folder + Hilbert lattice + mailbox",
    "kiln ls | cat | quota | crew | domain | ports",
    "kiln agent spawn     resident indexer",
    "kiln action run      settle.yml on this machine",
    "cat <path>  head <path>",
  ].join("\n");
}

function treeText(files, cwd) {
  const prefix = cwd && cwd !== "/" ? cwd.replace(/^\//, "").replace(/\/?$/, "/") : "";
  const rows = listDir(files, prefix);
  return rows
    .map((e) => (e.type === "dir" ? `dir  ${e.name}/` : `file ${e.file?.path}  ${e.file?.size ?? 0}B  ${e.file?.sha || ""}`))
    .join("\n") || "(empty)";
}

function nestedTree(files) {
  const lines = [];
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted.slice(0, 80)) {
    const parts = f.path.split("/");
    lines.push("  ".repeat(Math.max(0, parts.length - 1)) + parts.at(-1) + `  ${f.size || 0}`);
  }
  if (sorted.length > 80) lines.push(`… ${sorted.length - 80} more`);
  return lines.join("\n");
}

async function catFile(repo, path, nlines) {
  const file = (repo.files || []).find((f) => f.path === path || f.path.endsWith("/" + path));
  if (!file) return { code: 1, out: `cat: ${path}: no such file` };
  const secret = state().wallet ? undefined : undefined;
  let text = file.content || "";
  if (!text && file.blobId) {
    try {
      text = await readFile(file, state().wallet?.secret);
    } catch {
      text = `[sealed ${file.size || 0}B]`;
    }
  }
  if (nlines) text = String(text).split("\n").slice(0, nlines).join("\n");
  return { code: 0, out: String(text) };
}

async function runJs(src) {
  const logs = [];
  try {
    Function("console", `"use strict";\n${src}`)({
      log: (...a) => logs.push(a.map(String).join(" ")),
    });
    return { code: 0, out: logs.join("\n") || "(ok)" };
  } catch (e) {
    return { code: 1, out: e instanceof Error ? e.message : String(e) };
  }
}

export async function runOnMachine(repoId, command) {
  const repo = repoOf(repoId);
  if (!repo) return { code: 1, out: `no computer for ${repoId}` };
  const m = bootMachine(repo);
  const raw = String(command || "").trim();
  const [bin, ...rest] = raw.split(/\s+/);
  const arg = rest.join(" ");
  let code = 0;
  let out = "";
  try {
    switch (bin) {
      case "help":
      case "":
        out = help();
        break;
      case "pwd":
        out = m.cwd;
        break;
      case "whoami":
        out = state().wallet?.handle || repo.owner;
        break;
      case "uname":
        out = `Kiln ${repo.id} kilnsh AES-256-GCM grok ${repo.modelId || "grok-4.6"}`;
        break;
      case "date":
        out = new Date().toISOString();
        break;
      case "env":
        out = Object.entries(m.env)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n");
        break;
      case "ps":
        out = m.processes.map((p) => `${p.pid}\t${p.name}\t${p.status}`).join("\n");
        break;
      case "ls":
        out = treeText(repo.files || [], arg || m.cwd);
        break;
      case "tree":
        out = nestedTree(repo.files || []);
        break;
      case "cd": {
        const next = arg || "/";
        m.cwd = next.startsWith("/") ? next : (m.cwd.replace(/\/?$/, "/") + next);
        out = m.cwd;
        break;
      }
      case "cat":
        ({ code, out } = await catFile(repo, arg || rest[0], 0));
        break;
      case "head":
        ({ code, out } = await catFile(repo, rest[0] || arg, 16));
        break;
      case "git": {
        const sub = rest[0] || "status";
        const branches = (state().userBranches || []).filter((b) => b.repoId === repo.id);
        if (sub === "status")
          out = `on ${repo.defaultBranch || "main"}\norigin kiln://${repo.id}.git${repo.githubUrl ? "\nupstream " + repo.githubUrl : ""}\n${(repo.files || []).length} files · merkle ${repo.merkleRoot || "pending"}`;
        else if (sub === "log")
          out = (state().userCommits || [])
            .concat([])
            .filter((c) => c.repoId === repo.id)
            .slice(0, 8)
            .map((c) => `${c.sha}  ${c.message}`)
            .join("\n") || `${(repo.defaultBranch || "main")}  genesis`;
        else if (sub === "clone") out = `git clone kiln://${repo.id}.git`;
        else if (sub === "remote")
          out = [`origin\tkiln://${repo.id}.git`, repo.githubUrl ? `github\t${repo.githubUrl}` : null]
            .filter(Boolean)
            .join("\n");
        else if (sub === "branch")
          out = (branches.length ? branches : [{ name: repo.defaultBranch || "main" }])
            .map((b) => `* ${b.name}  ${b.sha || ""}`)
            .join("\n");
        else out = `git ${sub}`;
        break;
      }
      case "node": {
        const path = rest[0];
        if (!path) {
          out = (repo.files || [])
            .filter((f) => /\.m?js$/.test(f.path))
            .map((f) => f.path)
            .join("\n") || "no .js files";
          break;
        }
        const file = (repo.files || []).find((f) => f.path === path);
        ({ code, out } = await runJs(file?.content || arg));
        break;
      }
      case "python": {
        const path = rest[0];
        const file = path ? (repo.files || []).find((f) => f.path === path) : null;
        const src = file?.content || (path ? "" : arg);
        if (path && !file) {
          code = 1;
          out = `python: ${path}: no such file`;
          break;
        }
        const files = {};
        for (const f of (repo.files || []).filter((f) => f.path.endsWith(".py")).slice(0, 8)) files[f.path] = f.content || "";
        const r = await runPython(src || "print('python:8000')", files);
        code = r.code ?? (r.ok ? 0 : 1);
        out = [r.out || r.stdout, r.err || r.stderr].filter(Boolean).join("\n") || "(ok)";
        break;
      }
      case "gpu": {
        const probe = await probeGpu();
        const mix = await gpuMix(new TextEncoder().encode(repo.readme || repo.id));
        out = JSON.stringify({ adapter: probe.adapter, available: probe.available, via: mix.via, hex: mix.hex, port: 7840 }, null, 2);
        try {
          state().setGpuBound?.(probe.available);
        } catch {}
        break;
      }
      case "memory": {
        const { searchAllMemory } = await import("./memory-DWov_Aom.js").then((e) => e.n);
        const q = rest[0] === "search" ? rest.slice(1).join(" ") : arg;
        const hits = await searchAllMemory(
          repo,
          q,
          state().wallet?.secret,
          {
            mailbox: (state().agents || []).filter((a) => a.repoId === repo.id).flatMap((a) => (a.mailbox ?? []).map((x) => x.body)),
            cwd: m.cwd,
            logs: m.history.map((h) => h.cmd),
            messages: Object.values(state().agentMessages || {}).flat(),
            toolsUsed: ["kiln_write_file", "kiln_handoff", "kiln_run", "kiln_deploy"],
            agents: (state().agents || []).filter((a) => a.repoId === repo.id),
          },
        );
        out = hits.map((h) => `${h.kind}  ${h.path}:${h.line}  cell ${h.cell}  ${h.snippet}`).join("\n") || "No memory hits.";
        break;
      }
      case "kiln": {
        const sub = rest[0] || "ls";
        if (sub === "ls") out = treeText(repo.files || [], rest[1] || m.cwd);
        else if (sub === "cat") ({ code, out } = await catFile(repo, rest.slice(1).join(" ")));
        else if (sub === "quota") {
          const used = folderUsed(repo.files || [], "");
          out = `${repo.id} folder /  ${fmtBytes(used)} / ${fmtBytes(FOLDER_QUOTA)}  merkle ${repo.merkleRoot ?? "pending"}  sealed=${repo.encrypted}`;
        } else if (sub === "crew") {
          const agents = (state().agents || []).filter((a) => a.repoId === repo.id);
          const crew = (state().crews || []).find((c) => c.repoId === repo.id);
          out = [
            crew ? `crew ${crew.id} · ${crew.name}` : "no crew record — spawn one in Studio",
            ...agents.map((a) => `${a.name}  ${a.role}  ${a.status}  seat ${a.workingPath ?? "—"}`),
            agents.length ? "" : "Indra  indexer  idle  seat README.md",
          ]
            .filter(Boolean)
            .join("\n");
        } else if (sub === "domain" || sub === "ports") {
          out = m.ports.map((p) => `${p.port}  ${p.service}  ${p.proto}`).join("\n") + `\nhttps://${hostOf(repo)}`;
        } else if (sub === "agent") {
          out = "kiln agent spawn · open Studio to seat a crew (Ada, Bram, Reeve, Dahl, Cyril, Indra)";
        } else if (sub === "action") {
          try {
            const run = await state().runAction(repo.id, rest[2] || "settle.yml");
            out = `${run.workflow} ${run.status}\n${(run.logs || []).join("\n")}`;
          } catch (e) {
            out = e instanceof Error ? e.message : "action failed";
            code = 1;
          }
        } else out = `kiln ${sub}`;
        break;
      }
      default:
        if (!bin) out = help();
        else {
          code = 127;
          out = `kilnsh: ${raw}: command not found\ntype help.`;
        }
    }
  } catch (e) {
    code = 1;
    out = e instanceof Error ? e.message : String(e);
  }
  m.history = [...m.history, { cmd: raw, out, code }].slice(-80);
  return { code, out };
}

export const n = { bootMachine, runOnMachine };
