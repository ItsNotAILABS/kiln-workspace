/**
 * Server-side proxy to the KILN swarm daemon's local HTTP API.
 *
 * The bearer token is read from <stateDir>/api.token here, server-side ONLY —
 * it never leaves this module toward the client. Every daemon-facing call
 * goes through daemonFetch(), which throws SwarmDownError (carrying the exact
 * fix command) when the daemon is unreachable, and plain Errors for API
 * failures. No mock data anywhere in this file.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Shown in the console when the daemon is down. Run inside KILN/swarm/. */
export const SWARM_DOWN_FIX =
  "node swarm.mjs daemon start  # run inside the KILN repo's swarm/ directory";

export interface SwarmDaemonStatus {
  up: boolean;
  pid: number | null;
  startedAt: string | null;
  apiUrl: string | null;
  /** Set when down — the exact command that fixes it. */
  fix: string | null;
}

export class SwarmDownError extends Error {
  fix = SWARM_DOWN_FIX;
  constructor(message: string) {
    super(message);
    this.name = "SwarmDownError";
  }
}

export function swarmStateDir(): string {
  return process.env.KILN_SWARM_DIR || join(homedir(), ".kiln-swarm");
}

interface DaemonJson {
  pid?: number;
  apiUrl?: string;
  startedAt?: string;
}

function readDaemonJson(): DaemonJson | null {
  const p = join(swarmStateDir(), "daemon.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as DaemonJson;
  } catch {
    return null;
  }
}

