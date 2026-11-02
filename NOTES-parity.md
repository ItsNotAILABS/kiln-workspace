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
- [ ] 1 G1: kiln-parity-core.js (client + ciVerdict) + kiln-workspaces.js
      (/workspaces list + detail + create) + _owner wrapper branch +
      kiln-create.js "New workspace" door.
- [ ] 2 G18: kiln-repo-meta.js settings sheet (description, topics,
      visibility flip) + plain visibility badge on the repo bar;
      owner-only render, non-owners see state only.
- [ ] 3 G8: CI chip in kiln-repo-meta.js bar (details.ci) + workspace
      detail repo rows.

## Gates (per piece, before its commit)
- [ ] node --check every changed file
- [ ] load-sim RAN CLEAN for each changed/new module (.scratch/loadsim.mjs)
- [ ] class audit of new CSS class tokens vs styles-A_fIl0Ci.css
- [ ] ephemeral-daemon / contract proofs (.scratch/eph_proof.mjs pattern)
- [ ] cold-load renders desktop + 375px on a staged origin:
      /workspaces, one repo page (settings + CI chip), 0 pageerrors
