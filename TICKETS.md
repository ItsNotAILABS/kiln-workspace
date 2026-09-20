# KILN Forge — Improvement Tickets

Produced 2026-09-19 from a full read-only walkthrough of the app as a first-time
user (public deployment `https://kiln-git.grok.me/`) plus verification of each
finding against current source (`main`, local build `k=35`).

Updated 2026-09-19 (evening pass): full interactive walkthrough of current
source as a real user — repo creation, issues/pulls/commits, all repo tabs,
account/wallet connect-disconnect, swarm console (spawn, job, receipts),
KILN-native git clone/push — with Playwright against the dev server. Every
reproducible defect was repaired in the same pass (Section D).

Updated 2026-09-19 (swarm E3 pass): dogfood tickets E1 (daemon-down UX, fixed)
and E3 (smart-HTTP self-deadlock, fixed — Critical). Swarm suite 92/92 green;
SDK-only agent loop verified end-to-end (clone→compute→commit→push→receipts→
independent clone); persistent auro worker revived KILN-native with
policy=always; capability exercises green (release refused without cap,
release succeeds with cap).

**Important context:** the public deployment is stale (Section A1). Findings in
Section A were re-verified against current source and are fix-ready. Findings in
Section B were observed on the public build and must be re-reproduced on a
current build after the deployment pipeline ships again — several (B2, B3) do
not exist in current source and were likely already fixed in newer code.

Severity: High = blocks core use or misrepresents the product; Medium = real
friction or confusion; Low = polish.

---

## A. Confirmed against current source

### A1 — Public deployment is stale (High)
- **Area:** Ops / deploy pipeline — `https://kiln-git.grok.me/`
- **Observed:** The live site serves asset seal `k=33` while the repo is at
  `k=35`. Its JS chunks contain zero references to `swarm`; the current local
  build ships `swarm-DjwRIz4o.js` (swarm console) and the KILN-native repos
  panel. On the live site, `/swarm` renders an empty profile for a user named
  "swarm" instead of the swarm console — the flagship new surface is invisible
  to every real user.
- **Expected:** The public site tracks `main` within a defined deploy SLA; new
  surfaces are reachable the same day they land.
- **Repro:** Open `https://kiln-git.grok.me/swarm` — profile page, no console.
- **Acceptance:** `/swarm` on the public site renders the daemon console;
  document the deploy trigger/SLA so staleness is visible next time.

### A2 — `/signin` renders a bogus profile for a user literally named "signin" (High) — **FIXED 2026-09-19**
- **Area:** Routing / auth — nav "Sign in"
- **Observed:** There is no `src/routes/signin.tsx`; the `/$owner` dynamic route
  catches `/signin` and renders "Kiln account · 0 repositories" for user
  "signin". Meanwhile "Connect" opens the real wallet flow. Two sign-in entries,
  one a dead end.
- **Fix:** New `src/routes/signin.tsx` redirects to `/account` — the app's real
  identity flow (wallet connect/profile; auth is off by default, there is no
  password sign-in). New `src/lib/kiln/reserved.ts` defines `RESERVED_OWNER_NAMES`
  (all top-level static segments + `login`, the auth `SIGN_IN_PATH`); both
  `/$owner/` and `/$owner/$repo` throw `notFound()` in `beforeLoad` for reserved
  names, so no reserved name can ever render as a profile again. Covered by
  `src/lib/kiln/reserved.test.ts` (6 tests, incl. a coverage test that fails if
  a new top-level route is added without updating the set).
- **Repro:** Click "Sign in" in the top nav.
- **Acceptance:** `/signin` never renders a user profile; single obvious path
  to connect. ✅ Verified via new tests; route redirect verified in build.

### A3 — `/settings` has no top-level route; renders a "settings" user profile (Medium) — **FIXED 2026-09-19**
- **Area:** Routing — `/settings`
- **Observed:** No `src/routes/settings.tsx` exists; `/$owner` catches it and
  renders an empty profile. Repo-level settings (`/:owner/:repo/settings`)
  exist, but the obvious top-level URL is a trap.
