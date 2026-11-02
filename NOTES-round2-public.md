# Round 2 — Piece 1: "Nothing shows public" (/repos All repos)

Branch: round2-public (off improve/ws-system-ui @ ee78c97)
Status: ROOT CAUSE PROVEN (bug reproduced cold through the live domain) — FIXING

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
- Local origin (:8931) COLD auro read (cache expired, load ~20):
  **200 in 74.3 s, 411,038 bytes, all 4 repos present**
  (auro/blockchain-kit, defi-kit, kiln-agent-kit, marketplace-paper).
  itsnotailabs cold read: 200 in 0.27 s, truly empty (no repos in anon listing).
- **Live domain COLD auro read — THE BUG, REPRODUCED (load ~20+):**
  `GET https://kiln.pocketnova.app/api/kiln/public/accounts/auro/repos`
  → **200 in 21.2 s with `{"ok":true,"owner":"auro","repos":[]}`** — EMPTY.
  21 s ≈ each repo's details call burning the 8 s timeout + 0.4 s pause +
  8 s retry in parallel, every repo dropped, empty answer. That failure-empty
  is then cached by `publicAccountBody` for 30 s and served as truth.
  (Daemon details calls measured immediately after were themselves hanging
  >100 s for the 4-repo loop under this load — the daemon slows drastically,
  and the public reader's 8 s budget is far below the daemon's real latency;
  the file's own account-doc reader uses 25 s because "a few repos answer
  in ~20 s".)
- Design-round scratch corroborates intermittency on the local path:
  probe-p4-repos.txt waited 150 s → "No public repositories answered";
  probe-p4-repos2.txt got all rows in 24 s; mobile probe in 20 s.

## ROOT CAUSE (all three layers compound)
1. **Origin timeout budget too small for the daemon under load.** Public
   daemon calls abort at 8 s (+1 retry). Daemon per-repo latency routinely
   exceeds that under this box's load (10–40+), so repos get dropped
   silently; when all drop, the account reads as empty.
2. **Origin caches and mislabels failure.** A compute that failed (fully or
   per-repo) produces the same 200 `{repos: []}` as a truly-empty account,
   and `publicAccountBody` caches ANY result — including failure-empty —
   for 30 s. Cold path also has no stale-while-revalidate and no in-flight
   dedupe, so every cold phone pays the full 20–75 s compute (or a
   Cloudflare proxy timeout past ~100 s) with nothing to fall back on.
3. **Hub conflates failure with empty and blocks on the slowest seed.**
   Sequential seed lookups, one `setPubRepos` at the very end, no fetch
   timeout, no store-known fallback, and a single empty message that
   claims a live read happened. `lookupPublicAccount` also treats any
   200-with-empty (and even a non-JSON error page, via `res.json().catch`)
   as a successful empty result.

## FIX PLAN (evidence-mapped)
- `scripts/serve-original.mjs` **[ACTIVATION: needs kiln-original.service
  restart — coordinator sequences; do NOT restart from this lane]**:
  - `PUBLIC_FETCH_TIMEOUT_MS` 8000 → 25000 (same budget as the account-doc
    reader, whose comment documents ~20 s daemon answers).
  - `computePublicAccount` reports per-repo failure count + listed count.
  - `publicAccountBody` rewritten: stale-while-revalidate (serve last good
    body instantly, refresh in background, in-flight deduped — the
    accountDocBody pattern); cache only real results (complete, partial
    with repos, or verified-empty); a total failure with nothing cached
    answers `{…, repos: [], degraded: true}` and is NEVER cached.
- `public/assets/kiln-public.js`:
  - `lookupPublicAccount`: 60 s fetch timeout, `res.ok` check, JSON-parse
    failure and `degraded:true` bodies return `{ok:false, …}` instead of a
    fake successful empty.
  - `searchPublic`: non-OK / degraded answers throw, so callers show their
    "did not answer" state instead of "no matches".
- `public/assets/kiln-repos.js` (hub):
  - Seed lookups run concurrently and merge into the list **per owner as
    each lands** (auro's rows no longer wait for itsnotailabs or vice versa).
  - Initial display seeds from store-held public records
    (`forgePublic === true` — real records previously merged from this same
    public API; nothing invented), live results overwrite by id.
  - Distinct states: loading / forge-unreachable (with Retry) /
    last-known-shown note / truly-empty (only when every lookup succeeded
    and returned nothing).
  - Rows normalize `commitCount`/`fileCount` → the `commitsCount`/
    `filesCount` fields RepoRow prints (they never rendered before).

## Activation flags
- (pending) If the fix touches `scripts/serve-original.mjs`, landing needs a
  kiln-original.service restart — coordinator sequences it; do NOT restart here.
