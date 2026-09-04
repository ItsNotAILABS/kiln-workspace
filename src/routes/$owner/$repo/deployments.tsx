import { createFileRoute, Link } from "@tanstack/react-router";
import { findRepo, kilnHost, useKiln } from "@/lib/kiln/store";
import { formatAgo } from "@/lib/utils";

export const Route = createFileRoute("/$owner/$repo/deployments")({
  component: Deployments,
});

function Deployments() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const host = kiln.domains.find((d) => d.repoId === repo.id)?.host ?? kilnHost(repo.owner, repo.name);
  const page = kiln.pages.find((p) => p.repoId === repo.id);
  const runs = kiln.actionRuns.filter((r) => r.repoId === repo.id).slice(0, 6);
  return (
    <div className="mt-5">
      <h1 className="font-display text-3xl">Deployments</h1>
      <p className="mt-2 text-sm text-muted">Kiln Pages and capsule previews. GitHub Pages equivalent — the tree is the site.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Kiln Pages</p>
          <p className="mt-2 font-mono text-sm text-seal">{host}</p>
          <p className="mt-1 text-xs text-muted">{page?.enabled ? "Enabled · main /" : "Off — enable in settings"}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn h-8" onClick={() => kiln.setPages(repo.id, !page?.enabled)}>
              {page?.enabled ? "Disable" : "Enable Pages"}
            </button>
            <Link to="/$owner/$repo/preview" params={{ owner, repo: name }} className="btn h-8">
              Open preview
            </Link>
          </div>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Environments</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>production · {host}</li>
            <li>preview · capsule</li>
            <li>computer · kilnsh</li>
          </ul>
        </div>
      </div>
      <h2 className="mt-8 font-display text-2xl">Recent</h2>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
        {runs.map((r) => (
          <li key={r.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              {r.workflow} · {r.sha}
            </span>
            <span className="text-muted">
              {r.status} · {formatAgo(r.createdAt)}
            </span>
          </li>
        ))}
        {!runs.length ? <li className="px-4 py-8 text-center text-sm text-muted">No deployments yet.</li> : null}
      </ul>
    </div>
  );
}
