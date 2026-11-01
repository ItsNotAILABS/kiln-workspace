# Design round — checkpoint notes (branch `design-round` off improve/ws-system-ui @ 1538012)

Worktree: ~/workspace/.worktrees/kiln-design-round — main tree untouched (crash lane lives there).
Gates per piece: `node --check` on edited files → load sim (.scratch/loadsim.mjs) RAN CLEAN →
real cold-load render (.scratch/render_gate.mjs, local serve-original) desktop 1280 + mobile 375, 0 pageerrors.
Classes: only utilities present in public/assets/styles-A_fIl0Ci.css or already used by shipped
house modules/chunks (audit script in .scratch). Inline styles otherwise.

## Architecture facts (verified by reading the chunks)

- Entry: index.html → kiln-forge.js (house wiring; dynamically imports kiln-identity.js) + kiln-client.js (router bundle).
- House-module pattern: readable modules in public/assets (kiln-public.js, kiln-receipt.js,
  kiln-identity.js) imported BY route chunks / AppShell; components defined at module scope.
  AppShell already imports { searchPublic } from kiln-public.js — adding house imports to
  AppShell is established practice.
- Store: store-sx46DNi5.js (zustand). Aliases used by house modules:
  b=useStore/useKiln, d=allRepos selector, G=formatKln, p=allTxsOf, t=blocksOf.
  Repo record shape: buildPublicRepo in kiln-public.js (files[] carry {path,size,sha,language,
  content?} — content only for text files the origin chose to include).
  Notices: {id,title,body,href,read,createdAt,kind} via store notify(title,body,href,kind);
  kind is usually undefined (only one caller passes `activity`) → inbox groups by derived
  category + read state, not by kind. markNoticesRead marks ALL read; per-item read is a
  store.setState map (house modules setState directly — kiln-forge precedent).
- Routes (from kiln-client.js T(`…`) registrations): NO /repos route exists, and the router
  does not admit one without surgery on the generated route tree in kiln-client.js (441KB
  routes chunk + manifest) — out of bounds for a frozen-chunk edit. /repos falls through to
  /$owner with owner="repos" (details in Piece 4).
  /papers → papers-DKQH21Qh.js (Research list); /papers/$slug → _slug-BL9CzFUP.js;
  /paper → paper-DZK2VAq_.js (same Research component); /notifications → notifications-uzXj96uh.js
  (tiny house-style chunk over _repo-kit.js, renders store notices as a flat list);
  /$owner/ → _owner-B3Oc7_zJ.js (single component b, params via useParams from index bundle).
