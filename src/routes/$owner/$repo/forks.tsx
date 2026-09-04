import { createFileRoute, Link } from "@tanstack/react-router";
import { findRepo, forkList, starCount, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/forks")({
  component: Forks,
});

function Forks() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const forks = forkList(kiln, repo.id);
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Forks</h1>
        <button type="button" className="btn-primary btn h-8" onClick={() => { const f = kiln.fork(repo.id); if (f) window.location.assign(`/${f.owner}/${f.name}`); }}>
          Fork this tree
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">{repo.forks + (kiln.forksOf.includes(repo.id) ? 1 : 0)} forks of {repo.id}.</p>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {forks.length ? (
          forks.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="font-mono text-sm hover:text-seal">
                {r.id}
              </Link>
              <p className="text-sm text-muted">{r.description}</p>
              <p className="text-xs text-subtle">{starCount(r, kiln)} stars</p>
            </li>
          ))
        ) : (
          <li className="px-4 py-10 text-center text-sm text-muted">No forks on the forge yet. Be the first.</li>
        )}
      </ul>
    </div>
  );
}
