import { createFileRoute, Link } from "@tanstack/react-router";
import { findRepo, profileOf, starCount, useKiln } from "@/lib/kiln/store";
import { SEED_PROFILES } from "@/lib/kiln/seed";

export const Route = createFileRoute("/$owner/$repo/stargazers")({
  component: Stargazers,
});

function Stargazers() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const handles = Object.keys(SEED_PROFILES).slice(0, Math.min(8, Math.max(3, Math.floor(starCount(repo, kiln) / 40))));
  if (kiln.stars[repo.id] && kiln.wallet) handles.unshift(kiln.wallet.handle);
  const unique = [...new Set(handles)];
  return (
    <div className="mt-5">
      <h1 className="font-display text-3xl">Stargazers</h1>
      <p className="mt-2 text-sm text-muted">{starCount(repo, kiln)} people starred {repo.id}.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {unique.map((h) => {
          const p = profileOf(h);
          return (
            <li key={h}>
              <Link to="/$owner" params={{ owner: h }} search={{ tab: "overview" }} className="panel block p-4 hover:border-seal">
                <p className="font-display text-xl">{p.displayName}</p>
                <p className="font-mono text-sm text-muted">{h}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{p.bio}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