- Data doors the browser actually has:
  - Origin public API (anonymous, daemon visibility gate is the enforcement):
    GET /api/kiln/public/accounts/:owner/repos (full records; file CONTENT included for text
    exts ≤32KB — `json` included, so paper.json content is readable),
    …/repos/:repo/commits, GET /api/kiln/public/search?q= (accounts + repos, q ≥ 2 chars).
  - Origin forge proxy: /api/forge/* → daemon :18787 any path, caller's Authorization
    forwarded verbatim. With a daemon account session (kiln-identity keeps it in
    localStorage `kiln.daemon.session.v1`) the browser can call the whole /v1 surface:
    repos create, contents PUT (a real commit), details PATCH (designation), releases POST,
    tree/contents GET for anything the session may read.
  - GET /api/kiln/forge-activity (origin, anonymous): recent daemon commits
    {owner, repo, sha, authorName, message, timestamp} — real cross-forge activity.
  - The store itself: own repos (incl. files with content), notices, chain txs, profiles.
- NO workspace surface exists anywhere in the app assets (grep: zero chunks mention
  workspaces) → Piece 3 has no New workspace door to offer (see Piece 3).

## Piece 1 — header dropdown (INVENTORY)

Top bar, desktop (header nav, `hidden sm:inline` links): **Models · Studio · Explore ·
Marketplace** + L1 (/chain, icon+height) + New button (/new) + bell (Activity panel) +
wallet chip (/wallet, when connected) / Connect.
Top bar, phone (second row, sm:hidden): **Models · Studio · Explore · Marketplace · L1**.
More dropdown (BEFORE): Models, Studio, Explore, Marketplace, Wallet, Apps, Assistants,
Cloud, Account, Organizations, Pricing, Architecture, /papers labeled "Docs", Gists,
Bounties, CLI, WebGPU, Get started, Shortcuts (button).
Rule applied: an entry stays in the dropdown only if it is NOT on that form factor's top
bar. Models/Studio/Explore/Marketplace are on BOTH form factors' top bars → removed.
Wallet is on the top bar as the wallet chip (both form factors; icon-only on phone) →
removed (judgment call, recorded). /papers stays but its label was "Docs" — the entry
was the papers index mislabeled; relabeled **Papers** (his "add Papers": the door now
exists under its own name).
AFTER: Papers, Apps, Assistants, Cloud, Account, Organizations, Pricing, Architecture,
Gists, Bounties, CLI, WebGPU, Get started, Shortcuts.
⌘K palette already carries its own full list (incl. "Working papers") — not the dropdown;
left untouched.
Edit shape: data-array entries inside AppShell component R — no new JSX, no new bindings
(the #130-safe class of edit).
Status: DONE — node --check OK; load sim RAN CLEAN; cold render / desktop: nav ok,
0 pageerrors, header renders; click probe on "More": dropdown text = Papers, Apps,
Assistants, Cloud, Account, Organizations, Pricing, Architecture, Gists, Bounties, CLI,
WebGPU, Get started, Shortcuts (exactly the AFTER list, Papers first, no top-bar
duplicates), 0 pageerrors. (Two console entries were sandbox ERR_TUNNEL resource
failures on external fetches — environmental, not page errors.)

## Piece 3 — Create sheet (plan)

- New house module kiln-create.js exporting KilnCreateSheet (module scope): fixed overlay,
  backdrop + Escape dismiss, bottom-anchored panel on mobile / centered on desktop,
  safe-area padding inline. Opens on window event `kiln:create` (the `kiln:palette`
  precedent in AppShell F). Doors (all REAL, verified):
  New repository → /new?tab=create · Import from GitHub → /new?tab=import ·
  New gist → /gists · New paper → /papers#new (suite opens its create door on the hash).
  New workspace: OMITTED — no workspace create door (or any workspace surface) exists in
  the app today (verified above). /orgs/new (organizations) exists but is a different
  concept and was not in his list — flagged here for the parent, not added.
- AppShell edits: import { KilnCreateSheet }; mount beside the palette in L;
  bottom-bar Create (Q) Link→button dispatching `kiln:create` (visual identical);
  header New (R) Link→button dispatching the same (the sheet serves the desktop + too —
  its first door is New repository, so nothing is lost). Status: TODO

## Piece 2 — Papers Studio (plan)

- Home: /papers route chunk papers-DKQH21Qh.js — wrap its exported component at module
  scope: KilnPapersStudio (new house module kiln-papers.js) on top, the existing
  Research/claimed-constructions component preserved verbatim below.
- Suite sections: hero (app voice) · doors (New paper / Release a paper / record pages) ·
  My papers · Public index (scholarly record rows: title, authors, ID badge
  kiln:<owner>/<slug>, license; version + citations join when the registry answers).
- Detection (today's honest rule): a repo is a paper if its root file list contains
  paper.json, or both paper.md and paper.pdf. Manifest (title/authors/abstract/license/
  keywords) parsed from paper.json content when the record carries it (public records
  include .json content ≤32KB; store records carry file content for local repos).
- Public index sources (all real): public search "paper" + public accounts auro and
  itsnotailabs (the accounts with known papers; the Discover chips precedent), filtered
  by the detection rule. Read door: auro papers → /papers/<slug>/ (the origin Pages
  proxy is auro-only today); other owners → their in-app repo page. NOTES gap: widening
  the record-page door = generalizing the origin /papers proxy beyond auro + proxying
  the daemon /doi/ resolver — app-tree/origin follow-ups for the parent.
- New paper door (#new): manifest form (title, authors, abstract, license, keywords) →
  with a daemon session (localStorage kiln.daemon.session.v1): POST /api/forge/v1/repos
  (scaffold: paper.json + paper.md stub + README via contents PUTs — real commits).
  Without a session: the same form yields the scaffold + doors to /new?tab=create and
  /account (where the identity panel signs in). Errors surface verbatim.
- Release door: pick one of my repos → panel per repo: manifest present? pages record?
  With a session: Designate button (PATCH details {paper:{enabled:true}} — the LIVE
  daemon does not know the paper designation yet; failures surface verbatim and the
  button labels itself staged) + Release button (tag input → POST …/releases; an
  ordinary forge release today; the registry snapshot + version ID arrive when the
  papers-workflow branch activates on the daemon). Without a session: deep link to the
  repo's /releases page. Registry probe: GET /api/forge/v1/papers on mount — 404 today;
  when it answers, records take precedence for version/ID/citation display.
- marketplace-paper site restyle: forge PR (see repo work below). Status: TODO

## Piece 4a — Repos tab (plan)

- Home decision: the router admits no new route (above). The tab's target becomes
  /repos, which resolves to /$owner with owner="repos"; _owner-B3Oc7_zJ.js gets a
  module-scope WRAPPER component (the papers-B3 composition pattern): owner==="repos"
  → KilnReposHub (new house module kiln-repos.js); anything else → the original
  profile component untouched. Wrapper calls useParams once (always), children keep
  their own hook sets — no hook-order hazard. Consequence, recorded: a forge account
  literally named "repos" would be shadowed in the app (the router already shadows
  explore/studio/papers/new the same way).
- Bottom-bar Repos tab (AppShell Q): target changes from /:owner|/explore to /repos
  (active-state matching updated to /repos + profile paths).
- Segments: MINE — signed in (wallet): profile summary (handle, address, joined,
  repo count, KLN balance) + my repos from the store selector with forge details
  (language, commits count when carried, updated, visibility) + filter; signed out:
  honest sign-in prompt (Connect) + the two public segments still offered.
  ALL REPOS — every public repo the public API can see: seed accounts auro +
  itsnotailabs merged via lookupPublicAccount + search box over /api/kiln/public/search
  (the Discover pattern); rows link to repo pages.
  EXPLORER — pick a repo (from ALL/MINE lists or owner/name input) → browse:
  public repos browse from their public record files[] (tree built from paths,
  text content inline when the record carries it; larger/binary files say so and
  link the repo page); with a daemon session, any repo the session may read browses
  via /api/forge/v1/repos/:o/:r/tree + /contents (private own repos included);
  store-local repos browse from their store files. Breadcrumbs + back, read-only.
  Gap recorded: anonymous browsing beyond the public record's included contents
  (files >32KB or non-text) has no door today — the session door is the widening path.

## Piece 4b — Inbox (plan)

- Home: notifications-uzXj96uh.js delegates to KilnInbox (new house module
  kiln-inbox.js), same `component` export. The old flat list is replaced per the
  ordered rebuild.
- Sections over REAL data only:
  NEEDS ATTENTION — unread store notices (read===false), per-item mark-read,
  deep links from notice.href. (Workspace invites: NO data source exists in the
  app — invites arrive by email token; the daemon has no "invites for me" list and
  the app has no workspace surface → the feed does not appear; gap recorded here
  for the daemon side: a GET /v1/invites/mine would feed this section.)
  ACTIVITY — all notices, newest first, read state shown, click = mark read + go.
  SYSTEM — forge activity (GET /api/kiln/forge-activity: real daemon commits,
  link to the repo) + my chain activity (store txs touching my wallet/agents/
  models, link to /chain/<hash> receipts). Honest empty states when a source is
  empty/unreachable.
  Mark-all-read button (store markNoticesRead). Known interaction, recorded:
  the header bell panel marks all notices read when opened (AppShell R) — the
  inbox reflects whatever read state results; changing the bell is out of scope.
- Status: TODO

## Landing order (for the parent, after the crash fix)

1. Piece 1 commit (AppShell data edit) — independent.
2. Piece 3 commit (AppShell + kiln-create.js) — after Piece 1 (same file, sequential).
3. Piece 2 app commit (kiln-papers.js + papers-DKQH21Qh.js wrapper) + the
   marketplace-paper site PR (forge repo, independent of the app tree).
4. Piece 4 commit (kiln-repos.js + _owner wrapper + AppShell Q tab target [same file
   as 1–3, sequential] + kiln-inbox.js + notifications chunk).
Deploy = one Worker version carrying all four (bindings discipline + served-bytes
proof + cold render of /, /explore, /papers, /repos, /notifications, /studio at
desktop + mobile), or per-piece if the parent prefers.
