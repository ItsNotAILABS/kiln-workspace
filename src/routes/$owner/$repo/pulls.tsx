import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatAgo } from "@/lib/utils";
import { allPulls, findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/pulls")({
  component: Pulls,
});

function Pulls() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [openForm, setOpenForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [from, setFrom] = useState("work");
  if (!repo) return null;
  const rows = allPulls(kiln).filter((p) => p.repoId === repo.id);
  const branches = kiln.branches.filter((b) => b.repoId === repo.id);
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{rows.filter((p) => p.state === "open").length} open · {rows.filter((p) => p.state === "merged").length} merged</p>
        <button type="button" className="btn-primary btn h-8" onClick={() => setOpenForm((v) => !v)}>
          New pull
        </button>
      </div>
      {openForm ? (
        <form
          className="panel mt-4 space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            kiln.createPull(repo.id, title, body, from);
            setTitle("");
            setBody("");
            setOpenForm(false);
          }}
        >
          <input className="input" required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input" placeholder="What does this change?" value={body} onChange={(e) => setBody(e.target.value)} />
          <label className="block text-sm">
            From branch
            <input className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <p className="text-xs text-subtle">Known: {branches.map((b) => b.name).join(", ") || "main"}</p>
          <button type="submit" className="btn-primary btn h-9">
            Create pull request
          </button>
        </form>
      ) : null}
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <Link to="/$owner/$repo/pulls/$n" params={{ owner, repo: name, n: String(p.number) }} className="font-medium hover:text-seal">
              {p.title}
            </Link>
            <p className="mt-1 text-xs text-muted">
              #{p.number} {p.state} · {p.fromBranch} → {p.toBranch} · {p.author} · {formatAgo(p.createdAt)} · +{p.additions}/−{p.deletions}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
