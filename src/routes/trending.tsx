import { createFileRoute, Link } from "@tanstack/react-router";
import { VideoFrame } from "@/components/VideoFrame";
import { allRepos, starCount, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/trending")({
  validateSearch: (s: Record<string, unknown>) => ({ since: String(s.since ?? "week"), language: String(s.language ?? "") }),
  component: Trending,
});

function Trending() {
  const { since, language } = Route.useSearch();
  const kiln = useKiln();
  const repos = allRepos(kiln)
    .filter((r) => r.visibility === "public")
    .filter((r) => !language || r.language.toLowerCase() === language.toLowerCase())
    .sort((a, b) => starCount(b, kiln) - starCount(a, kiln) || b.updatedAt.localeCompare(a.updatedAt));
  const langs = [...new Set(allRepos(kiln).map((r) => r.language))].sort();
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Trending</p>
          <h1 className="mt-3 font-display text-4xl sm:text-6xl">See what the forge is starring</h1>
        </div>
        <VideoFrame src="/marketing/market.mp4" poster="/marketing/market.jpg" caption="Public goods this week" />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {["today", "week", "month"].map((k) => (
          <a key={k} href={`/trending?since=${k}&language=${encodeURIComponent(language)}`} className={`btn h-8 capitalize ${since === k ? "btn-primary" : ""}`}>
            {k}
          </a>
        ))}
        <select
          className="input w-40"
          value={language}
          onChange={(e) => {
            window.location.assign(`/trending?since=${since}&language=${encodeURIComponent(e.target.value)}`);
          }}
        >
          <option value="">Any language</option>
          {langs.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
      <ol className="mt-6 divide-y divide-border rounded-xl border border-border">
        {repos.map((r, i) => (
          <li key={r.id} className="flex gap-4 px-4 py-4">
            <span className="w-6 tabular-nums text-subtle">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="font-mono text-sm hover:text-seal">
                {r.id}
              </Link>
              <p className="mt-1 text-sm text-muted">{r.description}</p>
            </div>
            <p className="tabular-nums text-sm text-muted">{starCount(r, kiln)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
