# KILN workspace

Live Kiln forge app. **Not** the Foundry L1 repo (`ItsNotAILABS/KILN`).
Those are the two Kiln repositories. Do not open a third.

Muse uses this app's `/api/mcp`. Delete `http://127.0.0.1:8787` from
`~/.config/muse/settings.json`. That was the old local kiln.
See `docs/MUSE.md`.

The public name is https://kiln.pocketnova.app. The worker there still
returns Hello World until `public/cloudflare/worker.js` is pasted and
`ORIGIN` is this published app. Until that host returns this forge,
Muse uses the `/api/mcp` of the kiln that is actually answering.

Read `WORKSPACE.md` then `PICKUP.md`.
