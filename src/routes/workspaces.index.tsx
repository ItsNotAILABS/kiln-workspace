import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { swarmWorkspaces } from "@/lib/kiln/swarm";
import type { WorkspaceView } from "@/lib/kiln/swarm-proxy";

export const Route = createFileRoute("/workspaces/")({ component: Workspaces });

/**
 * The daemon answers 404 for /v1/workspaces until the workspaces rollout
 * reaches it (the routes ship in swarm/lib/httpapi.mjs and mount on the
 * daemon's next start). That state is rendered plainly — never mock data.
 */
export function workspaceRolloutNote(error: string | null): string | null {
  if (!error) return null;
  if (/not found/i.test(error)) {
    return "The connected daemon doesn't serve workspaces yet — the API ships in the forge code and mounts on the daemon's next start. Workspace records themselves are created with `swarm.mjs workspaces` against the registry.";
  }
  return null;
}

function Workspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fix, setFix] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await swarmWorkspaces({ data: {} }).catch(() => null);
    if (r && r.ok) {
      setWorkspaces(r.workspaces);
      setError(null);
      setFix(null);
    } else if (r && !r.ok) {
      setError(r.error);
      setFix(r.fix ?? null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const rollout = workspaceRolloutNote(error);

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Workspaces</p>
      <h1 className="mt-3 font-display text-4xl leading-[0.95] sm:text-6xl">Workspaces</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        First-class groupings of the repos and sites that make one product — read live from the
        forge's own workspace registry. The registry is an index; the durable links live in each
        member repo's KILN Memory.
      </p>

      {error && (
        <div className="panel mt-8 border-red-500/40 p-5">
          <p className="text-sm font-medium text-red-400">Couldn't load workspaces</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          {rollout && <p className="mt-2 text-sm text-muted">{rollout}</p>}
          {fix && <p className="mt-2 font-mono text-xs text-subtle">{fix}</p>}
        </div>
      )}

      {!error && workspaces === null && <p className="mt-8 text-sm text-muted">Loading…</p>}

      {!error && workspaces !== null && workspaces.length === 0 && (
        <div className="panel mt-8 p-5">
          <p className="text-sm text-muted">
            No workspaces in the registry yet. Create one with{" "}
            <span className="font-mono text-xs">
              swarm.mjs workspaces add --owner O --slug S --name N --repos o/r,o/r --sites site_…
            </span>
          </p>
        </div>
      )}

      {workspaces !== null && workspaces.length > 0 && (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {workspaces.map((w) => (
            <li key={w.id}>
              <Link
                to="/workspaces/$workspaceId"
                params={{ workspaceId: w.id }}
                className="panel block p-5 hover:border-seal"
              >
                <p className="font-display text-2xl">{w.name}</p>
                <p className="mt-1 font-mono text-sm text-muted">
                  {w.owner}/{w.slug}
                </p>
                {w.description && <p className="mt-2 text-sm text-muted">{w.description}</p>}
                <p className="mt-3 text-xs text-subtle">
                  {w.repos.length} {w.repos.length === 1 ? "repo" : "repos"} · {w.siteIds.length}{" "}
                  {w.siteIds.length === 1 ? "site" : "sites"} · updated{" "}
                  {new Date(w.updatedAt).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
