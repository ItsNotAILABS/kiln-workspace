# SECTIONS — how KILN the app is divided, and who owns what

Written 2026-10-31 (architect's order: organize the app into sections in the
workspace like an app company's workers own areas). This map is factual from
the tree as it exists tonight. Where ownership is genuinely ambiguous, it
says so — nothing here invents structure that isn't in the code.

## The shape, in one paragraph

kiln.pocketnova.app is Grok's **frozen build** in `public/` (inventory in
`public/freeze/LOCK.json`), served by the Cloudflare Worker in
`ops-cloudflare/`, backed by the origin in `scripts/serve-original.mjs`
(kiln-original.service, :8931), which talks to the **swarm daemon** in the
separate `~/workspace/repos/KILN` repo (:18787). The `src/` TanStack tree in
this repo is a **skeleton**: it is the :8080 builders' preview door plus the
daemon workspace/account layer — it is not the app users see. Every section
below names its surface in the frozen build first, then its platform layers.

**Standing rules that bind every section:**

- **Edit, never rewrite.** Existing pages are fine until the architect says
  otherwise. Changes are surgical edits that keep structure, media, and
  sections. Files listed in `public/freeze/LOCK.json` are the frozen product
  set; the established exceptions are the `?k=` asset stamps and the 2-line
  `js`-class hook in `public/index.html`, and the hand-patched
  `public/kiln-account.json` (never regenerate it — 12 embedded capsule
  files have no surviving disk sources).
- **Visibility law (daemon-enforced).** Every forge repo carries
  `visibility` in its `kiln.json`: **private by default, fail-closed**.
  Public means readable by anyone, including anonymous visitors (list,
  clone, files, commits, branches, pulls, releases). **Writes never open**:
  git push is operator-only, forge writes are owner-only, anonymous push on
  a public repo is still 401. The app never decides visibility; the daemon
  gate does, and every client surface (app merge, SSR snapshot, search)
  inherits that decision.
- **Deploy gates.** App/edge changes ship only through
  `ops-cloudflare/deploy_worker.py` with bindings verified on the new
  version *before* deploying (ASSETS, ORIGINAL_API_URL plain_text,
  KILN_SWARM_TOKEN secret_text preserved, compat 2026-10-24 +
  nodejs_compat), and a change is not "done" until the live page has been
  cold-loaded in a fresh browser and renders its first screen. API checks
  alone never prove a page works.
- **Daemon house rule.** Nobody restarts the swarm daemon by hand. The
  Doctor owns boots; daemon changes activate at the next Doctor boot.

---

## 1. Explore / Discovery

- **User surface:** `/explore` (Discover section at the top: account-handle
  lookup + chips), `/:owner` (profile), `/:owner/:repo` (repo home, file
  tree, README, Commits), the ⌘K command palette (Accounts + Public repos
  groups), mobile bottom-bar Explore tab. The standalone Discover tab was
  folded into Explore on 2026-10-31 — there is one discovery home.
- **Code home:** frozen chunks `explore-rtlBhl3C.js` (route),
  `explore-list.js` (list + Discover section), `AppShell-H-m5HQPd.js`
  (nav, palette, mobile bottom bar), `_owner-*.js`, `_repo-DtOO023L.js` /
  `_repo-BcnIeLcW.js`, `RepoChrome-BaVvC5oG.js`, `_repo-kit.js`,
  `commits-BcBsIMIz.js`, `explore-github.js` (GitHub view-only lookup).
  **Our module:** `public/assets/kiln-public.js` — merges looked-up public
  accounts into the store as `forgeMirror` records (never over the viewer's
  own handle), repairs forge-capsule import stubs at boot, and feeds the
  palette's public groups. The edge SSR snapshot for these routes lives in
  the Edge Worker section (§8).
- **Data source:** the client store (`store-sx46DNi5.js`), seeded from
  `public/kiln-account.json`; public data from `GET
  /api/kiln/public/accounts/:owner/repos`,
  `.../repos/:repo/commits`, `GET /api/kiln/public/search?q=` on the origin,
  which reads the daemon **anonymously** — the daemon's visibility gate is
  the only enforcement, so private repos are never returned, merged, or
  rendered for any viewer.
