# NOTES — /doi wiring (KILN Completeness Program, Item 2)

Branch: `doi-wiring` off `improve/ws-system-ui` @ `9c9f413` (verified at worktree creation).
Scope: BUILD + local verify only. NO deploy, NO service restart, NO push.
Coordinator lands / restarts / deploys.

## Goal
Make `/doi/*` reachable on kiln.pocketnova.app, mirroring the existing
`/papers/*` pair from Worker v38:
- origin route in `scripts/serve-original.mjs`
- edge rule in `ops-cloudflare/kiln-edge-worker.mjs`

Daemon side already exists (merged, activates at daemon's next boot):
`GET /doi/:owner/:slug` and `GET /doi/:owner/:slug/v/:n` → 302 to the
paper's Pages URL.

## Findings
- `/papers` origin pattern (`scripts/serve-original.mjs`): dedicated block
  ahead of the `/api/forge` proxy — GET/HEAD only (405 otherwise), repo
  segment validated against `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$` (404 on
  mismatch), proxies to the daemon at `127.0.0.1:18787` with the path
  rewritten to `/pages/auro/<repo><remainder><search>`; status,
  content-type and content-length pass through, `cache-control: no-store`
  added, 502 JSON on upstream error.
- `/doi` differs from `/papers` in two ways: (1) the daemon serves the
  route itself at the same path, so the path passes through UNCHANGED
  (same host/port the `/api/forge` proxy targets, 127.0.0.1:18787);
  (2) the daemon answers 302, so the proxy must also forward the
  `Location` header or the redirect target is lost.
- Edge pattern (`ops-cloudflare/kiln-edge-worker.mjs`): one condition
  listing the proxied prefixes, fetch with `redirect: "manual"`, status
  and headers returned verbatim — a daemon 302 passes the edge intact.

## Changes
- `scripts/serve-original.mjs` (+53 lines, commit 231a302): new block
  immediately after the `/papers` block, mirroring it — GET/HEAD only
  (405), shape guard (404): exactly `<owner>/<slug>` or
  `<owner>/<slug>/v/<digits>` with owner/slug on the same regex as the
  papers repo guard; path + query forwarded unchanged to
  127.0.0.1:18787; status / content-type / content-length / **location**
  pass through; `cache-control: no-store`; 502 JSON
  (`doi daemon unreachable: …`) on upstream error.
- `ops-cloudflare/kiln-edge-worker.mjs` (commit 58ccc4a): added
  `|| path.startsWith("/doi/")` to the origin-proxy condition and
  `/doi/*` to the header comment's proxied list. Nothing else touched.

## Local verification (2026-11-01, scratch origin on KILN_PORT=18931)
- `node --check` passes on both edited files.
- `GET /doi/auro/marketplace-paper` via the scratch origin → **401**,
  body = the daemon's own `{"error":"unauthorized: valid token required…"}`
  JSON, with the proxy's `cache-control: no-store` header — i.e. the
  request reached the daemon on :18787 and its answer passed through.
  A direct `curl http://127.0.0.1:18787/doi/auro/marketplace-paper`
  returned the identical 401, so the 401 is the currently-running
  daemon's pre-resolver-boot answer, not a wiring defect. The resolver
  activates at the daemon's next boot; after the coordinator restarts
  the daemon, the same request should 302.
- `GET /doi/auro/marketplace-paper/v/1` → 401 (passed the shape guard,
  reached the daemon — versioned form wired).
- `GET /doi/onlyone` → 404 from the origin shape guard (never proxied).
- `POST /doi/auro/marketplace-paper` → 405.
- Regressions: `GET /papers/marketplace-paper/` → 200; `GET /` → 200.
- Scratch server stopped afterwards; port 18931 free. No service was
  restarted and nothing was deployed.

## Landing steps for the coordinator
1. Review + merge branch `doi-wiring` into `improve/ws-system-ui`
   (or the branch the coordinator is landing from) in
   `~/workspace/repos/kiln-workspace`.
2. Restart the origin service so `scripts/serve-original.mjs` picks up
   the new route: `systemctl --user restart kiln-original.service`
   (service on :8931; verify it is back up before deploying the Worker).
3. ALSO restart the KILN daemon if it has not booted since the /doi
   resolver merged — the resolver only activates at daemon boot. (The
   wiring can be live before the resolver answers; that ordering is
   expected. Until the daemon boots with the resolver, /doi/* will
   proxy through and get the daemon's pre-resolver response.)
4. Deploy the edge Worker: run `ops-cloudflare/deploy_worker.py`
   (the v38 path) and confirm the bindings check passes — the Worker
   must keep its existing bindings/routes; do not deploy a config that
   drops bindings.
5. Curl checks after deploy:
   - `curl -sI https://kiln.pocketnova.app/doi/auro/marketplace-paper`
     → expect 302 (Location: the paper's Pages URL) once the daemon
     has booted with the resolver; before that boot, expect the
     daemon's fallthrough response — record which state you are in.
   - `curl -sI https://kiln.pocketnova.app/doi/auro/marketplace-paper/v/1`
     → same expectation for the versioned form.
   - Regression: `curl -sI https://kiln.pocketnova.app/papers/auro/marketplace-paper/`
     (or the known-good /papers path) still answers as before, and
     `curl -sI https://kiln.pocketnova.app/` still serves the app.
6. Report the Worker version deployed and the curl evidence.
