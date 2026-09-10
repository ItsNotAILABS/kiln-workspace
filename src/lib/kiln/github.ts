import { createServerFn } from "@tanstack/react-start";
import { langOf } from "./store";
import type { Repo, RepoFile } from "./types";
import { syncHash } from "@/lib/utils";
import type { LiveRepoStats } from "./provenance";

async function token(): Promise<string> {
  try {
    const fs = await import("node:fs");
    return fs.readFileSync("/tmp/grok/connectors/github.token", "utf8").trim();
  } catch {
    return process.env.GITHUB_TOKEN || "";
  }
}

async function gh(pathname: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "kiln",
  };
  const t = await token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(`https://api.github.com${pathname}`, { headers });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

function mapRepo(r: Record<string, unknown>) {
  const owner = (r.owner as { login?: string } | undefined)?.login || String(r.full_name || "").split("/")[0];
  return {
    fullName: String(r.full_name || ""),
    name: String(r.name || ""),
    owner,
    description: String(r.description || ""),
    language: String(r.language || ""),
    stars: Number(r.stargazers_count || 0),
    forks: Number(r.forks_count || 0),
    htmlUrl: String(r.html_url || ""),
    defaultBranch: String(r.default_branch || "main"),
    topics: (r.topics as string[]) || [],
    license:
      ((r.license as { spdx_id?: string; name?: string } | null)?.spdx_id ||
        (r.license as { name?: string } | null)?.name ||
        "MIT") as string,
  };
}

const SKIP_DIR = new Set(["node_modules", "dist", "build", ".git", "vendor", "target", ".next", "coverage"]);
const SKIP_EXT = /\.(png|jpe?g|gif|webp|pdf|zip|tar|gz|wasm|woff2?|mp4|webm|ico|bin|lock|map)$/i;

export const githubList = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    const q = String(data.query || "")
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "");
    if (!q) return { ok: false as const, error: "Need a GitHub user, org, or owner/repo", items: [] as ReturnType<typeof mapRepo>[] };
    try {
      if (q.includes("/")) {
        const [owner, repo] = q.split("/");
        const res = await gh(`/repos/${owner}/${repo}`);
        if (!res.ok) return { ok: false as const, error: res.data?.message || `GitHub ${res.status}`, items: [] as ReturnType<typeof mapRepo>[] };
        return { ok: true as const, items: [mapRepo(res.data)] };
      }
      let res = await gh(`/users/${encodeURIComponent(q)}/repos?per_page=40&sort=updated`);
      if (!res.ok) res = await gh(`/orgs/${encodeURIComponent(q)}/repos?per_page=40&sort=updated`);
      if (!res.ok) return { ok: false as const, error: res.data?.message || `GitHub ${res.status}`, items: [] as ReturnType<typeof mapRepo>[] };
      const list = Array.isArray(res.data) ? res.data : [];
      return { ok: true as const, items: list.map(mapRepo) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "GitHub lookup failed", items: [] as ReturnType<typeof mapRepo>[] };
    }
  });

