import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { findRepo, useKiln } from "@/lib/kiln/store";
import type { ProjectCard } from "@/lib/kiln/types";

const COLS: ProjectCard["column"][] = ["Backlog", "Ready", "In progress", "Done"];

export const Route = createFileRoute("/$owner/$repo/projects")({
  component: Projects,
});

function Projects() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [title, setTitle] = useState("");
  if (!repo) return null;
  const cards = kiln.projectCards.filter((c) => c.repoId === repo.id);
  return (
    <div className="mt-5">
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) kiln.addCard(repo.id, title.trim());
          setTitle("");
        }}
      >
        <input className="input max-w-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a card" />
        <button type="submit" className="btn h-9">
          Add
        </button>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLS.map((col) => (
          <div key={col} className="panel min-h-[20rem] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{col}</p>
            <ul className="mt-3 space-y-2">
              {cards
                .filter((c) => c.column === col)
                .map((c) => (
                  <li key={c.id} className="rounded-md border border-border bg-bg px-3 py-2 text-sm">
                    <p>{c.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {COLS.filter((x) => x !== col).map((x) => (
                        <button key={x} type="button" className="text-[10px] uppercase tracking-wide text-seal hover:underline" onClick={() => kiln.moveCard(c.id, x)}>
                          {x}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
