import { createServerFn } from "@tanstack/react-start";
import {
  getDaemonStatus,
  listSwarmNodes,
  listSwarmJobs,
  submitSwarmJob,
  spawnSwarmNode,
  stopSwarmNode,
  getSwarmNodeLogs,
  verifySwarmReceipts,
  listGitRepos,
  listWorkspaces,
  getWorkspaceStatus,
  SwarmDownError,
  type SpawnNodeInput,
  type SubmitJobInput,
} from "./swarm-proxy";

/**
 * Swarm console server functions. The daemon bearer token is read
 * server-side inside swarm-proxy.ts and never reaches the client.
 * Every handler returns {ok:true,...} on success or {ok:false,error}
 * — the console never crashes on a daemon failure, it reports it.
 */
export const swarmDaemonStatus = createServerFn({ method: "GET" }).handler(async () => {
  const status = await getDaemonStatus();
  return { ok: true as const, status };
});

export const swarmNodes = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, nodes: await listSwarmNodes() };
  } catch (e) {
    return fail(e);
  }
});

export const swarmJobs = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, jobs: await listSwarmJobs() };
  } catch (e) {
    return fail(e);
  }
});

export const swarmSubmitJob = createServerFn({ method: "POST" })
  .inputValidator((d: SubmitJobInput) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, ...(await submitSwarmJob(data)) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmSpawnNode = createServerFn({ method: "POST" })
  .inputValidator((d: SpawnNodeInput) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, ...(await spawnSwarmNode(data)) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmStopNode = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    try {
      await stopSwarmNode(data.id);
      return { ok: true as const };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmNodeLogs = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string; tail?: number; stream?: "stdout" | "stderr" }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, ...(await getSwarmNodeLogs(data.id, data.tail ?? 80, data.stream ?? "stdout")) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmVerifyReceipts = createServerFn({ method: "POST" })
  .inputValidator((d: { node?: string }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, ...(await verifySwarmReceipts(data.node)) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmGitRepos = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, repos: await listGitRepos() };
  } catch (e) {
    return fail(e);
  }
});

export const swarmWorkspaces = createServerFn({ method: "GET" })
  .inputValidator((d: { owner?: string }) => d ?? {})
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, workspaces: await listWorkspaces(data?.owner) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmWorkspaceStatus = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, status: await getWorkspaceStatus(data.id) };
    } catch (e) {
      return fail(e);
    }
  });

function fail(e: unknown) {  const err = e as Error & { fix?: string };
  const out: { ok: false; error: string; fix?: string } = {
    ok: false as const,
    error: err instanceof Error ? err.message : "swarm request failed",
  };
  if (e instanceof SwarmDownError || err.fix) out.fix = err.fix || (e as SwarmDownError).fix;
  return out;
}
