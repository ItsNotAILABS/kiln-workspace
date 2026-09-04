import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Markdown } from "@/components/Markdown";
import { findRepo, kilnHost, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/preview")({
  component: Preview,
});

function Preview() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const html = useMemo(() => {
    if (!repo) return "";
    return repo.files.find((f) => f.path === "index.html" || f.path.endsWith("/index.html"))?.content ?? "";
  }, [repo]);
  if (!repo) return null;
  const host = kiln.domains.find((d) => d.repoId === repo.id)?.host ?? kilnHost(repo.owner, repo.name);
  const logs = [`git clone kiln://${repo.id}.git`, `capsule boot · ${repo.files.length} objects`, `bound model ${repo.modelId}`, `https://${host}`];
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted">
          <span className="font-mono text-seal">{host}</span>
          <span>capsule live</span>
        </div>
        {html ? (
          <iframe title="preview" className="h-[28rem] w-full bg-white" srcDoc={html} sandbox="allow-scripts" />
        ) : (
          <div className="max-h-[28rem] overflow-auto bg-surface p-6">
            <Markdown source={repo.readme || "_No index.html. README is the preview._"} />
          </div>
        )}
      </div>
      <aside className="panel p-4 font-mono text-[12px] text-muted">
        <p className="text-[11px] uppercase tracking-[0.16em]">Computer log</p>
        <ul className="mt-2 space-y-1">
          {logs.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
