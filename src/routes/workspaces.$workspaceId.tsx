import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { swarmWorkspaceStatus } from "@/lib/kiln/swarm";
import type { WorkspaceStatusView } from "@/lib/kiln/swarm-proxy";
import { workspaceRolloutNote } from "./workspaces.index";

export const Route = createFileRoute("/workspaces/$workspaceId")({ component: WorkspaceDetail });

function repoLine(r: WorkspaceStatusView["repos"][number]) {
  if (!r.exists) return `${r.repo} — not hosted on this forge`;
  if (!r.head) return `${r.repo} — ${r.branch ?? "main"} · empty repo`;
  return `${r.repo} — ${r.branch ?? "main"} @ ${r.head.shortSha} · ${r.head.subject}`;
}

function WorkspaceDetail() {
  const { workspaceId } = Route.useParams();
  const [status, setStatus] = useState<WorkspaceStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fix, setFix] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await swarmWorkspaceStatus({ data: { id: workspaceId } }).catch(() => null);
    if (r && r.ok) {
      setStatus(r.status);
      setError(null);
      setFix(null);
    } else if (r && !r.ok) {
      setError(r.error);
      setFix(r.fix ?? null);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const rollout = workspaceRolloutNote(error);
  const w = status?.workspace;

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        <Link to="/workspaces" className="hover:text-seal">
          Workspaces
        </Link>
      </p>

      {error && (
        <div className="panel mt-8 border-red-500/40 p-5">
          <p className="text-sm font-medium text-red-400">Couldn't load this workspace</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          {rollout && <p className="mt-2 text-sm text-muted">{rollout}</p>}
          {fix && <p className="mt-2 font-mono text-xs text-subtle">{fix}</p>}
        </div>
      )}

      {!error && !status && <p className="mt-8 text-sm text-muted">Loading…</p>}

      {w && status && (
        <>
          <h1 className="mt-3 font-display text-4xl leading-[0.95] sm:text-6xl">{w.name}</h1>
          <p className="mt-3 font-mono text-sm text-muted">
            {w.owner}/{w.slug} · {w.id}
          </p>
          {w.description && <p className="mt-3 max-w-xl text-sm text-muted">{w.description}</p>}
          <p className="mt-2 text-xs text-subtle">
            created {new Date(w.createdAt).toLocaleString()} · updated{" "}
            {new Date(w.updatedAt).toLocaleString()}
          </p>

          <h2 className="mt-10 font-display text-2xl">Member repos</h2>
          <p className="mt-1 text-xs text-subtle">
            Live state read from the forge itself — HEAD of each hosted bare repo, plus whether the
            repo's KILN Memory carries the workspace link.
          </p>
          <ul className="mt-4 space-y-2">
            {status.repos.map((r) => {
              const [owner, repo] = r.repo.split("/");
              const linked = status.memory.repos[r.repo]?.present;
              return (
                <li key={r.repo} className="panel flex items-baseline justify-between gap-4 p-4">
                  <Link
                    to="/$owner/$repo"
                    params={{ owner, repo }}
                    className="font-mono text-sm hover:text-seal"
                  >
                    {repoLine(r)}
                  </Link>
                  <span
                    className={`shrink-0 text-xs ${linked ? "text-green-500" : "text-red-400"}`}
                    title="KILN Memory workspace core block"
                  >
                    {linked ? "memory linked" : "memory link missing"}
                  </span>
                </li>
              );
            })}
            {status.repos.length === 0 && (
              <li className="panel p-4 text-sm text-muted">No member repos yet.</li>
            )}
          </ul>
          <p className="mt-3 text-xs text-subtle">
            memory linkage: {status.memory.linked ? "complete — every member repo carries the link" : "incomplete"}
          </p>

          <h2 className="mt-10 font-display text-2xl">Linked sites</h2>
          <ul className="mt-4 space-y-2">
            {status.sites.map((s) => (
              <li key={s.id} className="panel p-4">
                {s.found ? (
                  <>
                    <p className="font-mono text-sm">
                      {s.name} <span className="text-subtle">({s.id})</span>
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {s.frontend} ⇄ {s.backend}
                    </p>
                  </>
                ) : (
                  <p className="font-mono text-sm text-red-400">
                    {s.id} — no longer in the sites registry
                  </p>
                )}
              </li>
            ))}
            {status.sites.length === 0 && (
              <li className="panel p-4 text-sm text-muted">No linked sites.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
