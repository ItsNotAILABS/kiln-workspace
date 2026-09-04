import { createFileRoute, Link } from "@tanstack/react-router";
import { allIssues, allPulls, allRepos, profileOf, useKiln } from "@/lib/kiln/store";
import { SEED_PROFILES } from "@/lib/kiln/seed";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: String(s.q ?? ""), type: String(s.type ?? "repos") }),
  component: SearchPage,
});

function SearchPage() {
  const { q, type } = Route.useSearch();
  const kiln = useKiln();
  const t = q.trim().toLowerCase();
  const repos = allRepos(kiln).filter((r) => !t || `${r.id} ${r.description} ${r.topics.join(" ")}`.toLowerCase().includes(t));
  const issues = allIssues(kiln).filter((i) => !t || `${i.title} ${i.body}`.toLowerCase().includes(t));
  const pulls = allPulls(kiln).filter((p) => !t || `${p.title} ${p.body}`.toLowerCase().includes(t));
  const users = Object.keys(SEED_PROFILES).filter((h) => !t || h.includes(t) || profileOf(h).displayName.toLowerCase().includes(t));
  const code = allRepos(kiln).flatMap((r) => r.files.filter((f) => !t || f.path.toLowerCase().includes(t) || f.content.toLowerCase().includes(t)).slice(0, 3).map((f) => ({ repo: r, file: f })));
  const commits = allRepos(kiln).flatMap((r) => r.files.filter((f) => !t || f.message.toLowerCase().includes(t) || f.sha.includes(t)).slice(0, 4).map((f) => ({ repo: r, file: f })));
  const discussions = kiln.discussions.filter((d) => !t || `${d.title} ${d.body}`.toLowerCase().includes(t));
  return (
    <div>
      <h1 className="font-display text-4xl">Search</h1>
      <form className="mt-4 max-w-xl">
        <input className="input" defaultValue={q} name="q" placeholder="Search repositories, issues, pulls, people, code" onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            window.location.assign(`/search?q=${encodeURIComponent((e.target as HTMLInputElement).value)}&type=${type}`);
          }
        }} />
      </form>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {["repos", "issues", "pulls", "users", "code", "commits", "discussions"].map((k) => (
          <a key={k} href={`/search?q=${encodeURIComponent(q)}&type=${k}`} className={`btn h-8 ${type === k ? "btn-primary" : ""}`}>
            {k}
          </a>
        ))}
      </div>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
        {type === "repos" && repos.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="font-mono text-sm hover:text-seal">{r.id}</Link>
            <p className="text-sm text-muted">{r.description}</p>
          </li>
        ))}
        {type === "issues" && issues.map((i) => (
          <li key={i.id} className="px-4 py-3">
            <Link to="/$owner/$repo/issues/$n" params={{ owner: i.repoId.split("/")[0]!, repo: i.repoId.split("/")[1]!, n: String(i.number) }} className="hover:text-seal">{i.title}</Link>
            <p className="text-xs text-muted">{i.id}</p>
          </li>
        ))}
        {type === "pulls" && pulls.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <Link to="/$owner/$repo/pulls/$n" params={{ owner: p.repoId.split("/")[0]!, repo: p.repoId.split("/")[1]!, n: String(p.number) }} className="hover:text-seal">{p.title}</Link>
            <p className="text-xs text-muted">{p.id}</p>
          </li>
        ))}
        {type === "users" && users.map((h) => (
          <li key={h} className="px-4 py-3">
            <Link to="/$owner" params={{ owner: h }} search={{ tab: "overview" }} className="font-mono hover:text-seal">{h}</Link>
            <p className="text-sm text-muted">{profileOf(h).bio}</p>
          </li>
        ))}
        {type === "code" && code.slice(0, 40).map(({ repo, file }) => (
          <li key={repo.id + file.path} className="px-4 py-3">
            <Link to="/$owner/$repo/blob/$" params={{ owner: repo.owner, repo: repo.name, _splat: file.path }} className="font-mono text-sm hover:text-seal">{repo.id}:{file.path}</Link>
          </li>
        ))}
        {type === "commits" && commits.slice(0, 40).map(({ repo, file }) => (
          <li key={repo.id + file.sha} className="px-4 py-3">
            <Link to="/$owner/$repo/commits" params={{ owner: repo.owner, repo: repo.name }} className="font-mono text-sm hover:text-seal">
              {file.sha.slice(0, 7)}
            </Link>
            <p className="text-sm text-muted">
              {file.message} · {repo.id}
            </p>
          </li>
        ))}
        {type === "discussions" && discussions.map((d) => (
          <li key={d.id} className="px-4 py-3">
            <Link to="/$owner/$repo/discussions" params={{ owner: d.repoId.split("/")[0]!, repo: d.repoId.split("/")[1]! }} className="hover:text-seal">
              {d.title}
            </Link>
            <p className="text-xs text-muted">{d.repoId}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