export const githubImport = createServerFn({ method: "POST" })
  .inputValidator((d: { owner: string; repo: string; handle?: string }) => d)
  .handler(async ({ data }) => {
    const owner = data.owner.trim();
    const repo = data.repo.trim().replace(/\.git$/i, "");
    if (!owner || !repo) return { ok: false as const, error: "Need owner/repo" };
    try {
      const metaRes = await gh(`/repos/${owner}/${repo}`);
      if (!metaRes.ok) return { ok: false as const, error: metaRes.data?.message || `GitHub ${metaRes.status}` };
      const meta = metaRes.data as Record<string, unknown>;
      const branch = String(meta.default_branch || "main");
      const treeRes = await gh(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
      if (!treeRes.ok) return { ok: false as const, error: treeRes.data?.message || "Could not read git tree" };
      const blobs = ((treeRes.data as { tree?: { type: string; path: string; size?: number }[] }).tree || []).filter(
        (t) => t.type === "blob" && t.path && !SKIP_EXT.test(t.path) && !t.path.split("/").some((p) => SKIP_DIR.has(p)),
      );
      const files: RepoFile[] = [];
      const sha = String((treeRes.data as { sha?: string }).sha || branch);
      let bytes = 0;
      for (const blob of blobs) {
        if (files.length >= 80) break;
        if ((blob.size || 0) > 180000) continue;
        const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${blob.path}`);
        if (!raw.ok) continue;
        const content = await raw.text();
        if (content.slice(0, 400).includes("\0")) continue;
        if (bytes + content.length > 4e6) break;
        files.push({
          path: blob.path,
          language: langOf(blob.path),
          message: `import ${owner}/${repo}`,
          content,
          size: content.length,
          sha: syncHash(blob.path + content),
          updatedAt: new Date().toISOString(),
        });
        bytes += content.length;
      }
      const handle = (data.handle || owner).toLowerCase();
      const name = String(meta.name || repo);
      const readme = files.find((f) => /^readme\.md$/i.test(f.path))?.content ?? "";
      const imported: Repo = {
        id: `${handle}/${name}`,
        owner: handle,
        name,
        description: String(meta.description || ""),
        visibility: "public",
        encrypted: false,
        keyCommitment: "0x0000000000000000000000000000000000000000",
        viewerGrant: true,
        chainAddress: `0x${syncHash(owner + repo).slice(1).padEnd(40, "0")}`,
        language: String(meta.language || files.find((f) => f.language !== "Markdown")?.language || "source"),
        languages: {},
        stars: Number(meta.stargazers_count || 0),
        forks: Number(meta.forks_count || 0),
        watchers: Number(meta.watchers_count || 0),
        topics: ["imported", "github", ...(((meta.topics as string[]) || []).slice(0, 6))],
        license: (meta.license as { spdx_id?: string } | null)?.spdx_id || "MIT",
        defaultBranch: branch,
        updatedAt: new Date().toISOString(),
        createdAt: String(meta.created_at || new Date().toISOString()),
        tvlKln: 0,
        files,
        readme,
        website: String(meta.html_url || ""),
        quotaBytes: 50 * 1024 * 1024 * 1024,
        modelId: "grok-4.6",
        githubUrl: String(meta.html_url || ""),
        githubOwner: owner,
        githubRepo: repo,
        githubSha: sha,
        kind: "code",
      };
      return { ok: true as const, repo: imported, skipped: Math.max(0, blobs.length - files.length) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Import failed" };
    }
  });

/**
 * Batch live stats for the forge's real repos.
 *
 * One round-trip for the whole explore page instead of N per-repo calls.
 * Returns a map keyed by "owner/repo" (lowercased). Failures for individual
 * repos resolve to null so one missing repo never breaks the page.
 */
export const githubRepoStatsBatch = createServerFn({ method: "POST" })
  .inputValidator((d: { repos: { owner: string; repo: string }[] }) => d)
  .handler(async ({ data }) => {
    const seen = new Set<string>();
    const targets = (data.repos || [])
      .map((r) => ({ owner: String(r.owner || "").trim(), repo: String(r.repo || "").trim() }))
      .filter((r) => r.owner && r.repo)
      .filter((r) => {
        const k = `${r.owner}/${r.repo}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 40);
    const out: Record<string, LiveRepoStats | null> = {};
    await Promise.all(
      targets.map(async ({ owner, repo }) => {
        const key = `${owner}/${repo}`.toLowerCase();
        try {
          const res = await gh(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
          if (!res.ok) {
            out[key] = null;
            return;
          }
          const r = res.data as Record<string, unknown>;
          out[key] = {
            stars: Number(r.stargazers_count || 0),
            forks: Number(r.forks_count || 0),
            watchers: Number(r.watchers_count || 0),
            openIssues: Number(r.open_issues_count || 0),
            description: String(r.description || ""),
            language: String(r.language || ""),
            topics: (r.topics as string[]) || [],
            license:
              ((r.license as { spdx_id?: string } | null)?.spdx_id ||
                (r.license as { name?: string } | null)?.name ||
                "") as string,
            pushedAt: String(r.pushed_at || ""),
            defaultBranch: String(r.default_branch || "main"),
            fetchedAt: new Date().toISOString(),
          };
        } catch {
          out[key] = null;
        }
      }),
    );
    return { ok: true as const, stats: out };
  });

export const studioGenerate = createServerFn({ method: "POST" })
  .inputValidator((d: { prompt: string }) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Studio AI is not available in this environment" };
    const prompt = String(data.prompt || "").slice(0, 800);
    if (!prompt.trim()) return { ok: false as const, error: "Need a prompt" };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 1400,
        messages: [
          {
            role: "system",
            content:
              'You generate a tiny software repo. Reply ONLY JSON: {"name":"kebab-name","description":"one line","files":[{"path":"README.md","content":"..."}, ...]}. 4-7 files, real code, no markdown fences around the JSON.',
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    const text = body.choices[0]?.message.content ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) return { ok: false as const, error: "Could not parse studio output" };
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as {
        name: string;
        description: string;
        files: { path: string; content: string }[];
      };
      return { ok: true as const, name: parsed.name, description: parsed.description, files: parsed.files ?? [] };
    } catch {
      return { ok: false as const, error: "Could not parse studio output" };
    }
  });
