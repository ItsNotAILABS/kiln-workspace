# OAuth — APP lane (Lane B re-scoped)

Worktree: ~/workspace/.worktrees/kiln-oauth-app · branch lane-b-oauth-app
Base: improve/ws-system-ui @ 60c0656 (identity batch live as Worker v47,
discovery v48). NOT deployed by this lane — landing is the coordinator's call.
Daemon contract: LOCKED (see task). Daemon child's lane-b-oauth branch was
NOT available in ~/workspace/repos/KILN at start (checked branches + worktrees),
so proofs run against a contract stub speaking the locked contract exactly
(.scratch/stub.mjs) behind a static+proxy origin (.scratch/serve.mjs,
http://127.0.0.1:18947, stub :18946). Sandbox wall disclosed, not faked.

## Slice 1 — the on-load "Sign-in failed" banner: ROOT CAUSE

- The literal string "Sign-in failed" exists in exactly ONE place in the
  whole app: client-DRhaju3Z.js, as the fallback message of the grok-auth
  wrapper `Lt` (exported as `signIn`): `Y.signIn.oauth2(...)` errors →
  `throw Error(o.message ?? "Sign-in failed")`.
- Pre-v47 login chunk (live during the Gemini field test, 01:35–01:54 CST;
  v47 landed 01:56 CST): the Google/X handler `E` was
  `await a(e,{callbackURL:"/start"})` with `a` = that `signIn`, and its catch
  wrote the error into the login card's red banner state `C`
  (`w(e instanceof Error ? e.message : "Sign-in failed")`).
- The better-auth oauth2 call runs against the stubbed lab stack
  (_serverFn → {result:null}, no provider registered), so it ALWAYS errors,
  and the stub's error carries no message → the banner text is exactly the
  fallback literal "Sign-in failed". Any trigger of E (Gemini's Google click;
  its log order made it read as pre-existing) put that banner on /login, and
  nothing else in the app can produce that string.
- v47 (a242514) replaced E with the honest cover (click-only note, no
  better-auth call). PROOF on current base bytes: cold render of /login
  against the contract-stub origin (.scratch/probe.mjs) — full page text
  captured, NO "Sign-in failed", NO error banner, 0 pageerrors.
- Elimination in this batch (slices 2–3): the buttons wire the real daemon
  OAuth flow; provider-not-configured is shown as an inline honest note in a
  dedicated slot — never the red form-error banner, never "Sign-in failed" —
  and nothing on mount sets any error state. The cold-render gate re-proves
  "fresh /login = no banner" on the final bytes, plus the Google preflight
  click probe.

## Slices
- [x] 1 On-load banner: root cause above + cold-render proof on base bytes
- [ ] 2 Identity client: OAuth doors in kiln-identity-core.js + boot fragment handling in kiln-identity.js
- [ ] 3 Buttons wired for real (panel + login chunk, surgical)
- [ ] 4 Handle-pick view (pending → complete → signed in)
- [ ] 5 /account "Sign-in & wallets": oauthLinks display

## Start URLs the buttons use (locked contract)
- Preflight (fetch, GET): /api/forge/v1/accounts/oauth/google/start?return=<path>
  and /api/forge/v1/accounts/oauth/x/start?return=<path>
- Navigation (only when preflight is NOT 503 provider_not_configured):
  window.location = the same URL. Return path = current pathname (the panel
  lives on /login and /account; OAuth starts from /login).