function readApiToken(): string | null {
  // Hosted deployments (e.g. the Cloudflare door) carry the token as a
  // server-side secret env var — there is no state dir on the host.
  // Locally the state-dir file wins and behavior is unchanged.
  const fromEnv = process.env.KILN_SWARM_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const p = join(swarmStateDir(), "api.token");
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function daemonApiUrl(): string {
  return (
    process.env.KILN_SWARM_API_URL || readDaemonJson()?.apiUrl || "http://127.0.0.1:18787"
  );
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Honest daemon status: running pid, or down + the exact fix command. */
export async function getDaemonStatus(): Promise<SwarmDaemonStatus> {
  const dj = readDaemonJson();
  if (!dj || !dj.pid || !pidAlive(dj.pid)) {
    // Hosted door (no local state dir): the daemon is remote, reached
    // through its tunnel URL. Probe its health endpoint and report
    // that truthfully instead of prescribing a local start command
    // this host cannot run.
    const remoteUrl = process.env.KILN_SWARM_API_URL;
    if (!dj && remoteUrl) {
      try {
        const r = await fetch(`${remoteUrl}/health`, { signal: AbortSignal.timeout(3000) });
        const data = (await r.json().catch(() => null)) as { ok?: boolean } | null;
        if (r.ok && data?.ok) {
          return { up: true, pid: null, startedAt: null, apiUrl: remoteUrl, fix: null };
        }
      } catch {
        /* unreachable — fall through to the down verdict */
      }
      return {
        up: false,
        pid: null,
        startedAt: null,
        apiUrl: remoteUrl,
        fix: "the local forge daemon is unreachable through its tunnel — check the daemon on its host machine",
      };
    }
    return { up: false, pid: null, startedAt: null, apiUrl: null, fix: SWARM_DOWN_FIX };
  }
  try {
    const r = await fetch(`${daemonApiUrl()}/health`, { signal: AbortSignal.timeout(3000) });
    const data = (await r.json().catch(() => null)) as { ok?: boolean } | null;
    if (r.ok && data?.ok) {
      return {
        up: true,
        pid: dj.pid,
        startedAt: dj.startedAt ?? null,
        apiUrl: daemonApiUrl(),
        fix: null,
      };
    }
  } catch {
    /* daemon.json is fresh but the API doesn't answer — down */
  }
  return {
    up: false,
    pid: dj.pid,
    startedAt: dj.startedAt ?? null,
    apiUrl: daemonApiUrl(),
    fix: SWARM_DOWN_FIX,
  };
}

async function daemonFetch(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const token = readApiToken();
  if (!token) {
    throw new SwarmDownError(
      "swarm api token is missing — locally: run `node swarm.mjs init` in the KILN swarm directory, then start the daemon; hosted: set the KILN_SWARM_TOKEN secret"
    );
  }
  let res: Response;
  try {
    res = await fetch(daemonApiUrl() + path, {
      method: init.method || "GET",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new SwarmDownError("cannot reach the swarm daemon API — it may be down");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) {
    throw new Error("swarm API rejected the token (401) — the daemon may have been re-inited");
  }
  if (!res.ok) throw new Error(data.error || `swarm API HTTP ${res.status}`);
  return data;
}

/** Mirrors the daemon's node view (see swarm/lib/httpapi.mjs nodeView). */
export interface SwarmNodeView {
  id: string;
  name: string;
  status: "idle" | "working" | "stale" | "dead";
  workerPid: number | null;
  caps: number;
  capNames: string[];
  expiresAt: number;
  expired: boolean;
  parent: string | null;
  mind: string;
  repo: string | null;
}

/** Mirrors the daemon's job record (see swarm/lib/queue.mjs). */
export interface SwarmJobView {
  id: string;
  name: string;
  status: "pending" | "done" | "failed";
  node?: string;
  summary?: string;
  error?: string;
  submittedAt?: number;
  finishedAt?: number;
}

export interface ReceiptResult {
  node: string;
  name: string;
  ok: boolean;
  count: number;
  error: string | null;
}

export async function listSwarmNodes(): Promise<SwarmNodeView[]> {
  const data = (await daemonFetch("/nodes")) as { nodes: SwarmNodeView[] };
  return data.nodes ?? [];
}

export async function listSwarmJobs(): Promise<SwarmJobView[]> {
  const data = (await daemonFetch("/jobs")) as { jobs: SwarmJobView[] };
  return data.jobs ?? [];
}

export interface SubmitJobInput {
  name?: string;
  plan: { steps: { tool: string; args?: Record<string, unknown> }[] };
  mind?: string;
  node?: string;
  repo?: string;
}

export async function submitSwarmJob(input: SubmitJobInput): Promise<{ id: string; name: string }> {
  if (!input?.plan || !Array.isArray(input.plan.steps) || input.plan.steps.length === 0) {
    throw new Error("plan.steps[] is required and must not be empty");
  }
  input.plan.steps.forEach((s, i) => {
    if (!s || typeof s.tool !== "string" || !s.tool) {
      throw new Error(`plan step ${i} needs a tool name`);
    }
  });
  const data = (await daemonFetch("/jobs", { method: "POST", body: input })) as {
    id: string;
    name: string;
  };
  return data;
}

export interface SpawnNodeInput {
  name: string;
  caps: number;
  ttlSec?: number;
  repo?: string;
  mind?: string;
}

export async function spawnSwarmNode(input: SpawnNodeInput): Promise<{ id: string; name: string }> {
  if (!input?.name?.trim()) throw new Error("node name is required");
  if (!Number.isFinite(input.caps)) throw new Error("caps bitmask is required");
  const data = (await daemonFetch("/nodes", { method: "POST", body: input })) as {
    id: string;
    name: string;
  };
  return data;
}

export async function stopSwarmNode(id: string): Promise<void> {
  await daemonFetch(`/nodes/${encodeURIComponent(id)}/stop`, { method: "POST" });
}

export async function getSwarmNodeLogs(
  id: string,
  tail = 80,
  stream: "stdout" | "stderr" = "stdout"
): Promise<{ stream: string; log: string }> {
  const data = (await daemonFetch(
    `/nodes/${encodeURIComponent(id)}/logs?tail=${tail}&stream=${stream}`
  )) as { stream: string; log: string };
  return data;
}

export async function verifySwarmReceipts(
  node?: string
): Promise<{ results: ReceiptResult[]; allOk: boolean }> {
  const data = (await daemonFetch("/receipts/verify", {
    method: "POST",
    body: node ? { node } : {},
  })) as { results: ReceiptResult[]; allOk: boolean };
  return { results: data.results ?? [], allOk: !!data.allOk };
}

/** Mirrors the daemon's git repo record (see swarm/lib/git.mjs listRepos). */
export interface GitRepoView {
  owner: string;
  repo: string;
  createdAt: string;
  /** Usable clone URL against this daemon. */
  cloneUrl: string;
}

/**
 * KILN-native git repos hosted by the daemon. GET /git is a PUBLIC route —
 * no token is needed and none is sent, so this works even before init.
 * Push/create stay authenticated on the daemon itself.
 */
export async function listGitRepos(): Promise<GitRepoView[]> {
  const apiUrl = daemonApiUrl();
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/git`, { signal: AbortSignal.timeout(15000) });
  } catch {
    throw new SwarmDownError("cannot reach the swarm daemon API — it may be down");
  }
  const data = (await res.json().catch(() => ({}))) as {
    repos?: { owner: string; repo: string; createdAt: string }[];
  };
  if (!res.ok) throw new Error(`swarm API HTTP ${res.status}`);
  const repos = Array.isArray(data.repos) ? data.repos : [];
  return repos.map((r) => ({
    owner: r.owner,
    repo: r.repo,
    createdAt: r.createdAt,
    cloneUrl: `${apiUrl}/git/${r.owner}/${r.repo}`,
  }));
}

/** Mirrors the daemon's workspace record (see swarm/lib/workspaces.mjs). */
export interface WorkspaceView {
  id: string;
  owner: string;
  slug: string;
  name: string;
  description: string;
  repos: string[];
  siteIds: string[];
  /** Id of the parent workspace (same owner), or null for a root. */
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A workspace record plus its nested children (GET /v1/workspaces?tree=1). */
export interface WorkspaceTreeNode extends WorkspaceView {
  children: WorkspaceTreeNode[];
}

/** Lightweight workspace reference used by status parent/children + details. */
export interface WorkspaceRef {
  id: string;
  owner: string;
  slug: string;
  name: string;
}

export interface RepoCommitView {
  sha: string;
  shortSha: string;
  subject: string;
  author: string;
  date: string;
}

/** Context-economical per-repo summary carried on workspace status entries. */
export interface RepoDetailsSummary {
  description: string;
  topics: string[];
  defaultBranch: string | null;
  commitCount: number;
  lastCommit: RepoCommitView | null;
}

export interface WorkspaceRepoStatus {
  repo: string;
  exists: boolean;
  branch: string | null;
  head: { sha: string; shortSha: string; subject: string } | null;
  /** Present on daemons with the project-details rollout. */
  details?: RepoDetailsSummary | null;
}

export interface WorkspaceSiteStatus {
  id: string;
  name: string | null;
  frontend: string | null;
  backend: string | null;
  found: boolean;
}

/** Mirrors the daemon's aggregated workspace status (GET /v1/workspaces/:id). */
export interface WorkspaceStatusView {
  workspace: WorkspaceView;
  repos: WorkspaceRepoStatus[];
  sites: WorkspaceSiteStatus[];
  memory: {
    repos: Record<string, { present: boolean; coreLabels: string[] }>;
    linked: boolean;
  };
  /** Nesting fields — absent on daemons predating the nesting rollout. */
  parent?: WorkspaceRef | null;
  children?: WorkspaceRef[];
  rollup?: {
    descendantCount: number;
    repos: WorkspaceRepoStatus[];
    siteIds: string[];
  };
}

/** Mirrors a daemon sites-registry record (GET /v1/sites). */
export interface SiteView {
  id: string;
  name: string;
  frontend: string | null;
  backend: string | null;
}

export interface RepoLanguageView {
  language: string;
  files: number;
  bytes: number;
  pct: number;
}

export interface RepoReadmeView {
  path: string;
  content: string;
  truncated: boolean;
}

/** Latest CI result as recorded by the daemon (lib/ci.mjs readLatest). */
export interface CiResultView {
  status?: string;
  verdict?: string;
  conclusion?: string;
  state?: string;
  result?: string;
  sha?: string;
  commit?: string;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string;
  date?: string;
}

export interface RepoWorkspaceMembership extends WorkspaceRef {
  parentId: string | null;
}

/**
 * The project-details object (GET /v1/repos/:owner/:repo/details) —
 * derived live from the hosted bare repo; see swarm/lib/repodetails.mjs.
 * `ci` is the latest CI result object as recorded, or null when no run
 * has been recorded for the repo.
 */
export interface RepoDetailsView {
  repo: string;
  owner: string;
  name: string;
  createdAt: string | null;
  description: string;
  topics: string[];
  empty: boolean;
  defaultBranch: string | null;
  commitCount: number;
  fileCount: number;
  treeBytes: number;
  diskBytes: number;
  lastCommit: RepoCommitView | null;
  recentActivity: RepoCommitView[];
  languages: RepoLanguageView[];
  readme: RepoReadmeView | null;
  workspaces: RepoWorkspaceMembership[];
  site: { id: string; name: string; role: string } | null;
  ci: CiResultView | null;
}

/**
 * KILN Workspaces from the daemon registry (GET /v1/workspaces).
 * Daemons that predate the workspaces rollout answer 404 — daemonFetch
 * surfaces that as an error and the pages render the rollout state
 * honestly instead of mock data.
 */
export async function listWorkspaces(owner?: string): Promise<WorkspaceView[]> {
  const q = owner ? `?owner=${encodeURIComponent(owner)}` : "";
  const data = (await daemonFetch(`/v1/workspaces${q}`)) as { workspaces: WorkspaceView[] };
  return data.workspaces ?? [];
}

/** Workspace roots with nested `children` arrays (GET /v1/workspaces?tree=1). */
export async function listWorkspaceTree(owner?: string): Promise<WorkspaceTreeNode[]> {
  const params = new URLSearchParams({ tree: "1" });
  if (owner) params.set("owner", owner);
  const data = (await daemonFetch(`/v1/workspaces?${params.toString()}`)) as {
    workspaces: WorkspaceTreeNode[];
  };
  return data.workspaces ?? [];
}

export async function getWorkspaceStatus(id: string): Promise<WorkspaceStatusView> {
  return (await daemonFetch(`/v1/workspaces/${encodeURIComponent(id)}`)) as WorkspaceStatusView;
}

export interface CreateWorkspaceInput {
  owner: string;
  slug: string;
  name: string;
  description?: string;
  repos?: string[];
  siteIds?: string[];
  parentId?: string;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceView> {
  const data = (await daemonFetch("/v1/workspaces", { method: "POST", body: input })) as {
    workspace: WorkspaceView;
  };
  return data.workspace;
}

export interface UpdateWorkspacePatch {
  name?: string;
  description?: string;
  addRepos?: string[];
  removeRepos?: string[];
  linkSites?: string[];
  unlinkSites?: string[];
  /** Present = change parent (workspace id, or null for root); absent = unchanged. */
  setParent?: string | null;
}

export async function updateWorkspace(
  id: string,
  patch: UpdateWorkspacePatch
): Promise<WorkspaceView> {
  const data = (await daemonFetch(`/v1/workspaces/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  })) as { workspace: WorkspaceView };
  return data.workspace;
}

export async function deleteWorkspace(id: string, confirm: string): Promise<void> {
  await daemonFetch(`/v1/workspaces/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: { confirm },
  });
}

/** Sites from the daemon registry (GET /v1/sites). */
export async function listSites(): Promise<SiteView[]> {
  const data = (await daemonFetch("/v1/sites")) as { sites: SiteView[] };
  return data.sites ?? [];
}

function unwrapDetails(data: unknown): RepoDetailsView {
  const d = data as { details?: RepoDetailsView };
  return (d && typeof d === "object" && d.details ? d.details : data) as RepoDetailsView;
}

/** Project details for a forge-hosted repo. 404s for repos the forge doesn't host. */
export async function getRepoDetails(owner: string, repo: string): Promise<RepoDetailsView> {
  const data = await daemonFetch(
    `/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/details`
  );
  return unwrapDetails(data);
}

export interface UpdateRepoDetailsPatch {
  description?: string;
  topics?: string[];
}

export async function updateRepoDetails(
  owner: string,
  repo: string,
  patch: UpdateRepoDetailsPatch
): Promise<RepoDetailsView> {
  const data = await daemonFetch(
    `/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/details`,
    { method: "PATCH", body: patch }
  );
  return unwrapDetails(data);
}

export interface CreatedGitRepoView {
  owner: string;
  repo: string;
  createdAt: string | null;
}

/** Create a hosted repo on the forge (POST /git/:owner/:repo, bearer). */
export async function createGitRepo(owner: string, repo: string): Promise<CreatedGitRepoView> {
  const data = (await daemonFetch(
    `/git/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { method: "POST" }
  )) as { owner?: string; repo?: string; createdAt?: string } | null;
  return {
    owner: typeof data?.owner === "string" ? data.owner : owner,
    repo: typeof data?.repo === "string" ? data.repo : repo,
    createdAt: typeof data?.createdAt === "string" ? data.createdAt : null,
  };
}
