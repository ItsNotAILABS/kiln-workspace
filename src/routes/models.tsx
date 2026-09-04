import { createFileRoute } from "@tanstack/react-router";
import { AGENT_ROLES } from "@/lib/kiln/types";

export const Route = createFileRoute("/models")({ component: Models });

const MODELS = [
  { id: "grok-4.6", label: "Grok 4.6", blurb: "Default conductor. Long context, tool use, code." },
  { id: "grok-4.5", label: "Grok 4.5", blurb: "Studio one-shots. Fast enough to wait on." },
  { id: "grok-4-fast", label: "Grok 4 Fast", blurb: "Indexer and scout. Cheap tokens." },
  { id: "medina-phi", label: "MEDINA-φ", blurb: "Toroidal memory specialist. Beat-locked." },
  { id: "neuro-bcvi", label: "Neuro-BCVI", blurb: "Coherence-gated. Holds surge without phase lock." },
  { id: "xcrew-edge", label: "XCREW Edge", blurb: "72h offline. PQ transcripts." },
];

function Models() {
  return (
    <div>
      <h1 className="font-display text-4xl">Models</h1>
      <p className="mt-2 max-w-xl text-muted">Bound to repositories. Agents pick one. Studio uses grok-4.5.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {MODELS.map((m) => (
          <li key={m.id} className="panel p-4">
            <p className="font-mono text-sm text-seal">{m.id}</p>
            <p className="mt-1 font-display text-2xl">{m.label}</p>
            <p className="mt-2 text-sm text-muted">{m.blurb}</p>
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
