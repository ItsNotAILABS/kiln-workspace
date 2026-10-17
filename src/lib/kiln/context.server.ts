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
    return kilnLocal("POST", `/v1/context/nodes/${encodeURIComponent(node)}/index`, {
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
    return kilnLocal("POST", `/v1/context/nodes/${encodeURIComponent(node)}/query`, {
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
    return kilnLocal("GET", `/v1/context/nodes/${encodeURIComponent(node)}/status`);
  });


export const kilnContextSit = createServerFn({ method: "POST" })
  .inputValidator((d: { node: string; query: string; maxBytes?: number; maxChunks?: number; memoryTokens?: number; knownHashes?: Record<string,string> }) => d)
  .handler(async ({ data }) => {
    const node = String(data.node || "").trim();
    const query = String(data.query || "").trim();
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(node)) return { ok: false as const, status: 400, error: "Invalid node" };
    if (!query || query.length > 4096) return { ok: false as const, status: 400, error: "Query is required and must be <= 4096 characters" };
    return kilnLocal("POST", `/v1/context/nodes/${encodeURIComponent(node)}/sit`, {
      query,
      maxBytes: Math.min(Math.max(Number(data.maxBytes || 18000), 512), 128000),
      maxChunks: Math.min(Math.max(Number(data.maxChunks || 10), 1), 50),
      memoryTokens: Math.min(Math.max(Number(data.memoryTokens || 1200), 128), 8000),
      knownHashes: data.knownHashes || {},
    });
  });

export const kilnContextReceiptsVerify = createServerFn({ method: "POST" })
  .handler(async () => kilnLocal("POST", "/v1/context/receipts/verify", {}));

export const kilnLocalNodes = createServerFn({ method: "POST" })
  .handler(async () => kilnLocal("GET", "/nodes"));


export const kilnContextMetrics = createServerFn({ method: "POST" })
  .handler(async () => kilnLocal("GET", "/v1/context/metrics"));
