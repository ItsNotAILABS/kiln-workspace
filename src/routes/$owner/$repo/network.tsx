import { createFileRoute, Link } from "@tanstack/react-router";
import { findRepo, forkList, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/network")({
  component: Network,
});

function Network() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const forks = forkList(kiln, repo.id);
  const branches = kiln.branches.filter((b) => b.repoId === repo.id);
  return (
    <div className="mt-5">
      <h1 className="font-display text-3xl">Network</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">Members, forks, and branches of this tree. Every push is a node on L1.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border p-6">
        <svg viewBox="0 0 640 220" className="h-52 w-full text-seal">
          <line x1="40" y1="110" x2="600" y2="110" stroke="currentColor" strokeOpacity="0.25" />
          {Array.from({ length: 12 }).map((_, i) => (
            <circle key={i} cx={50 + i * 48} cy={110} r={i === 0 ? 8 : 5} fill="currentColor" opacity={i === 0 ? 1 : 0.55} />
          ))}
          {forks.slice(0, 4).map((_, i) => (
            <g key={i}>
              <line x1={146 + i * 96} y1="110" x2={146 + i * 96} y2={50 + i * 8} stroke="currentColor" strokeOpacity="0.4" />
              <circle cx={146 + i * 96} cy={50 + i * 8} r="5" fill="currentColor" opacity="0.8" />
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Upstream</p>
          <Link to="/$owner/$repo" params={{ owner: repo.owner, repo: repo.name }} className="mt-2 block font-mono text-sm hover:text-seal">
            {repo.id}
          </Link>
          <p className="text-xs text-subtle">{repo.defaultBranch} · {branches.length || 1} branches</p>
        </div>
        {forks.map((f) => (
          <div key={f.id} className="panel p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Fork</p>
            <Link to="/$owner/$repo" params={{ owner: f.owner, repo: f.name }} className="mt-2 block font-mono text-sm hover:text-seal">
              {f.id}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
