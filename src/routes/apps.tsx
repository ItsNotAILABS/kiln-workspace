import { createFileRoute } from "@tanstack/react-router";
import { KILN_APPS } from "@/lib/kiln/seed";

export const Route = createFileRoute("/apps")({ component: Apps });

function Apps() {
  return (
    <div>
      <h1 className="font-display text-4xl">Apps & add-ons</h1>
      <p className="mt-2 max-w-xl text-muted">Installed on the repository computer. Permissions are grants, not OAuth theater.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KILN_APPS.map((a) => (
          <li key={a.id} className="panel p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{a.category}</p>
            <p className="mt-1 font-display text-2xl">{a.name}</p>
            <p className="text-xs text-subtle">{a.publisher}</p>
            <p className="mt-2 text-sm text-muted">{a.blurb}</p>
            <button type="button" className="btn mt-4 h-8">
              Install
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