- **Fix:** New `src/routes/settings.tsx` redirects to `/account` (global account
  settings — handle, address, connect/disconnect — live there; per-repo settings
  remain at `/$owner/$repo/settings`). Same reserved-name guard as A2.
- **Repro:** Navigate to `/settings` directly.
- **Acceptance:** `/settings` resolves to something intentional, never a fake
  profile. ✅

### A4 — Repo "Agent" tab is a dead tab: bare "Not Found", no recovery (Medium) — **RESOLVED 2026-09-19 (not present in current source)**
- **Area:** Repo chrome — `/:owner/:repo/agent`
- **Observed (stale k=33 public build):** The tab bar showed an "Agent" tab with
  no backing route, rendering a bare "Not Found".
- **Re-verified:** Current source `src/components/RepoChrome.tsx` has **no**
  Agent tab (tabs: Code, Computer, 4D, Preview, Projects, Issues, Pull requests,
  Discussions, Actions, Commits, Releases, Wiki, Packages, Insights, Security,
  Settings); `grep` for an Agent tab label across `src/` returns nothing. The
  dead tab was an artifact of the stale deployment (A1), not current source.
- **Additionally:** new `src/lib/not-found.tsx` wired as the router's
  `defaultNotFoundComponent` — any genuine 404 now shows recovery copy with
  Home / Explore / Search links instead of a bare message.

---

## B. Observed on the public build — re-verified on current build 2026-09-19

### B1 — Site-wide text truncation mid-word (High) — **FIXED 2026-09-19**
- **Area:** Typography/content — landing hero (mobile).
- **Re-verified:** The concrete reproducible case was the landing hero: on
  narrow viewports the hero copy was clipped mid-word by an absolute-positioned
  video overlay. Fixed in `src/routes/index.tsx` — hero text now participates
  in normal flow on mobile and becomes an absolute video overlay only at `sm`
  and above. Verified: desktop + 390×844 mobile, no horizontal overflow on
  `/`, `/explore`, `/kiln-labs/protocol`; hero text fully visible on mobile.
  The other named locations (`/papers`, READMEs, Security, Computer, `/bounties`,
  `/models`) showed no truncation on current source.
- **Acceptance:** Zero mid-word cuts on a current build. ✅

### B2 — Wallet "Connect" dialog is a trap: no dismiss affordance (High) — **RESOLVED 2026-09-19 (not present; deeper defect fixed)**
- **Area:** Wallet / account identity.
- **Re-verified:** No modal trap exists in current source. However the
  walkthrough found a deeper honesty defect: the "Disconnect" button on
  `/account` was theatrical — `AppShell` auto-connected `"you"` whenever the
  wallet was null, so Disconnect instantly reconnected and the custom-handle
  connect form was unreachable.
- **Fix:** Removed the auto-connect effect in `src/components/AppShell.tsx`
  (null wallet is a real, supported state — header Connect button, `/account`
  connect form, `createRepo` guard all handle it). Verified end-to-end:
  fresh visit → disconnected; Connect → connected; Disconnect → stays
  disconnected with the handle form; connect as `qa-wallet` → `/qa-wallet`
  profile renders; repo created as `qa-wallet` lands at `/qa-wallet/<repo>`.
- **Acceptance:** Disconnect is real; identity choice is honest. ✅

### B3 — Inputs pre-filled with unexplained values (Medium) — **RESOLVED 2026-09-19 (not present)**
- **Area:** Explore lookup, `/new` import box, Connect dialog.
- **Re-verified:** No `octocat` defaults anywhere outside tests; the
  ItsNotAILABS values are genuine seed metadata; `/new` inputs are empty with
  placeholder examples (`protocol`, `What this computer is for`); the
  `/account` handle field prefills `you`, the honest current default.
- **Acceptance:** No unexplained prefilled values. ✅

