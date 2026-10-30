# Live edge worker — kiln.pocketnova.app

`kiln-edge-worker.mjs` is the exact source of the Cloudflare Worker named
`kiln` that serves kiln.pocketnova.app, recovered verbatim from the live
script on 2026-10-29 during the black-page fix and redeployed unchanged as
version 13. It was not in this repo before — deploys happened by API upload
with no source copy here. Keep this file in sync on every future deploy.

How the domain is actually served (verified 2026-10-29):

- kiln.pocketnova.app is a **Worker custom domain** on the `kiln` worker.
- The worker serves the app from **Worker static assets** (the repo's
  `public/` tree, 194 files), stubs `/_serverFn/*` with `{result:null}`,
  and proxies `/api/kiln*`, `/api/mcp`, `/api/github*` through the tunnel
  to kiln-original.service (:8931) on the home machine.
- Missing `/assets/*` returns a real 404 (no SPA fallback) — so a missing
  asset file breaks the boot exactly like a missing import does.
- Bindings: `ASSETS` (assets), `ORIGINAL_API_URL` (plain text:
  https://kiln-original.medinatechlabs.net), `KILN_SWARM_TOKEN`
  (secret_text — preserved across deploys via `keep_bindings`, never
  stored here).
- Compatibility: date 2026-10-24, flag `nodejs_compat`.
- The `kiln-forge` Cloudflare Pages project (kiln-forge.pages.dev) is a
  separate static mirror — it is NOT what kiln.pocketnova.app serves.
- The Vite dev server on :8080 (kiln-forge.service) is the builders'
  preview only; the public domain never proxies to it.

Deploy path used 2026-10-29 (API, no wrangler): assets-upload-session →
workers/assets/upload (base64 multipart, per-bucket) → completion token →
POST workers/scripts/kiln/versions with metadata
{main_module, assets:{jwt}, bindings, keep_bindings:["secret_text"]} →
verify the new version's bindings still include KILN_SWARM_TOKEN →
POST workers/scripts/kiln/deployments at 100%.

Asset hashes for the manifest: first 32 hex chars of the file's SHA-256,
with its byte size.

Incident note: the 2026-10-29 black page was caused by
`public/assets/machine-seal.js` missing from the uploaded asset set — it
was an untracked file that never made it into the version-12 upload, and
`kiln-forge.js` imports it statically, so the whole app failed to boot.
The file has been restored in `public/assets/` (head recovered verbatim
from the kiln-account.json capsule; tail reconstructed to the KILN-WP-14
contract, marked in the file). It must be committed to git so no future
deploy can silently drop it again.
