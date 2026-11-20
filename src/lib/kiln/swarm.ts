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
  getCapabilities,
  accountsLive,
  signupAccount,
  loginAccount,
  getMe,
  listMyAgents,
  createMyAgent,
  revokeMyAgent,
  listWorkspacesAs,
  createWorkspaceAs,
  listWorkspaces,
  listWorkspaceTree,
  getWorkspaceStatus,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listSites,
  getRepoDetails,
  updateRepoDetails,
  createGitRepo,
  SwarmDownError,
  type SpawnNodeInput,
  type SubmitJobInput,
  type CreateWorkspaceInput,
  type UpdateWorkspacePatch,
  type UpdateRepoDetailsPatch,
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
  .inputValidator((d: { owner?: string; tree?: boolean }) => d ?? {})
  .handler(async ({ data }) => {
    try {
      if (data?.tree) {
        return { ok: true as const, workspaces: await listWorkspaceTree(data.owner) };
      }
      return { ok: true as const, workspaces: await listWorkspaces(data?.owner) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmCapabilities = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, capabilities: await getCapabilities() };
  } catch (e) {
    return fail(e);
  }
});

// ---- accounts + agent identities (the forge's own account system) ----
// The browser holds the account session token (localStorage, see
// account-session.ts) and passes it to these functions as data; the
// proxy forwards it as the bearer. Nothing here ever uses the
// operator token for an account act — the daemon scopes by session.

export const accountLive = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, live: await accountsLive() };
  } catch (e) {
    return fail(e);
  }
});

export const accountSignup = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; name: string; owner: string; password: string }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, account: await signupAccount(data) };
    } catch (e) {
      return fail(e);
    }
  });

export const accountLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    try {
      const r = await loginAccount(data);
      return { ok: true as const, account: r.account, sessionToken: r.sessionToken, expiresAt: r.expiresAt };
    } catch (e) {
      return fail(e);
    }
  });

export const accountMe = createServerFn({ method: "POST" })
  .inputValidator((d: { session: string }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, ...(await getMe(data.session)) };
    } catch (e) {
      return fail(e);
    }
  });

export const accountAgents = createServerFn({ method: "POST" })
  .inputValidator((d: { session: string }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, agents: await listMyAgents(data.session) };
    } catch (e) {
      return fail(e);
    }
  });

export const accountCreateAgent = createServerFn({ method: "POST" })
  .inputValidator((d: { session: string; name: string; scopes?: string[] }) => d)
  .handler(async ({ data }) => {
    try {
      const r = await createMyAgent(data.session, { name: data.name, scopes: data.scopes });
      return { ok: true as const, agent: r.agent, token: r.token };
    } catch (e) {
      return fail(e);
    }
  });

export const accountRevokeAgent = createServerFn({ method: "POST" })
  .inputValidator((d: { session: string; id: string }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, agent: await revokeMyAgent(data.session, data.id) };
    } catch (e) {
      return fail(e);
    }
  });

export const accountMyWorkspaces = createServerFn({ method: "POST" })
  .inputValidator((d: { session: string }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, workspaces: await listWorkspacesAs(data.session) };
    } catch (e) {
      return fail(e);
    }
  });

export const accountCreateWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d: { session: string; input: CreateWorkspaceInput }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, workspace: await createWorkspaceAs(data.session, data.input) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmCreateWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d: CreateWorkspaceInput) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, workspace: await createWorkspace(data) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmUpdateWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; patch: UpdateWorkspacePatch }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, workspace: await updateWorkspace(data.id, data.patch) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmDeleteWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; confirm: string }) => d)
  .handler(async ({ data }) => {
    try {
      await deleteWorkspace(data.id, data.confirm);
      return { ok: true as const };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmSites = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, sites: await listSites() };
  } catch (e) {
    return fail(e);
  }
});

export const swarmRepoDetails = createServerFn({ method: "GET" })
  .inputValidator((d: { owner: string; repo: string }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, details: await getRepoDetails(data.owner, data.repo) };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmUpdateRepoDetails = createServerFn({ method: "POST" })
  .inputValidator((d: { owner: string; repo: string; patch: UpdateRepoDetailsPatch }) => d)
  .handler(async ({ data }) => {
    try {
      return {
        ok: true as const,
        details: await updateRepoDetails(data.owner, data.repo, data.patch),
      };
    } catch (e) {
      return fail(e);
    }
  });

export const swarmCreateGitRepo = createServerFn({ method: "POST" })
  .inputValidator((d: { owner: string; repo: string }) => d)
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, created: await createGitRepo(data.owner, data.repo) };
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
