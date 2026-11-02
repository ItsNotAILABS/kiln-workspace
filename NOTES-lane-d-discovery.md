# Lane D — agent discovery for KILN (NOTES)

Branch `lane-d-discovery` off `improve/ws-system-ui` (88cc4c8), worktree
`~/workspace/.worktrees/lane-d-discovery`. Do NOT deploy the Worker from
this lane (a parallel landing lane owns the deploy). Do NOT restart any
daemon/service.

## STEP 1 — first-hand probe evidence (BEFORE, 2026-11-02 ~01:56 CST)

Probed https://kiln.pocketnova.app with curl (public egress is slow;
several requests took >10 s):

- `GET /.well-known/agent.json` → **404**, `content-type: text/plain;
  charset=utf-8`, body `not found` (Cloudflare edge headers; asset 404
  preserved because the last path segment contains a dot). Gemini
  reported 403/PERMISSION_DENIED; first-hand it is a plain **404** —
  either way: no manifest exists.
- `GET /.well-known/mcp.json` → **404**, same plain-text `not found`.
- `GET /api` → **200 but the HTML SPA shell** (`<!doctype html>…`),
  because the Worker only treats `/api/` (trailing slash) as API-shaped;
  bare `/api` falls into the SPA fallback. Not machine-readable.
- `GET /api/` → **404 text/plain `not found`** (ASSETS 404 preserved for
  `/api/` paths). So the root API door is either HTML or an unexplained
  404 depending on the slash — no honest index either way.
- `GET /api/mcp` and `POST /api/mcp` (MCP initialize,
  protocolVersion 2025-03-26) → probe results recorded in the addendum
  below when the slow-egress curls land. [PENDING at checkpoint 1]

No `PERMISSION_DENIED` string exists anywhere in the app origin code
(`scripts/`, `ops-cloudflare/`) or the daemon (`swarm/`) — that wording
was Gemini's client's rendering, not a KILN response body.

## STEP 2 — the layers, and the existing contracts (verbatim, not invented)

Public path: Cloudflare Worker `ops-cloudflare/kiln-edge-worker.mjs`
(assets from `public/`, deploy via `ops-cloudflare/deploy_worker.py`,
os.walk includes dot-directories) → proxies ONLY `/api/kiln*`,
`/api/mcp` (exact), `/api/github*`, `/api/forge*`, `/papers/`, `/doi/`
to the tunnel origin `kiln-original.medinatechlabs.net`
(kiln-original.service, `scripts/serve-original.mjs`, :8931).
`/.well-known/*`, `/api`, `/api/` are NOT routed anywhere — root cause
of every claim above is at the Worker layer, i.e. origin-side, i.e.
this lane.

Existing MCP contracts found (two, both protocol **2024-11-05**):

1. **HTTP MCP at `/api/mcp`** — `scripts/agent-turn.mjs` `handleMcp`:
   `initialize` → `{ protocolVersion: "2024-11-05", capabilities:
   { tools: {} }, serverInfo: { name: "kiln", version: "2026.9" } }`;
   `tools/list` → 17 app tools (`kiln_list_files`, `kiln_read_file`,
   `kiln_write_file`, `kiln_create_branch`, `kiln_open_pr`,
   `kiln_search` are forge-bridge tools that forward the caller's
   `Authorization: Bearer` to the daemon at 127.0.0.1:18787; without a
   credential only public repos answer); `tools/call`, `ping`,
   `notifications/initialized` handled; unknown method → -32601.
   `GET /api/mcp` → `{ ok, tools: [names], transport: "JSON-RPC 2.0
   POST /api/mcp" }`. This is the surface the app itself advertises
   (public/assets addons/cli: "MCP Streamable HTTP, POST /api/mcp,
   protocol 2024-11-05", client config `{ "mcpServers": { "kiln":
   { "url": "<origin>/api/mcp" } } }`).
2. **Daemon stdio MCP** — `~/workspace/repos/KILN/swarm/mcp-server.mjs`:
   zero-dependency, newline-delimited JSON-RPC over stdio,
   `PROTOCOL_VERSION = "2024-11-05"`, `SERVER_INFO = { name:
   "kiln-forge", version: "1.0.0" }`, 48 tools (`kiln_workspace_*`,
   `kiln_repo_details`, `kiln_forge_*`, `kiln_papers_*`,
   `kiln_agent_invite_*`, `kiln_agent_account_*`, …) calling the
   daemon `/v1` API with the operator token. Answers
   initialize/tools/list with NO daemon running. Local-spawn only —
   there is no public HTTP door onto it.

Daemon discovery contract: `GET /v1/capabilities` →
`buildCapabilities()` (ability index, `swarm/lib/openapi.mjs`) and
`GET /v1/openapi.json` (OpenAPI 3.1) — **bearer-gated by design**, like
every `/v1` route (openapi.mjs header, httpapi.mjs discovery block).
So the public capabilities pointer must live at the origin (the
manifests), pointing at the gated daemon documents for credentialed
agents — not bypass them.

Lane C redemption route — exact shape (daemon `swarm/docs/ACCOUNTS.md`
§"Agent accounts + agent invite links", `swarm/lib/httpapi.mjs`,
`NOTES-lane-c-agent-accounts.md`, MCP tool `kiln_agent_invite_create`):

- `POST /v1/agent-invites/:token/redeem` — **PUBLIC (no bearer)**, body
  `{ owner, name, modelLabel? }` → `201 { account, agent, token,
  invite }`, token (`kiln_agt_…`) shown once. Consumed/revoked/unknown
  → 404 indistinguishable; expired → 410; validation failure does NOT
  consume the link.
- Sponsor side (authenticated): `POST/GET
  /v1/accounts/me/agent-invites`, `DELETE
  /v1/accounts/me/agent-invites/:id`; direct create `POST
  /v1/accounts/me/agent-accounts`.
- ⚠️ The lane brief's shape `POST
  /v1/accounts/agent-invites/:token/redeem` is NOT a daemon route.
  The manifests use the daemon's real route above.
- ⚠️ There is **no public `/v1/*` proxy** anywhere in the app-origin
  stack (Worker routes + serve-original handlers checked): redemption
  is reachable today only on the daemon API base (agent kit
  `KILN_SWARM_API_URL`, default `http://127.0.0.1:18787`). A public
  proxy for the ONE unauthenticated redeem route is a follow-up that
  needs a landing/daemon decision — flagged, not smuggled in here.
  The manifests describe the door with this status stated plainly.
- Live-daemon status per Lane C notes: the running daemon predates
  agent invites (mint 404 / unauth redeem 401 observed) — the routes
  activate at the **next Doctor boot**. Daemon-side item, not this lane.

## STEP 3 — plan (origin-side only, surgical)

1. Worker: serve `/.well-known/agent.json` + `/.well-known/mcp.json`
   from the Worker itself (origin-correct URLs built from the request
   origin), unauthenticated, `application/json`, short public cache.
   Static copies also land in `public/.well-known/` so the tunnel
   origin (serve-original serves `.json` as application/json) and any
   static mirror answer the same documents.
2. Worker: `GET /api` and `GET /api/` → honest JSON index of the
   public doors (other methods → 405 JSON pointing at the index).
3. `/api/mcp`: keep the existing proxy to the origin's `handleMcp`
   (the contract above) — fix only what the probe proves broken.
4. Daemon-side flags (NOT implemented here): public `/v1` redeem
   proxy decision; agent-invite routes activate at next Doctor boot.
