# Usefulness + UI + GitHub-parity phase — app lane

Worktree: ~/workspace/.worktrees/kiln-usefulness · branch usefulness-phase
Base: improve/ws-system-ui @ 4c89b9a (Worker v47 live). ONE batch, ONE Worker version.
Order: G1 workspaces → G18 repo settings → G8 CI chip → G17 /pages proxy.
Must-lands: G1 + G18, gated before G8/G17.

## Recon (2026-11-02, from daemon code + live operator probes)
- Workspaces LIVE: GET /v1/workspaces (account principal → own + member-of via
  listWorkspacesForAccount); POST {owner,slug,name,description?,repos?,siteIds?,
  parentId?} (account creates only under own namespace); GET /v1/workspaces/:id →
  status {workspace{…,members:[{owner,accountId,role,via,joinedAt}]}, repos:[{repo,
  exists,branch,head,details{description,topics,defaultBranch,commitCount,lastCommit}}],
  sites:[{id,name,frontend,backend,found}], parent, children, rollup};
  PATCH {name?,description?,addRepos?,removeRepos?,linkSites?,unlinkSites?,setParent?}
  owner-only; DELETE guarded by slug confirm (NOT built in app this batch).
- Invites: POST /v1/workspaces/:id/invites {email,role admin|member} owner/admin →
  201 {invite(masked), token (shown once), delivery}; GET list (masked);
  DELETE …/invites/:inviteId revoke; POST /v1/invites/:token/accept (session);
  GET /v1/invites/mine → pending for my bound email, NO token field → the app
  inbox can list but acceptance needs the emailed link token (stated honestly).
  Mail queues unsent until a transport is configured (delivery string says so).
- Live list (operator): 5 workspaces — auro/dfw-haul, auro/itsnotailabs,
  auro/coldstart-ws, itsnotailabs/itsnotailabs (ws_224cf4f58668),
  auro/papers (ws_a75c6a6c825f).
- Details: GET/PATCH /v1/repos/:o/:r/details. Fields: visibility ("public" only
  when kiln.json says so, else "private"), pages {enabled,branch,path} (branch ""
  = default branch, path "" = root; path must be clean relative dir), paper
  {enabled} (enabling requires valid paper.json at default-branch tip — daemon
  400 otherwise), description ≤1024, topics ≤16. PATCH is owner/operator-only.
  Live: auro/marketplace-paper = public, pages {enabled,branch:"",path:"site"},
  paper {enabled:true}, ci null.
- CI (details.ci = lib/ci readLatest): null, or {schema:"kiln.ci-result.v1",
  status: "pass"|"fail"|"error"|"timeout"|"skipped", exitCode, ref, sha,
  recordedAt, suites:[{name,status,durationMs}]}. NO "running" state exists in
  stored results — the chip renders exactly these + null = "No CI result".
  Live: auro/minutely ci.status = "fail" (recorded 2026-11-02T07:33Z).
- Lists carry NO details: kiln-repos hub rows come from public records/store;
  workspace status repo entries carry the facts summary (no ci). Fetching
  details per row = N+1 on a load-sensitive path → G8 chip rides ONLY the
  repo page's single details fetch (shared with G18). Scoped honestly.
- Mounting: /workspaces via _owner shadow (owner==="workspaces"), the
  repos/agents precedent. Repo page home chunk _repo-DtOO023L.js composes
  Chrome+Tree+About — the settings/CI panel mounts under its grid.
  Create sheet: kiln-create.js DOORS. Nav: AppShell "More" dropdown array +
  command-palette P array are clean one-line slots for Workspaces.

## RECONCILIATION (2026-11-02, landing)
A parallel parity lane landed its own G1 + G18 + G8 on improve/ws-system-ui
(47d324c + ce896b2, on top of Lane D v48) while this lane worked, and
deployed them. Rather than land duplicates, this batch reconciled:
- G17 cherry-picked clean onto the merged tip (8278741 in the landing
  worktree; only the NOTES file conflicted, resolved by keeping it).
- G1 completion in the parity module: detail Manage section (owner
  add/remove repos via PATCH; owner/admin invite-by-email with the
  shown-once token + honest queued-mail copy; masked invite list +
  revoke) + parity-core client verbs. Parity's detail was read-only.
- G18 completion in kiln-repo-meta.js: Pages designation (enabled +
  branch + path + live-site link) and paper designation rows join
  visibility/description/topics in the owner Settings panel, same
  details PATCH. Parity's panel had only desc/topics/visibility.
- This lane's standalone kiln-workspaces.js/kiln-settings.js (f13147f,
  37e19a2 on usefulness-phase) are SUPERSEDED by the parity modules and
  were not landed; they remain on the branch for the record.
- Proofs from this lane that stand: ephemeral session contract 27/27
  (workspace lifecycle + invite loop + details flips, .scratch/
  eph_proof.mjs); ephemeral-origin signed-in renders of /workspaces
  list (desktop+375) and detail (375: repos, owner role, invite panel)
  0 pageerrors; staged-origin /pages bytes == /papers bytes incl. PDF
  sha256 e8a995ee (the published snapshot).

## Pieces
- [x] G1 kiln-workspaces.js + _owner wiring + Create door + nav entries — f13147f (load-sim RAN CLEAN incl. _owner graph; class tokens match kiln-agents idiom)
- [x] G18+G8 kiln-settings.js (settings panel + CI chip) + _repo mount (load-sim RAN CLEAN)
- [x] G17 serve-original /pages/<owner>/<repo> route + edge Worker /pages/ rule (staged proof: general path bytes == /papers bytes, PDF sha256 e8a995ee… == published snapshot; proxied 401s == direct daemon 401s)
- [ ] Gates + landing + live proofs

## Decisions
- Repo DELETE: left OUT of this batch (daemon door exists; a delete surface
  deserves its own careful pass, not a bolt-on). Stated in the panel copy? No —
  simply absent; noted here and in the report.
- Workspace DELETE: likewise out (guarded daemon-side; not in G1's ask).
