# BRIDGE 1 — the live app ↔ the forge

One KILN, not two: the app at kiln.pocketnova.app (this repo's frozen build,
served by `scripts/serve-original.mjs` + `scripts/agent-turn.mjs`) now works
the **real forge** — the swarm daemon on loopback :18787, the same repos the
Agent Kit (SDK/CLI/MCP) serves — instead of only its own browser-side state.

## Before this bridge

- `/api/mcp` answered `initialize` and `tools/list` for real, but
  `tools/call` executed only the kiln-infra tools. Every repo tool
  (`kiln_list_files`, `kiln_read_file`, `kiln_write_file`, …) returned a stub:
  "runs in the Kiln browser overlay". No server-side repo reads or writes
  existed on this door at all.
- Agent turns (`/api/kiln/agent-turn`) return text + tool calls; the
  **browser** executes the tool calls against its sealed tree in
  localStorage. Server-side, nothing landed anywhere.
- Studio's operator repos came from `/kiln-account.json`, a **static
  snapshot** (`scripts/kiln-account.mjs`): the kiln account's published
  drops, synthesized from local files — not daemon repos.
- Already bridged (pre-existing, kept): `GET /api/kiln/forge-activity`
  (daemon commits mirrored into the app's L1 ledger, operator token,
  server-side), `GET /api/kiln/public/accounts/:owner/repos[/:repo/commits]`
  and `/api/kiln/public/search` (daemon read **anonymously** — public repos
  only), and `/api/forge/*` (transparent proxy forwarding the caller's
  Authorization to the daemon).

## What the bridge adds

### 1. MCP repo tools execute on the forge — `scripts/agent-turn.mjs`

`tools/call` for `kiln_list_files`, `kiln_read_file`, `kiln_write_file`,
`kiln_create_branch`, `kiln_open_pr`, `kiln_search` now runs against the
daemon's forge API (`/v1/repos/<owner>/<repo>/…`): tree reads, contents
reads, and writes as **real git commits** through the contents API.

- **Repo resolution:** `owner/name` as given; a bare `name` resolves to
  owner `auro` (the forge's working namespace — all daemon repos live
  there); `kiln/<name>` also resolves to `auro/<name>`, because the app
  renders that namespace under the kiln account. Stated in the tool
  descriptions, so every agent sees it in `tools/list`.
- **Credential model:** the MCP caller's `Authorization` header is threaded
  from `serve-original` into the handler and forwarded to the forge
  verbatim; the daemon enforces its own gates (accounts-only reads, owner
  scoping, agent tokens need the `forge` scope). The bridge **never injects
  a credential**: anonymous callers can read public repos; write tools
  without a credential are refused with instructions; a credentialed
  caller's errors are the daemon's own words.
- `kiln_search` is a path search over the real tree (content search would
  mean fetching every blob; the tool says so).
- Everything else is unchanged: infra tools still execute, crew/machine/
  memory tools still belong to the browser overlay and answer with the
  overlay text, BYOK is untouched (no operator xAI key; resident local mode
  without a key, labeled as before).

### 2. The boot account doc carries the forge's repos — `scripts/serve-original.mjs`

`GET /kiln-account.json` is now answered dynamically: the static snapshot's
account + repos, **plus** the forge's real repos for owner `auro` read live
from the daemon (operator token, the forge-activity posture), shaped into
the same store records and marked `forgeBridge: true`, with real
description/topics/visibility, file listings, tip commit, and README/small
text contents. The build runs in the background (stale-while-revalidate —
the daemon derives repo details live from git and a full pass takes real
time): the first answer is the static snapshot, the live doc replaces it
when the build lands, so boot never waits on or breaks on the bridge. The Cloudflare Worker for
kiln.pocketnova.app proxies `/kiln-account.json` to this origin like the
other API paths, so the live app boots from the same doc as the local door.

## What still lives in app state (labeled, not hidden)

- **Browser Studio turns**: the frozen frontend executes agent-turn tool
  calls in the browser's sealed tree (localStorage). That is the frozen
  build's design and it is unchanged; the forge-backed execution surface
  is the `/api/mcp` door — the same door Studio's "Point Claude / Muse
  at this webapp" flow hands to external agents.
- The kiln account's showcase repos in the static snapshot
  (`kiln/kiln`, `kiln/studio`, …) remain app-side published drops; they are
  kept in the boot doc ahead of the appended forge repos.
- The app's L1 chain (`data/l1.json`), computers (`computers/`), and
  capsules remain app-local, with forge commits mirrored in via
  `/api/kiln/forge-activity` as before.
- Users' own browser repos (their home trees) remain in their browser
  state; nothing was migrated or deleted.
