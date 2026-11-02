# GitHub-parity batch — G1 workspaces · G18 repo settings/visibility · G8 CI chip

Worktree: ~/workspace/.worktrees/kiln-parity · branch parity-g1-g18-g8
Base: improve/ws-system-ui @ 21a896c (account-unify landed, Worker v47).
Does NOT deploy — lands as ONE Worker version AFTER Lane D's. Do NOT touch
ops-cloudflare/. Frozen chunks edited surgically only where unavoidable,
flagged below.

## Recon findings (2026-11-02, read from the trees + read-only daemon probes)
- Daemon contracts (KILN @ feat/l1-compute, swarm/docs/WORKSPACES.md +
  lib/repodetails.mjs + lib/httpapi.mjs + lib/ci.mjs):
  - Workspaces: POST /v1/workspaces {owner, slug, name, description?,
    repos?, siteIds?, parentId?} → 201 {ok, workspace}; account principals
    create only under their own namespace (403 otherwise). GET
    /v1/workspaces → {workspaces:[...]} (account: own + member-of).
    GET /v1/workspaces/:id → aggregated status {workspace, repos:[{repo,
    exists, branch, head, details:{description, topics, defaultBranch,
    commitCount, lastCommit}}], sites, memory, parent, children, rollup};
    workspace record carries members[] {owner, accountId, role, via,
    joinedAt} (owner is never a member). PATCH/DELETE owner-only.
  - Repo details: GET /v1/repos/:o/:r/details → full object incl.
    visibility ("public" ONLY when kiln.json says exactly that; anything
    else reads "private" — fail-closed), description, topics, ci.
    PATCH same path {description?, topics?, visibility?} → {ok, details};
    account principals only under their own namespace (403 otherwise);
    topics each ^[a-z0-9][a-z0-9-]{0,31}$, ≤16; description ≤1024 chars;
    visibility must be "public"|"private" (400 otherwise).
  - CI: details.ci = lib/ci.mjs readLatest() result or null. Result doc:
    {schema "kiln.ci-result.v1", status: "pass"|"fail"|"error"|"timeout",
    sha, ref, suites:[{name,status,durationMs}], recordedAt, log}.
    null = no recorded verdict (repo not enrolled / never run) — the
    honest "no CI configured" state. There is NO queued/running field in
    the details object; the chip maps a queued/running status if one ever
    appears, but from today's contract "running" is unreachable — stated
    here, not faked in the UI.
- LIVE probe (read-only, local daemon 127.0.0.1:18787, operator token):
  GET /v1/workspaces → 200 with real records (dfw-haul, itsnotailabs, …)
  and GET /v1/repos/auro/senda/details → 200 with visibility "private",
  ci null. **The workspaces + details routes are LIVE on the running
  daemon, not staged** — no staged-degrade copy needed for G1/G18; the
  surfaces still handle 404 as "not yet active" defensively (the
  isNotYetActive precedent) in case an older daemon answers.
- Routing: frozen router has no /workspaces route; /workspaces resolves
  as /$owner with owner "workspaces" — the _owner-B3Oc7_zJ.js wrapper B
  precedent (repos → KilnReposHub, agents → KilnAgentsSurface). Surgical
  edit: one import + one ternary branch. FLAGGED frozen-chunk edit #1.
- Create sheet IS house-owned (kiln-create.js, DOORS list): adding a
  "New workspace" door → /workspaces?new=1 is a house-module edit, no
  frozen chunk touched. The workspaces surface opens its create form
  when ?new=1 is present.
- Repo page (/:owner/:repo) is a frozen chunk with no house hook.
  House precedent for global surfaces: AppShell-H-m5HQPd.js imports and
  renders KilnCreateSheet next to the shell chrome. G18+G8 ride the
  same mount: AppShell surgical edit (one import + one jsx next to
  KCS) mounts KilnRepoMetaBar from the new house module
  kiln-repo-meta.js; the bar self-gates on location (exactly two path
  segments, first segment not a reserved app route) and renders nothing
  elsewhere. FLAGGED frozen-chunk edit #2. This avoids any edit to
  kiln-repos.js / kiln-papers.js / kiln-vault.js (live-bugs lane owns
  those); the CI chip therefore ships on the repo page header bar and
  on workspace-detail repo rows (per-repo details reads), NOT inside
  kiln-repos.js list rows — deliberate, flagged here.
- Client: new pure module kiln-parity-core.js (identity-core precedent:
  no app imports, node-harnessable) with createParityClient over
  /api/forge/v1 + the session bearer, plus ciVerdict() mapping. UI
  modules (kiln-workspaces.js, kiln-repo-meta.js) import it.
- Session/owner: localStorage kiln.daemon.session.v1 (kiln-agents.js
  precedent); signed-in owner via client.me() (identity client). Owner
  gating for settings UI: me.owner === repo owner — the daemon's 403
  remains the real enforcement; UI hiding is presentation only.

