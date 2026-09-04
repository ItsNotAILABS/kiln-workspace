import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { formatAgo } from "@/lib/utils";
import { allPulls, findRepo, useKiln } from "@/lib/kiln/store";
import type { MergeMethod } from "@/lib/kiln/types";

export const Route = createFileRoute("/$owner/$repo/pulls/$n")({
  component: PullDetail,
});

function PullDetail() {
  const { owner, repo: name, n } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const pull = allPulls(kiln).find((p) => p.repoId === repo?.id && String(p.number) === n);
  const [tab, setTab] = useState<"conversation" | "commits" | "checks" | "files">("conversation");
  const [body, setBody] = useState("");
  const [method, setMethod] = useState<MergeMethod>("merge");
  if (!repo || !pull) return <p className="py-16 text-center text-muted">Pull not found.</p>;
  const runs = kiln.actionRuns.filter((r) => r.repoId === repo.id).slice(0, 4);
  const approved = pull.reviews.some((r) => r.state === "approve");
  return (
    <div className="mt-5">
      <p className="text-xs text-muted">
        <Link to="/$owner/$repo/pulls" params={{ owner, repo: name }} className="hover:text-fg">
          Pulls
        </Link>{" "}
        / #{pull.number}
      </p>
      <h1 className="mt-2 font-display text-3xl">{pull.title}</h1>
      <p className="mt-1 text-sm text-muted">
        <span className={pull.state === "merged" ? "text-seal" : pull.state === "open" ? "text-ok" : "text-muted"}>{pull.state}</span>
        {pull.mergeMethod ? ` · ${pull.mergeMethod}` : ""} · {pull.fromBranch} → {pull.toBranch} · {pull.author} · {formatAgo(pull.createdAt)} · +{pull.additions}/−{pull.deletions}
      </p>
      <div className="mt-4 inline-flex flex-wrap rounded-sm border border-border text-sm">
        {(["conversation", "commits", "checks", "files"] as const).map((t) => (
          <button key={t} type="button" className={`px-3 py-1.5 capitalize ${tab === t ? "bg-surface" : "text-muted"}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "files" ? (
        <ul className="mt-4 space-y-3">
          {(pull.files.length ? pull.files : [{ path: "(no diff yet)", patch: pull.body, additions: pull.additions, deletions: pull.deletions }]).map((f) => (
            <li key={f.path} className="overflow-hidden rounded-xl border border-border">
              <p className="border-b border-border bg-surface px-3 py-2 font-mono text-xs">
                {f.path} · +{f.additions}/−{f.deletions}
              </p>
              <pre className="overflow-auto p-3 font-mono text-[12px] text-muted">{f.patch}</pre>
            </li>
          ))}
        </ul>
      ) : tab === "commits" ? (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          <li className="px-4 py-3 text-sm">
            <p className="font-mono text-xs text-subtle">{pull.txHash || pull.id}</p>
            <p>{pull.title}</p>
            <p className="text-xs text-muted">
              {pull.author} · {formatAgo(pull.createdAt)}
            </p>
          </li>
        </ul>
      ) : tab === "checks" ? (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {(runs.length ? runs : [{ id: "c0", workflow: "ci", status: "success", sha: "—", createdAt: pull.createdAt, duration: "12s", event: "pull_request", branch: pull.fromBranch, repoId: repo.id, logs: [] }]).map((r) => (
            <li key={r.id} className="flex justify-between px-4 py-3 text-sm">
              <span>
                <span className={r.status === "success" ? "text-ok" : r.status === "failure" ? "text-danger" : "text-seal"}>{r.status}</span>
                <span className="ml-2">{r.workflow}</span>
              </span>
              <span className="text-xs text-subtle">{r.duration}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_16rem]">
          <div className="space-y-3">
            <div className="panel p-5">
              <Markdown source={pull.body} />
            </div>
            {pull.reviews.map((r, i) => (
              <div key={i} className="panel p-4">
                <p className="text-xs uppercase tracking-wide text-subtle">{r.state}</p>
                <p className="mt-1 text-sm">
                  {r.author} · {r.body}
                </p>
              </div>
            ))}
            {pull.comments.map((c) => (
              <div key={c.id} className="panel p-4">
                <p className="text-xs text-muted">
                  {c.author} · {formatAgo(c.createdAt)}
                </p>
                <div className="mt-2">
                  <Markdown source={c.body} />
                </div>
              </div>
            ))}
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (body.trim()) kiln.commentPull(pull.id, body);
                setBody("");
              }}
            >
              <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Comment" />
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn h-9">
                  Comment
                </button>
                <button type="button" className="btn h-9" onClick={() => kiln.reviewPull(pull.id, "approve", "Looks good")}>
                  Approve
                </button>
                <button type="button" className="btn h-9" onClick={() => kiln.reviewPull(pull.id, "request", "Please revise")}>
                  Request changes
                </button>
                {pull.state === "open" ? (
                  <button type="button" className="btn h-9" onClick={() => kiln.closePull(pull.id)}>
                    Close pull
                  </button>
                ) : null}
              </div>
            </form>
          </div>
          <aside className="space-y-3">
            {pull.state === "open" ? (
              <div className="panel space-y-2 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Merge</p>
                <p className="text-sm">{approved ? "Approved. Ready to merge." : "Waiting on review."}</p>
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value as MergeMethod)}>
                  <option value="merge">Create a merge commit</option>
                  <option value="squash">Squash and merge</option>
                  <option value="rebase">Rebase and merge</option>
                </select>
                <button type="button" className="btn-primary btn h-9 w-full" onClick={() => kiln.mergePull(pull.id, method)}>
                  {method === "squash" ? "Squash and merge" : method === "rebase" ? "Rebase and merge" : "Merge pull request"}
                </button>
              </div>
            ) : (
              <div className="panel p-4 text-sm text-muted">This pull is {pull.state}.</div>
            )}
            <div className="panel p-4 text-sm">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Reviewers</p>
              <p className="mt-2">{pull.reviews.map((r) => r.author).join(", ") || "None"}</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
