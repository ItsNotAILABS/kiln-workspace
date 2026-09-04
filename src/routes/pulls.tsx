import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatAgo } from "@/lib/utils";
import { allPulls, allRepos, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/pulls")({
  component: GlobalPulls,
});

function GlobalPulls() {
  const kiln = useKiln();
  const [tab, setTab] = useState<"open" | "merged" | "closed">("open");
  const rows = allPulls(kiln).filter((p) => p.state === tab);
  return (
    <div>
      <h1 className="font-display text-4xl">Pull requests</h1>
      <p className="mt-2 text-sm text-muted">Review, approve, merge — squash, rebase, or a merge commit.</p>
      <div className="mt-4 inline-flex rounded-sm border border-border text-sm">
        {(["open", "merged", "closed"] as const).map((t) => (
          <button key={t} type="button" className={`px-3 py-1.5 capitalize ${tab === t ? "bg-surface" : "text-muted"}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows.map((p) => {
          const repo = allRepos(kiln).find((r) => r.id === p.repoId);
          if (!repo) return null;
          return (
            <li key={p.id} className="px-4 py-3">
              <Link to="/$owner/$repo/pulls/$n" params={{ owner: repo.owner, repo: repo.name, n: String(p.number) }} className="hover:text-seal">
                {p.title}
              </Link>
              <p className="text-xs text-muted">
                {p.repoId}#{p.number} · {p.fromBranch} → {p.toBranch} · {p.author} · {formatAgo(p.createdAt)}
              </p>
            </li>
          );
        })}
        {!rows.length ? <li className="px-4 py-10 text-center text-sm text-muted">No {tab} pulls.</li> : null}
      </ul>
    </div>
  );
}
