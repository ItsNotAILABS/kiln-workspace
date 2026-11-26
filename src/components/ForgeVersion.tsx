import { useEffect, useState } from "react";
import { swarmCapabilities, swarmDaemonStatus } from "@/lib/kiln/swarm";
import type { CapabilitiesView, SwarmDaemonStatus } from "@/lib/kiln/swarm-proxy";

/**
 * The forge's version surface. Everything except the kit line is read
 * LIVE from the daemon's /v1/capabilities at load — the discovery
 * document every agent starts from — so what this panel says is what
 * the API will actually do. The Agent Kit line is the kit's published
 * package version (a static label, marked as such): the kit is a
 * client of the API, not part of the daemon's registry.
 */
const KIT_PACKAGE = "@itsnotailabs/kiln-agent-kit";
const KIT_VERSION = "0.1.0";

export function ForgeVersion() {
  const [caps, setCaps] = useState<CapabilitiesView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    swarmCapabilities()
      .then((r) => {
        if (!live) return;
        if (r.ok) setCaps(r.capabilities);
        else setError(r.error);
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="panel mt-8 p-5">
      <p className="font-display text-lg">Forge version</p>
      {caps ? (
        <>
          <p className="mt-1 font-mono text-sm text-muted">
            KILN API v{caps.version} · {KIT_PACKAGE} v{KIT_VERSION}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {caps.abilities.map((a) => (
              <span
                key={a.id}
                className="rounded-full border px-2 py-0.5 font-mono text-xs text-muted"
                title={a.title}
              >
                {a.id}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle">
            Live from the daemon&apos;s capabilities registry — read from{" "}
            <span className="font-mono">/v1/capabilities</span> just now, not typed in by
            hand. Machine-readable spec:{" "}
            <span className="font-mono">{caps.openapi ?? "/v1/openapi.json"}</span>. The
            Agent Kit version is its published package version.
          </p>
        </>
      ) : error ? (
        <p className="mt-1 text-sm text-muted">
          Version unavailable right now — the daemon did not answer ({error}). Nothing here
          is guessed.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Loading…</p>
      )}
    </div>
  );
}

/**
 * One forge, two doors — coded, not just described. The forge is a
 * single daemon and registry on its host machine; it is reached two
 * ways: the LOCAL door (the app on that machine) and the CLOUD door
 * (this app deployed at kiln.pocketnova.app, whose server side talks
 * to the same daemon through its tunnel). Neither door stores state,
 * so neither can drift: what changes through one is immediately true
 * through the other. This panel states which door you are looking
 * through and whether the forge behind both is answering.
 */
const CLOUD_DOOR = "kiln.pocketnova.app";

export function ForgeDoors() {
  const [status, setStatus] = useState<SwarmDaemonStatus | null>(null);
  const [host, setHost] = useState<string>("");

  useEffect(() => {
    setHost(window.location.hostname);
    let live = true;
    swarmDaemonStatus()
      .then((r) => {
        if (live && r.ok) setStatus(r.status);
      })
      .catch(() => {
        /* status stays null — rendered as unknown, never guessed */
      });
    return () => {
      live = false;
    };
  }, []);

  const isCloud = host === CLOUD_DOOR || host.endsWith(".pages.dev");
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.");

  return (
    <div className="panel mt-4 p-5">
      <p className="font-display text-lg">One forge, two doors</p>
      <p className="mt-1 text-sm text-muted">
        {isCloud
          ? "You are looking through the cloud door — this deployment's server side reaches the same daemon, on its own machine, through its tunnel."
          : isLocal
            ? "You are looking through the local door — the app on the forge's own machine, talking to the daemon beside it."
            : `You are looking through the door at ${host || "this host"} — one of the entrances to the same forge.`}
      </p>
      <p className="mt-2 text-sm text-muted">
        {status === null
          ? "Forge status: checking…"
          : status.up
            ? `Forge daemon: up${status.pid ? ` (pid ${status.pid})` : ""} — one registry behind both doors; a change through either is immediately true through the other.`
            : `Forge daemon: not answering — ${status.fix ?? "status unknown"}. This door shows that plainly rather than stale data.`}
      </p>
      <p className="mt-2 font-mono text-xs text-subtle">
        cloud: https://{CLOUD_DOOR} · local: the app on the forge host (:8080) · daemon
        API: {status?.apiUrl ?? "127.0.0.1:18787"}
      </p>
    </div>
  );
}
