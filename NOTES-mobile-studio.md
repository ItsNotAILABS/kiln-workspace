# Mobile + Studio round — working notes (checkpoint file)

Worktree: ~/workspace/.worktrees/kiln-studio-mobile · branch mobile-studio-round · tip afd7a48
Live Worker: v36 at start. Host load extreme (25-41) — serialize heavy steps.

## Inventory (2026-10-31 ~23:11 CDT)
- Our modules in public/assets/: kiln-public.js (18,410 B — Discover/Explore + palette),
  kiln-forge.js (16,581 B), kiln-identity.js + kiln-identity-core.js (identity round),
  AppShell-H-m5HQPd.js (20,770 B — holds our v25 bottom bar), boot-kiln.js.
- index.html loads: kiln-forge.js?k=35, kiln-client.js?k=35 (the frozen client bundle,
  331,890 B, same bytes as kiln-boot.js / index-kiln-client.js), styles-A_fIl0Ci.css,
  studio-fjyqp5G-.js + studio-tabs.js as preloaded hrefs, Google Fonts (Plex Sans + Newsreader).
- kiln-chat.css still linked (known 404, pre-existing).

## Progress (commits on mobile-studio-round, atop afd7a48)
- [x] 1 Bottom bar redesign + overlap fix — COMMITTED af56898 (load-sim RAN CLEAN; browser proof blocked by sandbox boot flood, see below)
- [x] 2 Studio completeness (creation doors) — COMMITTED 8cd2e30 (load-sim RAN CLEAN)
- [x] 3 Transaction → full receipt — COMMITTED 59a4d03 (load-sim RAN CLEAN, export contract preserved)
- [x] 4 Search-not-typing fix — COMMITTED 319b21c (uncontrolled input; scripted typing proof blocked by the same sandbox flood — disclosed in the commit)
- [x] 5 Perf measurement + our-layer fix — COMMITTED 1b8fb26 (dead kiln-chat.css link dropped); measurements + findings below
- [~] 6 Mobile 375px render gate — STATIC evidence only (class audit vs compiled CSS: receipt hashes break-all, rows stack vertically <640px, bar tabs flex-1 text-[10px], doors wrap, repos strip scrolls); in-browser gate NOT run — sandbox could not boot the app to interactivity tonight
- [x] Gates: node --check clean on every edited file; module load sim (Node vm + DOM shims, .scratch/loadsim.mjs) evaluates every edited chunk's full import graph — RAN CLEAN ×7 modules
- DEPLOY: NOT deployed. The real-browser cold-load gate used by prior rounds is not green (could not be executed in this sandbox tonight); per discipline the round stays local for the parent to deploy after a browser pass. Live Worker untouched (v36 line).

## Perf (Item 5) — measured 2026-10-31 night, this host
- Static serving (local origin): index + bundles answer in 0.07–0.25s (curl).
- Daemon anonymous GET /git: 200 in 0.37s. Public accounts API via origin:
  29.3s COLD (daemon compute under load), then the 30s serve-original cache
  absorbs repeats — the cold number is the known origin-side cost, not a
  client-module cost; no client-layer fix applies.
- Cold-load document set (every page): index 1.8KB + styles 43.8KB +
  kiln-forge 16.6KB + kiln-client 331.9KB ≈ 394KB, plus AppShell 21.7KB +
  store 257.2KB + react 8.2KB pulled by the module graph ≈ 680KB before
  route chunks. /explore route adds ≈29KB (kiln-public 19.3KB + explore
  chunks 9.8KB). /studio adds studio 17.8KB + studio-tabs 59.5KB.
- FINDING (frozen shell, not changed): index.html modulepreloads studio
  (17.8KB) + studio-tabs (59.5KB) + kernel (4.3KB) on EVERY page — ~81KB
  fetched on cold loads that never open Studio. Tradeoff is Studio's
  first-open latency; left as a named finding, not unilaterally cut.
- FINDING (frozen bundle): the client+store boot floods the main thread
  in sandbox browsers (evaluate starved for minutes at host load 12–40)
  — bisected: reproduces on the pristine tree, without kiln-forge.js,
  and with all APIs stubbed instant, so it is the bundle's own boot /
  continuous-republish work (chain simulation ticks + store merges) on a
  starved 2-core box. On the architect's phone the same weight reads as
  "app is slow". Real fix lives in the frozen bundle (seed/spine build +
  republish cadence) — named, not rewritten here.
- Our-layer fix shipped: dead kiln-chat.css 404 request removed (1b8fb26).
- /studio SSR: the Worker's snapshot coverage is /explore, /:owner,
  /:owner/:repo — /studio is not covered. Extending it helps agents and
  crawlers, not the phone's interactive boot; not shipped tonight
  (edge change without a browser-verifiable deploy would be blind).

## Findings
- Item 3 (receipt) diagnosis: `/chain/$id` re-exported the /chain LIST component
  (`_id-GWr0XW_4.js`, 48 B) — the detail route rendered the list and ignored the
  id, so no receipt existed anywhere. Fix: new `public/assets/kiln-receipt.js`
  (tx receipt: full hash, memo, actor, amount when numeric, from/to, repo link,
  block height + block hash link, merkle root, full+relative timestamp; block
  receipt: hash, parent, timestamp, tx list linking to receipts; honest
  not-found). Shim now exports KilnReceipt. /chain ledger rows: whole row is
  now the receipt Link (inner hash link → span). Wallet tx rows do NOT share
  this component (wallet-CTr0sTgn.js has no /chain links; wallet round's own
  Details surface covers them) — disclosed, not wired.
  Tx shape from the store constructor: {type, from, to, amount, memo, repoId,
  timestamp, block, merkleRoot, hash}; block {height, parent, timestamp, txs, hash}.
