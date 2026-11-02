/**
 * Parity core — pure client (no app imports, node-harnessable) for the
 * GitHub-parity batch: workspaces (G1), repo details incl. the
 * visibility flip (G18), and the CI verdict read (G8).
 *
 * Daemon contracts (KILN swarm/docs/WORKSPACES.md, lib/repodetails.mjs,
 * lib/httpapi.mjs, lib/ci.mjs — all LIVE on the running daemon,
 * verified read-only 2026-11-02):
 *
 *   POST  /v1/workspaces {owner, slug, name, description?, repos?,
 *         siteIds?, parentId?} -> 201 {ok, workspace}
 *         (account principals: own namespace only, else 403;
 *          (owner, slug) collision 409; unknown member repo 404)
 *   GET   /v1/workspaces -> {workspaces:[...]} (account: own + member-of)
 *   GET   /v1/workspaces/:id -> aggregated status {workspace, repos:
 *         [{repo, exists, branch, head, details}], sites, parent,
 *         children, rollup}; workspace.members[] = {owner, role, via,
 *         joinedAt} — the owner is never a member.
 *   GET   /v1/repos/:owner/:repo/details -> details object incl.
 *         description, topics, visibility ("public" only when stored
 *         exactly so; anything else reads "private"), ci (below).
 *   PATCH /v1/repos/:owner/:repo/details {description?, topics?,
 *         visibility?} -> {ok, details} (own namespace only, else 403;
 *         topics ^[a-z0-9][a-z0-9-]{0,31}$ × ≤16; description ≤1024)
 *
 *   details.ci is lib/ci.mjs readLatest(): the latest recorded CI
 *   result {status: "pass"|"fail"|"error"|"timeout", sha, ref,
 *   suites, recordedAt} or null when the repo has no recorded verdict.
 *   null is the honest "no CI configured" state — never a fake green.
 *
 * The browser reaches the daemon through this origin's /api/forge
 * proxy with the account session bearer (kiln-identity-core's shape).
 */

export class ParityApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data || null;
  }
}

/** Same staged-daemon test as kiln-identity-core's isNotYetActive. */
export function isNotYetActive(e) {
  if (!(e instanceof ParityApiError)) return false;
  if (e.status === 404) return true;
  if (e.status === 401 && /valid token required/i.test(e.message || "")) return true;
  return false;
}

/**
 * Map a details.ci value to the chip's verdict. Pure — the harness
 * pins every branch. States: pass / fail / running / none. Today's
 * contract only ever stores finished verdicts, so "running" is
 * reachable only if a queued/running status ever appears in the
 * record; it is mapped, never invented from a stale pass.
 */
export function ciVerdict(ci) {
  if (!ci || typeof ci !== "object" || typeof ci.status !== "string" || !ci.status) {
    return { state: "none", label: "No CI configured", status: null };
  }
  const s = ci.status.toLowerCase();
  if (s === "pass" || s === "passed" || s === "success") {
    return { state: "pass", label: "CI pass", status: ci.status };
  }
  if (s === "fail" || s === "failed" || s === "failure" || s === "error" || s === "timeout" || s === "timed_out") {
    return { state: "fail", label: s === "timeout" || s === "timed_out" ? "CI timeout" : "CI fail", status: ci.status };
  }
  if (s === "queued" || s === "pending" || s === "running" || s === "in_progress") {
    return { state: "running", label: "CI running", status: ci.status };
  }
  return { state: "none", label: `CI ${ci.status}`, status: ci.status };
}

/** The daemon's topic rule (lib/repodetails.mjs), mirrored for the form. */
export const TOPIC_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function parseTopics(text) {
  const out = [];
  for (const raw of String(text || "").split(/[\s,]+/)) {
    const t = raw.trim().toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function invalidTopics(topics) {
  return topics.filter((t) => !TOPIC_RE.test(t));
}

export function createParityClient({ fetchImpl, getToken, base = "/api/forge/v1" } = {}) {
  const doFetch = fetchImpl || ((...args) => fetch(...args));

  async function call(method, path, body, { auth = true } = {}) {
    const headers = { "content-type": "application/json" };
    if (auth) {
      const token = typeof getToken === "function" ? getToken() : null;
      if (token) headers.authorization = `Bearer ${token}`;
    }
    const res = await doFetch(`${base}${path}`, {
      method,
      headers,
      cache: "no-store",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ParityApiError(res.status, (data && data.error) || `request failed (${res.status})`, data);
    }
    return data;
  }

  return {
    // ---- workspaces (G1)
    listWorkspaces: () => call("GET", "/workspaces"),
    getWorkspace: (id) => call("GET", `/workspaces/${encodeURIComponent(id)}`),
    createWorkspace: ({ owner, slug, name, description, repos }) =>
      call("POST", "/workspaces", {
        owner,
        slug,
        name,
        ...(description ? { description } : {}),
        ...(Array.isArray(repos) && repos.length ? { repos } : {}),
      }),

    // ---- repo details: read (G8 CI + visibility state), write (G18)
    getRepoDetails: (owner, repo) =>
      call("GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/details`),
    patchRepoDetails: (owner, repo, patch) =>
      call("PATCH", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/details`, patch),
  };
}
