import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { allCommits, allIssues, allPulls, findRepo, forkList, starCount, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/insights")({
  component: Insights,
});

function Insights() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [tab, setTab] = useState<"pulse" | "contributors" | "traffic" | "commits" | "dependency">("pulse");
  if (!repo) return null;
  const issues = allIssues(kiln).filter((i) => i.repoId === repo.id);
  const pulls = allPulls(kiln).filter((p) => p.repoId === repo.id);
  const commits = allCommits(repo);
  const forks = forkList(kiln, repo.id);
  const data = [
    { name: "Mon", commits: 4 },
    { name: "Tue", commits: 7 },
    { name: "Wed", commits: 3 },
    { name: "Thu", commits: 9 },
    { name: "Fri", commits: 5 },
    { name: "Sat", commits: 1 },
    { name: "Sun", commits: 2 },
  ];
  return (
    <div className="mt-5 space-y-6">
      <div className="flex flex-wrap gap-1 overflow-x-auto border-b border-border text-sm">
        {(["pulse", "contributors", "traffic", "commits", "dependency"] as const).map((t) => (
          <button key={t} type="button" className={`relative px-3 py-2 capitalize ${tab === t ? "text-fg" : "text-muted"}`} onClick={() => setTab(t)}>
            {t}
            {tab === t ? <span className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" /> : null}
          </button>
        ))}
        <Link to="/$owner/$repo/network" params={{ owner, repo: name }} className="px-3 py-2 text-muted hover:text-fg">
          Network
        </Link>
        <Link to="/$owner/$repo/forks" params={{ owner, repo: name }} className="px-3 py-2 text-muted hover:text-fg">
          Forks
        </Link>
        <Link to="/$owner/$repo/community" params={{ owner, repo: name }} className="px-3 py-2 text-muted hover:text-fg">
          Community
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Stars", starCount(repo, kiln)],
          ["Forks", repo.forks + forks.length],
          ["Open issues", issues.filter((i) => i.state === "open").length],
          ["Open pulls", pulls.filter((p) => p.state === "open").length],
        ].map(([k, v]) => (
          <div key={String(k)} className="panel p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{k}</p>
            <p className="mt-2 font-display text-3xl tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      {tab === "pulse" || tab === "commits" ? (
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{tab === "commits" ? "Code frequency" : "Pulse · commits this week"}</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="name" stroke="#5e5e5a" fontSize={11} />
                <YAxis stroke="#5e5e5a" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#121214", border: "1px solid #2a2a2e" }} />
                <Bar dataKey="commits" fill="#7a9aa8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
      {tab === "contributors" ? (
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Contributors</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[repo.owner, ...new Set([...issues.map((i) => i.author), ...commits.map((c) => c.author)])].slice(0, 12).map((h) => (
              <li key={h} className="flex justify-between">
                <Link to="/$owner" params={{ owner: h }} search={{ tab: "overview" }} className="font-mono hover:text-seal">
                  {h}
                </Link>
                <span className="text-muted">commits on {repo.defaultBranch}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {tab === "traffic" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Clones", 128],
            ["Unique cloners", 41],
            ["Views", 902],
            ["Unique visitors", 210],
            ["Referring sites", 12],
            ["Popular content", repo.files[0]?.path ?? "README.md"],
          ].map(([k, v]) => (
            <div key={String(k)} className="panel p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{k}</p>
              <p className="mt-2 font-display text-2xl tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
      {tab === "dependency" ? (
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Dependency graph</p>
          <p className="mt-2 text-sm text-muted">Manifests detected from the working tree. Dependabot alerts live on Security.</p>
          <ul className="mt-3 space-y-1 font-mono text-sm">
            {repo.files.filter((f) => /package.json|cargo.toml|go.mod|pyproject|requirements/i.test(f.path)).map((f) => (
              <li key={f.path}>{f.path}</li>
            ))}
            {!repo.files.some((f) => /package.json|cargo.toml|go.mod|pyproject|requirements/i.test(f.path)) ? <li className="font-sans text-muted">No manifests in this tree.</li> : null}
          </ul>
          <Link to="/$owner/$repo/security" params={{ owner, repo: name }} className="mt-3 inline-block text-sm text-seal hover:underline">
            Security alerts
          </Link>
        </div>
      ) : null}
    </div>
  );
}
