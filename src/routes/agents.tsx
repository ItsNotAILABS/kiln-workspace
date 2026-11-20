import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { swarmCapabilities } from "@/lib/kiln/swarm";
import type { CapabilitiesView } from "@/lib/kiln/swarm-proxy";
import { ForgeVersion, ForgeDoors } from "@/components/ForgeVersion";

export const Route = createFileRoute("/agents")({ component: Agents });

const STEPS: { title: string; body: string; call: string }[] = [
  {
    title: "1 · Discover",
    body: "The forge describes itself. Version, abilities, endpoints, and MCP tools — nothing is assumed, and the full machine-readable spec is published.",
    call: "GET /v1/capabilities  ·  GET /v1/openapi.json",
  },
  {
    title: "2 · Install",
    body: "The Agent Kit installs from the forge's own repo (auro/kiln-agent-kit): the SDK (@itsnotailabs/kiln-agent-kit), the kiln-kit CLI, a skill, and an MCP config. No registry, no vendor lock-in.",
    call: "git clone <forge>/auro/kiln-agent-kit",
  },
  {
    title: "3 · Import",
    body: "A local project becomes a forge repo: created if needed, pushed, attached to a workspace, described — then read back live as proof it landed.",
    call: "kiln-kit import <dir> --workspace <id>",
  },
  {
    title: "4 · Organize",
    body: "Workspaces are the organizing primitive: a named, nestable group of repos and sites. A product nests under a lab; status rolls up the whole subtree in one call.",
    call: "POST /v1/workspaces  ·  kiln_workspace_create",
  },
  {
    title: "5 · Verify",
    body: "Every claim in this flow is a read-back from the live API. The kit's guardrails — token never printed, deletes guarded by slug, no daemon-lifecycle verbs, errors verbatim — are what let many agents build matching instead of breaking the forge for each other.",
    call: "GET /v1/workspaces/:id  ·  GET /v1/repos/:owner/:repo/details",
  },
];

function Agents() {
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
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-5xl">Agents</h1>
      <p className="mt-4 text-muted">
        KILN is a forge for people <em>and</em> AI. This page is written for the second
        audience: what the agent flow is, what it is for, and the exact doors in. An agent
        with a forge token can do everything a user can — discover the forge, create and
        organize workspaces, import projects, and read live project details — through open
        interfaces, with no insider knowledge.
      </p>
      <p className="mt-3 text-muted">
        Three doors, one forge: the REST API and SDK, the CLI, and MCP tools expose the
        same abilities against the same daemon, local or through the cloud door at
        kiln.pocketnova.app. What changes in one door is immediately true in the others.
      </p>

      <div className="mt-8 space-y-4">
        {STEPS.map((s) => (
          <div key={s.title} className="panel p-5">
            <p className="font-display text-xl">{s.title}</p>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
            <p className="mt-3 font-mono text-xs text-subtle">{s.call}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-3xl">Live abilities</h2>
      <p className="mt-2 text-sm text-muted">
        Read from the daemon&apos;s capabilities registry just now — the same document an
        agent discovers first.
      </p>
      {caps ? (
        <div className="mt-4 space-y-4">
          {caps.abilities.map((a) => (
            <div key={a.id} className="panel p-5">
              <p className="font-mono text-sm">{a.id}</p>
              <p className="mt-1 text-sm text-muted">{a.title}</p>
              <p className="mt-3 font-mono text-xs text-subtle">
                {a.endpoints.join("  ·  ")}
              </p>
              {a.mcpTools.length > 0 && (
                <p className="mt-1 font-mono text-xs text-subtle">
                  MCP: {a.mcpTools.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-muted">
          The registry did not answer ({error}) — abilities are never listed from memory.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      )}

      <ForgeVersion />
      <ForgeDoors />
    </div>
  );
}
