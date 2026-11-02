# Round 2 — Piece 1: "Nothing shows public" (/repos All repos)

Branch: round2-public (off improve/ws-system-ui @ ee78c97)
Status: DIAGNOSING

## Bug
Signed out, phone, /repos → "All repos": "Reading the forge…" then
"No public repositories answered — the list reads the forge's public surface live."
Forge actually has 4 public repos, all owner `auro`:
auro/kiln-agent-kit, auro/defi-kit, auro/blockchain-kit, auro/marketplace-paper.

## Code facts established (2026-11-01 ~19:52 CST)
- Hub: `public/assets/kiln-repos.js`
  - `SEED_ACCOUNTS = ["auro", "itsnotailabs"]` — auro IS seeded. ✔ not a seed-list bug.
  - The load effect awaits the seed lookups **sequentially** and only calls
    `setPubRepos` after BOTH finish — one slow account blocks every row.
  - While `pubRepos === null`: renders "Reading the forge…".
  - When the merged result is `[]`: renders the "No public repositories
    answered" copy — **indistinguishable from a failed read**. No distinct
    unreachable / last-known state, and the hub does NOT render store-known
    public records (kiln-public.js merges lookups into the store, but the hub
    waits on its own fetch result only).
  - Browser fetch in `kiln-public.js lookupPublicAccount`: no timeout.
- Origin: `scripts/serve-original.mjs` public surface
  - `publicAccountBody(owner)`: ANY result — including the empty list produced
    when `computePublicAccount` throws — is cached for **30 s**. A failed cold
    read therefore *caches the empty* and serves it as if it were truth.
  - `computePublicAccount`: anonymous `GET /git` on daemon, then per-repo
    `computePublicRepo` (details + commits + full tree walk + up to 41 file
    contents), 4 repos in parallel. Each daemon call: 8 s timeout + 1 retry
    (`daemonAnonJson`) — a queued/slow call can burn ~16 s and still fail,
    and one repo's tree-walk failure drops that repo silently.
  - Any failure at the top answers **200 with an empty list by design**.

## Live evidence
- Daemon direct, anonymous, 2026-11-01 ~19:53 CST (load was 5/16/27 falling):
  - `GET http://127.0.0.1:18787/git` → 200 in **0.42 s**, lists exactly the 4
    auro public repos (anonymous listing contains no itsnotailabs repos).
  - `GET /v1/repos/auro/kiln-agent-kit/details` (anon) → 200 in **1.08 s**,
    visibility "public".
  - So the daemon itself can be fast; the origin's per-repo full-record
    compute (tree walk + contents) is the expensive layer on top.
- Local origin (:8931) cold auro read: TIMING PENDING (call in flight >12 s).
- Live domain (kiln.pocketnova.app) cold read: PENDING.

## Activation flags
- (pending) If the fix touches `scripts/serve-original.mjs`, landing needs a
  kiln-original.service restart — coordinator sequences it; do NOT restart here.
