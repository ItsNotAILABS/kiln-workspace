# Round 2 — Piece 2: Profile, better UI (checkpoint notes)

Worktree: ~/workspace/.worktrees/kiln-round2-profile · branch round2-profile · base improve/ws-system-ui @ ee78c97
Scope: /account (signed-out identity panel + signed-in profile) and public profile /:owner.
Constraints: frozen build in public/ — surgical chunk edits + house modules only; module-scope
components only in frozen chunks (React #130 lesson, NOTES-mobile-studio.md); only CSS utilities
proven present in public/assets/styles-A_fIl0Ci.css or inline styles; NO fake data — every element
binds to real store/forge data or is omitted; PRESERVE all v36 identity flows exactly (presentation
only in kiln-identity.js / kiln-identity-core.js untouched crypto/session logic); edit never rewrite.
NOT deployed — coordinator lands commits.

## Step log
- [x] 1 Inventory both surfaces cold + class audit (below; renders in .scratch/before-*.txt)
- [x] 2 Build: kiln-identity.js presentation pass — DONE: per-section eyebrows (Account / New here /
  Wallet recovery / Signature-linked / Encrypted backup / Advanced; section() gained a 4th param,
  default unchanged); err/note are now bordered banners and err uses text-red-500 (exists) instead
  of text-red-400 (absent — also fixed in the backup-offer status line); panel header is composed
  when signed in (initials avatar from account name/owner, mono seal handle, email, real chips:
  linked-wallet count + backup on file/no backup yet + this-browser link state, all gated on the
  loaded /me snapshot so nothing renders from unknown state) and carries Sign out on the identical
  handler — the duplicate "Signed in" section is gone; linked-wallet rows py-2→py-3 with the full
  address on title; step-1 wallet box p-3→p-4 + bg-bg framing; section subs gain leading-relaxed.
  NO handler/crypto/session/copy changes; kiln-identity-core.js untouched.
  Gates: node --check OK · class audit 66 tokens, none missing · load-sim RAN CLEAN (exports intact).
- [x] 3 Build: account chunk surgical pass — DONE (all replacements count-asserted ==1, no new
  bindings beyond in-scope u/r/t/i/e already used by the component's own JSX): signed-out frame
  max-w-lg py-12 text-center → max-w-2xl py-10 text-left + title text-3xl→text-4xl (aligns with the
  identity panel below it); signed-in gains an identity summary strip under the prose line
  (truncated mono address with full address on title · Joined <profile.joined | wallet year> ·
  "<balance> KLN balance" via the store's own toLocaleString format — all existing locals);
  the bare form grid becomes a card (rounded-xl border bg-surface p-5, gap-3→gap-4); Save row
  gains "View public profile" (existing Link + /$owner params pattern); invite card mt-10→mt-6.
  Gates: node --check OK · class audit 56 tokens, none missing · load-sim RAN CLEAN.
- [x] 4 Build: _owner chunk surgical pass — DONE (all replacements count-asserted ==1; only
  in-scope bindings y/t/r/p/D used, in the chunk's own JSX patterns): aside becomes a profile
  card (rounded-xl border bg-surface p-5, self-start lg:sticky lg:top-20); avatar shows word
  initials (split on space/dash, uppercased, first-two-letters fallback — "Meridian Research"
  now initials MR, not "Me"); address is a framed block (rounded-lg border bg-bg px-3 py-2);
  counts line becomes a stats line with font-medium text-fg numbers (the followers-line pattern);
  owner-only KLN balance line under it (store balance is the viewer's — rendered ONLY when the
  viewer owns the profile, never on a stranger's page); Edit profile becomes btn-primary;
  repo descriptions line-clamp-2; list rows py-3→py-4; meta list gap/margin aligned.
  Gates: node --check OK · class audit 73 tokens, none missing · load-sim RAN CLEAN (wrapper +
  KilnReposHub exports intact, so /repos is untouched).
- [ ] 5 Gates: node --check, class audit, load-sim, cold renders desktop+375px, identity click-probe

## Class audit (styles-A_fIl0Ci.css, 2026-11-01 night)
Method: regex extract + Tailwind-escape check (design-round .scratch/class_audit.mjs approach).
PRESENT (safe): max-w-lg/md/xl/2xl/3xl/4xl/5xl, mx-auto, font-display, text-2xl..5xl, text-[9px]/[10px]/
[11px]/[12px]/[12.5px]/[13px], tracking-[0.12em]/[0.14em]/[0.16em]/[0.18em]/[0.2em], rounded-xl/2xl/lg/md,
border/border-t/border-b/border-border/border-seal, bg-surface/bg-surface-2/bg-bg/bg-seal/bg-accent,
text-muted/text-subtle/text-fg/text-seal/text-ok/text-danger/text-red-500, chip, btn/btn-primary/btn-ghost,
input, grid/grid-cols-2, sm:grid-cols-2/3, sm:col-span-2, sm:flex-row, sm:w-64, sm:px-4/6, sm:text-sm/base,
lg:grid-cols-[16rem_1fr]/[14rem_1fr], lg:sticky, lg:top-20, divide-y/divide-border, font-mono, min-h-11/8,
size-2/3/3.5/4/5/6/8/10/20, break-all/break-words, truncate, line-clamp-2/3, gap-1/1.5/2/3/4/5/6/8,
space-y-1..4/8, mt-0..16, mb-1..4, p-3/4/5/6, px-1..6, py-1..12, pt-4/5/8, pb-16/20, w-full/w-fit,
h-7/8/9/10/11/14, self-start/self-center, shrink-0, min-w-0, tabular-nums, overflow-x-auto/hidden/auto,
whitespace-pre-wrap, leading-5/relaxed, uppercase, hover:underline, sticky/relative/fixed/absolute,
inset-0, z-30/40/50, duration-150/300, transition-colors, aspect-square, select-none.
ABSENT (never use): sm:hidden, bottom-0, text-red-400 (0 hits — kiln-identity.js already uses it in
4 spots; those error texts currently fall back to inherited color — fixing to text-red-500 in this
pass is a presentation fix, noted), shadow-[var(--shadow-panel)] as a compiled class (kiln-identity
backup-offer card uses it — pre-existing, left as-is except color fix is separate), grid-cols-3
(bare; sm:grid-cols-3 exists), sm:p-* (none), sm:w-auto (none), max-w-6xl/7xl (none).

## Architecture facts (verified by reading the chunks)
- /account = account-49nJUaQm.js, single minified component d(). Signed-out branch (!wallet):
  div.mx-auto.max-w-lg.py-12.text-center → h1 "Make your account" text-3xl, muted sub, Sign up btn
  (Link /login), then <KilnIdentityPanel/> (house module, root mx-auto w-full max-w-2xl text-left).
  Signed-in branch: div.mx-auto.max-w-2xl → eyebrow "Account", h1 "Your profile" text-4xl, prose
  line (public link mono seal + repo count + Discord pitch), bare form grid sm:grid-cols-2 (no card),
  Save profile btn, Discord invite section (already a card), then <KilnIdentityPanel/>.
- KilnIdentityPanel (kiln-identity.js, readable house module): own header block (mt-10, eyebrow
  "Identity & wallets", h2 text-3xl "Your Kiln account", max-w-2xl description), optional
  surface-off notice, err (text-red-400 — not in CSS) / note (text-seal) plain <p>s, then sections
  via section() helper: rounded-xl border bg-surface p-5, eyebrow "Kiln account" repeated on EVERY
  section, h2 text-2xl, optional sub. Signed-out: Sign in form + Create (wallet-first, step-1 box +
  sm:grid-cols-2 form). Signed-in: Signed in summary (mono owner · email + Sign out), Restore
  (conditional), Linked wallets (divide-y list, chips, Unlink btn min-h-11), Backup, Import.
- /:owner = _owner-B3Oc7_zJ.js: module-scope wrapper B (owner==="repos" → KilnReposHub, else b).
  b(): grid gap-8 lg:grid-cols-[16rem_1fr]. Aside has NO className (loose stack): avatar size-20
  rounded-xl border bg-surface font-display text-2xl with (lab||displayName||handle).slice(0,2)
  (first two letters, not word initials), h1 text-2xl semibold, lab in seal, handle mono xs subtle,
  bio, highlight seal xs, address break-all mono [11px] subtle (full width, dominates), ul company /
  location+" · joined "+joined-year, followers/following (only when profile.followers is a number),
  Edit profile btn (owner only), "N repositories · M stars" plain line, website/twitter/email stack.
  Main: Pinned (sm:grid-cols-2 cards via x compact), Repositories header + filter input
  (h-11 w-full sm:w-64), list divide-y rounded-lg border, rows x(): name seal + listedKln label,
  description (no clamp), meta row (language dot+name, stars, tvlKln formatted, model label,
  encrypted/grant badge). Slice cap 80 + "more — filter" note. Empty: "No visible repositories."
- Store facts: state.balance is the viewer's KLN balance (formatKln = `${n.toLocaleString(max2)} KLN`,
  store export G); wallet {handle,address,createdAt,secret}; profiles[handle] {displayName,bio,
  location,lab,twitter,website,highlight,address,kind,joined(year str),followers?,following?,pinned?}.
  Balance belongs ONLY on own-profile surfaces (viewer === owner) — never on a stranger's profile.
- Visual language (Studio/Explore): dark, Newsreader serif font-display headings tracking-tight,
  [11px] uppercase tracking-[0.2em] muted eyebrows, seal accent for handles/links, surface cards
  rounded-xl border-border bg-surface p-5, chips for small facts, mono for addresses/hashes.

## Inventory (cold, BEFORE) — local origin :18931 serving THIS worktree, host load 19–37 (slow boots)
Gate: .scratch/profile_gate.mjs (Playwright headless, design-round pattern). Console entries on every
run are only ERR_TUNNEL_CONNECTION_FAILED on external fetches — environmental, not pageerrors.
- /account desktop 1280, signed-out: renders fully, 0 pageerrors, no h-overflow. Text order: header
  nav → centered narrow (max-w-lg) "Make your account" text-3xl + sub + Sign up btn → identity panel
  (max-w-2xl, left-aligned): eyebrow/head/desc, Sign in card, Create card (step-1 wallet box +
  2-col form). DEFECTS: (a) page header centered+narrow vs panel left+wide — two competing frames;
  (b) EVERY identity section repeats the same "KILN ACCOUNT" eyebrow — no per-section identity;
  (c) err text uses text-red-400 which does not exist in the compiled CSS (renders inherited color);
  (d) signed-out page gives no composed summary of what an account is (handle/address/balance live
  only in prose). Mobile 375: same content, no overflow, bottom bar present (Profile/Repos/Create/
  Activity/Wallet).
- /account signed-in: code-read inventory (chunk d() signed-in branch above). Direct blob-seeding
  the store does NOT survive boot in this harness (pre-boot and mutate-then-reload kiln-v2 blobs
  both come back wallet:null — a boot path resets an externally-planted wallet; the app's own
  Generate-wallet click is the only honest seed — probe running, see .scratch/genprobe.txt).
  DEFECTS (from code): form floats as a bare grid with no card grouping; header prose line mixes
  public link + repo count + Discord pitch in one breath; NO identity summary anywhere (address,
  joined, KLN balance never composed — balance = store.balance, joined = profile.joined); the
  identity panel then re-introduces itself with a second large header ("Your Kiln account",
  text-3xl) under "Your profile" (text-4xl) — stacked competing headers; Discord invite card sits
  between the profile form and the identity sections, splitting "who I am" from "my wallets".
- /auro desktop, signed-out: renders, 0 pageerrors. Avatar "au" (= handle.slice(0,2), lowercase,
  not initials), name auro, handle, fallback bio "Kiln account", "0 repositories · 0 stars",
  "No visible repositories." — the LOCAL origin's public API answered auro with repos:[] tonight
  (curl-verified, 16.5s cold) so the empty state is honest local data, not an app defect.
- /meridian desktop (bundle-seeded org profile, the rich case): avatar "Me" (lab.slice(0,2) —
  "Meridian Research" should initial as MR), name, lab seal line, handle, ORGANIZATION tag, long
  bio, highlight, FULL 42-char address break-all dominating the loose aside, company row,
  "Lisbon, Portugal · joined 2026", "2,210 followers · 61 following", "1 repositories · 1560 stars"
  as a plain text line, website + twitter links, Pinned card + repo rows render correctly.
  DEFECTS: aside is an ungrouped stack (no card), address block unframed, counts not composed as
  stats, repo descriptions unclamped, sidebar not sticky on desktop.
- Visual-language reference (Explore/Studio): eyebrow [11px] uppercase tracking-[0.2em] muted,
  font-display serif titles tracking-tight, seal for handles/links, cards rounded-xl border
  bg-surface p-5, chips for facts, mono for addresses. The profile surfaces mostly speak it —
  the wins are grouping, hierarchy, density, and composition, not a restyle.

## Build plan (presentation only; all bindings real)
- kiln-identity.js (house module, readable): section() gains a per-section eyebrow (new param,
  default "Kiln account" — call sites pass Sign in / New account / Account / Wallet / Backup /
  Import); err/note become bordered banners (err text-red-400 → text-red-500, the class that
  exists); panel header becomes a composed identity header — when signed in it shows initials
  avatar + display handle (mono seal) + email + real chips (N linked wallets · backup on file /
  no backup · this browser's wallet linked / not linked); signed-in "Signed in" section folds into
  that header (Sign out stays, same handler) so the duplicate summary section goes away; linked
  wallet rows get a two-line composition (address mono truncated by shortAddr as today + chip row).
  NO handler, crypto, session, or copy-of-substance changes; backup-offer card untouched except
  its err color class already uses text-red-400 in two status spots → text-red-500 (presentation).
- account-49nJUaQm.js (minified, class/text-structure-safe edits only, no new JSX bindings):
  signed-out frame max-w-lg py-12 text-center → max-w-2xl py-10 text-left, title text-3xl→text-4xl
  (aligns with panel width/alignment); signed-in: header gains a real summary strip (address mono
  truncated, joined, balance KLN, repo count — all from existing locals t/e/E + profile i) as
  chips row under the prose line [the one structural addition — uses only in-scope bindings
  u/jsx + t + i + e.balance, verified against the chunk's own JSX patterns]; form grid becomes a
  card (rounded-xl border bg-surface p-5 on the existing grid div); Save button row gains a
  "View public profile" link beside it (existing Link r + params pattern already used above).
- _owner-B3Oc7_zJ.js (minified, same discipline): aside gains card classes + lg:sticky lg:top-20
  self-start; avatar initials become word initials (pure string logic on existing locals, uppercase);
  address becomes a framed block (rounded-lg border bg-bg px-3 py-2, break-all kept); counts line
  ("N repositories · M stars") becomes a stats row with fg numbers (existing pattern from the
  followers line); Edit profile btn → btn-primary (it is the owner's primary action); repo row
  description gains line-clamp-2; repositories list rows py-3→py-4 for scan rhythm; followers
  line spacing aligned. Balance chip ONLY when viewer is the owner (r) — store balance is the
  viewer's, never shown on someone else's profile.
