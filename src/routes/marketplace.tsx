import { createFileRoute, Link } from "@tanstack/react-router";
import { VideoFrame } from "@/components/VideoFrame";
import { SEED_LISTINGS } from "@/lib/kiln/seed";
import { allRepos, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/marketplace")({ component: Market });

function Market() {
  const kiln = useKiln();
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Marketplace</p>
          <h1 className="mt-3 font-display text-5xl leading-[0.95]">License a tree in KLN</h1>
          <p className="mt-3 max-w-md text-muted">Public goods, priced. Take is free. Buy settles from your wallet.</p>
        </div>
        <VideoFrame src="/marketing/market.mp4" poster="/marketing/market.jpg" />
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {SEED_LISTINGS.map((l) => {
          const repo = allRepos(kiln).find((r) => r.id === l.repoId);
          if (!repo) return null;
          return (
            <li key={l.id} className="panel p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{l.category}</p>
              <Link to="/$owner/$repo" params={{ owner: repo.owner, repo: repo.name }} className="mt-1 block font-display text-2xl hover:text-seal">
                {l.title}
              </Link>
              <p className="mt-1 font-mono text-sm text-muted">{l.repoId}</p>
              <p className="mt-3 text-sm">{l.priceKln === 0 ? "Take" : `${l.priceKln} KLN`}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
