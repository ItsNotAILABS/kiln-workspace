import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { allPulls, findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/compare")({
  validateSearch: (s: Record<string, unknown>) => ({ base: String(s.base ?? "main"), head: String(s.head ?? "") }),
  component: Compare,
});

function Compare() {
  const { owner, repo: name } = Route.useParams();
  const { base, head } = Route.useSearch();
  const kiln = useKiln();
  const nav = useNavigate();
  const repo = findRepo(kiln, owner, name);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  if (!repo) return null;
  const branches = kiln.branches.filter((b) => b.repoId === repo.id);
  const names = branches.length ? branches.map((b) => b.name) : [repo.defaultBranch, "work"];
  const from = head || names.find((n) => n !== base) || names[0]!;
  const existing = allPulls(kiln).filter((p) => p.repoId === repo.id && p.fromBranch === from && p.toBranch === base);
  return (
    <div className="mt-5 mx-auto max-w-2xl">
      <h1 className="font-display text-3xl">Compare</h1>
      <p className="mt-2 text-sm text-muted">Open a pull request from any branch into {base}.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Base
          <select className="input mt-1" value={base} onChange={(e) => nav({ to: "/$owner/$repo/compare", params: { owner, repo: name }, search: { base: e.target.value, head: from } })}>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Compare
          <select className="input mt-1" value={from} onChange={(e) => nav({ to: "/$owner/$repo/compare", params: { owner, repo: name }, search: { base, head: e.target.value } })}>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 font-mono text-sm text-seal">
        {base} ← {from}
      </p>
      {existing.length ? (
        <p className="mt-4 text-sm">
          Already open:{" "}
          <Link to="/$owner/$repo/pulls/$n" params={{ owner, repo: name, n: String(existing[0]!.number) }} className="text-seal hover:underline">
            #{existing[0]!.number} {existing[0]!.title}
          </Link>
        </p>
      ) : (
        <form
          className="panel mt-6 space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const p = kiln.createPull(repo.id, title || `${from} into ${base}`, body, from);
            if (p) nav({ to: "/$owner/$repo/pulls/$n", params: { owner, repo: name, n: String(p.number) } });
          }}
        >
          <input className="input" required placeholder="Pull request title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input min-h-32" placeholder="What does this change?" value={body} onChange={(e) => setBody(e.target.value)} />
          <button type="submit" className="btn-primary btn h-9">
            Create pull request
          </button>
        </form>
      )}
    </div>
  );
}
