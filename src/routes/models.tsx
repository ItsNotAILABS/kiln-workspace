import { createFileRoute, Link } from "@tanstack/react-router";
import { AGENT_ROLES } from "@/lib/kiln/types";
import { isFixtureRepo } from "@/lib/kiln/provenance";
import { useKiln, allRepos } from "@/lib/kiln/store";

export const Route = createFileRoute("/models")({ component: Models });

const MODEL_BLURBS: Record<string, string> = {
  "grok-4.6": "Default conductor. Long context, tool use, code.",
  "grok-4.5": "Studio one-shots. Fast enough to wait on.",
  "grok-4-fast": "Indexer and scout. Cheap tokens.",
  "grok-4": "General crew work.",
  "grok-3": "Legacy fallback.",
  "medina-phi": "Toroidal memory specialist. Beat-locked.",
  "neuro-bcvi": "Coherence-gated. Holds surge without phase lock.",
  "xcrew-edge": "72h offline. PQ transcripts.",
  "pocket-os": "POCKET native agent OS model.",
  "auro-native": "Auro native LLM family.",
  "capsula-1": "CapsulaBuilder default.",
  "sovereign-os": "Sovereign framework default.",
};

function Models() {
  const kiln = useKiln();
  // Model ids actually bound to repos in the forge — no invented entries.
  const bound = new Map<string, string[]>();
  for (const r of allRepos(kiln)) {
    if (isFixtureRepo(r)) continue;
    const list = bound.get(r.modelId) ?? [];
    list.push(r.id);
    bound.set(r.modelId, list);
  }
  const models = [...bound.entries()].sort((a, b) => b[1].length - a[1].length);
  return (
    <div>
      <h1 className="font-display text-4xl">Models</h1>
      <p className="mt-2 max-w-xl text-muted">
        Identifiers referenced by repositories — every entry below is declared by at least one real repo on this forge.
        Bound is a label, not a trained checkpoint: it means a repo points at this id, nothing more.
        Agents pick one. Studio uses grok-4.5.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {models.map(([id, repos]) => (
          <li key={id} className="panel p-4">
            <p className="font-mono text-sm text-seal">{id}</p>
            <p className="mt-2 text-sm text-muted">{MODEL_BLURBS[id] ?? "Repository-bound model."}</p>
            <p className="mt-3 text-[11px] text-subtle">
              {repos.length} repo{repos.length === 1 ? "" : "s"}:{" "}
              {repos.slice(0, 3).map((rid, i) => {
                const r = allRepos(kiln).find((s) => s.id === rid);
                return (
                  <span key={rid}>
                    {i > 0 && ", "}
                    {r ? (
                      <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="hover:text-seal">
                        {rid}
                      </Link>
                    ) : (
                      rid
                    )}
                  </span>
                );
              })}
              {repos.length > 3 && ` +${repos.length - 3} more`}
            </p>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 font-display text-2xl">Crew roles</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AGENT_ROLES.map((r) => (
          <li key={r.id} className="panel p-4">
            <p className="text-sm">{r.label}</p>
            <p className="mt-1 text-xs text-muted">{r.blurb}</p>
            <p className="mt-2 text-xs text-subtle">{r.priceKln} KLN</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
