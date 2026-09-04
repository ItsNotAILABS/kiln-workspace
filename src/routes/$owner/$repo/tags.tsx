import { createFileRoute, Link } from "@tanstack/react-router";
import { formatAgo } from "@/lib/utils";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/tags")({
  component: Tags,
});

function Tags() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const rows = kiln.releases.filter((r) => r.repoId === repo.id);
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Tags</h1>
        <Link to="/$owner/$repo/releases" params={{ owner, repo: name }} className="text-sm text-seal hover:underline">
          Releases
        </Link>
      </div>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows.length ? (
          rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-mono text-sm text-seal">{r.tag}</p>
                <p className="text-xs text-muted">
                  {r.title} · {r.author} · {formatAgo(r.createdAt)}
                </p>
              </div>
              <p className="text-xs text-subtle">{r.assets[0]?.name}</p>
            </li>
          ))
        ) : (
          <li className="px-4 py-10 text-center text-sm text-muted">No tags yet. Draft a release to cut one.</li>
        )}
      </ul>
    </div>
  );
}