- **Deploy gate:** Worker pipeline (above) + cold-load browser walk,
  signed out: Explore renders, lookup returns exactly the public set,
  a private repo answers "No public tree with that name."

## 2. Studio (the creation suite)

- **User surface:** `/studio`. Beneath the hero, the app's own
  user-creation doors: `/new` (new repository), `/new?tab=import` (GitHub
  import), `/gists` (new gist).
- **Code home:** `studio-tabs.js` (the tabbed Agentic Studio — crew,
  GitHub import, one-shot, computer, CLI; **LOCK file**),
  `studio-fjyqp5G-.js` (route re-export; LOCK file), `kernel-Y7F91935.js`
  (agent-turn client; LOCK file), `new-DrGYWjdX.js` / `new-qDTlb39S.js`,
  `github-import.js`, `gists-helYFVPX.js`. Agent turns execute on the
  origin: `scripts/agent-turn.mjs` (writes land as git commits).
- **Data source:** the daemon forge (repos, workspaces) via
  `/api/kiln/agent-turn` and `/api/kiln/*` on the origin; the kiln wallet
  identity from the store.
- **Standing rule, stated twice because it was broken twice:** Studio is
  the app's **full creation suite** — everything users make starts there,
  not just the one-shot prompt. **Forge administration never lives inside
  Studio**: workspace registry, agent tokens, and account plumbing belong
  to `/workspaces`, `/agents`, `/account`. Do not append admin cards under
  the Studio hero, and do not strip Studio down to the prompt alone.
- **Deploy gate:** Worker pipeline + cold-load walk of the Studio tabs.

## 3. Marketplace

- **User surface:** `/marketplace` (nav + mobile bottom bar).
- **Code home:** frozen chunk `marketplace-ZjEnaBK1.js`; adjacent surfaces
  in `packages-BoFx1Umh.js` / `packages-CXc1_BwV.js` (packages),
  `bounties-DD7H3yFr.js` (bounties), `pricing-D55xWYdI.js`.
- **Data source:** the store plus the daemon packages surface
  (`/v1/packages`, KILN repo `swarm/lib/packages.mjs`).
- **Open product calls (not decided, do not improvise):** whether `/gpu`
  and `/pricing` become real surfaces or are removed.
- **Deploy gate:** Worker pipeline + cold-load walk.

## 4. L1

- **User surface:** `/l1` (nav + mobile bottom bar).
- **Code home:** the app-chain state lives in the store
  (`store-sx46DNi5.js` exports `chainBlocks` / `chainTxs`, imported by
  `kiln-forge.js`); chain-flavored chunks `chain-B3-jCySW.js`,
  `chain-BeGhQWqf.js`. **Ambiguity, stated honestly:** the compiled chunks
  do not draw a clean line around a single "L1 page" module — chain state
  is woven through the store and the forge boot module, so L1 work usually
  touches §5's modules too.
- **Data source:** the **in-app ledger** — a hash-chained, single-writer
  app chain (KLN issuance: one-time faucet, agent-wallet seeding). This is
  **not** the contract L1. `KilnOwnershipRegistry.sol` lives in the KILN
  repo (`contracts/`, `deployments/chain.json`) and anchors to Robinhood
  Chain 4663 + Monad per the architect's multi-chain decision; the app
  syncs it via `scripts/sync-kiln.mjs`. Never conflate the two ledgers.
- **Deploy gate:** app-side changes ride the Worker pipeline; contract
  changes ride the KILN repo's Foundry suite and the deploy packet — the
  broadcast itself is the architect's key, never an agent's.

## 5. Account & Wallet / Identity

- **User surface:** `/account`, `/login` (hidden whenever a wallet is
  connected — a connected wallet *is* the sign-in), profile settings,
  `/:owner` profile pages, wallet views (totals strip, Details with
  address/copy/recent transactions, transfers), agent-wallet ledger,
  model-wallet mint.
