import { createServerFn } from "@tanstack/react-start";

export type FleetService = {
  id: string;
  name: string;
  port: number;
  repo: string;
  /** POCKET going down is an ASAP moment — it has its own watchers/keep-alive. */
  asap: boolean;
};

export const FLEET: FleetService[] = [
  { id: "forge", name: "KILN forge", port: 8080, repo: "ItsNotAILABS/kiln-workspace", asap: false },
  { id: "capsula", name: "CapsulaBuilder", port: 8081, repo: "ItsNotAILABS/CapsulaBuilder", asap: false },
  { id: "sovereign", name: "Sovereign Engine", port: 8082, repo: "FreddyCreates/sovereign-engine", asap: false },
  { id: "neurospace", name: "NeurospaceAI", port: 8084, repo: "ItsNotAILABS/Neurospaceai", asap: false },
  { id: "pocket", name: "POCKET host", port: 8787, repo: "ItsNotAILABS/pocket", asap: true },
];

export type FleetProbe = FleetService & {
  up: boolean;
  ms: number | null;
  status: number | null;
  checkedAt: string;
};

async function probe(s: FleetService): Promise<FleetProbe> {
  const started = Date.now();
  try {
    const r = await fetch(`http://127.0.0.1:${s.port}/`, {
      signal: AbortSignal.timeout(2500),
      redirect: "manual",
    });
    // Any HTTP response (even 404/500) means the service is listening.
    await r.body?.cancel().catch(() => {});
    return { ...s, up: true, ms: Date.now() - started, status: r.status, checkedAt: new Date().toISOString() };
  } catch {
    return { ...s, up: false, ms: null, status: null, checkedAt: new Date().toISOString() };
  }
}

/**
 * Probe the ecosystem port map from the machine serving this app.
 *
 * Meaningful when the forge runs on the operator's own machine (the
 * services are localhost-bound). From a remote deployment the probes
 * describe the deployment host instead — the page says so.
 */
export const fleetStatus = createServerFn({ method: "GET" }).handler(async () => {
  const results = await Promise.all(FLEET.map(probe));
  return { ok: true as const, services: results };
});