### B4 — Issues/Commits/Pulls tabs render heading-only, no lists, no empty state (Medium) — **FIXED 2026-09-19**
- **Area:** Repo tabs — `/:owner/:repo/issues`, `/commits`, `/pulls`.
- **Re-verified:** Lists render real rows on current source
  (`/kiln-labs/protocol/issues|pulls|commits` all HTTP 200, real rows, filters,
  new-issue flow). Two genuine empty-state gaps found and fixed:
  `src/routes/$owner/$repo/pulls.tsx` now renders
  "No pull requests yet. Open one with “New pull”.";
  `src/routes/$owner/$repo/commits.tsx` now renders "No commits yet."
  (issues already had "No open issues."). Verified by creating a repo through
  the UI and visiting all three tabs.
- **Acceptance:** Lists or honest empty states on every tab. ✅

### B5 — Explore nav feels broken on first click (Medium) — **RESOLVED 2026-09-19 (not present)**
- **Area:** `/explore`
- **Re-verified:** `/explore` loads cleanly on current source; search
  interaction returns real results (`protocol` → `kiln-labs/protocol` rows).
  No hydration dead-click observed.
- **Acceptance:** Explore is responsive on current build. ✅

### B6 — All 8 landing videos fail to play (Medium) — **RESOLVED 2026-09-19 (not present)**
- **Area:** Landing page media.
- **Re-verified:** Current landing ships 5 videos; all reach `readyState 4`
  (HAVE_ENOUGH_DATA) with zero media errors; above-fold videos play
  (`paused: false`). No "Unable to play media" anywhere.
- **Acceptance:** Videos load and play on current build. ✅

### B7 — Accessibility tree duplication (Low) — **RESOLVED 2026-09-19 (not present)**
- **Area:** Repo pages, profile pages, Issues/Pulls/Commits pages.
- **Re-verified:** Exactly one live region on the landing page (the sonner
  toaster); no AX duplication, no stray "Notifications alt+T" region.
- **Acceptance:** Clean on current build. ✅

### B8 — Disabled "Take" button with no explanation; garbled Security text (Low) — **RESOLVED 2026-09-19 (not present)**
- **Area:** Repo page actions; Security tab.
- **Re-verified:** No "Take" button exists in current source — "Take" is only a
  text label for free marketplace listings (`src/routes/marketplace.tsx`), not
  a control. The Security tab renders coherent copy on current source; the
  garbled text was a stale-deployment artifact (A1).
- **Acceptance:** Nothing to fix on current build. ✅

### B9 — `kiln/kiln` explore row missing stats (Low) — **RESOLVED 2026-09-19 (not present)**
- **Area:** `/explore` repository list.
- **Re-verified:** No `kiln/kiln` repo exists in current source (seed has
  `kiln-labs/*`, `itsnotailabs/*`, etc.); stale-deployment artifact (A1).
- **Acceptance:** Nothing to fix on current build. ✅

### B10 — Agent grants not discoverable (Medium) — **IMPROVED 2026-09-19**
- **Area:** Grants — `AgentGrantsPanel`.
- **Re-verified:** The panel is real, registry-backed, and honest
  ("staged — no registry deployment recorded; nothing sent on-chain") at
  repo → Settings → Agent capabilities.
- **Improvement:** `src/routes/$owner/$repo/settings.tsx` now supports
  `?section=agents` deep-linking (URL-backed, validated section state), so the
  grants surface is linkable and reachable in one click from a repo URL.
- **Acceptance:** Grants reachable via `/​:owner/​:repo/settings?section=agents`. ✅

---

## C. Fixed during this pass (2026-09-19)

