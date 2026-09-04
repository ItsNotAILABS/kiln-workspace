import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/security")({
  component: Security,
});

function Security() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [tab, setTab] = useState<"overview" | "policy" | "advisories" | "dependabot" | "code" | "secrets">("overview");
  if (!repo) return null;
  const alerts = kiln.alerts.filter((a) => a.repoId === repo.id);
  return (
    <div className="mt-5 space-y-6">
      <div className="flex flex-wrap gap-1 overflow-x-auto border-b border-border text-sm">
        {(["overview", "policy", "advisories", "dependabot", "code", "secrets"] as const).map((t) => (
          <button key={t} type="button" className={`relative px-3 py-2 capitalize ${tab === t ? "text-fg" : "text-muted"}`} onClick={() => setTab(t)}>
            {t === "code" ? "Code scanning" : t === "secrets" ? "Secret scanning" : t}
            {tab === t ? <span className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" /> : null}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Code scanning", "On · kiln-analyze"],
            ["Secret scanning", "On · push protection"],
            ["Dependabot", "On · weekly"],
          ].map(([k, v]) => (
            <div key={k} className="panel p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{k}</p>
              <p className="mt-2 text-sm">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
      {tab === "policy" ? (
        <div className="panel prose-kiln p-5 text-sm">
          <h2 className="font-display text-2xl">Security policy</h2>
          <p className="mt-3 text-muted">
            Report vulnerabilities privately. Do not open a public issue for unpatched secrets. Mail the owner of {repo.id} or file a private advisory.
          </p>
          <p className="mt-2 text-muted">Supported versions: the default branch and the latest tagged release.</p>
        </div>
      ) : null}
      {tab === "advisories" ? (
        <p className="text-sm text-muted">No published advisories on this tree.</p>
      ) : null}
      {tab === "overview" || tab === "dependabot" || tab === "code" || tab === "secrets" ? (
        <div>
          <h2 className="font-display text-2xl">Alerts</h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {alerts.length ? (
              alerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-sm">
                      <span className={a.severity === "critical" || a.severity === "high" ? "text-danger" : "text-muted"}>{a.severity}</span>
                      <span className="ml-2">{a.summary}</span>
                    </p>
                    <p className="text-xs text-subtle">
                      {a.package} · {a.state}
                    </p>
                  </div>
                  {a.state === "open" ? (
                    <div className="flex gap-2">
                      <button type="button" className="btn h-8" onClick={() => kiln.dismissAlert(a.id)}>
                        Dismiss
                      </button>
                      <button type="button" className="btn h-8" onClick={() => kiln.fixAlert(a.id)}>
                        Mark fixed
                      </button>
                    </div>
                  ) : (
                    <span className="text-ok text-xs">{a.state}</span>
                  )}
                </li>
              ))
            ) : (
              <li className="px-4 py-10 text-center text-sm text-muted">No alerts on this tree.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
