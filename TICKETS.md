# KILN Forge — Improvement Tickets

Produced 2026-09-19 from a full read-only walkthrough of the app as a first-time
user (public deployment `https://kiln-git.grok.me/`) plus verification of each
finding against current source (`main`, local build `k=35`).

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

## B. Observed on the public build — re-verify on a current build

### B1 — Site-wide text truncation mid-word (High)
- **Area:** Typography/content — landing, `/papers`, repo READMEs, Security tab,
  Computer tab, `/settings` tree page, marketplace hero, `/bounties`, `/models`,
  Connect dialog.
- **Observed (screenshot-confirmed):** Paragraphs cut mid-word with no ellipsis:
  "all thr", "sh", "th", "weeken", "…first-class transacti", "…they do not omit
  th", "…only when you r", "bootsindex.html" (missing space — inline elements
  losing whitespace). Looks like a ~80–120 char slice or a fixed-height
  overflow cut. No JS string slicer found in current source; suspect CSS
  (`line-clamp` / fixed-height `overflow:hidden`) or stale-build rendering.
- **Expected:** Full sentences; intentional truncation uses ellipsis at word
  boundaries.
- **Repro:** Load the landing page, read hero/marketing paragraphs; open
  `/papers` and any repo README.
- **Acceptance:** Zero mid-word cuts on a current build; add a visual regression
  check for the landing hero copy.

### B2 — Wallet "Connect" dialog is a trap: no dismiss affordance (High)
- **Area:** Wallet connect dialog (public build).
- **Observed:** No close button, Escape ignored, backdrop click ignored, and the
  nav "Connect" button is obscured by the modal overlay so it can't toggle. The
  only exits are "Generate wallet" / "Import" or reloading the page.
- **Expected:** X button, Escape, and backdrop click all dismiss.
- **Note:** The dialog seen on the public build does not exist in current
  source — likely already reworked. Verify the current connect flow dismisses
  cleanly; do not regress.

### B3 — Inputs pre-filled with unexplained values (Medium)
- **Area:** Explore lookup, `/new` import box, Connect dialog.
- **Observed:** Explore's GitHub lookup came pre-filled with "ethereum" and
  auto-ran a 100-result lookup on page load; `/new` import box pre-filled
  "ItsNotAILABS"; Connect dialog username pre-filled "octocat". Reads as leaked
  demo state, not intentional examples.
- **Expected:** Empty inputs with placeholder examples, or labeled demo values.
- **Note:** Not present in current source; verify on a current build.

### B4 — Issues/Commits/Pulls tabs render heading-only, no lists, no empty state (Medium)
- **Area:** Repo tabs — `/:owner/:repo/issues`, `/commits`, `/pulls`.
- **Observed:** Heading + "On this tree." only — no item lists and no empty-state
  text, even though tab badges claim content (`Issues2`, `Pulls1` on
  `kiln-labs/protocol`).
- **Expected:** Lists render, or counts are corrected, or a real empty state
  ("No issues yet").
- **Repro:** Open `/kiln-labs/protocol`, click Issues / Pulls tabs.

### B5 — Explore nav feels broken on first click (Medium)
- **Area:** `/explore`
- **Observed:** Clicking Explore navigates to `/explore?q=` but the landing page
  content persists until the explore UI hydrates — first impression is a dead
  click.
- **Expected:** Instant loading state or skeleton for the explore view.
- **Repro:** Click "Explore" in nav from the landing page.

### B6 — All 8 landing videos fail to play (Medium)
- **Area:** Landing page media.
- **Observed:** Every video shows "Unable to play media" (disabled); hero video
  panel is an empty black box (screenshot-confirmed).
- **Expected:** Videos play, or are replaced with poster images if the format
  isn't web-safe.
- **Repro:** Load the landing page.

### B7 — Accessibility tree duplication (Low)
- **Area:** Repo pages, profile pages, Issues/Pulls/Commits pages.
- **Observed:** Every element appears twice in the AX tree (`dup=1/2`,
  `dup=2/2`); visually single. Breaks screen readers and doubles AX/DOM cost. A
  stray region named "Notifications alt+T" sits at the bottom of every page.
- **Expected:** Single AX nodes; no stray regions.
- **Acceptance:** AX audit clean on a repo page.

### B8 — Disabled "Take" button with no explanation; garbled Security text (Low)
- **Area:** Repo page actions; Security tab.
- **Observed:** A disabled "Take" button sits between "Repo agent" and "Sponsor"
  with no tooltip explaining what it does or how to enable it. Security tab
  shows concatenated "Viewer grant on / nonePASS".
- **Expected:** Disabled controls explain themselves; no garbled strings.

### B9 — `kiln/kiln` explore row missing stats (Low)
- **Area:** `/explore` repository list.
- **Observed:** Every row shows stars/forks/TVL except `kiln/kiln`.
- **Expected:** Consistent stats or an explicit reason.

### B10 — Agent grants not discoverable (Medium)
- **Area:** Grants — `AgentGrantsPanel`.
- **Observed:** The calldata-staging panel (`authorizeAgent` / `delegateGrant` /
  `revokeAuthorization`, with explicit "nothing submitted on-chain" copy) exists
  in current source at repo Settings, but the walkthrough surfaced no path to
  it from any nav — a first-time user cannot find grants or the honesty copy.
- **Expected:** A visible path (docs, repo page affordance when a wallet is
  connected, or nav) to the grants UI.
- **Acceptance:** A new user can reach the grants panel and its "nothing is
  sent on-chain" explanation within two clicks from a repo page.

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

## Follow-ups not covered
- Mobile/narrow-viewport pass (the walkthrough ran desktop-width; the user is
  on iOS — worth its own ticket after the deploy refresh).
- Repo tabs not opened during the walkthrough: 4D, Preview, Project, Discuss,
  Actions, Releases, Wiki, Packages, Insights.
