import { createFileRoute, Link } from "@tanstack/react-router";
import { VideoFrame } from "@/components/VideoFrame";
import { allRepos, allTopics, useKiln } from "@/lib/kiln/store";
import { isFixtureRepo, displayStars } from "@/lib/kiln/provenance";
import { useLiveRepoStats, liveStatsFor } from "@/lib/kiln/use-live-stats";
import type { Repo } from "@/lib/kiln/types";

export const Route = createFileRoute("/explore")({
  validateSearch: (s: Record<string, unknown>) => ({ q: String(s.q ?? "") }),
  component: Explore,
});

function RepoRow({ r, live }: { r: Repo; live: ReturnType<typeof useLiveRepoStats> }) {
  const fixture = isFixtureRepo(r);
  const stats = liveStatsFor(r, live);
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
      <div className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="font-mono text-sm hover:text-seal">
            {r.owner}/{r.name}
          </Link>
          {fixture ? (
            <span className="chip border-dashed text-subtle" title="Demo fixture — sample data, not a real repository">
              demo
            </span>
          ) : stats ? (
            <span className="flex items-center gap-1 text-[11px] text-seal" title={`Live from GitHub · fetched ${new Date(stats.fetchedAt).toLocaleDateString()}`}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-seal" />
              live
            </span>
          ) : null}
        </span>
        <p className="mt-1 max-w-2xl text-sm text-muted">{stats?.description || r.description}</p>
        <p className="mt-2 flex flex-wrap gap-2 text-[11px] text-subtle">
          <span>{stats?.language || r.language}</span>
          {(stats?.topics?.length ? stats.topics : r.topics).slice(0, 4).map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </p>
      </div>
      {fixture ? (
        <p className="text-[11px] uppercase tracking-wider text-subtle">sample data</p>
      ) : (
        <p className="tabular-nums text-sm text-muted">{displayStars(r, stats)} stars</p>
      )}
    </li>
  );
}

function Explore() {
  const { q } = Route.useSearch();
  const kiln = useKiln();
  const live = useLiveRepoStats();
  const t = q.trim().toLowerCase();
  const matches = (r: Repo) =>
    r.visibility === "public" &&
    (!t || `${r.id} ${r.description} ${r.language} ${r.topics.join(" ")}`.toLowerCase().includes(t));
  const real = allRepos(kiln)
    .filter((r) => matches(r) && !isFixtureRepo(r))
    .sort((a, b) => displayStars(b, live.get(b.id)) - displayStars(a, live.get(a.id)));
  const fixtures = allRepos(kiln)
    .filter((r) => matches(r) && isFixtureRepo(r))
    .sort((a, b) => a.id.localeCompare(b.id));
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
        {real.map((r) => (
          <RepoRow key={r.id} r={r} live={live} />
        ))}
      </ul>
      {fixtures.length > 0 && (
        <>
          <h2 className="mt-10 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Demo fixtures</h2>
          <p className="mt-1 text-sm text-subtle">Sample repositories for exploring the forge offline — not real projects.</p>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-dashed border-border">
            {fixtures.map((r) => (
              <RepoRow key={r.id} r={r} live={live} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
