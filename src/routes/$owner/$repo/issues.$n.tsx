import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { formatAgo } from "@/lib/utils";
import { allIssues, findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/issues/$n")({
  component: IssueDetail,
});

function IssueDetail() {
  const { owner, repo: name, n } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const issue = allIssues(kiln).find((i) => i.repoId === repo?.id && String(i.number) === n);
  const [body, setBody] = useState("");
  if (!repo || !issue) return <p className="py-16 text-center text-muted">Issue not found.</p>;
  const labels = kiln.labels.filter((l) => l.repoId === repo.id);
  const miles = kiln.milestones.filter((m) => m.repoId === repo.id);
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div>
        <p className="text-xs text-muted">
          <Link to="/$owner/$repo/issues" params={{ owner, repo: name }} className="hover:text-fg">
            Issues
          </Link>{" "}
          / #{issue.number}
        </p>
        <h1 className="mt-2 font-display text-3xl">{issue.title}</h1>
        <p className="mt-1 text-sm text-muted">
          <span className={issue.state === "open" ? "text-ok" : "text-muted"}>{issue.state}</span> · {issue.author} · {formatAgo(issue.createdAt)}
        </p>
        <div className="panel mt-4 p-5">
          <Markdown source={issue.body} />
        </div>
        <ul className="mt-4 space-y-3">
          {issue.comments.map((c) => (
            <li key={c.id} className="panel p-4">
              <p className="text-xs text-muted">
                {c.author} · {formatAgo(c.createdAt)}
              </p>
              <div className="mt-2">
                <Markdown source={c.body} />
              </div>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            kiln.commentIssue(issue.id, body);
            setBody("");
          }}
        >
          <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leave a comment" />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary btn h-9">
              Comment
            </button>
            <button type="button" className="btn h-9" onClick={() => kiln.setIssueState(issue.id, issue.state === "open" ? "closed" : "open")}>
              {issue.state === "open" ? "Close issue" : "Reopen"}
            </button>
          </div>
        </form>
      </div>
      <aside className="space-y-3 text-sm">
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Assignees</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(issue.assignees.length ? issue.assignees : ["—"]).map((a) => (
              <span key={a} className="chip">
                {a}
              </span>
            ))}
          </div>
          <button type="button" className="mt-2 text-xs text-seal hover:underline" onClick={() => kiln.assignIssue(issue.id, kiln.wallet?.handle || "you")}>
            Assign yourself
          </button>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Labels</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {labels.slice(0, 10).map((l) => {
              const on = issue.labels.includes(l.name);
              return (
                <button
                  key={l.name}
                  type="button"
                  className={`chip ${on ? "border-seal text-fg" : ""}`}
                  onClick={() => kiln.setIssueLabels(issue.id, on ? issue.labels.filter((x) => x !== l.name) : [...issue.labels, l.name])}
                >
                  {l.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Milestone</p>
          <select className="input mt-2" value={issue.milestone ?? ""} onChange={(e) => kiln.setIssueMilestone(issue.id, e.target.value || undefined)}>
            <option value="">None</option>
            {miles.map((m) => (
              <option key={m.id}>{m.title}</option>
            ))}
          </select>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Bounty</p>
          <p className="mt-2 tabular-nums text-fg">{issue.bountyKln ? `${issue.bountyKln} KLN · ${issue.bountyStatus}` : "None"}</p>
        </div>
      </aside>
    </div>
  );
}
