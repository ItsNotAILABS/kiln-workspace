# Round 2 — Piece 4: every tab in the dropdown, better (branch `round2-tabs` off improve/ws-system-ui @ ee78c97)

Worktree: ~/workspace/.worktrees/kiln-round2-tabs — main tree untouched. NOT deployed; coordinator lands.
Harness: .scratch/probe.mjs (cold headless render, desktop 1280 + mobile 375, pageerrors counted;
sandbox tunnel errors on external fonts are environmental, not pageerrors), .scratch/loadsim.mjs,
.scratch/class_audit.mjs. Local origin: serve-original on :8942 serving THIS worktree.
Dropdown map (verified in AppShell): Papers /papers · Apps /apps · Assistants /assistants ·
Cloud /cloud · Account /account · Organizations /orgs · Pricing /pricing · Architecture
/architecture · Gists /gists · Bounties /bounties · CLI /cli · WebGPU /gpu · Get started /start ·
Shortcuts = modal (AppShell, `kiln:shortcuts` event), not a route.

## Per-tab table (filled per tab as work lands)

| Tab | What it was | Change | Gate |
|---|---|---|---|
| Papers | Papers Studio already built (design round) | inventory only | TBD |
| Apps | Rich add-on catalog, real install flow via store, signed-out state honest | TBD | desktop render OK (6061 chars, 0 pageerrors) |
| Assistants | Real MCP connect flow, snippet with live origin, signed-out state honest | TBD | desktop render OK (2648 chars, 0 pageerrors) |
| Cloud | Signed-in cloud console; signed-out surface exists in code | TBD | first probe returned header-only (renderer saturation suspected) — re-probe owed |
| Account | Owned by sibling profile piece | inventory + small fixes only | TBD |
| Organizations | List + honest empty state + /orgs/new door | TBD | TBD |
| Pricing | INVENTED prices/offerings: Team "$20 / user / month", "kiln.app preview domain", "Priority Grok seats", "On-prem or edge (XCREW)", SSO etc. — no architect ruling backs these | honest pending-pricing surface (structure kept) | desktop render OK pre-fix (1046 chars, 0 pageerrors) |
| Architecture | Crew-kernel spec page renders fully; footer links "Paper: KILN-WP-09 Crew Kernel" to /papers/crew — no such paper record exists (real record is auro/marketplace-paper) → dead door | TBD | desktop render OK (2744 chars, 0 pageerrors) |
| Gists | Create form is LOCAL STATE ONLY — gists vanish on reload, never saved/sealed, copy claims "Instant sealed snippets. Same cipher as a repository" (lies) | TBD | TBD |
| Bounties | Lists store issues with bountyKln>0; NO empty state — empty <ul> renders as a bare box, header claims escrow total | TBD | TBD |
| CLI | In-browser terminal wired to real MCP tools (kiln_* tool calls) | TBD | TBD |
| WebGPU | Real probe (probeGpu) + real hash mix; copy claims "Bound to every repository computer on port 7840" — no such binding exists (stale invented claim) | TBD | TBD |
| Get started | 5-step checklist with live done-states; step 01 copy says sign-up is "Google, X, or email" — the app's actual account door is /login + wallet identity (kiln-identity) | TBD | TBD |
| Shortcuts | Modal lists ⌘K, ?, g n, g s, g e, g a — ALL verified real in the AppShell key handler | TBD | code-verified |

## Flags for coordinator
- (none yet)
