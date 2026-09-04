import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatAgo } from "@/lib/utils";
import { allIssues, allRepos, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/issues")({
  component: GlobalIssues,
});

function GlobalIssues() {
  const kiln = useKiln();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const me = kiln.wallet?.handle;
  const rows = allIssues(kiln).filter((i) => i.state === tab);
  const mine = rows.filter((i) => i.author === me || i.assignees.includes(me || ""));
  const shown = me ? mine.length ? mine : rows : rows;
  return (
    <div>
      <h1 className="font-display text-4xl">Issues</h1>
      <p className="mt-2 text-sm text-muted">Across every tree on this forge. Same surface as GitHub Issues.</p>
      <div className="mt-4 inline-flex rounded-sm border border-border text-sm">
        {(["open", "closed"] as const).map((t) => (
          <button key={t} type="button" className={`px-3 py-1.5 capitalize ${tab === t ? "bg-surface" : "text-muted"}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {shown.map((i) => {
          const repo = allRepos(kiln).find((r) => r.id === i.repoId);
          if (!repo) return null;
          return (
            <li key={i.id} className="px-4 py-3">
              <Link to="/$owner/$repo/issues/$n" params={{ owner: repo.owner, repo: repo.name, n: String(i.number) }} className="hover:text-seal">
                {i.title}
              </Link>
              <p className="text-xs text-muted">
                {i.repoId}#{i.number} · {i.author} · {formatAgo(i.createdAt)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
