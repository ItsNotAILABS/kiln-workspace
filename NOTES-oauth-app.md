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

## Slice 2 — identity client + boot fragment handling (DONE)
- kiln-identity-core.js: parseOAuthFragment + OAUTH_NOT_CONFIGURED_TEXT
  (pure, harness-pinned); client.oauthStartUrl / oauthPreflight (fetch,
  redirect:"manual"; 503+provider_not_configured → {configured:false},
  never throws for it) / oauthHandoff / oauthComplete — all on the locked
  contract paths under the existing base "/api/forge/v1".
- kiln-identity.js: processOAuthReturn() at armIdentity (module load, every
  page the panel can land on): handoff → exchange → saveSession (same
  localStorage kiln.daemon.session.v1 shape as every door) + refreshIdentity;
  pending → module state + sessionStorage (kiln.oauth.pending.v1, survives a
  reload during handle-pick); fragment always scrubbed via
  history.replaceState. Handoff failure → one-shot honest notice, never
  "Sign-in failed". completeOAuthSignup() keeps the pending token on error
  (409 owner-taken retries in slice 4's form).
- Gates: node --check both files OK; load-sim RAN CLEAN (both modules);
  contract harness vs stub (.scratch/oauth_harness.mjs): 6/6 PASS
  (fragment parse x3, preflight not-configured, start URL shape, bogus
  handoff → 404 IdentityApiError).

## Slice 3 — buttons wired for real (DONE)
- Panel (kiln-identity.js, Sign-in section): "Continue with Google" /
  "Continue with X" buttons → doOAuthStart: oauthPreflight(return=
  location.pathname) → not configured: dedicated oauthOff slot with
  OAUTH_NOT_CONFIGURED_TEXT ("…isn't switched on yet — the provider app
  still needs to be created…", muted note styling, NOT the red error
  banner); configured: window.location = oauthStartUrl (exact start URLs
  in the header of this file). No better-auth calls.
- Login chunk (login-CNvQADsL.js, surgical, count-asserted x2): handler E
  rewritten from the honest cover to the same preflight → navigation flow
  (fetch redirect:"manual"; 503+provider_not_configured → inline message
  via the chunk's message slot w(); otherwise window.location = start
  URL, return=/login). Providers map grok-google→google, grok-x→x.
  Signup subcopy corrected ("Email, wallet, Google or X — every door
  opens the same account."). grep: no signIn.social / signIn.oauth2
  references remain in the chunk; the chunk's remaining better-auth use
  is its legacy email form (out of this lane's scope, untouched).
  FLAGGED: the chunk's only message slot is danger-styled (text-danger) —
  inherited from the frozen chunk; the panel carries the properly
  styled honest state.
- Gates: node --check OK; load-sim RAN CLEAN (kiln-identity + login
  chunk); cold render /login: panel OAuth buttons present, 0 pageerrors,
  no banner. Google click probe: see Gates section (host-load retries).

## Slice 4 — handle-pick view (DONE)
- Panel: when signed out AND a pending token exists, the sign-in doors
  are replaced by "Finish your KILN account" (eyebrow "Almost there"):
  handle (lowercased, same regex as signup) + display name; submit →
  completeOAuthSignup → session stored + refreshIdentity → signed-in
  state via the existing restore flow. 409 → inline "@handle is taken —
  pick another handle." in the form; pending token survives (module
  state + sessionStorage), retry works. Other errors inline too.
  Cancel drops the pending token and returns to the doors.

## Slice 5 — /account "Sign-in & wallets" providers (DONE)
- Signed-in section gains Google + X rows read from acct.oauthLinks:
  linked → chip "Linked — can sign in" (+ "Linked <date>" when the
  record carries linkedAt); not linked → chip "Not linked" + honest
  copy (sign in with it once from the login page). Read-only display.
- FLAGGED (not invented): linking an additional provider while already
  signed in has NO door in the locked daemon contract (start is a
  sign-in door; no link-start variant) — out of scope per task, flagged
  here for the daemon lane.
- Class audit vs styles-A_fIl0Ci.css: all tokens used exist (my-2 caught
  missing by the audit and replaced with my-6 before commit; variant /
  arbitrary-value tokens verified present in escaped form).

## Daemon contract — verified against the REAL daemon child code
- The daemon lane's branch appeared mid-run: lane-b-oauth @ 1c3478e
  (~/workspace/.worktrees/kiln-lane-b-oauth). Its httpapi.mjs/accounts.mjs
  match the locked contract exactly: GET /v1/accounts/oauth/<google|x>/
  start?return=…, 503 {error:"provider_not_configured", provider},
  callback 302 → <return>#oauth_handoff=… / #oauth_pending=…, POST
  handoff/complete → 200 {ok, account, sessionToken, expiresAt}, complete
  checks owner reservation BEFORE touching the pending record (409 keeps
  the pending alive), /me account carries oauthLinks:[{provider, subject,
  linkedAt}].
- Ephemeral REAL-daemon proof (.scratch/eph_daemon.mjs, startApiServer
  from the lane-b-oauth worktree, driven by the app's own core client):
  7/7 PASS — signup+login sanity; /me oauthLinks is an array ([]);
  preflight google AND x = {configured:false} (no provider creds in env);
  bogus handoff → 404 "handoff code not found"; bogus complete → 404
  "pending OAuth sign-up not found".
- Note: the real /me masks email (e•••@x.io, emailBound) — the panel
  displays the account record as returned, unchanged behavior.

## Gates — final state
- [x] node --check: kiln-identity-core.js, kiln-identity.js,
      login-CNvQADsL.js — all OK on final bytes.
- [x] load-sim RAN CLEAN (node --experimental-vm-modules): core, identity,
      login chunk, account chunk.
- [x] class audit vs styles-A_fIl0Ci.css: all tokens present (one catch
      fixed pre-commit: my-2 → my-6).
- [x] stub contract harness (app core client): 6/6 PASS.
- [x] ephemeral REAL daemon (lane-b-oauth worktree code): 7/7 PASS —
      see the contract section above. This supersedes stub-only proof
      for every server-driven behavior the app depends on.
- [x] cold render /login (stub origin, desktop): full text captured —
      panel Google/X buttons present, NO "Sign-in failed", NO error
      banner, 0 pageerrors. (Slice-1 proof re-run on final bytes.)
- [x] cold render pending state (stub origin, desktop): navigating to
      the daemon's 302 target /login#oauth_pending=<token> renders
      "Finish your KILN account" with handle + display-name fields and
      the fragment is scrubbed from the URL (location.hash === "").
      Proven on three separate runs/tokens.
- [~] browser click-through completions — PARTIAL, sandbox wall: host
      load averaged 17–58 for the whole run (other lanes); Chromium
      repeatedly failed to launch, page loads timed out at 60 s, and
      page.evaluate calls wedged for minutes at a time. The handle-pick
      SUBMIT (409 inline → retry → session) and the handoff exchange
      were therefore NOT captured end-to-end in a browser. They ARE
      proven at API level with the app's own client against both the
      contract stub and the real daemon code, and every state the
      browser must render around them (pending form, signed-out doors,
      fragment scrub) is browser-proven. Re-run when load settles:
      .scratch/flow.mjs (MODE=pending|handoff) and the click probe in
      .scratch/probe.mjs (CLICK_TEXT="Continue with Google"). NOT
      claimed as browser-proven.
- [~] Google preflight click probe (browser): same wall — not captured.
      The preflight itself is proven vs stub AND real daemon
      ({configured:false} for google and x with no creds configured),
      and both buttons' handlers are that exact client call.
- [~] 375px renders: not captured (same Chromium wall). No new
      viewport-specific code ships: the panel sections reuse the
      existing responsive classes (sm:flex-row etc. from the current
      panel), and the pending form is a single-column grid.
- NOT deployed (coordinator lands this batch as one Worker version).

## Shortfalls / flags for the coordinator
- Daemon contract differences vs locked: NONE found. The real complete
  endpoint's reserved-namespace 409 carries a longer message; the panel
  renders any 409 as "@handle is taken — pick another handle." inline,
  which is accurate for both 409 kinds.
- Linking an additional provider while signed in: no daemon door in the
  contract — flagged in slice 5, not invented.
- Login chunk message slot is danger-styled (frozen chunk) — flagged in
  slice 3; panel carries the properly styled honest state.
- The chunk's legacy better-auth EMAIL form is untouched (out of scope);
  the daemon doors are the panel's.

## Addendum (later same run, load window opened briefly)
- [x] Google preflight click probe — PASSED for BOTH buttons (stub
      unconfigured): chunk button (first match) and panel button
      (second match) each show "…isn't switched on yet" exactly once,
      "Sign-in failed" absent, 0 pageerrors. This closes the slice-3
      click gate that the earlier gates section marked not captured.
- The pending-flow submit still wedges in-browser at the same place
  (page.evaluate stops answering after the synthetic handle input is
  set; the form, scrub and SET all proven) — the API-level proof
  stands; flow.mjs remains the re-run path.

## LANDING RECEIPT (2026-11-02, deploy-only finish)
- Landed on improve/ws-system-ui: fast-forward 1a58c56 -> 6e200c9
  (ref update from the oauth-land worktree; the main tree's foreign
  WIP — M ops-cloudflare/README.md, M public/kiln-account.json,
  ?? data/ — was not disturbed; the stale index left by the ref move
  was re-synced to HEAD with read-tree before this commit, and this
  receipt commit contains ONLY this file).
- Worker v52 (NOT v51 as pre-briefed — v51, version
  7532cb74-d426-421e-af80-446086731748 / deployment
  8ea3303f-58a0-4528-a0ca-5adfbad7ffa1, was already live for the
  typing fixes): new version_id
  0def9d21-1951-4e85-9692-d3384afd8756, deployment
  edf3a8ad-f02c-4773-9848-b054098f0743 at 100%, confirmed via the
  deployments API (latest entry, created 2026-11-02T09:35:40Z),
  not just the script receipt. Deploy ran from the clean
  oauth-land worktree: 212-file manifest, only 3 asset buckets
  uploaded (the 3 changed assets).
- Bindings verified on v52 BEFORE rollout: ASSETS (assets) ·
  KILN_SWARM_TOKEN (secret_text, preserved via keep_bindings) ·
  ORIGINAL_API_URL plain_text
  https://kiln-original.medinatechlabs.net.
- Served-bytes sha256, live == oauth-land tree, MATCH 3/3:
  kiln-identity-core.js
  aec9df8318d2116b1925fc121800f94ff626f34806fabc2ab14b638d216516d0 ·
  kiln-identity.js
  595dbf64a2fea7f542433b18c7fe2e983ad6c4d9d18aa2753a0fe2976df8f676 ·
  login-CNvQADsL.js
  1367e68c33ec08111c976a89c65ac56ecf952f92369ff71cd76bc011953d59c9.
  GET https://kiln.pocketnova.app/ -> 200 (1,699 B).
- Live preflight, first-hand (run twice, identical):
  GET /api/forge/v1/accounts/oauth/google/start?return=/login ->
  HTTP 401, body verbatim:
  {"error":"unauthorized: valid token required (Bearer <redacted> or Basic password)"}
  i.e. the staged daemon falls through to the operator gate (401),
  not a 404, and not yet the post-boot 503.
- FINDING (pre-boot click behavior, NOT patched — deploy-only lane):
  a user clicking "Continue with Google" TODAY does NOT get the
  muted not-switched-on state.
  - Login chunk (login-CNvQADsL.js): its inline preflight only
    special-cases 503 provider_not_configured; on any other status
    (today's 401 included) it falls through to
    window.location.href = <start URL>, landing the user on the
    raw 401 JSON above.
  - Panel (kiln-identity.js doOAuthStart): oauthPreflight in
    kiln-identity-core.js likewise only maps 503
    provider_not_configured to {configured:false}; the 401 throws
    IdentityApiError and the catch renders the daemon's raw
    "unauthorized: valid token required …" string as the error.
    (isNotYetActive in the same core file already recognises this
    exact 401 as the staged signal for the wallet doors, but the
    OAuth preflight paths do not use it.)
  After the next Doctor boot, once the daemon routes answer
  503 {"error":"provider_not_configured"}, both paths behave as
  designed: no navigation, and the honest copy "Google sign-in
  isn't switched on yet — the provider app still needs to be
  created. Sign in with your password or a wallet below: every
  door opens the same account." (panel renders it muted —
  border/bg-bg/text-muted; the chunk renders the same copy in its
  danger-styled message slot, already flagged in the shortfalls
  above). Fix candidate for a later lane: treat 404 and the
  operator-gate 401 in oauthPreflight (and the chunk fallthrough)
  as {configured:false} / not-yet-active, same as the wallet doors.
- No daemon was restarted by this lane (swarm daemon and
  kiln-original untouched, per constraints).

## PREFLIGHT FIX — checkpoint 1 (investigation, 2026-11-02)
- Clean worktree ~/workspace/.worktrees/kiln-oauth-preflight off ff8a1eb.
- Core: oauthPreflight only maps 503 provider_not_configured; other
  statuses parse + throw IdentityApiError — 401 operator-gate and 404
  fall there. isNotYetActive(e) already tests exactly: status 404, or
  401 with /valid token required/i on the message.
- Panel doOAuthStart: already consumes {configured:false} correctly
  (setOAuthOff(OAUTH_NOT_CONFIGURED_TEXT[provider]), busy cleared, no
  navigation) — no change needed there once preflight is fixed.
- Handoff (processOAuthReturn): notice is a FIXED string (404-specific
  or generic "couldn't be finished") — raw daemon string never shown,
  so it already degrades honestly; will add an isNotYetActive branch
  so a pre-boot 401 says "isn't active yet" specifically.
- Pending complete (doOAuthComplete): OTHER branch renders e.message
  raw — a pre-boot 401 from oauthComplete WOULD show the daemon's raw
  "unauthorized: valid token required …" string inline. Same-class
  defect, will fix with isNotYetActive → honest pkErr copy (pending
  token survives: completeOAuthSignup only clears it on success).
- Login chunk handler E: inline preflight, count of
  provider_not_configured segment = 1 (surgical target confirmed).

## PREFLIGHT FIX — checkpoint 2 (edits done)
- kiln-identity-core.js oauthPreflight: non-ok answers now build the
  IdentityApiError first, return {configured:false} when
  isNotYetActive(err) (404 / operator-gate 401), else throw. 503
  provider_not_configured unchanged. Scoped to this preflight only.
- kiln-identity.js: (a) processOAuthReturn adds a 401+isNotYetActive
  branch — "That sign-in link isn't active yet …"; 404 wording and
  generic fallback unchanged (raw string was never shown here).
  (b) doOAuthComplete adds isNotYetActive → honest pkErr copy instead
  of the raw e.message (the one same-class raw-string path found).
- login-CNvQADsL.js: count-asserted (x1) inline preflight — body parsed
  once; (503+provider_not_configured) OR 404 OR (401 + /valid token
  required/i on error) → honest copy via w(), NO navigation.
- node --check: core, identity, chunk all OK.

## PREFLIGHT FIX — checkpoint 3 (gates, all green)
- Stub harness (.scratch/preflight_harness.mjs, real core client +
  fake fetch): 8/8 PASS — 401 operator-gate → {configured:false},
  404 (body + no-body) → {configured:false}, 503
  provider_not_configured → {configured:false}, 500 throws,
  401 other-message throws (scope guard), 503 other throws,
  302 → {configured:true}.
- Load-sim RAN CLEAN: kiln-identity-core.js, kiln-identity.js,
  login-CNvQADsL.js.
- Browser click probe vs a pre-boot GATE stub reproducing the live
  401 verbatim (.scratch/gate_stub.mjs + gate_serve.mjs +
  gate_probe.mjs, local origin :18948): cold /login renders (2 Google
  buttons, 0 pageerrors); click 0 (login chunk) PASS and click 1
  (panel) PASS — honest "isn't switched on yet" copy x1, URL stays
  /login, no raw gate string, no "Sign-in failed", 0 pageerrors.
- Handoff probe (.scratch/gate_handoff_probe.mjs): landing on
  /login#oauth_handoff=boguscode against the gate stub shows "That
  sign-in link isn't active yet", fragment scrubbed, no raw string,
  0 pageerrors — PASS.
