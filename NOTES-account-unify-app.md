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
- [ ] probe pending

## Pieces
- [ ] 1 Lane B app: wallet sign-in doors (Phantom injected + local device wallet),
      unlinked guidance, staged-404 honest state; Google/X honest; /account
      "Sign-in & wallets" section. (kiln-identity-core.js + kiln-identity.js +
      login chunk surgical edit)
- [ ] 2 Lane B-mobile: Door 1 browse deep link leads when no provider;
      Door 2 UL connect + signMessage with vendored tweetnacl; boot restore;
      no silent failures. (kiln-phantom-ul.js + kiln-nacl.min.js + panel wiring)
- [ ] 3 Lane C app: /agents surface + /agents/invite/<token> redeem landing
      (kiln-agents.js + _owner wrapper surgical edit)

## Gates
- [ ] node --check every changed file
- [ ] load-sim RAN CLEAN for changed modules
- [ ] UL crypto harness with test keys (round trip vs vendored lib)
- [ ] ephemeral-daemon proofs (password sanity, wallet sign-in incl.
      wallet_not_linked, invite mint→redeem→token-works)
- [ ] cold-load renders desktop + 375px, 0 pageerrors, every changed route
- [ ] Worker bindings verify → deploy → served-bytes sha256