- **C1 — 16 failing tests → 0 failures.** `scripts/brand-check.test.mjs` (and
  siblings) asserted on gitignored platform-injected files
  (`.grok/skills/og/SKILL.md`, `.grok/app-env.json`) absent from this checkout:
  those assertions now `t.skip()` with a reason when the files are absent and
  still run fully when present — no fake platform files created. 8 further
  failures were a real test-isolation bug in `grok-pwa-plugin` tests (ran
  against the checkout's real KILN branding instead of an empty fixture);
  production was correct, tests fixed. Final: **299 pass, 0 fail, 8 skipped.**
- **C2 — 131 `tsc --noEmit` errors → 0.** Real JSDoc typedefs across
  `scripts/github-engine.mjs`, `scripts/agent-turn.mjs`,
  `scripts/kiln-infra.mjs` (which also fixed a knock-on error in
  `server/middleware/aa-kiln-github.ts`). No `ts-nocheck`, no tsconfig
  weakening.
- Committed locally as `0f1614a` ("Fix all pre-existing test + type failures");
  `npm run build` green. Not pushed.

## D. New defects found and fixed during the interactive walkthrough (2026-09-19)

- **D1 — Arbitrary handles rendered fabricated profiles (High).** `/does-not-exist-xyz`
  rendered a profile ("A kiln member.") for a user that does not exist. Fixed:
  `src/lib/kiln/reserved.ts` gained `isKnownOwnerName()` (dependency-free);
  `src/lib/kiln/store.ts` gained `isKnownOwner()` (seeded profiles + real repo
  owners + connected wallet); `src/routes/$owner/index.tsx` renders the
  intentional Not Found page for unknown handles post-hydration while reserved
  names still throw route-level `notFound()`. Tests expanded 6 → 10
  (`src/lib/kiln/reserved.test.ts`). Verified: `/does-not-exist-xyz` → Not Found;
  `/kiln-labs`, `/you`, `/qa-wallet` still render.
- **D2 — Reloading a user-created repo flashed a false "No public tree with that
  name." (Medium).** `RepoLayout` declared not-found before zustand rehydration
  completed; user repos live in persisted `extraRepos`. Fixed in
  `src/components/RepoChrome.tsx`: pre-hydration renders "Loading tree…",
  post-hydration renders the real not-found message. Reproduced the race,
  verified the false 404 no longer appears across repeated hard reloads.
- **D3 — Theatrical Disconnect (High).** See B2 above — fixed by removing the
  AppShell auto-connect.
- **D4 — Mobile landing hero clipped mid-word (High).** See B1 above.
- **D5 — Pulls/Commits tabs had no empty state (Medium).** See B4 above.
- **D6 — Agent grants deep-linking (Medium).** See B10 above.

Walkthrough coverage (all HTTP 200, zero app console errors unless noted):
`/`, `/explore` (+ search), `/new` (created real repos `you/qa-test-repo`,
`you/qa-empty-states`, `qa-wallet/qa-owned-repo` via the UI),
`/kiln-labs/protocol` + Code/Computer/4D/Preview/Projects/Issues/Pull
requests/Discussions/Actions/Commits/Releases/Wiki/Packages/Insights/Security/Settings
tabs, `/account` (connect/disconnect/custom handle), `/wallet`,
`/swarm` (daemon status, KILN-native repos, spawned `qa-worker` via UI,
submitted job `qa-job` — failed honestly with `fatal: not a git repository`
because the worker had no repo; receipts verify "OK — chain intact"),
`/signin` → `/account`, `/settings` → `/account`, reserved and arbitrary
handles → intentional Not Found. KILN-native git: fresh clone exit 0 with real
history; unauthenticated push refused with real exit 1, remote unchanged at
`8802fb8`. Production preview smoke: `npm run build` green, preview served all
routes 200, assets 200 at seal `k=35`, `/` rendered in-browser with zero page
errors. Final gates: 317 tests (309 pass, 0 fail, 8 honest skips), `tsc`
clean, KILN swarm suite 75/75.

## E. Dogfood tickets (filed by the architect while using KILN)

### E1 — `swarm.mjs repo list`/`create` fail with bare "fetch failed" when the daemon isn't running (Medium) — **FIXED 2026-09-19**
- **Reported:** While dogfooding KILN-native git hosting, `swarm.mjs repo
  list`/`create` printed only `error: fetch failed` (exit 1) when the daemon
  wasn't running — no indication of what was wrong or how to fix it.
- **Reproduced:** Scratch state dir with `daemon.json` pointing at a dead
  port → exact `error: fetch failed`, exit 1, for both commands.
- **Fix (in the KILN repo, `swarm/swarm.mjs`):**
  - `apiCall` now translates connection-level fetch failures
    (ECONNREFUSED/ENOTFOUND/EHOSTUNREACH/…) into a `DaemonDownError` carrying
    an actionable message: never-started → "swarm daemon is not running (no
    answer at <url>). start it with: node swarm.mjs daemon start";
    pid recorded but port dead → "not responding … it may have died" variant.
  - `repo list`/`create` fall back to the local state dir when the daemon is
    down. This is safe because the daemon's own create/list paths are
    literally the same `lib/git.mjs` functions (`createRepo`/`listRepos`)
    — a locally-created repo is served identically once the daemon starts.
    The CLI says so explicitly, prints the clone URL (valid once the daemon
    is up), and the start hint.
  - Duplicate create still fails honestly (`repo exists: …`); invalid names
    still rejected — never "fetch failed".
