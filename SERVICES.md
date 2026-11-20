# Forge Services — the KILN services directory

*Written 2026-11-19 (Forge services pass). This file is the record of
what "Forge services" is in this build, where the registry lives, and
the stable Coffer shapes other surfaces read. Audits behind it:
`~/workspace/pocketnova-wallets/forge-services/` (audit-kiln.md,
audit-service-agents.md, audit-dev-doors.md).*

## What the rail is

"Forge services" did not exist in this KILN build before this pass —
no `/v1/services` route family in the daemon, no registry, no catalog
surface in the frozen app; agent discovery (agent-phone service
cards) is peer-to-peer with no directory. So the build IS the
registry, the hub way — **one canonical services directory in the
forge**:

- **Canonical data:** `public/forge-services.json` in this repo
  (`auro/kiln-workspace`), authored from
  `~/workspace/pocketnova-wallets/forge-services/services-registry.json`.
  Agents can read it through the forge contents API like any repo
  file; the forge surface reads it same-origin.
- **Surface:** `/services` in the frozen app, served by the sidecar
  `public/assets/kiln-services.js` through the `/$owner` dispatch in
  `public/assets/_owner-B3Oc7_zJ.js` (the same pattern as
  `/agents`, `/workspaces`, `/repos`). The nav anchor is injected by
  the sidecar itself (the nav loader lives in frozen `index.html`,
  so the anchor arms when the services module loads). No frozen
  (LOCK.json) file was touched.
- **Live labels:** registry labels are the floor, never the ceiling.
  The Coffer card reads Coffer's own `GET /v1/pricing` live
  (CORS-open since the 2026-11-19 Coffer production pass) and renders
  what it returns — network, charging state, wallet types, fee —
  marked "● Live"; Sendapay's card attempts its `/health`. Any
  failure degrades silently to the registry labels. Nothing is
  invented, and a failed registry fetch renders an honest empty
  state, not fake cards.
- **Windows on the same registry:** Sendapay `/developers` carries a
  "Forge services" section rendered from the same data (live since
  2026-11-19). Senda `/developers` is built in `auro/senda` on local
  branch `services-developers-local` (route + registry data + nav),
  held local-only by the architect's secret-rotation gate (below).
- **Staged future step:** a daemon `/v1/services` record type (so
  services become forge records beside repos/packages/sites) is the
  documented next move when the daemon next opens for feature work.
  Until then the registry file is the one hosted truth — do not grow
  a second copy anywhere; surfaces render THIS data or read the
  service itself live.

## Registry format

`{version, updated, note, services: [...]}` — each service:
`id, name, tagline, kind (api|engine), flagship?, door, console?,
discovery?, docs, sdk?, doorNote?, labels[], getStarted`.
Labels are read from the service itself at registration time
(its pricing/discovery door, its VERSION file, its live health) —
never invented. `doorNote` is for a service with no public door: it
prints plainly where a door link would go.

To add a service: append an entry, update the windows
(Sendapay `pages.mjs` SERVICES array, Senda `forge-services.ts`),
ship. Keep labels truthful or remove them.

## The services (2026-11-19)

1. **Coffer** — flagship. Wallets & vaults API.
   Door https://coffer.pocketnova.app · console `/app` · docs `/docs`
   · discovery `GET /v1/pricing` (CORS-open). Get started: operator
   mints the account key (the one operator power), then
   `POST /v1/wallets`. Agents may also hire Coffer through the
   VaultNet service-agent desk (signed card; SDK in
   `auro/agent-phone`) — the desk runs on demand, not always-on.
2. **Sendapay** — merchant money protocol. Settles in Circle-issued
   USDC/EURC on Solana via Circle's published mints; conversions over
   Jupiter. **There is no Circle API/CCTP integration** — never write
   "Circle rails" as if there were. SDK `@itsnotailabs/sendapay-sdk`
   + MCP. (Registry label note: the entry's version/scope labels are
   a snapshot — v1.14.0/33 scopes at registration; the protocol has
   since shipped v1.15.0 and the live scope table has moved. Refresh
   the labels from the live door at the next registry touch.)
3. **Sends engine** — money-movement quote engine (`auro/sends-engine`,
   v1.0.0). Fleet-local at `127.0.0.1:8796` today, **no public door
   yet** — the registry says so in `doorNote` instead of inventing a
   link. Quote-only: signs, sends, custodies nothing. LI.FI provider
   is `key_required` (the house LI.FI key flips it live).

## Coffer shapes other surfaces depend on (stable)

The admin app's operator window and the Coffer console both read
these; keep them stable and additive.

**Service attachment** — wallets attach to SERVICES, not programs.
`service` on wallet create (the long-standing `agent_identity` stamp
is the same field; either name sets it, both read back; agent
wallets require it). HD children accept `service` on derive.

- `GET /v1/services` → `{services: [{service, wallets, by_type,
  by_network}], unattached, total}` (caller's account, active only)
- `GET /v1/services/:id/wallets` → `{service, wallets, total, limit,
  offset}` (404 when the account has no active wallet on it)
- `GET /v1/wallets?service=&unattached=true&network=` filters
- `GET /v1/admin/services` (operator) → cross-account aggregates:
  `{generated_at, services: [{service, wallets, accounts, by_type,
  by_network}], unattached, total}`
- `GET /v1/admin/services/:id/wallets` (operator) → the drill-down;
  each wallet view carries `account_id`
- Every wallet view carries `service` when attached.

**Network dimension** — `network` at create: `mainnet-beta`
(default; every pre-existing wallet is mainnet, untouched) or
`devnet` for Solana types; `evm` is `ethereum-mainnet` only. Every
wallet view and balance response carries the wallet's `network`;
balance reads always hit the wallet's own network. Trades refuse
devnet wallets `409` (they settle on mainnet). The token registry is
a mainnet registry — devnet token reads report native + devnet scan
results only.

**Idempotency** — `Idempotency-Key` header on `POST /v1/wallets`,
`POST /v1/wallets/batch`, `POST /v1/vaults`: same key + same request
replays the first response; same key + different request → `409`
with `code: IDEMPOTENCY_CONFLICT`. `429` responses carry
`Retry-After: 60`. Every API response carries `x-request-id`.
`GET /health` and `GET /v1/pricing` are CORS-open (`*`, no
credentials); nothing else is.

## Gates (the architect's, untouched by this pass)

- Coffer `liveCharging` activation — metering runs, nothing bills.
- A keyed RPC endpoint for Coffer — the keyless public endpoints
  ration balance reads (the 503 wall); devnet reads share it.
- Any server-side signing decision — Coffer never signs in v1.
- Senda: rotation of the broker secret behind the hard-coded
  `PREVIEW_CLIENT_SECRET` — the Senda `/developers` build waits on
  it, local and verified.
- The house LI.FI key (portal.li.fi) — flips the sends engine's
  LI.FI provider live.
- A public door for the sends engine — future work, labeled as such.
