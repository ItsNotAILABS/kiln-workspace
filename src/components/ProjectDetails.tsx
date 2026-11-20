import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { swarmRepoDetails, swarmUpdateRepoDetails } from "@/lib/kiln/swarm";
import type { CiResultView, RepoDetailsView } from "@/lib/kiln/swarm-proxy";
import { LanguageBar } from "@/components/RepoChrome";
import { Markdown } from "@/components/Markdown";

/**
 * Project details for forge-hosted repos, read live from the daemon
 * (GET /v1/repos/:owner/:repo/details). Repos the forge doesn't host
 * (seed/GitHub-backed pages) answer 404 and this renders nothing —
 * the page's own store data already covers those.
 */

const inflight = new Map<string, Promise<RepoDetailsView | null>>();

function fetchDetails(owner: string, repo: string): Promise<RepoDetailsView | null> {
  const key = `${owner}/${repo}`;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      const r = await swarmRepoDetails({ data: { owner, repo } }).catch(() => null);
      return r && r.ok ? r.details : null;
    })();
    inflight.set(key, p);
  }
  return p;
}

export function useRepoDetails(owner: string, repo: string) {
  const [details, setDetails] = useState<RepoDetailsView | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    setLoaded(false);
    fetchDetails(owner, repo).then((d) => {
      if (!live) return;
      setDetails(d);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [owner, repo]);
  return { details, loaded, setDetails };
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function ciLine(ci: CiResultView): string {
  const parts: string[] = [];
  for (const k of ["status", "verdict", "conclusion", "state", "result"] as const) {
    const v = ci[k];
    if (v) parts.push(`${k}: ${v}`);
  }
  const when = ci.finishedAt ?? ci.updatedAt ?? ci.createdAt ?? ci.date;
  if (when) parts.push(new Date(when).toLocaleString());
  const sha = ci.sha ?? ci.commit;
  if (sha) parts.push(`@ ${sha.slice(0, 7)}`);
  return parts.length ? parts.join(" · ") : "a run is recorded";
}

export function ProjectDetails({ owner, repo }: { owner: string; repo: string }) {
  const { details, setDetails } = useRepoDetails(owner, repo);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!details) return null;

  async function saveDescription() {
    if (!details) return;
    setSaving(true);
    setSaveError(null);
    const r = await swarmUpdateRepoDetails({
      data: { owner, repo, patch: { description: draft } },
    }).catch((err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "save failed",
    }));
    setSaving(false);
    if (!r.ok) {
      setSaveError(r.error);
      return;
    }
    inflight.delete(`${owner}/${repo}`);
    setDetails(r.details);
    setEditing(false);
  }

  const langRecord: Record<string, number> = {};
  for (const l of details.languages) langRecord[l.language] = l.pct;

  return (
    <div className="panel p-4">
      <h3 className="text-sm font-medium">Project details</h3>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-subtle">
        live from the forge
      </p>

      <div className="mt-3">
        {editing ? (
          <div>
            <textarea
              className="input min-h-20 w-full"
              value={draft}
              maxLength={1024}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What this repo is"
            />
            {saveError && <p className="mt-2 text-xs text-red-400">{saveError}</p>}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-primary btn h-8 px-3"
                disabled={saving}
                onClick={saveDescription}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn h-8 px-3"
                onClick={() => {
                  setEditing(false);
                  setSaveError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted">
              {details.description || "No description recorded on the forge yet."}
            </p>
            <button
              type="button"
              className="mt-1 text-xs text-seal hover:underline"
              onClick={() => {
                setDraft(details.description);
                setEditing(true);
              }}
            >
              Edit description
            </button>
          </div>
        )}
      </div>

      {details.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {details.topics.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      )}

      {details.empty ? (
        <p className="mt-3 text-sm text-muted">Empty repo — no commits yet.</p>
      ) : (
        <dl className="mt-4 space-y-1.5 text-xs text-muted">
          <div className="flex justify-between">
            <dt>Default branch</dt>
            <dd className="font-mono text-fg">{details.defaultBranch ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Commits</dt>
            <dd className="tabular-nums text-fg">{details.commitCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Files</dt>
            <dd className="tabular-nums text-fg">{details.fileCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tree size</dt>
            <dd className="tabular-nums text-fg">{formatBytes(details.treeBytes)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>On disk</dt>
            <dd className="tabular-nums text-fg">{formatBytes(details.diskBytes)}</dd>
          </div>
          {details.createdAt && (
            <div className="flex justify-between">
              <dt>Created</dt>
              <dd className="text-fg">{new Date(details.createdAt).toLocaleDateString()}</dd>
            </div>
          )}
          {details.lastCommit && (
            <div>
              <div className="flex justify-between">
                <dt>Last commit</dt>
                <dd className="font-mono text-fg">{details.lastCommit.shortSha}</dd>
              </div>
              <p className="mt-1 text-right text-fg">{details.lastCommit.subject}</p>
              <p className="text-right text-subtle">
                {details.lastCommit.author} · {new Date(details.lastCommit.date).toLocaleString()}
              </p>
            </div>
          )}
        </dl>
      )}

      {details.languages.length > 0 && (
        <div className="mt-4">
          <LanguageBar langs={langRecord} />
        </div>
      )}

      {details.ci && (
        <p className="mt-4 text-xs text-muted">
          <span className="text-fg">CI</span> — {ciLine(details.ci)}
        </p>
      )}

      {details.workspaces.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">In workspaces</p>
          <ul className="mt-1 space-y-1 text-sm">
            {details.workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  to="/workspaces/$workspaceId"
                  params={{ workspaceId: w.id }}
                  className="text-seal hover:underline"
                >
                  {w.name}
                </Link>{" "}
                <span className="font-mono text-xs text-subtle">
                  {w.owner}/{w.slug}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {details.site && (
        <p className="mt-4 text-xs text-muted">
          Linked site: <span className="text-fg">{details.site.name}</span>{" "}
          <span className="text-subtle">
            ({details.site.id} · {details.site.role})
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * The forge-derived README, shown under the file tree only when the
 * page's own store carries no README for this repo.
 */
export function ProjectDetailsReadme({
  owner,
  repo,
  storeReadme,
}: {
  owner: string;
  repo: string;
  storeReadme: string;
}) {
  const { details } = useRepoDetails(owner, repo);
  if (storeReadme) return null;
  if (!details?.readme) return null;
  return (
    <div className="panel mt-4 p-5 sm:p-6">
      <Markdown source={details.readme.content} />
      {details.readme.truncated && (
        <p className="mt-3 text-xs text-subtle">
          README truncated at 128 KB in the forge details view ({details.readme.path}).
        </p>
      )}
    </div>
  );
}