- **Code home:** frozen chunks `account-49nJUaQm.js`,
  `wallet-CTr0sTgn.js`, `settings-COVC9ISI.js`, `members-*.js`,
  `orgs-*.js`, `invite-*.js`, `users-XnMdv_zG.js`; the in-browser
  filesystem and the **100 GiB** per-folder quota live in
  `fs-ri9Mkfbm.js`. **Our modules:** `kiln-forge.js` (operator boot: fetch
  install, L1 seeding, capsule merge), `boot-kiln.js` (operator
  auto-connect), `kiln-public.js` (profile merge for looked-up accounts).
- **Data source:** the store locally; the daemon account system
  (`swarm/lib/accounts.mjs`; `/v1/accounts`, `/v1/accounts/login`,
  `/v1/accounts/me`, `/v1/accounts/me/agents`) for real accounts. Wallet
  linking and recovery are daemon-side: signed-challenge wallet↔account
  linking (ed25519-verified, one address ↔ one account) and an opaque,
  client-encrypted wallet backup (`/v1/accounts/me/wallets/*`,
  `/v1/accounts/me/wallet-backup`) — built in the platform round, live at
  the daemon's next Doctor boot on round code.
- **Direction (architect, 2026-10-31):** wallet-first signup (wallet =
  identity), X/Twitter connect at signup, everything else linkable later
  in profile settings; re-sign-in must restore the already-generated
  wallet; Phantom connects as a **second wallet** on the same profile.
  The app-side restore/link UX is the identity lane's remaining work —
  until it ships, the local-key wallet is browser-local, and that limit
  is stated in the UI, never papered over.
- **Deploy gate:** Worker pipeline + cold-load walk signed out *and*
  signed in; daemon-side changes ride the KILN suite (399 tests) and
  activate at a Doctor boot — verify `/v1/capabilities` after the boot.

## 6. Models

- **User surface:** `/models`, `/models/:id` (nav: Models).
- **Code home:** frozen chunks `models-BywBH3wg.js`,
  `model-dm89L9bG.js`, plus `assistants-*.js` for assistant surfaces.
- **Data source:** model connections in the store (a connection's wallet
  is derived and auto-minted in the §5 wallet system when the model is
  connected); daemon compute surface (`/v1/compute/apps|capacity|invoke|
  map`, KILN repo `swarm/lib/compute.mjs`, `minds.mjs`).
- **Known gap, disclosed:** no store action yet credits or debits model
  wallets on use — the wallet exists, the metering does not.
- **Deploy gate:** Worker pipeline + cold-load walk.

## 7. Forge administration (its own doors — never Studio)

- **User surface:** `/workspaces`, `/agents`, `/account` (see §5), repo
  settings and the visibility toggle (owner-only).
- **Code home:** daemon-first: KILN repo `swarm/lib/forge.mjs`,
  `workspaces.mjs`, `repodetails.mjs`, `sites.mjs`, `promote.mjs`;
  app-side chunks `projects-DL1wg6Dm.js`, `orgs-*.js`. Repo creation with
  templates (license picker + user-saved templates) is daemon-side
  (`POST /v1/repos`, `/v1/templates`); surfacing templates in the app's
  creation flow is a follow-on that belongs to §2's doors.
- **Data source:** the daemon, operator/owner sessions only.
- **Deploy gate:** KILN suite; activation at a Doctor boot.

---

## Platform layers (no single section owns these — every section rides them)

## 8. Edge Worker / SSR — `ops-cloudflare/`

- **What it is:** the Cloudflare Worker named `kiln` holding the
  kiln.pocketnova.app custom domain. Serves the frozen app from Worker
  static assets (= `public/`), stubs `/_serverFn/*` as `{result:null}`,
  proxies `/api/kiln*`, `/api/mcp`, `/api/github*` to the origin, and
  404s genuinely missing assets.
- **SSR snapshots:** for navigation GETs to `/explore`, `/:owner`,
  `/:owner/:repo`, the Worker fetches the route's anonymous public data
  under a 3-second budget and injects a semantic text snapshot (hidden
  from humans once JS boots; read by agents and fetchers). Responses
  carry `x-kiln-ssr: descriptive | data | unavailable` — the layer
  self-reports which case answered. Private and nonexistent answer
  identically: no existence oracle. A non-GET/HEAD to a page route is an
  honest 404, never an edge error page.
