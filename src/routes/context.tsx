import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Database, RefreshCw, Search, ShieldCheck } from "lucide-react";
import {
  kilnContextIndex,
  kilnContextQuery,
  kilnContextReceiptsVerify,
  kilnContextSit,
  kilnContextStatus,
  kilnLocalNodes,
} from "@/lib/kiln/context.server";

export const Route = createFileRoute("/context")({ component: ContextFabric });

type ApiResult = { ok: boolean; status: number; error?: string; data?: any };

function short(value?: string | null, n = 12) {
  if (!value) return "—";
  return value.length <= n ? value : `${value.slice(0, n)}…`;
}

function ContextFabric() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [node, setNode] = useState("");
  const [query, setQuery] = useState("promotion policy, context provenance, and GitHub publishing");
  const [status, setStatus] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<"query" | "sit">("sit");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [verification, setVerification] = useState<any>(null);
  const [knownHashes, setKnownHashes] = useState<Record<string, string>>({});

  const pack = mode === "sit" ? result?.sit?.code : result?.pack;
  const memory = result?.sit?.memory;

  const emittedPaths = useMemo(
    () => (pack?.items || []).map((item: any) => item.path),
    [pack],
  );

  async function loadNodes() {
    setBusy("nodes");
    setError("");
    const res = (await kilnLocalNodes()) as ApiResult;
    setBusy("");
    if (!res.ok) return setError(res.error || "Could not reach the local KILN daemon.");
    const list = res.data?.nodes || [];
    setNodes(list);
    if (!node && list.length) setNode(list[0].id || list[0].name);
  }

  async function loadStatus(target = node) {
    if (!target) return;
    const res = (await kilnContextStatus({ data: { node: target } })) as ApiResult;
    if (res.ok) setStatus(res.data?.index || null);
  }

  async function buildIndex() {
    if (!node) return setError("Choose a KILN node first.");
    setBusy("index");
    setError("");
    const res = (await kilnContextIndex({ data: { node } })) as ApiResult;
    setBusy("");
    if (!res.ok) return setError(res.error || "Index build failed.");
    setStatus(res.data?.index || null);
  }

  async function runContext(nextMode: "query" | "sit", delta = false) {
    if (!node) return setError("Choose a KILN node first.");
    if (!query.trim()) return setError("Enter a repository question.");
    setBusy(nextMode + (delta ? "-delta" : ""));
    setError("");
    const common = {
      node,
      query,
      maxBytes: nextMode === "sit" ? 18000 : 24000,
      maxChunks: nextMode === "sit" ? 10 : 12,
      knownHashes: delta ? knownHashes : {},
    };
    const res = nextMode === "sit"
      ? (await kilnContextSit({ data: { ...common, memoryTokens: 1200 } })) as ApiResult
      : (await kilnContextQuery({ data: common })) as ApiResult;
    setBusy("");
    if (!res.ok) return setError(res.error || "Context query failed.");
    setMode(nextMode);
    setResult(res.data || null);
    const nextPack = nextMode === "sit" ? res.data?.sit?.code : res.data?.pack;
    const hashes: Record<string, string> = { ...knownHashes };
    for (const item of nextPack?.items || []) if (item.path && item.sha256) hashes[item.path] = item.sha256;
    for (const item of nextPack?.unchanged || []) if (item.path && item.sha256) hashes[item.path] = item.sha256;
    setKnownHashes(hashes);
    await loadStatus(node);
  }

  async function verifyReceipts() {
    setBusy("verify");
    setError("");
    const res = (await kilnContextReceiptsVerify()) as ApiResult;
    setBusy("");
    if (!res.ok) return setError(res.error || "Receipt verification failed.");
    setVerification(res.data);
  }

  useEffect(() => { void loadNodes(); }, []);
  useEffect(() => { if (node) void loadStatus(node); }, [node]);

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">FORNAX · Local cognition</p>
          <h1 className="mt-2 font-display text-5xl leading-none">Context Fabric</h1>
          <p className="mt-4 max-w-2xl text-muted">
            Query the exact Git worktree a KILN node is sitting in. Reuse content hashes across turns, fuse the node&apos;s own durable repository memory, and keep source out of audit receipts.
          </p>
        </div>
        <button className="btn h-10 gap-2" onClick={loadNodes} disabled={!!busy}>
          <RefreshCw className="size-4" /> Refresh nodes
        </button>
      </div>

      <section className="mt-7 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="panel p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Node / FORNAX workspace</p>
          <select
            className="mt-3 h-11 w-full rounded-md border border-border bg-bg px-3 font-mono text-sm"
            value={node}
            onChange={(e) => { setNode(e.target.value); setKnownHashes({}); setResult(null); }}
          >
            {!nodes.length ? <option value="">No local nodes found</option> : null}
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} · {n.status} · {String(n.id).slice(0, 10)}
              </option>
            ))}
          </select>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Metric label="Index" value={status ? short(status.digest) : "not built"} />
            <Metric label="Revision" value={short(status?.revision)} />
            <Metric label="Worktree" value={short(status?.worktreeDigest)} />
            <Metric label="State" value={status?.dirty ? "dirty" : status ? "clean" : "—"} />
          </div>
          <button className="btn-primary btn mt-4 h-10 w-full gap-2" onClick={buildIndex} disabled={!node || !!busy}>
            <Database className="size-4" /> {busy === "index" ? "Indexing…" : "Build / refresh index"}
          </button>
        </div>

        <div className="panel p-5">
          <label className="text-[11px] uppercase tracking-[0.16em] text-subtle">Repository question</label>
          <textarea
            className="mt-3 min-h-28 w-full rounded-md border border-border bg-bg p-3 text-sm outline-none focus:border-seal"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What does this node need to know?"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary btn h-10 gap-2" onClick={() => runContext("sit")} disabled={!node || !!busy}>
              <BrainCircuit className="size-4" /> Sit: code + memory
            </button>
            <button className="btn h-10 gap-2" onClick={() => runContext("query")} disabled={!node || !!busy}>
              <Search className="size-4" /> Code context
            </button>
            <button className="btn h-10" onClick={() => runContext(mode, true)} disabled={!node || !Object.keys(knownHashes).length || !!busy}>
              Delta follow-up
            </button>
            <button className="btn h-10 gap-2" onClick={verifyReceipts} disabled={!!busy}>
              <ShieldCheck className="size-4" /> Verify receipts
            </button>
          </div>
          {error ? <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
        </div>
      </section>

      {pack ? (
        <>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Emitted" value={`${pack.stats?.emittedBytes || 0} B`} />
            <Metric label="Token estimate" value={String(pack.stats?.tokenEstimate || 0)} />
            <Metric label="Chunks" value={String(pack.stats?.emittedChunks || 0)} />
            <Metric label="Unchanged" value={String(pack.stats?.unchangedChunks || 0)} />
            <Metric label="Pack digest" value={short(pack.digest)} />
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="panel overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Retrieved evidence</p>
                <p className="mt-1 text-sm text-muted">{emittedPaths.length ? emittedPaths.join(" · ") : "No source retransmitted; known hashes satisfied this request."}</p>
              </div>
              <div className="divide-y divide-border">
                {(pack.items || []).map((item: any) => (
                  <article key={item.chunkId} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-sm text-seal">{item.path}:{item.startLine}-{item.endLine}</p>
                      <p className="font-mono text-[11px] text-subtle">score {Number(item.score || 0).toFixed(3)} · {item.bytes} B</p>
                    </div>
                    {item.dependencyOf ? <p className="mt-1 text-xs text-muted">dependency of {item.dependencyOf}</p> : null}
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-bg p-3 font-mono text-xs leading-5 text-muted">{item.excerpt}</pre>
                    <p className="mt-2 font-mono text-[10px] text-subtle">sha256 {item.sha256}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="panel p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Provenance</p>
                <dl className="mt-3 space-y-2 font-mono text-xs text-muted">
                  <Row label="revision" value={pack.revision} />
                  <Row label="worktree" value={pack.worktreeDigest} />
                  <Row label="index" value={pack.indexDigest} />
                  <Row label="pack" value={pack.digest} />
                  <Row label="dirty" value={String(pack.dirty)} />
                </dl>
                {(pack.omissions || []).length ? (
                  <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    Omissions: {pack.omissions.join(", ")}
                  </p>
                ) : null}
              </div>

              {mode === "sit" ? (
                <div className="panel p-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Durable repository memory</p>
                  {memory?.available ? (
                    <>
                      <p className="mt-2 font-mono text-xs text-seal">{memory.owner}/{memory.repo}</p>
                      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-bg p-3 text-xs leading-5 text-muted">
                        {memory.text || JSON.stringify(memory, null, 2)}
                      </pre>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-muted">{memory?.reason || "No KILN-native repository memory attached."}</p>
                  )}
                </div>
              ) : null}

              {verification ? (
                <div className="panel p-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Receipt chain</p>
                  <p className="mt-3 text-sm">{verification.ok ? "Verified" : "Verification failed"} · {verification.count || 0} receipts</p>
                  <p className="mt-2 font-mono text-[10px] text-subtle">{verification.lastHash || "No receipt head"}</p>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{label}</p>
      <p className="mt-1 truncate font-mono text-sm text-fg">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="text-subtle">{label}</dt>
      <dd className="break-all text-fg">{value || "—"}</dd>
    </div>
  );
}
