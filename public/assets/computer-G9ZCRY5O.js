
import { A as MODELS, b as store, d as allRepos } from "./store-sx46DNi5.js";
import { c as fmtBytes, n as FOLDER_QUOTA, o as readFile, s as folderUsed } from "./fs-ri9Mkfbm.js";
import { n as runPython } from "./python-EZBTjN7I.js";
import { gpuMix, probeGpu } from "./gpu-Bs1r2h0p.js";
import { r as listDir } from "./model-dm89L9bG.js";
import {
  BANKS,
  bankSummary,
  bindModel,
  compareMachines,
  dumpMachine,
  facetView,
  isolationProof,
  persistShell,
  probeIsolation,
  remember,
  sealMachine,
  searchBanks,
} from "./machine-seal.js";

const machines = new Map();
function state() {
  return store.getState();
}
function repoOf(id) {
  return allRepos(state()).find((r) => r.id === id);
}
function hostOf(repo) {
  return `${repo.owner}-${repo.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-") + ".kiln.app";
}

export function bootMachine(repo) {
  if (!repo) return { cwd: "/", history: [], processes: [], ports: [], env: {} };
  let m = machines.get(repo.id);
  const sealed = globalThis.__KILN_MACHINES?.[repo.id];
  if (!m) {
    m = {
      repoId: repo.id,
      cwd: sealed?.shell?.cwd || "/",
      env: {
        KILN_REPO: repo.id,
        KILN_OWNER: repo.owner,
        KILN_NAME: repo.name,
        KILN_ISOLATION: `kiln://${repo.id}.git`,
        MODEL: repo.modelId || sealed?.models?.bound || "grok-4.6",
        DOMAIN: hostOf(repo),
        HOME: "/",
        PATH: "/bin:/usr/bin:/kiln/bin",
        ...(sealed?.shell?.env || {}),
      },
      history: sealed?.shell?.history || [],
      processes: sealed?.shell?.processes || [
        { pid: 1, name: "init", status: "running" },
        { pid: 2, name: "kiln-agentd", status: "running" },
        { pid: 3, name: "kiln-memoryd", status: "running" },
        { pid: 4, name: "kiln-edged", status: "running" },
        { pid: 5, name: "kiln-indexerd", status: "running" },
        { pid: 6, name: "kiln-ledgerd", status: "running" },
      ],
      ports: sealed?.shell?.ports || [
        { port: 443, service: "capsule", proto: "https" },
        { port: 7331, service: "mcp", proto: "mcp" },
        { port: 3000, service: "node", proto: "node" },
        { port: 7840, service: "webgpu", proto: "gpu" },
        { port: 8000, service: "python", proto: "python" },
        { port: 8443, service: "sealed-cloud", proto: "cloud" },
      ],
      bootAt: sealed?.shell?.bootAt || new Date().toISOString(),
    };
    machines.set(repo.id, m);
    sealMachine(repo).then((sm) => {
      m.env = { ...m.env, ...(sm.shell?.env || {}) };
      persistShell(repo.id, { cwd: m.cwd, env: m.env, history: m.history, processes: m.processes, ports: m.ports });
    });
  }
  return m;
}

