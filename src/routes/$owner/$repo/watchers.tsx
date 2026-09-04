import { createFileRoute, Link } from "@tanstack/react-router";
import { findRepo, profileOf, useKiln } from "@/lib/kiln/store";
import { SEED_PROFILES } from "@/lib/kiln/seed";

export const Route = createFileRoute("/$owner/$repo/watchers")({
  component: Watchers,
});

function Watchers() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const handles = [repo.owner, ...Object.keys(SEED_PROFILES).slice(0, 4)];
  if (kiln.watches[repo.id] && kiln.wallet) handles.unshift(kiln.wallet.handle);
  const unique = [...new Set(handles)];
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Watchers</h1>
        <button type="button" className="btn h-8" onClick={() => kiln.watchRepo(repo.id)}>
          {kiln.watches[repo.id] ? "Unwatch" : "Watch"}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">{repo.watchers + (kiln.watches[repo.id] ? 1 : 0)} watching {repo.id}.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {unique.map((h) => (
          <li key={h}>
            <Link to="/$owner" params={{ owner: h }} search={{ tab: "overview" }} className="panel block p-4 hover:border-seal">
              <p className="font-mono text-sm">{h}</p>
              <p className="mt-1 text-sm text-muted">{profileOf(h).bio}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
