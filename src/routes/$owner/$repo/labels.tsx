import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/labels")({
  component: Labels,
});

function Labels() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [n, setN] = useState("");
  const [d, setD] = useState("");
  if (!repo) return null;
  const rows = kiln.labels.filter((l) => l.repoId === repo.id);
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl">Labels</h1>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (n.trim()) kiln.createLabel(repo.id, n.trim(), "#7a9aa8", d);
            setN("");
            setD("");
          }}
        >
          <input className="input w-40" value={n} onChange={(e) => setN(e.target.value)} placeholder="Name" />
          <input className="input w-56" value={d} onChange={(e) => setD(e.target.value)} placeholder="Description" />
          <button type="submit" className="btn h-9">
            New label
          </button>
        </form>
      </div>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows.map((l) => (
          <li key={l.name} className="flex items-center gap-3 px-4 py-3">
            <span className="chip" style={{ borderColor: l.color, color: l.color }}>
              {l.name}
            </span>
            <span className="text-sm text-muted">{l.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
