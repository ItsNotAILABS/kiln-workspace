import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  swarmDaemonStatus,
  swarmGitRepos,
  swarmJobs,
  swarmNodeLogs,
  swarmNodes,
  swarmSpawnNode,
  swarmStopNode,
  swarmSubmitJob,
  swarmVerifyReceipts,
} from "@/lib/kiln/swarm";
import { SWARM_TEMPLATES } from "@/lib/kiln/swarm-templates";
import type {
  GitRepoView,
  ReceiptResult,
  SwarmDaemonStatus,
  SwarmJobView,
  SwarmNodeView,
} from "@/lib/kiln/swarm-proxy";

export const Route = createFileRoute("/swarm")({ component: SwarmConsole });

const CAPS = [
  { bit: 1, label: "commit" },
  { bit: 2, label: "release" },
  { bit: 4, label: "propose" },
  { bit: 8, label: "delegate" },
];

function statusDot(status: string) {
  const color =
    status === "idle" ? "bg-green-500" : status === "working" ? "bg-amber-400" : "bg-red-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function expiryLabel(expiresAt: number) {
  const d = new Date(expiresAt * 1000);
  const left = Math.round((d.getTime() - Date.now()) / 3600000);
  return `${d.toLocaleString()} (${left < 0 ? "expired" : `~${left}h left`})`;
}

function SwarmConsole() {
  const [daemon, setDaemon] = useState<SwarmDaemonStatus | null>(null);
  const [nodes, setNodes] = useState<SwarmNodeView[]>([]);
  const [jobs, setJobs] = useState<SwarmJobView[]>([]);
  const [repos, setRepos] = useState<GitRepoView[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await swarmDaemonStatus();
      if (s.ok) setDaemon(s.status);
    } catch {
      /* keep last */
    }
    const [n, j] = await Promise.all([swarmNodes().catch(() => null), swarmJobs().catch(() => null)]);
    if (n && n.ok) setNodes(n.nodes);
    else if (n && !n.ok) setNote(`nodes: ${n.error}${n.fix ? ` — ${n.fix}` : ""}`);
    if (j && j.ok) setJobs(j.jobs);
    const g = await swarmGitRepos().catch(() => null);
    if (g && g.ok) setRepos(g.repos);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Swarm</p>
      <h1 className="mt-3 font-display text-4xl leading-[0.95] sm:text-6xl">Console</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Headless worker processes with capability grants and signed receipts. Everything here
        executes for real against the local swarm daemon — nothing is staged.
      </p>

      {note && (
        <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-300">{note}</p>
        </div>
      )}

      <DaemonCard daemon={daemon} />
      <GitReposPanel repos={repos} />
      <NodeGrid nodes={nodes} onChange={refresh} />
      <LogViewer nodes={nodes} />
      <JobPanel jobs={jobs} onChange={refresh} />
      <SpawnForm onChange={refresh} />
      <ReceiptsPanel nodes={nodes} />
    </div>
  );
}

