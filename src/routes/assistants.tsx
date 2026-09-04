import { createFileRoute } from "@tanstack/react-router";
import { AGENT_ROLES } from "@/lib/kiln/types";

export const Route = createFileRoute("/assistants")({ component: Assistants });

function Assistants() {
  return (
    <div>
      <h1 className="font-display text-4xl">Coding assistants</h1>
      <p className="mt-2 max-w-xl text-muted">Resident processes on the repo computer. Not a copilot overlay — they write the same sealed trees you write.</p>
      <ul className="mt-6 space-y-3">
        {AGENT_ROLES.map((r) => (
          <li key={r.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-display text-xl">{r.label}</p>
              <p className="text-sm text-muted">{r.blurb}</p>
            </div>
            <span className="text-sm text-subtle">{r.priceKln} KLN</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
