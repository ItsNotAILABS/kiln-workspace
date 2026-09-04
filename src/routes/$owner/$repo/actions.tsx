import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { formatAgo } from "@/lib/utils";
import { findRepo, useKiln } from "@/lib/kiln/store";
import { SEED_WORKFLOWS } from "@/lib/kiln/seed";

export const Route = createFileRoute("/$owner/$repo/actions")({
  component: Actions,
});

function Actions() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [open, setOpen] = useState<string | null>(null);
  if (!repo) return null;
  const workflows = SEED_WORKFLOWS.filter((w) => w.repoId === repo.id);
  const runs = kiln.actionRuns.filter((r) => r.repoId === repo.id);
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="panel p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Workflows</p>
        <ul className="mt-2 space-y-1 text-sm">
          {(workflows.length ? workflows : [{ name: "ci", path: ".github/workflows/ci.yml", repoId: repo.id, on: ["push"], yaml: "" }]).map((w) => (
            <li key={w.name} className="flex items-center justify-between">
              <span>{w.name}</span>
              <button type="button" className="text-seal hover:underline" onClick={() => kiln.rerunAction(repo.id, w.name)}>
                Run
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div>
        <h2 className="font-display text-2xl">Runs</h2>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {runs.map((r) => (
            <li key={r.id}>
              <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <span>
                  <span className={r.status === "success" ? "text-ok" : r.status === "failure" ? "text-danger" : "text-seal"}>{r.status}</span>
                  <span className="ml-2">{r.workflow}</span>
                  <span className="ml-2 text-xs text-muted">
                    {r.event} · {r.branch} · {r.sha}
                  </span>
                </span>
                <span className="text-xs text-subtle">
                  {r.duration} · {formatAgo(r.createdAt)}
                </span>
              </button>
              {open === r.id ? (
                <pre className="border-t border-border bg-black/40 p-3 font-mono text-[12px] text-muted">{r.logs.join("\n")}</pre>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
