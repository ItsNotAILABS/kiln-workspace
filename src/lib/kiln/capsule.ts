/**
 * Capsule runtime — an isolated preview living inside a git repository.
 * Packs the working tree into a sandboxed document. Live stream is the iframe
 * plus the computer log. Bound models and agents are injected as window.Kiln.
 */
import type { RepoFile } from "./types";

export type CapsuleStatus = "idle" | "booting" | "live" | "stopped" | "error";

export type CapsuleAgent = { name: string; role: string; modelId?: string };

export type Capsule = {
  repoId: string;
  status: CapsuleStatus;
  logs: string[];
  entry: string;
  url?: string;
  error?: string;
  bootedAt?: string;
  assets: number;
  modelId?: string;
  calledAgents?: string[];
};

export type CapsuleBootOpts = {
  modelId?: string;
  agents?: CapsuleAgent[];
};

export function emptyCapsule(repoId: string): Capsule {
  return { repoId, status: "idle", logs: ["capsule cold · git tree idle"], entry: "index.html", assets: 0 };
}

export function stopCapsule(cap: Capsule): Capsule {
  if (cap.url) {
    try {
      URL.revokeObjectURL(cap.url);
    } catch {
      /* already revoked */
    }
  }
  return {
    ...cap,
    status: "stopped",
    url: undefined,
    logs: [...cap.logs, "capsule stopped · runtime revoked"],
  };
}

function pickEntry(files: RepoFile[]): string | null {
  const names = files.map((f) => f.path);
  if (names.includes("index.html")) return "index.html";
  if (names.includes("preview.html")) return "preview.html";
  const html = names.find((p) => p.endsWith(".html"));
  return html ?? null;
}

function rewrite(html: string, blobs: Record<string, string>): string {
  return html.replace(/(?:src|href)=["']([^"']+)["']/g, (m, rel: string) => {
    if (/^(https?:|data:|blob:|\/\/|#)/i.test(rel)) return m;
    const clean = rel.replace(/^\\.\//, "");
    const hit =
      blobs[clean] ||
      blobs[Object.keys(blobs).find((k) => k.endsWith("/" + clean) || k === clean) ?? ""];
    if (!hit) return m;
    return m.replace(rel, hit);
  });
}

function gitCloneLine(repoId: string): string {
  const [owner = "you", name = "repo"] = repoId.split("/");
  return `git clone kiln://${owner}/${name}.git`;
}

function kilnRuntime(repoId: string, modelId: string, agents: CapsuleAgent[]): string {
  const payload = {
    repo: repoId,
    model: { id: modelId, label: modelId },
    git: {
      clone: gitCloneLine(repoId),
      commit: 'git commit -m "message"',
      push: "git push origin main",
      pull: "git pull",
    },
    agents: agents.map((a) => ({ name: a.name, role: a.role, model: a.modelId || modelId })),
  };
  return `<script>window.Kiln=${JSON.stringify(payload)};</script>`;
}

function injectRuntime(html: string, runtime: string): string {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${runtime}</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, `<body$1>${runtime}`);
  return runtime + html;
}

export async function bootCapsule(
  repoId: string,
  files: RepoFile[],
  read: (file: RepoFile) => Promise<string>,
  opts: CapsuleBootOpts = {},
): Promise<Capsule> {
  const modelId = opts.modelId || "grok-4.6";
  const agents = opts.agents ?? [];
  const called = agents.map((a) => a.name);
  const logs = [
    gitCloneLine(repoId),
    `capsule boot · working tree ${files.length} objects`,
    `bound model ${modelId}`,
    called.length ? `called into capsule: ${called.join(", ")}` : "no agents bound yet",
    "sandbox allow-scripts allow-same-origin",
  ];
  const runtime = kilnRuntime(repoId, modelId, agents);
  const entry = pickEntry(files);
  if (!entry) {
    const listing = `<!doctype html><html><head><meta charset="utf-8"><title>${repoId}</title>
<style>
  :root{--bg:#09090b;--fg:#ecece8;--muted:#8e8e89;--seal:#7a9aa8;--line:#2a2a2e;--surface:#121214}
  body{font:14px/1.5 "Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--fg);padding:32px 20px 64px;margin:0}
  a{color:var(--seal)}
  h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(1.8rem,5vw,2.6rem);letter-spacing:-0.03em;margin:.4rem 0 0}
  .kicker{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
  ul{list-style:none;padding:0;margin:1.4rem 0;border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}
  li{display:flex;justify-content:space-between;gap:12px;padding:.7rem 1rem;border-bottom:1px solid var(--line);font-family:ui-monospace,monospace;font-size:12px}
  li:last-child{border-bottom:0}
  .meta{color:var(--muted);font-size:12px;margin-top:8px}
  .hint{margin-top:1.6rem;color:var(--muted);max-width:36rem}
</style>
${runtime}
</head><body>
<p class="kicker">Capsule · synthesized tree</p>
<h1>${repoId}</h1>
<p class="meta">${gitCloneLine(repoId)} · model ${modelId}</p>
<p>No index.html in this working tree — serving a directory capsule. One-shot a project in Studio to land a real page.</p>
<ul>${files.map((f) => `<li><span>${f.path}</span><span class="meta">${f.size} B${f.encrypted ? " · sealed" : ""}</span></li>`).join("")}</ul>
<p class="hint">Add <code>index.html</code> (and optionally <code>preview.html</code>) and boot again. The capsule rewrites relative assets into blob URLs and injects window.Kiln.</p>
</body></html>`;
    const url = URL.createObjectURL(new Blob([listing], { type: "text/html" }));
    logs.push("synthesized directory capsule from git tree", "stream live");
    return {
      repoId,
      status: "live",
      logs,
      entry: "(tree)",
      url,
      bootedAt: new Date().toISOString(),
      assets: files.length,
      modelId,
      calledAgents: called,
    };
  }
  const blobs: Record<string, string> = {};
  for (const f of files) {
    if (f.binary) continue;
    const text = await read(f);
    const mime = f.path.endsWith(".css")
      ? "text/css"
      : f.path.endsWith(".js") || f.path.endsWith(".mjs")
        ? "text/javascript"
        : f.path.endsWith(".svg")
          ? "image/svg+xml"
          : f.path.endsWith(".json")
            ? "application/json"
            : f.path.endsWith(".html")
              ? "text/html"
              : "text/plain";
    if (f.path !== entry) blobs[f.path] = URL.createObjectURL(new Blob([text], { type: mime }));
  }
  logs.push(`mapped ${Object.keys(blobs).length} assets from git tree`, `entry ${entry}`);
  const raw = await read(files.find((f) => f.path === entry)!);
  const html = injectRuntime(rewrite(raw, blobs), runtime);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  logs.push("runtime live · isolated container · window.Kiln bound");
  return {
    repoId,
    status: "live",
    logs,
    entry,
    url,
    bootedAt: new Date().toISOString(),
    assets: Object.keys(blobs).length,
    modelId,
    calledAgents: called,
  };
}
