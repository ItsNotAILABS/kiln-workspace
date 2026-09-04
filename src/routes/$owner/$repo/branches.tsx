import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatAgo } from "@/lib/utils";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/branches")({
  component: Branches,
});

function Branches() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [n, setN] = useState("");
  if (!repo) return null;
  const rows = kiln.branches.filter((b) => b.repoId === repo.id);
  const list = rows.length ? rows : [{ name: repo.defaultBranch, sha: repo.files[0]?.sha ?? "main", protected: true, repoId: repo.id, updatedAt: repo.updatedAt }];
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Branches</h1>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (n.trim()) kiln.createBranch(repo.id, n.trim());
            setN("");
          }}
        >
          <input className="input w-48" value={n} onChange={(e) => setN(e.target.value)} placeholder="new-branch" />
          <button type="submit" className="btn h-9">
            New branch
          </button>
        </form>
      </div>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {list.map((b) => (
          <li key={b.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-mono text-sm">
                {b.name}
                {b.name === repo.defaultBranch ? <span className="ml-2 chip">default</span> : null}
                {b.protected ? <span className="ml-2 chip">protected</span> : null}
              </p>
              <p className="text-xs text-muted">
                {b.sha.slice(0, 7)} · {formatAgo(b.updatedAt)}
              </p>
            </div>
            <Link to="/$owner/$repo/compare" params={{ owner, repo: name }} search={{ base: repo.defaultBranch, head: b.name }} className="text-sm text-seal hover:underline">
              New pull
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
