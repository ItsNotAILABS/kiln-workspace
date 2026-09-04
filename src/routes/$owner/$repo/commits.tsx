import { createFileRoute, Link } from "@tanstack/react-router";
import { formatAgo } from "@/lib/utils";
import { findRepo, useKiln } from "@/lib/kiln/store";
import { SEED_COMMITS } from "@/lib/kiln/seed";

export const Route = createFileRoute("/$owner/$repo/commits")({
  component: Commits,
});

function Commits() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const rows = [
    ...repo.files.slice(0, 8).map((f) => ({ sha: f.sha, message: f.message, author: repo.owner, createdAt: f.updatedAt, files: [f.path] })),
    ...SEED_COMMITS.filter((c) => c.repoId === repo.id),
  ];
  return (
    <div className="mt-5">
      <h2 className="font-display text-2xl">Commits on {repo.defaultBranch}</h2>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows.map((c, i) => (
          <li key={c.sha + i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm">{c.message}</p>
              <p className="text-xs text-muted">
                {c.author} · {formatAgo(c.createdAt)}
              </p>
            </div>
            <Link to="/$owner/$repo/blob/$" params={{ owner, repo: name, _splat: c.files[0] || "README.md" }} className="font-mono text-xs text-seal">
              {c.sha.slice(0, 7)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
