import { useEffect, useState } from "react";
import { swarmCapabilities } from "@/lib/kiln/swarm";
import type { CapabilitiesView } from "@/lib/kiln/swarm-proxy";

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
