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
- [ ] Worker bindings verify → deploy → served-bytes sha256 (landing step —
      result appended at the bottom of this file)

## Landing
- Branch commits: f7fa9e8 notes · fa1ff09 identity-core · fc63522 phantom-ul ·
  a242514 identity panel + login · 48bdfd1 agents · NOTES final (this file).