function help() {
  return [
    "help                 this list",
    "machine              dump the sealed machine (five facets)",
    "ls [path]            list the working tree",
    "tree                 nested paths",
    "pwd  env  ps  date  whoami  uname",
    "cd <path>            change cwd (this tree)",
    "cat <path>  head <path>  tail [-n N|+N] <path>  wc <path>",
    "find [name]          paths on this tree",
    "git status | log | branch [name] | remote | ls-tree",
    "node [file.js]       run JavaScript on this computer",
    "python [file.py]     run Python on port 8000",
    "wsl [cmd]            bash on this repo's computer (real cwd)",
    "pwsh [cmd]           sovereign power shell on this computer",
    "write <path> << body commit a file",
    "model [id]           bound model on this tree",
    "memory [search q]    folder + banks scoped to this tree",
    "memory remember <bank> <text>",
    "domain               kiln.app host + blob origin",
    "ledger               Merkle of this tree's commits and txs",
    "seal                 isolation proof — this tree only",
    "compare <owner/name> five-facet proof vs another tree",
    "probe <owner/name>   plant a secret here, search the other tree",
    "gpu                  probe WebGPU + mix a Merkle leaf",
    "kiln ls | cat | quota | crew | domain | ports | machine",
  ].join("\n");
}
function treeText(files, cwd) {
  const prefix = cwd && cwd !== "/" ? cwd.replace(/^\//, "").replace(/\/?$/, "/") : "";
  const rows = listDir(files, prefix);
  return rows.map((e) => (e.type === "dir" ? `dir  ${e.name}/` : `file ${e.file?.path}  ${e.file?.size ?? 0}B  ${e.file?.sha || ""}`)).join("\n") || "(empty)";
}
function resolvePath(cwd, p) {
  if (!p || p === ".") return cwd === "/" ? "" : cwd.replace(/^\//, "");
  if (p.startsWith("/")) return p.replace(/^\//, "");
  const base = cwd === "/" ? "" : cwd.replace(/^\//, "");
  const parts = (base ? base.split("/") : []).concat(p.split("/"));
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}
async function fileBody(repo, path) {
  const file = (repo.files || []).find((f) => f.path === path || f.path.endsWith("/" + path));
  if (!file) return null;
  let text = file.content || "";
  if (!text && file.blobId) {
    try {
      text = await readFile(file, state().wallet?.secret);
    } catch {
      text = `[sealed ${file.size || 0}B]`;
    }
  }
  return { file, text: String(text) };
}
async function catFile(repo, path, nlines) {
  const got = await fileBody(repo, path);
  if (!got) return { code: 1, out: `cat: ${path}: no such file` };
  let text = got.text;
  if (nlines) text = text.split("\n").slice(0, nlines).join("\n");
  return { code: 0, out: text };
}
async function runRemote(lang, source, repo, command, shell) {
  try {
    const files = (repo?.files || [])
      .filter((f) => typeof f.content === "string")
      .slice(0, 80)
      .map((f) => ({ path: f.path, content: f.content }));
    const r = await fetch("/api/kiln/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang, source, command, shell, repoId: repo?.id, files }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (d && typeof d.out === "string") return { code: d.code ?? (d.ok ? 0 : 1), out: d.out };
  } catch {}
  return null;
}
function runNode(src) {
  const logs = [];
  const fake = {
    log: (...a) => logs.push(a.map(String).join(" ")),
    info: (...a) => logs.push(a.map(String).join(" ")),
    warn: (...a) => logs.push(a.map(String).join(" ")),
    error: (...a) => logs.push(a.map(String).join(" ")),
  };
  try {
    const fn = new Function("console", "module", "exports", `"use strict";\n${src}\n`);
    const mod = { exports: {} };
    const result = fn(fake, mod, mod.exports);
    if (result !== undefined) logs.push(String(result));
    return { code: 0, out: logs.join("\n") || "(ok)" };
  } catch (e) {
    return { code: 1, out: e instanceof Error ? e.message : String(e) };
  }
}

async function withSealed(repo, m) {
  const sm = await sealMachine(repo);
  persistShell(repo.id, { cwd: m.cwd, env: m.env, history: m.history, processes: m.processes, ports: m.ports });
  return sm;
}

export async function runOnMachine(repoId, command) {
  const rawAll = String(command || "").trim();
  if (/[;\n]/.test(rawAll) && !/^(write|tee)\b/.test(rawAll)) {
    const parts = rawAll
      .split(/\n|;|&&/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      const outs = [];
      let code = 0;
      for (const part of parts) {
        const r = await runOnMachine(repoId, part);
        outs.push(`$ ${part}\n${r.out}`);
        if (r.code) code = r.code;
      }
      return { code, out: outs.join("\n\n") };
    }
  }
  const repo = repoOf(repoId);
  if (!repo) return { code: 1, out: `no computer for ${repoId}` };
  const m = bootMachine(repo);
  const raw = rawAll;
  const [bin, ...rest] = raw.split(/\s+/);
  const arg = rest.join(" ");
  let code = 0,
    out = "";
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
        out = `Kiln ${repo.id} kilnsh AES-256-GCM ${repo.modelId || "grok-4.6"} sealed-machine`;
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
      case "cd": {
        const next = "/" + resolvePath(m.cwd, rest[0] || "/");
        m.cwd = next === "/" ? "/" : next.replace(/\/+$/, "") || "/";
        out = m.cwd;
        break;
      }
      case "ls":
        out = treeText(repo.files || [], arg || m.cwd);
        break;
      case "tree":
        out = (repo.files || [])
          .map((f) => f.path)
          .slice(0, 120)
          .join("\n");
        break;
      case "cat":
        ({ code, out } = await catFile(repo, resolvePath(m.cwd, arg || rest[0]), 0));
        break;
      case "head":
        ({ code, out } = await catFile(repo, resolvePath(m.cwd, rest[0] || arg), 16));
        break;
      case "git": {
        const sub = rest[0] || "status";
        const st = state();
        if (sub === "status") out = `on ${repo.defaultBranch || "main"}\norigin kiln://${repo.id}.git\n${(repo.files || []).length} files\nsealed machine · ${repo.modelId || "grok-4.6"} · ${hostOf(repo)}`;
        else if (sub === "clone") out = `git clone kiln://${repo.id}.git`;
        else if (sub === "remote") out = `origin\tkiln://${repo.id}.git`;
        else if (sub === "log")
          out =
            (st.userCommits || [])
              .filter((c) => c.repoId === repo.id)
              .slice(0, 12)
              .map((c) => `${c.sha}  ${c.message}`)
              .join("\n") || "(no commits yet)";
        else if (sub === "ls-tree" || sub === "ls-files")
          out = (repo.files || []).map((f) => `${f.sha || "k" + (f.path || "").slice(0, 7)}  ${f.path}`).join("\n") || "(empty)";
        else if (sub === "branch") {
          const name = rest[1];
          if (name) {
            let wst = state();
            if (!wst.wallet && globalThis.__KILN_ENSURE_WALLET) await globalThis.__KILN_ENSURE_WALLET();
            wst = state();
            if (!wst.wallet) {
              code = 1;
              out = "Connect a wallet to branch";
              break;
            }
            let target = repo.id;
            if ((repoOf(target) || repo).owner !== wst.wallet.handle) {
              const forked = await wst.fork(target);
              if (!forked) {
                code = 1;
                out = "branch failed — could not fork";
                break;
              }
              target = forked.id;
            }
            const b = await wst.createBranch(target, name);
            out = `created ${b.name} @ ${b.sha} on ${target}`;
          } else {
            const bs = (st.userBranches || []).filter((b) => b.repoId === repo.id);
            out = (bs.length ? bs.map((b) => b.name) : [repo.defaultBranch || "main"]).join("\n");
          }
        } else out = `git ${sub}`;
        break;
      }
      case "node": {
        const path = resolvePath(m.cwd, rest[0] || "");
        const got = path ? await fileBody(repo, path) : null;
        const src = got?.text || (rest[0] ? "" : arg) || "console.log('node')";
        if (rest[0] && !got) {
          code = 1;
          out = `node: ${rest[0]}: no such file`;
          break;
        }
        ({ code, out } = (await runRemote("js", src, repo)) || runNode(src));
        break;
      }
      case "python": {
        const path = resolvePath(m.cwd, rest[0] || "");
        const got = path ? await fileBody(repo, path) : null;
        const src = got?.text || (path && rest[0] ? "" : arg) || "print('python:8000')";
        if (rest[0] && !got && path) {
          code = 1;
          out = `python: ${rest[0]}: no such file`;
          break;
        }
        const remote = await runRemote("python", src, repo);
        if (remote) {
          ({ code, out } = remote);
          break;
        }
        const r = await runPython(src, {});
        code = r.code ?? 0;
        out = [r.out || r.stdout, r.err || r.stderr].filter(Boolean).join("\n") || "(ok)";
        break;
      }
      case "echo":
        out = arg;
        break;
      case "find": {
        const needle = rest.find((x) => x !== "." && x !== "-name" && x !== "-type") || "";
        out =
          (repo.files || [])
            .map((f) => f.path)
            .filter((p) => !needle || p.includes(needle.replace(/^\*\./, ".").replace(/\*/g, "")))
            .slice(0, 200)
            .join("\n") || "(empty)";
        break;
      }
      case "wc": {
        const path = resolvePath(m.cwd, rest.filter((x) => !x.startsWith("-")).pop() || "");
        const got = path ? await fileBody(repo, path) : null;
        if (!got) {
          code = 1;
          out = `wc: ${path || "(no file)"}: no such file`;
          break;
        }
        const lines = got.text.split("\n").length;
        const words = got.text.trim() ? got.text.trim().split(/\s+/).length : 0;
        out = `${lines} ${words} ${got.text.length} ${path}`;
        break;
      }
      case "tail": {
        const nFlag = rest.find((x) => x.startsWith("-n") || x.startsWith("+"));
        let start = 0;
        let count = 10;
        if (nFlag === "-n" || rest.includes("-n")) {
          const idx = rest.findIndex((x) => x === "-n" || x.startsWith("-n"));
          const raw = rest[idx] === "-n" ? rest[idx + 1] : rest[idx].slice(2);
          if (String(raw).startsWith("+")) start = Math.max(0, parseInt(raw, 10) - 1);
          else count = Math.max(1, parseInt(raw, 10) || 10);
        } else if (nFlag && nFlag.startsWith("-n+")) start = Math.max(0, parseInt(nFlag.slice(3), 10) - 1);
        else if (nFlag && nFlag.startsWith("+")) start = Math.max(0, parseInt(nFlag, 10) - 1);
        const path = resolvePath(m.cwd, rest.filter((x) => !x.startsWith("-") && !x.startsWith("+") && x !== "-n").pop() || "");
        const got = path ? await fileBody(repo, path) : null;
        if (!got) {
          code = 1;
          out = `tail: ${path || "(no file)"}: no such file`;
          break;
        }
        const lines = got.text.split("\n");
        out = start ? lines.slice(start).join("\n") : lines.slice(-count).join("\n");
        break;
      }
      case "write":
      case "tee": {
        const path = resolvePath(m.cwd, rest[0] || "");
        if (!path) {
          code = 1;
          out = "usage: write <path> <body>";
          break;
        }
        const body = rest.slice(1).join(" ") || "";
        let st = state();
        if (!st.wallet && globalThis.__KILN_ENSURE_WALLET) await globalThis.__KILN_ENSURE_WALLET();
        st = state();
        if (!st.wallet) {
          code = 1;
          out = "Connect a wallet to write";
          break;
        }
        let target = repo.id;
        const live = repoOf(target) || repo;
        if (live.owner !== st.wallet.handle) {
          const forked = await st.fork(target);
          if (!forked) {
            code = 1;
            out = "write failed — could not fork for write";
            break;
          }
          target = forked.id;
        }
        const rec = await st.commitFile(target, path, body, `kilnsh write ${path}`);
        if (!rec) {
          code = 1;
          out = "write failed — own the tree or fork it first";
          break;
        }
        remember(target, "working", `wrote ${path} ${rec.sha}`, { path });
        out = `wrote ${path} · ${rec.sha} · tx ${rec.txHash || ""} · ${target}`;
        break;
      }
      case "gpu": {
        const probe = await probeGpu();
        const mix = await gpuMix(new TextEncoder().encode(repo.id));
        out = JSON.stringify({ adapter: probe.adapter, available: probe.available, via: mix.via, hex: mix.hex, port: 7840, isolation: `kiln://${repo.id}.git` }, null, 2);
        break;
      }
      case "machine": {
        const sm = await withSealed(repo, m);
        const facet = rest[0];
        out = facet ? facetView(sm, facet) : dumpMachine(sm);
        break;
      }
      case "seal": {
        await withSealed(repo, m);
        out = isolationProof(repo.id);
        break;
      }
      case "compare": {
        const other = rest[0];
        if (!other) {
          code = 1;
          out = "usage: compare owner/name";
          break;
        }
        const otherRepo = repoOf(other);
        if (otherRepo) await sealMachine(otherRepo);
        await withSealed(repo, m);
        const report = compareMachines(repo.id, other);
        if (report.error) {
          code = 1;
          out = report.error;
          break;
        }
        out = [
          `compare  ${report.aId}  vs  ${report.bId}`,
          `verdict  ${report.ok ? "ISOLATED" : "LEAK"}`,
          ...report.checks.map((c) => `${c.pass ? "pass" : "FAIL"}  ${c.facet}.${c.name}\n        ${c.a}  |  ${c.b}${c.note ? `\n        ${c.note}` : ""}`),
        ].join("\n");
        break;
      }
      case "probe": {
        const other = rest[0];
        if (!other) {
          code = 1;
          out = "usage: probe owner/name";
          break;
        }
        const otherRepo = repoOf(other);
        if (otherRepo) await sealMachine(otherRepo);
        await withSealed(repo, m);
        const r = probeIsolation(repo.id, other);
        out = [
          `planted  ${r.token}`,
          `source   ${repo.id}  hits ${r.sourceHits}`,
          `other    ${other}  hits ${r.otherHits}`,
          r.pass ? "verdict  secret stayed on this tree" : "verdict  LEAK — other tree could read the working bank",
        ].join("\n");
        break;
      }
      case "model": {
        if (rest[0]) {
          try {
            const sm = await bindModel(repo.id, rest[0]);
            m.env.MODEL = sm.models.bound;
            out = `bound ${sm.models.bound} (${sm.models.label}) on ${repo.id}`;
          } catch (e) {
            code = 1;
            out = e instanceof Error ? e.message : String(e);
            out += `\ncatalog:\n${(MODELS || []).map((x) => `  ${x.id}`).join("\n")}`;
          }
        } else {
          const sm = await withSealed(repo, m);
          out = facetView(sm, "models");
        }
        break;
      }
      case "memory": {
        const { searchAllMemory } = await import("./memory-DWov_Aom.js").then((e) => e.n);
        if (rest[0] === "remember") {
          const kind = BANKS.includes(rest[1]) ? rest[1] : "working";
          const text = BANKS.includes(rest[1]) ? rest.slice(2).join(" ") : rest.slice(1).join(" ");
          if (!text) {
            code = 1;
            out = "usage: memory remember <bank> <text>\nbanks: " + BANKS.join(" ");
            break;
          }
          const entry = remember(repo.id, kind, text, { path: "memory/" + kind });
          out = entry ? `remembered ${entry.kind}  ${entry.id}\n${entry.text}` : "machine not sealed";
          break;
        }
        const q = rest[0] === "search" ? rest.slice(1).join(" ") : rest[0] === "banks" ? "" : arg;
        if (rest[0] === "banks" || (!q && rest[0] !== "search")) {
          await withSealed(repo, m);
          out = bankSummary(repo.id);
          break;
        }
        const bankHits = searchBanks(repo.id, q);
        const fileHits = await searchAllMemory(repo, q, state().wallet?.secret, { agents: state().agents.filter((a) => a.repoId === repo.id) });
        const hits = [...bankHits, ...fileHits];
        out = hits.map((h) => `${h.kind}  ${h.path}:${h.line}  ${h.snippet}`).join("\n") || "No memory hits on this tree.";
        break;
      }
      case "domain": {
        const sm = await withSealed(repo, m);
        try {
          state().ensureDomain?.(repo.id);
        } catch {}
        out = facetView(sm, "domain");
        break;
      }
      case "ledger": {
        const sm = await withSealed(repo, m);
        out = facetView(sm, "ledger");
        break;
      }
      case "kiln": {
        const sub = rest[0] || "ls";
        if (sub === "ls") out = treeText(repo.files || [], rest[1] || m.cwd);
        else if (sub === "cat") ({ code, out } = await catFile(repo, resolvePath(m.cwd, rest[1] || ""), 0));
        else if (sub === "quota") {
          const used = folderUsed(repo.files || [], "");
          out = `${repo.id} folder /  ${fmtBytes(used)} / ${fmtBytes(FOLDER_QUOTA)}`;
        } else if (sub === "domain" || sub === "ports") {
          const sm = await withSealed(repo, m);
          out = (sm.shell.ports || []).map((p) => `${p.port}  ${p.service}`).join("\n") + `\nhttps://${hostOf(repo)}`;
        } else if (sub === "crew")
          out =
            (state().agents || [])
              .filter((a) => a.repoId === repo.id)
              .map((a) => `${a.name}  ${a.role}  ${a.status}  ${a.modelId || repo.modelId || ""}`)
              .join("\n") || "no agents";
        else if (sub === "machine") {
          const sm = await withSealed(repo, m);
          out = dumpMachine(sm);
        } else out = `kiln ${sub}`;
        break;
      }
      case "wsl":
      case "bash":
      case "sh":
      case "pwsh":
      case "powershell": {
        const restCmd = rest.join(" ") || (bin === "pwsh" || bin === "powershell" ? "Get-Location" : "pwd");
        const wrapped = bin === "pwsh" || bin === "powershell" ? `pwsh ${restCmd}` : restCmd;
        const remote = await runRemote("bash", "", repo, wrapped, bin === "wsl" || bin === "bash" || bin === "sh" ? "wsl" : "pwsh");
        if (remote) ({ code, out } = remote);
        else {
          code = 1;
          out = "computer offline";
        }
        if (out) out = `${bin} · ${repo.id}\n${out}`;
        break;
      }
      default:
        code = 127;
        out = `kilnsh: ${raw}: command not found\ntype help.`;
    }
  } catch (e) {
    code = 1;
    out = e instanceof Error ? e.message : String(e);
  }
  m.history = [...m.history, { cmd: raw, out, code }].slice(-80);
  persistShell(repo.id, { cwd: m.cwd, env: m.env, history: m.history });
  return { code, out };
}
export const n = { bootMachine, runOnMachine };
