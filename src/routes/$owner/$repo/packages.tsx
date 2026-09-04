import { createFileRoute } from "@tanstack/react-router";
import { findRepo, useKiln } from "@/lib/kiln/store";
import { SEED_PACKAGES } from "@/lib/kiln/seed";

export const Route = createFileRoute("/$owner/$repo/packages")({
  component: Packages,
});

function Packages() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const rows = SEED_PACKAGES.filter((p) => p.repoId === repo.id);
  return (
    <div className="mt-5">
      <h2 className="font-display text-2xl">Packages</h2>
      <p className="mt-1 text-sm text-muted">npm, containers, cargo, pypi — published from this tree.</p>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows.length ? (
          rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-mono text-sm">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.ecosystem} · {p.version}
                </p>
              </div>
              <p className="tabular-nums text-sm text-muted">{p.downloads.toLocaleString()} installs</p>
            </li>
          ))
        ) : (
          <li className="px-4 py-10 text-center text-sm text-muted">No packages published yet. Tag a release to cut one.</li>
        )}
      </ul>
    </div>
  );
}
