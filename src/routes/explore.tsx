import { createFileRoute, Link } from "@tanstack/react-router";
import { VideoFrame } from "@/components/VideoFrame";
import { allRepos, allTopics, starCount, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/explore")({
  validateSearch: (s: Record<string, unknown>) => ({ q: String(s.q ?? "") }),
  component: Explore,
});

function Explore() {
  const { q } = Route.useSearch();
  const kiln = useKiln();
  const t = q.trim().toLowerCase();
  const repos = allRepos(kiln)
    .filter((r) => r.visibility === "public")
    .filter((r) => !t || `${r.id} ${r.description} ${r.language} ${r.topics.join(" ")}`.toLowerCase().includes(t))
    .sort((a, b) => starCount(b, kiln) - starCount(a, kiln));
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Explore</p>
          <h1 className="mt-3 font-display text-4xl leading-[0.95] sm:text-6xl">Trending on the forge</h1>
          <p className="mt-3 max-w-xl text-muted">Public trees, ranked by stars. Import GitHub. Remix. The marketplace is KLN.</p>
          <div className="mt-4 flex gap-3 text-sm">
            <Link to="/trending" search={{ since: "week", language: "" }} className="text-seal hover:underline">
              Trending
            </Link>
            <Link to="/stars" className="text-seal hover:underline">
              Your stars
            </Link>
            <Link to="/topics/$slug" params={{ slug: "protocol" }} className="text-seal hover:underline">
              Topics
            </Link>
          </div>
        </div>
        <VideoFrame src="/marketing/market.mp4" poster="/marketing/market.jpg" caption="Public goods, priced in KLN" />
      </div>
      <form className="mt-8 max-w-xl">
        <input
          className="input"
          defaultValue={q}
          placeholder="Filter language, topic, owner…"
          name="q"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              window.location.assign(`/explore?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
            }
          }}
        />
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {allTopics(kiln).slice(0, 12).map(([topic, n]) => (
          <Link key={topic} to="/topics/$slug" params={{ slug: topic }} className="chip hover:border-seal">
            {topic} · {n}
          </Link>
        ))}
      </div>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
        {repos.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="font-mono text-sm hover:text-seal">
                {r.owner}/{r.name}
              </Link>
              <p className="mt-1 max-w-2xl text-sm text-muted">{r.description}</p>
              <p className="mt-2 flex flex-wrap gap-2 text-[11px] text-subtle">
                <span>{r.language}</span>
                {r.topics.slice(0, 4).map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </p>
            </div>
            <p className="tabular-nums text-sm text-muted">{starCount(r, kiln)} stars</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