- **Verified:** New `swarm/test/daemon-down.test.mjs` (6 tests, real CLI
  subprocesses against scratch dirs, dead-port daemon.json, with and without
  recorded pid) — 6/6 pass; full swarm suite 81/81.
- **Committed:** locally in the KILN repo; not pushed (needs architect's
  repo+branch call per standing rule).
- The public deployment is still stale (A1) — redeploy `main` so the fixes in
  this pass reach real users.
- Owner-gated chain work remains unimplemented until real decisions and
  credentials exist (KILN_MIND_URL, chain/testnet selection, deployer key,
  real KilnOwnershipRegistry deployment).

### E3 — Swarm daemon self-deadlocks when a node clones a KILN-native repo hosted by the same daemon (Critical) — **FIXED 2026-09-19**
- **Reported:** While dogfooding the agent-offload path ("agents like you
  should be able to use this platform to buffer out computing through the
  swarms"), `SwarmClient.spawnNode({ repo: <KILN-native URL> })` timed out:
  the worker's `git clone` never completed. `/health` and `/jobs` stayed up
  at first, but every smart-HTTP clone hung and the daemon's event loop
  froze until the clone timed out.
- **Reproduced:** A scratch daemon hosting a real KILN-native repo; a node
  spawned with `repo:` set to that daemon's own smart-HTTP URL hung in
  `git clone` indefinitely (had to be killed), while `/health` stopped
  responding for the clone's duration.
- **Root cause (in the KILN repo, `swarm/lib/nodes.mjs`):** `createNode()`
  ran the initial clone with synchronous `spawnSync("git", ["clone", …],
  { timeout: 120000 })`. When the repo was hosted by the SAME daemon, the
  clone's own smart-HTTP requests (`GET /git/<owner>/<repo>/info/refs`)
  needed the daemon's event loop — which was blocked inside the synchronous
  clone. Deterministic self-deadlock: the clone could only finish when the
  120s timeout killed it.
- **Fix (in the KILN repo):**
  - `swarm/lib/nodes.mjs`: `createNode` is now `async`; the clone runs via
    `spawn()` with an explicit timer so the event loop stays live to serve
    the clone's own HTTP requests. Failed clones remove their partial node
    directory (previously they left orphans that spammed `ENOENT` on every
    daemon tick — orphaned partial dirs from the failed attempts were also
    cleaned up by hand).
  - `swarm/lib/httpapi.mjs`, `swarm/lib/tools.mjs`, `swarm/swarm.mjs`: all
    `createNode` callers converted to `await`; daemon autospawn gained an
    in-flight guard so two ticks can't create the same node twice while a
    clone is pending.
  - New regression `swarm/test/git-self-clone.test.mjs`: creates a REAL
    KILN-native repo on a scratch daemon, seeds it through authenticated
    git push, spawns a node cloning from the same daemon, polls `/health`
    DURING the clone, and verifies the cloned file. Passes in ~1.5s with
    no event-loop stall.
- **Follow-on found while verifying (same pass):** workers could `git.commit`
  but had no way to publish — no `git.push` tool existed, so the
  "independently clone and verify" story stopped at the worker's workdir.
  Added `git.push` (`swarm/lib/tools.mjs`, grant-gated by CAP_COMMIT like
  `git.commit`): pushes `HEAD` to the cloned KILN-native remote, auth via
  the daemon's bearer token injected as a one-shot git `http.extraHeader`
  env — the token never touches the workdir, the job plan, or logs
  (asserted in tests: token absent from push output and `.git/config`).
  New `swarm/test/tools.test.mjs` cases: refused without CAP_COMMIT (and
  pushes nothing), real push to a bare remote lands the commit, illegal
  remote names rejected. 3/3 pass.
- **Verified:**
  - Full swarm suite: 92/92 pass (89 existing + 3 new `git.push`), 0 fail.
  - SDK-only end-to-end (`swarm/examples/agent-e2e.mjs`): connect →
    createRepo → spawnNode (native clone, no deadlock) → worker computes
    sum(1..1000)=500500 for real → git.commit → git.push → signed receipts
    verify (5/5, allOk) → independent fresh `git clone` shows commit with
    `SUM.md` = 500500. Green.
  - Persistent auro worker revived as a KILN-native piece of Auro:
    `policy: "always"`, workdir re-cloned from `auro/auro` on KILN-native,
    delegated a real beacon job via SDK only (write → commit → push),
    independently verified on the native remote.
  - Capability exercises: `project.release` on a CAP_COMMIT-only node is
    refused honestly (`needs [release]`); on the release-capable auro node
    a real release script runs with a real effect.
- **Docs:** `swarm/AGENTS.md` (the agent operator manual: SDK connection,
  the agent loop, `depositCode`, KILN-native git, persistent workers, the
  non-negotiable rules) updated with `git.push` and the jail-correct
  `fs.write`-then-execute pattern (the shell jail denies `;`, `..`, `$()`
  etc. — inline `-e` scripts with those characters fail loudly; the guide
  now teaches the intended pattern).
- **Committed:** locally in the KILN repo (explicit paths only); not pushed
  (needs architect's repo+branch call per standing rule).

### E4 — Daemon supervisor re-logs terminally-dead nodes every tick: ~25k lines/day, 10MB daemon.log (Medium) — **FIXED 2026-09-19**
- **Reported:** While investigating why the watchdog restarted the daemon
  three times in one evening, `~/.kiln-swarm/daemon.log` was 10MB with
  24,845 repeats of `node X: max restarts (3) reached — leaving dead` /
  `node X: dead, policy=on-failure — not respawning`: a full ~16-line block
  every 2 seconds for nodes that are already terminally dead and will never
  be respawned.
- **Reproduced:** Scratch daemon, fast tick, two dead nodes (one
  `policy=never`, one `restarts=maxRestarts`): both terminal lines repeated
  on every tick.
- **Root cause (in the KILN repo, `swarm/lib/daemon.mjs`):** `reconcile()`
  runs on every tick and unconditionally `log()`s the terminal branches.
  Terminal states never change on their own, so the lines are pure churn.
- **Fix:** `logTerminalOnce(key, msg)` — a per-daemon-lifetime dedup set;
  each distinct terminal state (`<id>:dead:<policy>`,
  `<id>:maxrestarts:<restarts>`) logs exactly once. A genuinely new
  situation (policy edited, restarts incremented) still logs.
- **Verified:** New `swarm/test/daemon-churn.test.mjs` — fails on the old
  code (lines repeated ~15x), passes on the fix (exactly 1 each). Full
  swarm suite: 94/94 pass, 0 fail, 0 skipped.
- **Committed:** locally in the KILN repo (explicit paths only); not pushed
  (needs architect's repo+branch call per standing rule).
- **Note on the daemon deaths that surfaced this:** one stop was a graceful
  SIGTERM (`daemon stop` from somewhere — source not identified), one was a
  silent kill with no log line and no OOM trace (environmental SIGKILL
  suspected). The watchdog revived the daemon each time, which is its job.
  Nothing in-repo explains the silent kills; left as an open observation,
  not a defect with a repro.
