import { useMemo, useState } from "react";
import registry from "@/lib/kiln/registry.json" with { type: "json" };
import { chainState } from "@/lib/kiln/provenance";
import type { Repo } from "@/lib/kiln/types";
import {
  CAPABILITY_FLAGS,
  decodeCapabilities,
  encodeRegistryCall,
  isAddress,
  isBytes32,
} from "@/lib/kiln/capabilities";

type RegistryProject = {
  id: string;
  name: string;
  repository: string;
  role?: string;
  defaultBranch: string;
};

function findRegistryProject(owner: string, name: string): RegistryProject | undefined {
  const want = `${owner}/${name}`.toLowerCase();
  return (registry.projects as RegistryProject[]).find((p) => p.repository.toLowerCase() === want);
}

const STAGED_LABEL = "staged — no registry deployment recorded; nothing sent on-chain";

export function AgentGrantsPanel({ owner, repo }: { owner: string; repo: string }) {
  const project = useMemo(() => findRegistryProject(owner, repo), [owner, repo]);
  const [projectId, setProjectId] = useState("");
  const [agent, setAgent] = useState("");
  const [days, setDays] = useState("30");
  const [caps, setCaps] = useState<bigint>(1n);
  const [staged, setStaged] = useState<{ action: string; calldata: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const anchor = chainState({ owner } as Repo);

  if (!project) {
    return (
      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-2xl">Agent capabilities</h2>
        <p className="text-sm text-muted">
          {owner}/{repo} is not in the KILN project registry (ItsNotAILABS/KILN → projects/registry.json),
          so there is no on-chain identity to grant capabilities against.
        </p>
      </section>
    );
  }

  const toggleCap = (bit: bigint) => setCaps((c) => (c & bit) !== 0n ? c & ~bit : c | bit);

  const expiresAt = useMemo(() => {
    const n = Number(days);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(Date.now() / 1000) + Math.floor(n * 86400);
  }, [days]);

  const validate = (): string | null => {
    if (!isBytes32(projectId.trim())) return "Project ID must be a 32-byte hex string (0x + 64 hex chars), exactly as recorded on-chain at registration.";
    if (!isAddress(agent.trim())) return "Agent must be a valid 0x address (40 hex chars).";
    if (expiresAt === null) return "Expiry must be a positive number of days.";
    return null;
  };

  const stage = (fn: string, needsCaps: boolean) => {
    setError(null);
    setCopied(false);
    const problem = validate();
    if (problem) {
      setError(problem);
      setStaged(null);
      return;
    }
    const args: (string | bigint)[] =
      fn === "revokeAuthorization"
        ? [projectId.trim(), agent.trim()]
        : [projectId.trim(), agent.trim(), needsCaps ? caps : 0n, BigInt(expiresAt!)];
    try {
      const calldata = encodeRegistryCall(fn, args);
      setStaged({ action: fn, calldata });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStaged(null);
    }
  };

  const copyCalldata = async () => {
    if (!staged) return;
    try {
      await navigator.clipboard.writeText(staged.calldata);
      setCopied(true);
    } catch {
      setError("Clipboard unavailable — select the calldata text manually.");
    }
  };

  const decoded = decodeCapabilities(caps);

  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h2 className="font-display text-2xl">Agent capabilities</h2>
        <p className="text-sm text-muted">
          Registry project <span className="font-mono">{project.id}</span> ({project.repository}).
          {" "}Chain status:{" "}
          <span className="font-mono">{anchor.anchored ? `anchored at ${anchor.address.slice(0, 10)}…` : "not anchored"}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          Calldata below is encoded against the synced KilnOwnershipRegistry ABI and is ready to
          submit with your own signer. <span className="font-semibold">{STAGED_LABEL}.</span>
        </p>
      </div>

      <label className="block text-sm">
        Project ID (bytes32, as recorded on-chain at registration)
        <input
          className="input mt-1 font-mono"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="0x… (64 hex chars)"
          spellCheck={false}
        />
      </label>

      <label className="block text-sm">
        Agent address
        <input
          className="input mt-1 font-mono"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          placeholder="0x… (40 hex chars)"
          spellCheck={false}
        />
      </label>

      <label className="block text-sm">
        Expiry (days from now)
        <input
          className="input mt-1"
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        {expiresAt !== null ? (
          <span className="mt-1 block text-xs text-muted">→ {new Date(expiresAt * 1000).toISOString()}</span>
        ) : null}
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Capabilities (bitflags from the registry contract)</legend>
        {CAPABILITY_FLAGS.map((flag) => (
          <label key={flag.name} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={(caps & flag.bit) !== 0n}
              onChange={() => toggleCap(flag.bit)}
            />
            <span>
              <span className="font-mono">{flag.name}</span> <span className="text-muted">= {flag.bit.toString()}</span>
              <span className="block text-xs text-muted">
                {flag.description}
                {!flag.enforced ? " — the app never presents it as enforced." : ""}
              </span>
            </span>
          </label>
        ))}
        <p className="text-xs text-muted">
          Decoded mask: <span className="font-mono">{caps.toString()}</span> →{" "}
          <span className="font-mono">{decoded.length ? decoded.map((d) => d.name).join(" | ") : "(none)"}</span>
        </p>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn h-9" onClick={() => stage("authorizeAgent", true)}>
          Stage authorizeAgent
        </button>
        <button type="button" className="btn h-9" onClick={() => stage("delegateGrant", true)}>
          Stage delegateGrant
        </button>
        <button type="button" className="btn h-9" onClick={() => stage("revokeAuthorization", false)}>
          Stage revokeAuthorization
        </button>
      </div>
      <p className="text-xs text-muted">
        authorizeAgent / revokeAuthorization are called by the project owner. delegateGrant is called by
        an agent whose own live grant carries CAP_DELEGATE, and its capabilities/expiry may not exceed
        the caller's — the contract enforces that on-chain.
      </p>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {staged ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-mono text-sm">{staged.action}</h3>
            <button type="button" className="btn h-8 text-xs" onClick={copyCalldata}>
              {copied ? "Copied" : "Copy calldata"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-xs break-all whitespace-pre-wrap">
            {staged.calldata}
          </pre>
          <p className="text-xs font-semibold">{STAGED_LABEL}.</p>
        </div>
      ) : null}
    </section>
  );
}