function DaemonCard({ daemon }: { daemon: SwarmDaemonStatus | null }) {
  if (!daemon) return <div className="panel mt-6 p-5 text-sm text-muted">Probing daemon…</div>;
  if (!daemon.up) {
    return (
      <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-5">
        <p className="font-medium text-red-400">Swarm daemon is down</p>
        <p className="mt-2 text-sm text-muted">
          The console talks to the daemon&apos;s local HTTP API. Start it with:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-sm text-red-200">
          {daemon.fix}
        </pre>
      </div>
    );
  }
  return (
    <div className="panel mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 p-5">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted">Daemon</p>
        <p className="mt-1 flex items-center gap-2 text-sm font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" /> running · pid {daemon.pid}
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted">API</p>
        <p className="mt-1 font-mono text-sm">{daemon.apiUrl}</p>
      </div>
      {daemon.startedAt && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted">Since</p>
          <p className="mt-1 text-sm">{new Date(daemon.startedAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

function GitReposPanel({ repos }: { repos: GitRepoView[] }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">KILN-native repos</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Git repositories hosted by this daemon itself — real bare repos served over
        smart HTTP. Cloning and fetching are public; creating and pushing need the
        daemon token.
      </p>
      {repos.length === 0 && (
        <p className="mt-3 text-sm text-muted">No repos yet — create one from the swarm CLI.</p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {repos.map((r) => (
          <div key={`${r.owner}/${r.repo}`} className="panel p-5">
            <p className="font-mono font-medium">
              {r.owner}/{r.repo}
            </p>
            <p className="mt-1 text-xs text-muted">
              created {new Date(r.createdAt).toLocaleString()}
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-widest text-muted">Clone</p>
            <code className="mt-1 block overflow-x-auto rounded-lg bg-black/40 p-2 font-mono text-xs">
              git clone {r.cloneUrl}
            </code>
          </div>
        ))}
      </div>
    </section>
  );
}

function NodeGrid({ nodes, onChange }: { nodes: SwarmNodeView[]; onChange: () => void }) {
  const stop = async (id: string, name: string) => {
    if (!window.confirm(`Stop worker ${name}?`)) return;
    const r = await swarmStopNode({ data: { id } });
    if (!r.ok) alert(r.error);
    onChange();
  };
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Workers</h2>
      {nodes.length === 0 && <p className="mt-3 text-sm text-muted">No nodes yet — spawn one below.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {nodes.map((n) => (
          <div key={n.id} className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-medium">
                {statusDot(n.status)} {n.name}
              </p>
              <span className="text-xs text-muted">{n.status}</span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted">{n.id.slice(0, 12)}…</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {n.capNames.map((c) => (
                <span key={c} className="rounded-md bg-surface px-2 py-0.5 text-xs">
                  {c}
                </span>
              ))}
            </div>
            <dl className="mt-3 space-y-1 text-xs text-muted">
              <div className="flex justify-between"><dt>pid</dt><dd className="font-mono">{n.workerPid ?? "—"}</dd></div>
              <div className="flex justify-between"><dt>mind</dt><dd>{n.mind}</dd></div>
              <div className="flex justify-between"><dt>grant expires</dt><dd>{expiryLabel(n.expiresAt)}</dd></div>
              {n.parent && <div className="flex justify-between"><dt>delegated by</dt><dd className="font-mono">{n.parent.slice(0, 12)}…</dd></div>}
            </dl>
            <button
              className="mt-4 rounded-lg border border-border px-3 py-1.5 text-xs"
              onClick={() => stop(n.id, n.name)}
            >
              Stop worker
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function LogViewer({ nodes }: { nodes: SwarmNodeView[] }) {
  const [nodeId, setNodeId] = useState("");
  const [stream, setStream] = useState<"stdout" | "stderr">("stdout");
  const [log, setLog] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!nodeId) return;
    const r = await swarmNodeLogs({ data: { id: nodeId, tail: 80, stream } });
    if (r.ok) setLog(r.log);
    else setLog(`error: ${r.error}`);
  }, [nodeId, stream]);
  useEffect(() => {
    if (!nodeId && nodes.length > 0) setNodeId(nodes[0].id);
  }, [nodes, nodeId]);
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Logs</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select className="input" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
        <div className="inline-flex rounded-lg border border-border text-sm">
          {(["stdout", "stderr"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`px-3 py-1.5 ${stream === s ? "bg-surface" : "text-muted"}`}
              onClick={() => setStream(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <button className="rounded-lg border border-border px-3 py-1.5 text-sm" onClick={load}>
          Load logs
        </button>
      </div>
      <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-border bg-black/30 p-4 font-mono text-xs leading-relaxed">
        {log ?? "Pick a worker and load its logs."}
      </pre>
    </section>
  );
}

function JobPanel({ jobs, onChange }: { jobs: SwarmJobView[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState(SWARM_TEMPLATES[0].id);
  const [planText, setPlanText] = useState(SWARM_TEMPLATES[0].plan);
  const [result, setResult] = useState<string | null>(null);
  const pick = (id: string) => {
    const t = SWARM_TEMPLATES.find((x) => x.id === id);
    if (t) {
      setTemplate(id);
      setPlanText(t.plan);
    }
  };
  const submit = async () => {
    setResult(null);
    let plan: { steps: { tool: string; args?: Record<string, unknown> }[] };
    try {
      plan = JSON.parse(planText);
    } catch {
      setResult("plan is not valid JSON");
      return;
    }
    const r = await swarmSubmitJob({ data: { name: name || undefined, plan } });
    if (r.ok) {
      setResult(`submitted ${r.id} — the daemon assigns it to an idle worker`);
      setName("");
    } else {
      setResult(`failed: ${r.error}${r.fix ? ` — ${r.fix}` : ""}`);
    }
    onChange();
  };
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Jobs</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {SWARM_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.blurb}
            onClick={() => pick(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${template === t.id ? "border-seal bg-surface" : "border-border text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="panel mt-4 space-y-3 p-5">
        <label className="block text-sm">
          Job name (optional)
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="nightly-report" />
        </label>
        <label className="block text-sm">
          Plan JSON — script-mind steps, executed for real
          <textarea
            className="input mt-1 min-h-40 font-mono text-xs"
            value={planText}
            onChange={(e) => setPlanText(e.target.value)}
            spellCheck={false}
          />
        </label>
        <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black" onClick={submit}>
          Submit job
        </button>
        {result && <p className="text-sm text-muted">{result}</p>}
      </div>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {jobs.length === 0 && <li className="p-4 text-sm text-muted">No jobs yet.</li>}
        {[...jobs].reverse().map((j) => (
          <li key={j.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted">{j.id}</span>
              <span className="text-sm font-medium">{j.name}</span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs ${
                  j.status === "done" ? "bg-green-500/15 text-green-400" : j.status === "failed" ? "bg-red-500/15 text-red-400" : "bg-amber-400/15 text-amber-300"
                }`}
              >
                {j.status}
              </span>
              {j.node && <span className="font-mono text-xs text-muted">→ {j.node.slice(0, 12)}…</span>}
            </div>
            {(j.summary || j.error) && (
              <p className="mt-1 truncate font-mono text-xs text-muted" title={j.summary || j.error}>
                {j.summary || j.error}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SpawnForm({ onChange }: { onChange: () => void }) {
  const [name, setName] = useState("");
  const [caps, setCaps] = useState<number[]>([1, 4]);
  const [repo, setRepo] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const toggle = (bit: number) =>
    setCaps((c) => (c.includes(bit) ? c.filter((b) => b !== bit) : [...c, bit]));
  const spawn = async () => {
    setResult(null);
    const bitmask = caps.reduce((a, b) => a | b, 0);
    const r = await swarmSpawnNode({
      data: { name, caps: bitmask, repo: repo || undefined, mind: "script" },
    });
    if (r.ok) {
      setResult(`spawned ${r.name} (${r.id.slice(0, 12)}…) — the daemon starts its worker process`);
      setName("");
      setRepo("");
    } else {
      setResult(`failed: ${r.error}${r.fix ? ` — ${r.fix}` : ""}`);
    }
    onChange();
  };
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Spawn worker</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        A whole new OS process with its own ed25519 identity and capability grant. Give it a repo
        and it really clones it as its working dir.
      </p>
      <div className="panel mt-4 space-y-3 p-5">
        <label className="block text-sm">
          Name
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="worker-3" />
        </label>
        <div className="text-sm">
          <p>Capabilities</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {CAPS.map((c) => (
              <label key={c.bit} className="flex items-center gap-2">
                <input type="checkbox" checked={caps.includes(c.bit)} onChange={() => toggle(c.bit)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        <label className="block text-sm">
          Repo to clone (optional)
          <input className="input mt-1 font-mono text-xs" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="/path/to/repo or git URL" />
        </label>
        <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black" onClick={spawn}>
          Spawn
        </button>
        {result && <p className="text-sm text-muted">{result}</p>}
      </div>
    </section>
  );
}

function ReceiptsPanel({ nodes }: { nodes: SwarmNodeView[] }) {
  const [results, setResults] = useState<ReceiptResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verify = async () => {
    setError(null);
    const r = await swarmVerifyReceipts({ data: {} });
    if (r.ok) setResults(r.results);
    else setError(`${r.error}${r.fix ? ` — ${r.fix}` : ""}`);
  };
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Receipts</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Every tool call a worker makes appends a canonical-JSON receipt signed with the
        node&apos;s ed25519 key, hash-chained. Verification is offline and cryptographic.
      </p>
      <button className="mt-4 rounded-lg border border-border px-4 py-2 text-sm" onClick={verify}>
        Verify receipts
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {results && (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {results.map((r) => (
            <li key={r.node} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">
                  {nodes.find((n) => n.id === r.node)?.name ?? r.node.slice(0, 12) + "…"}
                </p>
                <p className="font-mono text-xs text-muted">{r.count} receipts</p>
              </div>
              <span className={`rounded-md px-2 py-0.5 text-xs ${r.ok ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                {r.ok ? "OK — chain intact" : `BROKEN — ${r.error}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
