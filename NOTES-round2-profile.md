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
- [ ] 1 Inventory both surfaces cold + class audit
- [ ] 2 Build: kiln-identity.js presentation pass
- [ ] 3 Build: account chunk surgical pass
- [ ] 4 Build: _owner chunk surgical pass
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

## Inventory (cold, BEFORE) — filled by render gate below
TBD
