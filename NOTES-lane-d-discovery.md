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
- `GET /api/mcp` and `POST /api/mcp` (public, via the Worker) → the
  combined public probe was still crawling through the slow egress at
  commit time; the SAME requests against the tunnel origin (the exact
  server the Worker proxies `/api/mcp` to) answered first-hand:
  - `GET https://kiln-original.medinatechlabs.net/api/mcp` → **200**
    `application/json`, `{ ok: true, tools: [28 names], transport:
    "JSON-RPC 2.0 POST /api/mcp" }`.
  - `POST …/api/mcp` initialize (protocolVersion 2025-03-26) → **200**
    `{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",
    "capabilities":{"tools":{}},"serverInfo":{"name":"kiln",
    "version":"2026.9"}}}` — a correct, ingestible handshake; the
    server negotiates its own 2024-11-05, per spec.
  So the MCP door itself is healthy at the origin. What an external
  runtime could NOT ingest was the discovery layer around it: no
  manifest anywhere points at `/api/mcp`, `/api` answered HTML/404,
  and a client that requires the 2025-03-26 Streamable-HTTP session
  dance (Mcp-Session-Id, SSE) gets neither from this sessionless
  plain-JSON server — the manifests now state the transport plainly
  (sessionless JSON-RPC POST, protocol 2024-11-05) so a client can
  pick the right mode instead of guessing. A public-edge re-probe of
  GET/POST `/api/mcp` post-landing is in the landing checklist below.

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

## STEP 3 — shipped on this branch

- `81e33f2` — these NOTES (probe evidence + contract map).
- `3980df8` — Worker discovery, in `ops-cloudflare/kiln-edge-worker.mjs`
  (surgical: header comment + one routing block + a discovery section
  appended; builders exported for regeneration/tests):
  - `GET /.well-known/agent.json` → 200 JSON manifest built from the
    request origin: MCP endpoint + auth story, agent-account summary,
    the Lane C redemption door (real route `POST
    /v1/agent-invites/:token/redeem`, body/errors/base/status),
    sponsor doors, capabilities pointer (public index + bearer-gated
    daemon `/v1/capabilities` + `/v1/openapi.json`), public API list,
    daemon stdio MCP (kiln-forge 1.0.0, protocol 2024-11-05).
  - `GET /.well-known/mcp.json` → 200 JSON: `mcpServers.kiln.url`
    config shape + a `servers` array (remote HTTP + daemon stdio).
  - Static copies in `public/.well-known/agent.json` +
    `public/.well-known/mcp.json` (generated from the same builders,
    canonical origin) so the tunnel origin / static mirrors answer
    identically; `deploy_worker.py`'s os.walk includes the dot-dir.
  - `GET /api` and `GET /api/` → 200 JSON index of the doors
    (endpoints + daemonApi block); other methods → 405 JSON.
  - `/api/mcp` → **no code change**: the existing Worker proxy to the
    origin's `handleMcp` already answers a real handshake (evidence
    above); the fix was documenting its transport honestly in the
    manifests. Nothing invented, nothing re-implemented.
  - `ops-cloudflare/README.md` — discovery bullet added (the README
    orders itself kept in sync with the worker source).

## Local verification (first-hand, this worktree)

Harness: the Worker module imported in node with a mock ASSETS binding
(serves this worktree's `public/`, else 404) and `ORIGINAL_API_URL`
pointed at this worktree's `scripts/serve-original.mjs` running
locally on :18931 (started for the check, killed after; no service
touched). Results:

- `GET /.well-known/agent.json` → 200, `application/json`,
  `cache-control: public, max-age=300`, origin-correct URLs.
- `GET /.well-known/mcp.json` → 200 JSON, `mcpServers.kiln.url` set.
- `GET /api` and `GET /api/` → 200 JSON index; `POST /api` → 405 JSON.
- `GET /api/mcp` (through the Worker proxy) → 200, 28 tool names.
- `POST /api/mcp` initialize → 200 JSON-RPC result (protocolVersion
  2024-11-05, serverInfo kiln 2026.9); `tools/list` → parses, 28 tools
  with schemas.
- Static copies direct from serve-original: both `/.well-known/*.json`
  served as JSON (`.json` → `application/json` in its MIME table).
- Regressions: `GET /` → SPA shell 200; `GET /_serverFn/x` →
  `{"result":null}`; `GET /assets/nope.js` → real 404.
- `node --check ops-cloudflare/kiln-edge-worker.mjs` clean.

## Remaining — landing (deploy) checklist for the landing lane

1. Land this branch onto the deploy branch, then deploy the Worker the
   house way (`ops-cloudflare/deploy_worker.py`: version create →
   verify bindings still include `KILN_SWARM_TOKEN` → deployment at
   100%). The two new `public/.well-known/*.json` files MUST be in the
   uploaded asset manifest (194 → 196 files).
2. Post-deploy public re-probe (curl, first-hand): `GET
   /.well-known/agent.json`, `GET /.well-known/mcp.json`, `GET /api`,
   `GET /api/`, `GET /api/mcp`, `POST /api/mcp` initialize +
   tools/list — expect 200 JSON everywhere; then a cold-load check
   that `/` still boots (Worker changed).

## Remaining — next Doctor boot / daemon-side (flagged, NOT done here)

1. **Agent-invite routes activate**: the running daemon predates Lane
   C (mint 404 / unauth redeem 401 observed by Lane C); `POST
   /v1/agent-invites/:token/redeem` + sponsor routes go live at the
   next Doctor boot of the merged daemon code (feat/l1-compute).
2. **Public redeem proxy decision**: no `/v1/*` route is proxied at
   the public origin today, so an off-machine agent holding an invite
   link cannot redeem it at kiln.pocketnova.app yet. The one-route
   fix (Worker proxy for `POST /v1/agent-invites/*` to a daemon-
   reachable origin, or a serve-original bridge like the MCP forge
   bridge) needs the landing/daemon owner's call — the manifest
   already states this status honestly, and its `status` field should
   be updated in the same commit that ships the proxy.
3. Daemon capabilities stay bearer-gated by design — no change asked;
   the manifest points credentialed agents at them.
