import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatAgo } from "@/lib/utils";
import { allIssues, findRepo, useKiln } from "@/lib/kiln/store";

const TEMPLATES = [
  { id: "blank", label: "Blank", title: "", body: "" },
  { id: "bug", label: "Bug report", title: "Bug: ", body: "## What happened\n\n## Expected\n\n## Repro\n" },
  { id: "feat", label: "Feature request", title: "Feat: ", body: "## Problem\n\n## Proposal\n" },
];

export const Route = createFileRoute("/$owner/$repo/issues")({
  component: Issues,
});

function Issues() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [author, setAuthor] = useState("");
  if (!repo) return null;
  const rows = allIssues(kiln).filter((i) => i.repoId === repo.id);
  const labels = kiln.labels.filter((l) => l.repoId === repo.id);
  const shown = rows.filter((i) => i.state === tab && (!label || i.labels.includes(label)) && (!author || i.author === author));
  const authors = [...new Set(rows.map((i) => i.author))];
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-sm border border-border text-sm">
            {(["open", "closed"] as const).map((t) => (
              <button key={t} type="button" className={`px-3 py-1.5 capitalize ${tab === t ? "bg-surface text-fg" : "text-muted"}`} onClick={() => setTab(t)}>
                {t} · {rows.filter((i) => i.state === t).length}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Link to="/$owner/$repo/labels" params={{ owner, repo: name }} className="btn h-8">
              Labels
            </Link>
            <Link to="/$owner/$repo/milestones" params={{ owner, repo: name }} className="btn h-8">
              Milestones
            </Link>
            <button type="button" className="btn-primary btn h-8" onClick={() => setOpen((v) => !v)}>
              New issue
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="input w-40" value={label} onChange={(e) => setLabel(e.target.value)}>
            <option value="">All labels</option>
            {labels.map((l) => (
              <option key={l.name}>{l.name}</option>
            ))}
          </select>
          <select className="input w-40" value={author} onChange={(e) => setAuthor(e.target.value)}>
            <option value="">All authors</option>
            {authors.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        {open ? (
          <form
            className="panel mt-4 space-y-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              kiln.createIssue(repo.id, title, body, label ? [label] : []);
              setTitle("");
              setBody("");
              setOpen(false);
            }}
          >
            <div className="flex flex-wrap gap-2 text-xs">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setTitle(t.title);
                    setBody(t.body);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input className="input" required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="input min-h-32" placeholder="Write a comment" value={body} onChange={(e) => setBody(e.target.value)} />
            <button type="submit" className="btn-primary btn h-9">
              Submit new issue
            </button>
          </form>
        ) : null}
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {shown.length === 0 ? <li className="px-4 py-10 text-center text-sm text-muted">No {tab} issues.</li> : null}
          {shown.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <Link to="/$owner/$repo/issues/$n" params={{ owner, repo: name, n: String(i.number) }} className="font-medium hover:text-seal">
                {i.title}
              </Link>
              <p className="mt-1 text-xs text-muted">
                #{i.number} opened {formatAgo(i.createdAt)} by {i.author}
                {i.assignees.length ? ` · assigned ${i.assignees.join(", ")}` : ""}
                {i.milestone ? ` · ${i.milestone}` : ""}
                {i.bountyKln ? ` · ${i.bountyKln} KLN ${i.bountyStatus}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {i.labels.map((l) => (
                  <button key={l} type="button" className="chip" onClick={() => setLabel(l)}>
                    {l}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <aside className="space-y-3 text-sm">
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Labels</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {labels.slice(0, 12).map((l) => (
              <button key={l.name} type="button" className="chip" onClick={() => setLabel(label === l.name ? "" : l.name)}>
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Bounties</p>
          <p className="mt-2 text-muted">KLN locks against issue ids. Maintainers never hold the purse.</p>
        </div>
      </aside>
    </div>
  );
}