## Pieces
- [x] 1 G1: kiln-parity-core.js (client + ciVerdict) + kiln-workspaces.js
      (/workspaces list + detail + create) + _owner wrapper branch +
      kiln-create.js "New workspace" door.
      Gates: node --check OK (4 files); load-sim RAN CLEAN
      (kiln-parity-core, kiln-workspaces, kiln-create, _owner graph —
      graph timers keep the sim process alive, verdict is the print,
      account-batch precedent); class audit kiln-workspaces.js 57
      tokens, none missing vs styles-A_fIl0Ci.css; ephemeral-daemon
      proof .scratch/eph_proof.mjs 31/31 PASS (also covers the G18/G8
      contracts below: details default private, PATCH flip both ways,
      non-owner PATCH 403, invalid topic/visibility 400, public read
      signed-out, private refused signed-out, ci pass vs ci null).
- [x] 2 G18: kiln-repo-meta.js (mounted by AppShell surgical edit:
      one import + one jsx next to KCS — FLAGGED frozen-chunk edit #2)
      renders the visibility badge + state line on every repo page and
      the owner-only Settings panel (description, topics, visibility
      flip with an explicit confirm step for making public; one click
      back to private). Non-owners/signed-out see state only.
- [x] 3 G8: CI chip in the repo-meta bar (details.ci via ciVerdict) +
      workspace-detail repo rows (per-repo details reads, capped 24).
      States pass/fail/running/none; null ci renders "No CI configured".

## Gates
- [x] node --check every changed file (all batch files, re-verified on tip)
- [x] load-sim RAN CLEAN: kiln-parity-core, kiln-workspaces,
      kiln-create, kiln-repo-meta, AppShell graph, _owner graph
      (.scratch/loadsim*.txt; chunk graphs keep timers alive — verdict
      is the print, account-batch precedent)
- [x] class audit vs styles-A_fIl0Ci.css: kiln-workspaces.js 57 tokens,
      kiln-repo-meta.js 47 tokens — none missing
- [x] ephemeral-daemon proof .scratch/eph_proof.mjs: 31/31 PASS — the
      app's own parity client against an ephemeral merged daemon
      through a /api/forge proxy (workspace create/list/detail,
      cross-namespace create 403, duplicate slug 409, details default
      private, PATCH flip both ways, non-owner PATCH 403, invalid
      topic/visibility 400, public readable signed-out, private
      refused signed-out, ci pass vs ci null, ciVerdict branches)
- [x] cold-load renders on a staged origin over an EPHEMERAL daemon
      (.scratch/render_parity.mjs, seeded owner + public CI-pass repo
      + private no-CI repo + workspace): desktop + 375px, /workspaces
      (surface + workspace listed with repo count), both repo pages
      (PUBLIC/PRIVATE badge, CI PASS / No CI configured, topics,
      owner Settings button, state line), no Not Found, no horizontal
      overflow, ZERO pageerrors. The only console errors are
      ERR_TUNNEL_CONNECTION_FAILED for Google Fonts through the
      sandbox egress proxy — the known sandbox wall, not app errors.
- [x] G18 browser click-through (.scratch/render_settings.mjs,
      desktop): Settings panel opens, description edit saves through
      the UI, visibility flips private→public through the confirm
      step, a fresh daemon details read agrees (public + the edited
      description), 0 pageerrors.

## Landing steps (for the parent — this batch does NOT deploy)
1. Land Lane D first (its own Worker version), per the batch order.
2. Cherry-pick this branch onto improve/ws-system-ui in order:
   b6a78f0 (notes checkpoint) · b401c52 (G1) · <G18+G8 commit> ·
   <final notes commit>. Verify the merged tree with
   `git diff --name-only HEAD <parity-tip>` (expect empty after the
   last cherry-pick) and re-run node --check + load-sim on the merged
   tree.
3. Deploy ONE Worker version from the landed tree (bindings verified
   BEFORE rollout, per the account-batch receipt: ASSETS +
   ORIGINAL_API_URL + KILN_SWARM_TOKEN), then served-bytes sha256 for
   the changed assets: kiln-parity-core.js, kiln-workspaces.js,
   kiln-repo-meta.js, kiln-create.js, _owner-B3Oc7_zJ.js,
   AppShell-H-m5HQPd.js.
4. No daemon boot needed: workspaces + details routes are already
   LIVE on the running daemon (probed read-only 2026-11-02).

## LANDING — in progress (2026-11-02, landing lane)

- Clean landing worktree `~/workspace/.worktrees/kiln-parity-landing`
  (branch `parity-landing`) off `improve/ws-system-ui` @ 60c0656
  (Lane D landed, Worker v48). Main tree carries foreign WIP
  (M ops-cloudflare/README.md, M public/kiln-account.json, ?? data/) —
  deploy runs from this clean tree so none of it ships.
- Cherry-picks, ZERO conflicts: b6a78f0→7231561 (notes),
  b401c52→47d324c (G1), 5ba961f→ce896b2 (G18+G8).
- Tree equivalence: batch files (NOTES-parity.md + the 6 JS assets)
  byte-identical to parity tip 5ba961f; full diff vs parity tip is
  only Lane D's files (worker, public/.well-known/*, its NOTES +
  README). Landing delta vs 60c0656 = exactly those 7 files — no
  OAuth/identity files touched.

