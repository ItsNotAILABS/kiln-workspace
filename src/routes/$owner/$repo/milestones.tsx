import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { allIssues, findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/milestones")({
  component: Milestones,
});

function Milestones() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  if (!repo) return null;
  const rows = kiln.milestones.filter((m) => m.repoId === repo.id);
  const issues = allIssues(kiln).filter((i) => i.repoId === repo.id);
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl">Milestones</h1>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) kiln.createMilestone(repo.id, title.trim(), description);
            setTitle("");
            setDescription("");
          }}
        >
          <input className="input w-40" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <input className="input w-56" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <button type="submit" className="btn h-9">
            New milestone
          </button>
        </form>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map((m) => {
          const hit = issues.filter((i) => i.milestone === m.title);
          const closed = hit.filter((i) => i.state === "closed").length;
          const open = hit.filter((i) => i.state === "open").length;
          const pct = hit.length ? Math.round((closed / hit.length) * 100) : 0;
          return (
            <li key={m.id} className="panel p-4">
              <p className="font-display text-xl">{m.title}</p>
              <p className="text-sm text-muted">{m.description}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-ok" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-subtle">
                {pct}% complete · {open} open · {closed} closed
                {m.due ? ` · due ${m.due}` : ""}
              </p>
              <Link to="/$owner/$repo/issues" params={{ owner, repo: name }} className="mt-2 inline-block text-sm text-seal hover:underline">
                Issues
              </Link>
            </li>
          );
        })}
        {!rows.length ? <p className="text-sm text-muted">No milestones.</p> : null}
      </ul>
    </div>
  );
}
