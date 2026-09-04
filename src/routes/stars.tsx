import { createFileRoute, Link } from "@tanstack/react-router";
import { allRepos, starCount, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/stars")({
  component: Stars,
});

function Stars() {
  const kiln = useKiln();
  const repos = allRepos(kiln).filter((r) => kiln.stars[r.id]);
  return (
    <div>
      <h1 className="font-display text-4xl">Stars</h1>
      <p className="mt-2 text-sm text-muted">Trees you starred. Local to this forge wallet.</p>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
        {repos.length ? (
          repos.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="font-mono text-sm hover:text-seal">
                  {r.id}
                </Link>
                <p className="text-sm text-muted">{r.description}</p>
              </div>
              <button type="button" className="btn h-8" onClick={() => kiln.star(r.id)}>
                Unstar · {starCount(r, kiln)}
              </button>
            </li>
          ))
        ) : (
          <li className="px-4 py-10 text-center text-sm text-muted">No stars yet. Open a tree and press Star.</li>
        )}
      </ul>
    </div>
  );
}
