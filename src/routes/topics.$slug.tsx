import { createFileRoute, Link } from "@tanstack/react-router";
import { allRepos, starCount, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/topics/$slug")({
  component: Topic,
});

function Topic() {
  const { slug } = Route.useParams();
  const kiln = useKiln();
  const repos = allRepos(kiln).filter((r) => r.topics.includes(slug) || r.language.toLowerCase() === slug.toLowerCase());
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Topic</p>
      <h1 className="mt-2 font-display text-4xl">{slug}</h1>
      <p className="mt-2 text-sm text-muted">{repos.length} public trees.</p>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
        {repos.map((r) => (
          <li key={r.id} className="px-4 py-4">
            <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="font-mono text-sm hover:text-seal">
              {r.id}
            </Link>
            <p className="mt-1 text-sm text-muted">{r.description}</p>
            <p className="mt-1 text-xs text-subtle">
              {r.language} · {starCount(r, kiln)} stars
            </p>
          </li>
        ))}
        {!repos.length ? <li className="px-4 py-10 text-center text-sm text-muted">Nothing tagged {slug} yet.</li> : null}
      </ul>
    </div>
  );
}
