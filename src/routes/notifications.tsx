import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { formatAgo } from "@/lib/utils";
import { useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/notifications")({ component: Inbox });

function Inbox() {
  const kiln = useKiln();
  const [kind, setKind] = useState<string>("all");
  const rows = kiln.notices.filter((n) => kind === "all" || n.kind === kind);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-4xl">Inbox</h1>
        <button type="button" className="btn h-8" onClick={() => kiln.markNoticesRead()}>
          Mark all read
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {["all", "issue", "pull", "discuss", "release", "security", "ci", "star"].map((k) => (
          <button key={k} type="button" className={`btn h-8 ${kind === k ? "btn-primary" : ""}`} onClick={() => setKind(k)}>
            {k}
          </button>
        ))}
      </div>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
        {rows.map((n) => (
          <li key={n.id} className={`px-4 py-3 ${n.read ? "text-muted" : ""}`}>
            <a href={n.href} className="text-sm hover:text-seal">
              {n.title}
            </a>
            <p className="text-xs text-subtle">
              {n.kind} · {formatAgo(n.createdAt)}
            </p>
          </li>
        ))}
        {!rows.length ? <li className="px-4 py-10 text-center text-sm text-muted">All caught up.</li> : null}
      </ul>
    </div>
  );
}