- Item 1 (bar): Q() in AppShell-H-m5HQPd.js rewritten profile-centric:
  Profile → /account (the app's profile & settings surface), Repos → /:owner
  (his repository list) or /explore signed-out, Create (center, raised circle,
  plus icon) → /new, Activity → /notifications, Wallet → /wallet. All real
  routes. Icons: bell/plus/wallet existed; user + folder added via the same
  in-file lucide helper. Row height fixed 3.5rem; spacer matches.
  Disclosure: no dedicated /repos route exists — owner page is the repo list.
- Overlap fix (shell level): Studio root is the ONLY pane sized
  `h-[calc(100dvh-3.5rem)]` — it never subtracted the bar, so its bottom
  3.25rem+safe-area sat under the fixed bar (the architect's screenshot).
  index.html gains a <640px media rule returning the bar's height
  (3.5rem + safe-area) to that exact utility class. Desktop untouched.
- Item 2 (Studio): doors strip inserted under the Studio top bar in
  studio-fjyqp5G-.js (suite's own btn h-8 language): New repository →
  /new?tab=create, Import from GitHub → /new?tab=import, New gist → /gists
  (the gists page IS the create form). "Your repositories" strip in the
  handoffs-row pattern (overflow-x-auto chips → repo pages, from the same
  visible-repos list the Studio repo select uses). Hero untouched, nothing
  removed, no forge admin. /new tab state now initializes from ?tab=
  (one-line surgical change in new-DrGYWjdX.js; bare /new keeps its current
  default = import tab).
- Class discipline: every utility used was verified present in
  styles-A_fIl0Ci.css (size-11, justify-end, -top-4, pb-1, sm:gap-4, sm:pt-0.5
  are NOT in the compiled CSS — avoided; raised circle uses size-10 + inline
  negative margin).
- Sandbox renderer: /explore boot spins the headless renderer for minutes at
  load 15-40 (evaluate starved, body empty) while static serving + daemon
  answer in <1s. CDP profiler dispatched to name the spinning function —
  directly relevant to Item 4's diagnosis (a boot-time main-thread block is
  also a candidate for keystrokes dropped on a slow phone).

## RELAND — the /studio crash, diagnosed and fixed (2026-11-01 ~01:2x CDT)
- First landing (FF merge to improve/ws-system-ui + browser gate) caught a
  REAL regression and backed out: /studio hit the app error boundary with
  React error #130 ("got: object") on the merged tree; pristine afd7a48
  rendered Studio fully in the same environment. Production untouched (v36).
- ROOT CAUSE (bisect-proven): 8cd2e30 inserted the doors/repos strips
  inside component `j` of studio-fjyqp5G-.js. At module scope `r` is the
  router Link (import from link-BhiAFiqq.js), but inside `j` the minified
  local `r` is `t.agents` — an array. The strips' `(0,k.jsx)(r, ...)`
  therefore created elements whose type is the agents array → #130 on the
  strips' unconditional first render. The load sim could not catch this
  class: it evaluates modules, never renders. All other bindings in the
  insertion are sound inside `j` (`o` = AppShell plus icon, a forwardRef —
  probe-verified; the doors' other entries are plain anchors).
- Bisection record (bisect_serve + headless Chromium, stubbed APIs):
  pristine renders (25,654 chars); branch tip with ONLY the studio chunk
  reverted renders; doors-only variant crashes; doors-minus-Link renders
  fully (25,704, doors present); doors-minus-icon still crashes.
- FIX (3f47b40): the two strips moved verbatim into a new module-scope
  component `KilnStrips({repos})` in the same chunk, where `r`/`o` resolve
  to the imports; `j` renders `(0,k.jsx)(KilnStrips,{repos:s})` at the
  exact position the strips occupied. Behavior identical — doors and repo
  chips remain client-side router Links (rendered anchors verified:
  /gists, /new?tab=create, /new?tab=import, /kiln-labs/protocol, …).
- RENDER PROOF (worktree, bisect env): /studio desktop 25,934 chars +
  doors + one-shot, 0 pageerrors; mobile /studio renders, 0 pageerrors;
  mobile / renders with all five bar tabs; /chain + block receipt +
  tx receipt all render, 0 pageerrors.
- RELAND: main tree fast-forwarded afd7a48 → branch tip; foreign WIP
  preserved (ops-cloudflare/README.md M, kiln-account.json M, data/ —
  the index.html WIP one-liner was superseded by the branch, discarded
  per instructions after verifying it was only the kiln-chat.css line).
  Load sim on the merged tree: studio/AppShell/kiln-public/kiln-receipt/
  chain/new/_id all RAN CLEAN, exports intact. Browser gate on a copy of
  the merged tree: /, /chain, /studio (desktop+mobile), block receipt,
  tx receipt — ALL 0 pageerrors.
- Typing proof (Item 4): attempted again at 375px against /explore — the
  headless renderer saturated for minutes (the documented boot flood;
  its renderer had to be killed). STILL OWED, environmental — does not
  block the reland; the uncontrolled-input fix itself is in 319b21c.
