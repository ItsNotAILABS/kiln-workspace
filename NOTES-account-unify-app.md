# Account unification — APP lane (Lane B app + B-mobile + Lane C app)

Worktree: ~/workspace/.worktrees/kiln-account-unify · branch account-unify-app
Base: improve/ws-system-ui @ 684c67a (Worker v46 live). ONE batch, ONE Worker version.
Daemon contracts: merged feat/l1-compute @ 64824a0, STAGED (live daemon 900d95c →
new routes 404 live until next Doctor boot). App must degrade honestly staged +
prove against an EPHEMERAL instance of the merged daemon code.

## Recon findings (2026-11-02, read from the trees)
- Identity client base: kiln-identity-core createIdentityClient base "/api/forge/v1",
  session kiln_sess_ bearer in localStorage kiln.daemon.session.v1. Origin proxies
  /api/forge/* → daemon verbatim (serve-original + edge Worker).
- /login chunk (login-CNvQADsL.js) renders KilnIdentityPanel INSIDE its card, plus
  its own lab-stack email form + Google/X buttons: buttons call better-auth
  signIn.social (client-DRhaju3Z `a(providerId,{callbackURL:/start})`) against the
  stubbed _serverFn stack ({result:null}) — NO daemon OAuth contract exists
  (ACCOUNTS.md). First-hand verdict: the buttons fire a flow that cannot complete
  on the daemon; they must become an honest not-yet-available state.
- Phantom today (kiln-identity.js): phantomProvider() reads ONLY the injected
  provider (window.phantom?.solana / window.solana isPhantom); connectPhantom()
  throws "Phantom isn't available in this browser" when absent. No UL, no browse
  deep link anywhere in the app.
- MOBILE BREAK (precise): mobile Safari/Chrome expose NO injected provider —
  window.phantom/window.solana are undefined outside Phantom's in-app browser —
  so every Phantom action (signup connect, link) dead-ends on that error.
  Desktop extension + Phantom in-app browser are the only injected contexts.
- Prior art (ShopStream, ~/workspace/shopstream-crypto-app/app.js + vendor/nacl.min.js):
  UL_BASE https://phantom.app/ul/v1; openInPhantomApp() browse deep link;
  connectUL() (dapp box keypair persisted {sk58,encPub,session,pubkey} in store 'ul');
  ulEncrypt/ulDecrypt via tweetnacl nacl.box + bs58; ulSignAndSend persists pending
  in localStorage (iOS return can land in a fresh tab — sessionStorage loses it);
  handleULReturn(): orphaned return (data present, no stored session) → exact reason
  + fix toast, NEVER silent; errorCode/errorMessage surfaced verbatim;
  restoreUlWallet() at boot (Round 27 fix: a stored UL session silently re-attaches;
  before R27 a reload quietly disconnected the wallet). Phantom Connect
  (@phantom/browser-sdk 2.0.4) is injected-only — not a mobile road.
- Routing: frozen route tree (kiln-client.js) has NO /agents route. /agents resolves
  as /$owner with owner="agents" — the /repos shadow trick (_owner-B3Oc7_zJ.js
  wrapper B: owner==="repos" → KilnReposHub). /agents/invite/<token> is 3 segments:
  routing probe pending (see below).
- tweetnacl vendoring: ShopStream vendor/nacl.min.js (32,110 bytes, tweetnacl min,
  production-proven there). Its UMD tail assigns self.nacl when module is undefined,
  so it loads as a side-effect ES module via dynamic import() and sets globalThis.nacl.
  Copied byte-for-byte to public/assets/kiln-nacl.min.js — real NaCl box
  (X25519/XSalsa20-Poly1305), never hand-rolled.

## Routing probe for /agents/invite/<token>
- [x] PROBED: the frozen router renders "Not Found" for the 3-segment path.
      Fix shipped in kiln-forge.js (evaluates before kiln-client in index.html):
      pathname /^\/agents\/invite\/([^/]+)$/ → token stashed in sessionStorage
      "kiln.agent-invite.pending" + history.replaceState to /agents?invite=<token>;
      the Agents surface consumes the stash and renders the redeem view.
      Cold-render proven on staged origin, desktop + 375px: the invite URL shows
      "Join KILN as an agent" + "bootstrap credential", never "Not Found".
      (The pre-existing /invite/$code route is broken upstream — module export
      error — noted, out of scope.)

## Pieces
- [x] 1 Lane B app: wallet sign-in doors (Phantom injected + local device wallet),
      unlinked guidance, staged-404 honest state; Google/X honest; /account
      "Sign-in & wallets" section. (kiln-identity-core.js + kiln-identity.js +
      login chunk surgical edit) — commit a242514 (+ core fa1ff09)
- [x] 2 Lane B-mobile: Door 1 browse deep link leads when no provider;
      Door 2 UL connect + signMessage with vendored tweetnacl; boot restore;
      no silent failures. (kiln-phantom-ul.js + kiln-nacl.min.js + panel wiring)
      — commit fc63522. BOTH doors shipped.
- [x] 3 Lane C app: /agents surface + /agents/invite/<token> redeem landing
      (kiln-agents.js + _owner wrapper surgical edit) — commit 48bdfd1

## Gates
- [x] node --check every changed file (7 JS files, all OK, re-verified on tip)
- [x] load-sim RAN CLEAN for changed modules (identity, phantom-ul, login chunk,
      account chunk, agents via _owner graph)
- [x] class audit vs styles-A_fIl0Ci.css: kiln-agents.js 64 tokens, kiln-identity.js
      68 tokens — none missing
- [x] UL crypto harness with test keys: 15/15 PASS (connect + sign round trips
      vs the real vendored tweetnacl, harness plays Phantom; boot restore;
      orphan/error surfacing; base58 vectors; Door 1 browse-link format)
- [x] ephemeral-daemon proofs: 23/23 PASS (.scratch/eph_proof.mjs — app core
      client + app crypto against an ephemeral instance of the merged daemon
      code through a /api/forge proxy): password signup+login sanity; Phantom
      link then wallet sign-in → kiln_sess_; unlinked → 403 wallet_not_linked;
      local-wallet sign-in; agent account create/list + token works on /me;
      invite mint → public redeem → token works; replay 404; owner-taken 409
      and the same link still redeems; sever; Door 2 end-to-end minus Phantom
      itself (challenge → UL signMessage URL → harness signs as Phantom →
      parseUlReturn → wallet verify → session)
- [x] cold-load renders desktop + 375px, 0 pageerrors, every changed route
      (staged origin): /login, /account, /agents, /agents/invite/<token>,
      plus regressions /auro, /repos — all clean, no overflow, no React #130
- [x] Google honesty probe: clicking "Continue with Google" on staged /login
      shows the not-yet-available / provider-setup message
- [x] Door 1 href captured in-browser (staged /login, desktop, 0 pageerrors):
      https://phantom.app/ul/browse/<url-encoded /login URL>?ref=<url-encoded
      origin> — exactly the contract format (.scratch/door1.txt)
- [~] ephemeral-origin browser UI flow — PARTIAL, sandbox wall (host load
      24–48 throughout): panel renders on the ephemeral origin with the
      password door and 0 pageerrors (.scratch/eph_signin.txt panel-ready),
      but the click-through to the signed-in state did not settle inside the
      probe windows (body empty through a 90 s poll after the click; /agents
      step lost the browser in the earlier full run, .scratch/gate3.txt).
      The same flows are proven end-to-end at API level with the app's own
      client + crypto (23/23 above), and every route renders clean cold on
      the staged origin. NOT claimed as browser-proven.
- [x] Worker bindings verify → deploy → served-bytes sha256 — DONE, see
      Landing result below

## Landing
- Branch commits: f7fa9e8 notes · fa1ff09 identity-core · fc63522 phantom-ul ·
  a242514 identity panel + login · 48bdfd1 agents · 836e6a6 NOTES final.
- LANDED on improve/ws-system-ui (tip re-checked: still 684c67a) by cherry-pick:
  2100887 · c14ef67 · 3a42c8e · d7ea9bb · 30d8e1f · 88cc4c8. Main-tree foreign
  WIP untouched (M ops-cloudflare/README.md, M public/kiln-account.json,
  ?? data/ — identical before and after).
- DEPLOYED 2026-11-02: Worker version 47, version_id
  193059ea-bf58-4430-9d0c-57f257178e89, deployment id
  622a5f8e-f6e5-4161-a163-e5e7b11faa08 (100%). Bindings verified on the version
  BEFORE rollout: ASSETS (assets) · ORIGINAL_API_URL plain_text
  https://kiln-original.medinatechlabs.net · KILN_SWARM_TOKEN secret_text
  (keep_bindings). Deploy ran from the worktree's ops-cloudflare (its public/
  is byte-identical to the landed tree — the only diff vs the main tree is the
  foreign-WIP kiln-account.json, which therefore did NOT ship).
- Served-bytes sha256 vs https://kiln.pocketnova.app: ALL 8 changed assets
  MATCH (kiln-identity-core.js, kiln-identity.js, kiln-phantom-ul.js,
  kiln-nacl.min.js, kiln-agents.js, kiln-forge.js, login-CNvQADsL.js,
  _owner-B3Oc7_zJ.js).
- Live HTTP: /login, /agents, /agents/invite/<token> all 200 with the SPA
  shell. Live-domain headless render was NOT captured (sandbox egress latency
  4–11 s per request starved the probe; body empty through each 90 s window,
  0 pageerrors) — render evidence stands on the staged origin over identical
  bytes. Stated plainly, not papered over.
- STAGED vs LIVE: the APP is live now (v47). The daemon routes it calls for
  wallet sign-in + agent accounts/invites are still STAGED — they activate at
  the next Doctor boot of the daemon from feat/l1-compute @ 64824a0. Until
  then the doors show their honest "activating" state and steer to password;
  password sign-in, wallet linking/backup, and delegated agents are live
  today as before.

## Independent re-verification (second landing pass, 2026-11-02)
- Merged-tree equivalence: `git diff --name-only HEAD 836e6a6` empty at
  88cc4c8 — the cherry-picked tree is byte-identical to the branch tip.
  Changed-file set (9 files) contains none of kiln-papers.js, kiln-repos.js,
  kiln-vault.js or serve-original — no live-bugs-lane conflicts arose.
- Gates re-run on the merged tree: node --check 8/8 OK; load-sim RAN CLEAN
  for kiln-identity-core, kiln-phantom-ul, kiln-agents, kiln-identity,
  _owner graph, login chunk and account chunk (chunk graphs keep timers
  alive after printing RAN CLEAN — verdict is the print, not the exit).
- Bindings re-verified on live v47 (193059ea…): BINDINGS_OK — ASSETS,
  KILN_SWARM_TOKEN secret_text, ORIGINAL_API_URL plain_text correct.
  Deployments API confirms 622a5f8e at 100% (2026-11-02T07:56:55Z).
- Served-bytes sha256 re-run vs the main tree: ALL 8 changed assets MATCH.
- Live-origin headless render from this sandbox: BLOCKED at the network
  layer (ERR_TUNNEL_CONNECTION_FAILED on /login, /agents,
  /agents/invite/<token> — Chromium cannot traverse the egress proxy here;
  no page loaded, so no app verdict either way). Render evidence remains
  the staged-origin proof over identical bytes above. Not faked, not
  claimed.
