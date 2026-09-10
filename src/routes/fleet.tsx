import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fleetStatus, type FleetProbe } from "@/lib/kiln/fleet";

export const Route = createFileRoute("/fleet")({
  component: Fleet,
});

function Fleet() {
  const [services, setServices] = useState<FleetProbe[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval>;
    const load = () =>
      fleetStatus()
        .then((r) => {
          if (!cancelled && r.ok) {
            setServices(r.services);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "probe failed");
        });
    load();
    timer = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const pocket = services?.find((s) => s.id === "pocket");
  const down = services?.filter((s) => !s.up) ?? [];

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Fleet</p>
      <h1 className="mt-3 font-display text-4xl leading-[0.95] sm:text-6xl">What&apos;s up</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Live probes of the ecosystem port map, refreshed every 15 seconds. Probes run from the machine
        serving this app — on your own machine that&apos;s the real picture; from a remote preview
        they describe the deployment host instead.
      </p>

      {pocket && !pocket.up && (
        <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="font-medium text-red-400">POCKET is down — ASAP</p>
          <p className="mt-1 text-sm text-muted">
            POCKET has its own watchers and keep-alive. If it&apos;s down, something is wrong —
            check the host immediately.
          </p>
        </div>
      )}

      {error && <p className="mt-6 text-sm text-red-400">Probe error: {error}</p>}

      <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
        {(services ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${s.up ? "bg-emerald-400" : "bg-red-400"}`}
                  title={s.up ? "responding" : "not responding"}
                />
                {s.name}
                {s.asap && <span className="chip">asap on failure</span>}
              </p>
              <p className="mt-1 font-mono text-[11px] text-subtle">
                127.0.0.1:{s.port} · {s.repo}
              </p>
            </div>
            <p className="tabular-nums text-sm text-muted">
              {services === null ? "…" : s.up ? `${s.ms} ms · HTTP ${s.status}` : "down"}
            </p>
          </li>
        ))}
      </ul>

      {services && down.length === 0 && (
        <p className="mt-4 text-sm text-emerald-400">All {services.length} services responding.</p>
      )}
      {services && down.length > 0 && (
        <p className="mt-4 text-sm text-red-400">
          {down.length} service{down.length === 1 ? "" : "s"} down: {down.map((s) => s.name).join(", ")}.
        </p>
      )}
    </div>
  );
}