- **Code home:** `ops-cloudflare/kiln-edge-worker.mjs` (source of truth
  for the live Worker), `deploy_worker.py` (builds the asset manifest,
  creates a version — deploying is a separate, deliberate step),
  `cf_call.py`.
- **Deploy gate:** bindings verified on the created version **before**
  the deployment call, every time. The `kiln-forge` Pages project is a
  separate mirror — it is *not* the domain's server.

## 9. Origin — `scripts/serve-original.mjs` (kiln-original.service, :8931)

- **What it is:** the app's backend on the home machine, reached through
  the tunnel at kiln-original.medinatechlabs.net. Serves statics for the
  origin door, `/api/kiln/*` (agent turns via `scripts/agent-turn.mjs`,
  the forge-activity mirror, and the anonymous public endpoints of §1
  with a 30-second cache — failures answer 200-empty by design), and
  `/api/github*` via `scripts/github-engine.mjs`.
- **Freeze contract:** `public/freeze/LOCK.json` +
  `scripts/kiln-lock.mjs` + `startup.sh` restore the protected product
  files on boot.
- **House note:** the unit definition is preserved at
  `~/workspace/system/kiln-original.service`; it is not yet in the
  boot-restore unit list (flagged, awaiting the architect's word).

## 10. Daemon APIs — the KILN repo (`~/workspace/repos/KILN/swarm/`)

- **What it is:** the forge itself: `lib/daemon.mjs` + `lib/httpapi.mjs`
  on :18787, `lib/forge.mjs` (repos, pulls, releases, visibility),
  `lib/accounts.mjs`, `lib/workspaces.mjs`, `lib/packages.mjs`,
  `lib/compute.mjs`, `lib/sites.mjs`, `lib/openapi.mjs` (the served
  OpenAPI documents 42 path templates / 61 operations, with a drift test
  that fails the suite if a registered `/v1` route goes undocumented),
  `mcp-server.mjs` (the same surface as MCP tools), supervised by the
  Doctor (`lib/doctor.mjs`; `swarm.mjs doctor check`).
- **Surfaces:** `/v1/capabilities`, `/v1/accounts*`, `/v1/repos*`,
  `/v1/templates`, `/v1/workspaces*`, `/v1/packages*`, `/v1/compute/*`,
  `/v1/sites`, `/v1/promote`, `/v1/openapi.json`, plus git smart-HTTP
  under `/git` (push: operator token only).
- **Deploy gate:** the swarm test suite (399 tests at the platform-round
  tip) green in a clean worktree; activation only at a Doctor boot;
  verify `/v1/capabilities` afterward — a merged daemon change is not a
  live daemon change until the boot happens.

## 11. The `src/` skeleton (:8080 door)

- **What it is:** the TanStack tree (routes in `src/routes/` — account,
  agents, apps, explore, marketplace, models, new, orgs, papers,
  settings, and more) served by the Vite dev server on :8080
  (kiln-forge.service). Builders' preview + the daemon workspace/account
  layer. Its `/studio` is a one-shot stub — never cite it as "the Studio"
  (§2 is the real one). Root `AGENTS.md` / `AGENTS.project.md` are the
  Grok sandbox contract for this tree.
- **Deploy gate:** `tsc --noEmit` (Vite builds do not typecheck) plus a
  signed-in browser walk of changed pages, per this repo's hard lessons.

---

## Cross-cutting ambiguities (recorded, not resolved here)

- `/assets/kiln-chat.css` is in the LOCK set but missing from the served
  asset set (404, cosmetic, pre-existing).
- `/freeze` answers 404 through a Worker special case (pre-existing,
  parked for its own look).
- Papers: the frozen app has paper surfaces (`papers-*.js`,
  `paper-DZK2VAq_.js`) and the skeleton has `src/routes/papers.tsx`, but
  **published-paper hosting is not a KILN feature yet** — the Sites system
  (`swarm/lib/sites.mjs`) is a linkage registry, not a content server.
  The build order for real KILN Pages is recorded in the KILN repo at
  `swarm/docs/PAGES.md`. Until it lands, a published paper's repo is the
  source of truth on the forge and its live site is served by an external
  static host, labeled as such.
