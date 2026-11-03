import { createServerFn } from "@tanstack/react-start";

/**
 * Server-only bridge from KILN Workspace to the local KILN swarm daemon.
 *
 * Disabled by default. Set KILN_CONTEXT_UI_ENABLED=true on a trusted local
 * deployment. The bearer credential is read server-side and is never returned
 * to the browser.
 */
async function kilnLocal(method: string, path: string, body?: unknown) {
  if (process.env.KILN_CONTEXT_UI_ENABLED !== "true") {
    return { ok: false as const, status: 403, error: "Local Context Fabric UI bridge is disabled" };
  }
  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const os = await import("node:os");
  const dir = process.env.KILN_SWARM_DIR || pathMod.join(os.homedir(), ".kiln-swarm");
  const daemonPath = pathMod.join(dir, "daemon.json");
  const tokenPath = pathMod.join(dir, "api.token");
  if (!fs.existsSync(daemonPath) || !fs.existsSync(tokenPath)) {
    return { ok: false as const, status: 503, error: "KILN swarm daemon state is unavailable" };
  }
  const daemon = JSON.parse(fs.readFileSync(daemonPath, "utf8")) as { apiUrl?: string };
  const token = fs.readFileSync(tokenPath, "utf8").trim();
  if (!daemon.apiUrl || !token) return { ok: false as const, status: 503, error: "KILN swarm daemon is not configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(daemon.apiUrl + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false as const, status: response.status, error: String(data?.error || `KILN HTTP ${response.status}`) };
    return { ok: true as const, status: response.status, data };
  } catch (error) {
    return { ok: false as const, status: 503, error: error instanceof Error ? error.message : "KILN local bridge failed" };
  } finally {
    clearTimeout(timer);
  }
}

export const kilnContextIndex = createServerFn({ method: "POST" })
  .inputValidator((d: { node: string; chunkLines?: number; overlap?: number }) => d)
  .handler(async ({ data }) => {
    const node = String(data.node || "").trim();
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(node)) return { ok: false as const, status: 400, error: "Invalid node" };
    return kilnLocal("POST", `/context/${encodeURIComponent(node)}/index`, {
      chunkLines: data.chunkLines,
      overlap: data.overlap,
    });
  });

export const kilnContextQuery = createServerFn({ method: "POST" })
  .inputValidator((d: { node: string; query: string; maxBytes?: number; maxChunks?: number; knownHashes?: Record<string,string> }) => d)
  .handler(async ({ data }) => {
    const node = String(data.node || "").trim();
    const query = String(data.query || "").trim();
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(node)) return { ok: false as const, status: 400, error: "Invalid node" };
    if (!query || query.length > 4096) return { ok: false as const, status: 400, error: "Query is required and must be <= 4096 characters" };
    return kilnLocal("POST", `/context/${encodeURIComponent(node)}/query`, {
      query,
      maxBytes: Math.min(Math.max(Number(data.maxBytes || 24000), 512), 128000),
      maxChunks: Math.min(Math.max(Number(data.maxChunks || 12), 1), 50),
      knownHashes: data.knownHashes || {},
    });
  });

export const kilnContextStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { node: string }) => d)
  .handler(async ({ data }) => {
    const node = String(data.node || "").trim();
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(node)) return { ok: false as const, status: 400, error: "Invalid node" };
    return kilnLocal("GET", `/context/${encodeURIComponent(node)}/status`);
  });


export const kilnGraphBuild = createServerFn({ method: "POST" })
  .inputValidator((d: { node: string }) => d)
  .handler(async ({ data }) => {
    const node = String(data.node || "").trim();
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(node)) return { ok: false as const, status: 400, error: "Invalid node" };
    return kilnLocal("POST", `/graph/${encodeURIComponent(node)}/build`, {});
  });

export const kilnGraphImpact = createServerFn({ method: "POST" })
  .inputValidator((d: { node: string; paths: string[]; depth?: number }) => d)
  .handler(async ({ data }) => {
    const node = String(data.node || "").trim();
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(node)) return { ok: false as const, status: 400, error: "Invalid node" };
    const paths = Array.isArray(data.paths) ? data.paths.map(String).filter(Boolean).slice(0, 200) : [];
    if (!paths.length) return { ok: false as const, status: 400, error: "paths[] required" };
    return kilnLocal("POST", `/graph/${encodeURIComponent(node)}/impact`, { paths, depth: data.depth ?? 2 });
  });

export const kilnKnowledgePut = createServerFn({ method: "POST" })
  .inputValidator((d: { node: string; subject: string; predicate: string; value: unknown; evidence?: {path:string;sha256:string}[]; confidence?: string }) => d)
  .handler(async ({ data }) => {
    const node = String(data.node || "").trim();
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(node)) return { ok: false as const, status: 400, error: "Invalid node" };
    return kilnLocal("POST", `/knowledge/${encodeURIComponent(node)}/facts`, {
      subject: String(data.subject || "").slice(0, 512),
      predicate: String(data.predicate || "").slice(0, 256),
      value: data.value,
      evidence: Array.isArray(data.evidence) ? data.evidence.slice(0, 50) : [],
      confidence: String(data.confidence || "verified").slice(0, 64),
    });
  });

export const kilnKnowledgeQuery = createServerFn({ method: "POST" })
  .inputValidator((d: { node: string; query?: string }) => d)
  .handler(async ({ data }) => {
    const node = String(data.node || "").trim();
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(node)) return { ok: false as const, status: 400, error: "Invalid node" };
    return kilnLocal("POST", `/knowledge/${encodeURIComponent(node)}/query`, { query: String(data.query || "").slice(0, 4096) });
  });

export const kilnPortaEvaluate = createServerFn({ method: "POST" })
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data }) => kilnLocal("POST", "/porta/evaluate", data));


export const kilnContextCompile = createServerFn({ method: "POST" })
  .inputValidator((d: { node: string; query: string; tokenBudget?: number; maxBytes?: number; maxChunks?: number; includeFacts?: boolean; includeGraph?: boolean }) => d)
  .handler(async ({ data }) => {
    const node = String(data.node || "").trim();
    const query = String(data.query || "").trim();
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(node)) return { ok: false as const, status: 400, error: "Invalid node" };
    if (!query || query.length > 4096) return { ok: false as const, status: 400, error: "Query is required and must be <= 4096 characters" };
    return kilnLocal("POST", `/context/${encodeURIComponent(node)}/compile`, {
      query,
      tokenBudget: Math.min(Math.max(Number(data.tokenBudget || 12000), 256), 500000),
      maxBytes: Math.min(Math.max(Number(data.maxBytes || 64000), 512), 512000),
      maxChunks: Math.min(Math.max(Number(data.maxChunks || 20), 1), 100),
      includeFacts: data.includeFacts !== false,
      includeGraph: data.includeGraph !== false,
    });
  });