## LANDING — gates re-run on the merged tree (2026-11-02)

- `node --check` OK on all 6 changed JS files.
- Load-sim (parity branch's harness, ASSETS pointed at this tree;
  output in this worktree's `.scratch/loadsim{1,2,3}.txt`):
  RAN CLEAN ×3 — kiln-parity-core (exports ParityApiError, TOPIC_RE,
  ciVerdict, createParityClient, invalidTopics, isNotYetActive,
  parseTopics), kiln-workspaces (CiChip, KilnWorkspacesSurface),
  kiln-create (KilnCreateSheet, openCreateSheet), _owner graph
  (component), kiln-repo-meta (KilnRepoMetaBar), AppShell graph —
  export sets identical to the parity branch's own gate run.

## LANDING — Worker v49 created, bindings verified (2026-11-02)

- Deploy from this clean worktree (`ops-cloudflare/deploy_worker.py`):
  asset manifest 212 files (209 at v48 + the 3 new house modules);
  exactly 6 assets were new/changed to the asset store (buckets
  [2,2,2]) = the 6 batch JS files, nothing else.
- **Worker v49** `05deb345-a035-43aa-88f3-9bbeeca25fc3` created
  (NOT yet deployed at this checkpoint).
- Bindings verified on v49 BEFORE rollout: ASSETS (assets),
  KILN_SWARM_TOKEN (secret_text, preserved via keep_bindings),
  ORIGINAL_API_URL (plain_text →
  https://kiln-original.medinatechlabs.net) — BINDINGS_OK.

## LANDING — DONE (2026-11-02, landing lane receipt)

- **Branch landed**: `improve/ws-system-ui` fast-forwarded to this
  landing tip (feature picks 7231561 / 47d324c / ce896b2 + landing
  notes commits). Zero conflicts; no OAuth/identity files touched.
- **Deployed**: Worker **v49** `05deb345-a035-43aa-88f3-9bbeeca25fc3`,
  deployment `549acb94-6ce0-4fe4-8121-37fa123d98be` at **100%**
  (deployments API confirms as latest, created
  2026-11-02T08:31:52Z; previous was v48 deployment eb352e2d).
  Bindings on v49 verified pre-deploy: ASSETS (assets),
  KILN_SWARM_TOKEN (secret_text, preserved), ORIGINAL_API_URL
  (plain_text → https://kiln-original.medinatechlabs.net).
- **Asset manifest**: 212 files; exactly 6 assets new/changed to the
  store = the 6 batch JS files.
- **Served-bytes sha256 (live fetch == merged tree), all MATCH**:
  - kiln-parity-core.js `72b21a61f8a4c691…f9482c5`
  - kiln-workspaces.js `b75462490bee4789…436489`
  - kiln-repo-meta.js `28da681835890d99…e83e91`
  - kiln-create.js `69fac83ce063d747…83844f`
  - _owner-B3Oc7_zJ.js `0aa22cb5c272cb58…66453`
  - AppShell-H-m5HQPd.js `27f0a9d51ee636dd…27003`
- **Public smoke**: `GET https://kiln.pocketnova.app/` → 200 HTML
  SPA shell (1699 B); the 6 new/changed assets serve live (hashes
  above). Full browser render on the live domain is sandbox-blocked —
  NOT faked; render proof stands on the parity branch's staged-origin
  renders over these same bytes.
- **Foreign WIP preserved as found**: main tree still carries
  M ops-cloudflare/README.md, M public/kiln-account.json, ?? data/.
  Deploy ran from the clean landing worktree, so none of it shipped.
- **No daemon action**: no swarm daemon or kiln-original restart —
  workspaces + repo-details routes were already LIVE on the running
  daemon (parity recon, read-only probes).

## Honest shortfalls
- CI chip does NOT appear inside kiln-repos.js list rows (live-bugs
  lane owns that file; the task's preference was own-module rendering).
  The chip ships on the repo page bar and workspace-detail rows.
- "CI running" is mapped in ciVerdict but unreachable from today's
  details contract (only finished verdicts are stored) — labeled in
  kiln-parity-core.js, never synthesized.
- Workspace detail is an in-surface view (no /workspaces/:id route —
  the frozen router cannot admit one); members are read-only here
  (invite management stays on the daemon's invite doors).
- Live-domain render not attempted (this batch does not deploy); all
  render evidence is the staged origin over this worktree's bytes
  with an ephemeral daemon, plus the read-only live-daemon probes.
