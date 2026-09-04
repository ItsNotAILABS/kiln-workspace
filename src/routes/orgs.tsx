import { createFileRoute, Link } from "@tanstack/react-router";
import { SEED_PROFILES } from "@/lib/kiln/seed";

export const Route = createFileRoute("/orgs")({ component: Orgs });

function Orgs() {
  const orgs = Object.values(SEED_PROFILES).filter((p) => p.kind === "org");
  return (
    <div>
      <h1 className="font-display text-4xl">Organizations</h1>
      <p className="mt-2 max-w-xl text-muted">Labs that ship public goods. Teams, members, pinned trees.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {orgs.map((o) => (
          <li key={o.handle}>
            <Link to="/$owner" params={{ owner: o.handle }} search={{ tab: "overview" }} className="panel block p-5 hover:border-seal">
              <p className="font-display text-2xl">{o.displayName}</p>
              <p className="font-mono text-sm text-muted">{o.handle}</p>
              <p className="mt-2 text-sm text-muted">{o.bio}</p>
              <p className="mt-2 text-xs text-subtle">{o.followers} followers · {o.highlight}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
