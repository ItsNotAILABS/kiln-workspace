# Pickup — KILN workspace 2026-09-04

True shared git is **on**. Custom domain is **not**. Live site stays grok.me.

## Map

| What | Where |
|------|--------|
| Live preview | https://kiln-git.grok.me/ |
| GitHub | https://github.com/ItsNotAILABS/kiln-workspace |
| Grok lane | `E:\KILN` · branch `grok/work` |
| Codex lane | `E:\workspaces\kiln-codex` · branch `codex/work` |
| Merge / deploy | `main` only |
| Foundry L1 | `E:\repos\KILN` · ItsNotAILABS/KILN |
| Domain later | `kiln.medinatechlabs.net` — see `docs/DOMAIN.md`. Do not change DNS. |

## Codex (yesterday's machine)

```powershell
cd E:\workspaces\kiln-codex
git fetch origin
git checkout codex/work
git pull --rebase origin codex/work
npm install
npm run dev
```

Do **not** edit `E:\KILN` from Codex. That tree is Grok's lane.

## Grok (this session)

```powershell
cd E:\KILN
git checkout grok/work
git pull --rebase origin grok/work
npm run dev
```

Dev server: `0.0.0.0:8080`. Do not steal `pocket.medinatechlabs.net`.

## Merge rule

1. Finish work on your lane.
2. `npm test` and `npm run typecheck` if they exist.
3. PR or merge into `main`. Never force-push `main`.
4. Other agent: `git fetch` then rebase their lane on `main`.

## Yesterday leftover (not git)

- `E:\KILN\recovery-before-codex-20260903-094935\` (gitignored)
- `E:\KILN\recovered\` pretty-printed blobs (gitignored)

Pocket seed: `src/lib/kiln/seed.ts` → `itsnotailabs/pocket` (Desktop/Edge `/desk` auto-splits two agents; Spark + Crew stay in-window), `itsnotailabs/pocket-mailbox`, `itsnotailabs/kiln-workspace`.

---

# Pickup — KILN workspace 2026-09-10 (Auro lane, Linux VM)

## Map

| What | Where |
|------|--------|
| Working tree | `~/workspace/repos/kiln-workspace` · branch `codex/work` (agent lane) |
| Registry repo | `~/workspace/repos/KILN` · ItsNotAILABS/KILN |
| Merge / deploy | `main` only — never force-push |
| Live preview | https://kiln-git.grok.me/ (HTTP 200 on 2026-09-10) |
| Domain | `kiln.medinatechlabs.net` — not pointed yet, do not change DNS |

## Session: honesty + live-data pass (in progress, uncommitted)

Fixture repos no longer masquerade as live data:
- `src/lib/kiln/provenance.ts` (new) — `isFixtureRepo`, `LiveRepoStats`, `displayStars/displayForks`.
- `src/lib/kiln/use-live-stats.ts` (new) — shared batch fetch via `githubRepoStatsBatch`.
- `src/lib/kiln/github.ts` — added `githubRepoStatsBatch` server fn; fixed a swapped-export mistake (githubImport/studioGenerate were transposed — repaired and verified).
- `src/routes/explore.tsx` — real repos sorted by live stars with a "live" badge; fixtures moved under a "Demo fixtures" section, no star counts shown.
- `src/components/RepoChrome.tsx` — repo header + About panel use live stats; fixtures show a "demo fixture" badge.
- `src/routes/models.tsx` — rebuilt from the seed's actual modelIds (no invented entries).
- `src/routes/wallet.tsx` — faucet labeled demo.
- `src/lib/kiln/seed.ts` — added `freddycreates/sovereign-engine` (real GitHub stats baked in as the dated fallback: 0★ / 1 fork / Python / pushed 2026-09-04); added missing `modelId` to the five 2026-09-09 seed entries (was a latent typecheck failure).

New surfaces:
- `/fleet` (`src/routes/fleet.tsx`, `src/lib/kiln/fleet.ts`) — live probes of the port map 8080/8081/8082/8084/8787, 15s refresh, POCKET-down ASAP banner. Probes run from the serving machine.
- `/shipaton` (`src/routes/shipaton.tsx`) — September 29 2026 countdown + readiness checklist for the Sovereign Books substrate; banner in the sovereign-engine repo About panel.

Tests (all in `npm test` now):
- `src/lib/kiln/merkle.test.ts`, `crypto.test.ts`, `provenance.test.ts` — 28 tests, green (incl. chain-anchoring: nothing is "anchored" until a registry deployment is recorded).

Honesty fixes (2026-09-10, second pass):
- Repo headers showed fake truncated chain addresses (`0x4c1e7a91…`). Now show "not anchored" via `chainState()`/`displayChain()` in `provenance.ts` — flip that one function when the KilnOwnershipRegistry deploys.
- `freddycreates/sovereign` seed was wrong (TypeScript/MIT). Measured the local clone: 38% Motoko / 59% TS+TSX, SAPL-1.0. Seed corrected with a legal-triage note.
- `/models` copy now says a bound id is a label, not a trained checkpoint.

Build fix (2026-09-10):
- `npm run build` failed on `server/middleware/zz-kiln-original.ts` importing `../../public/freeze/index.html?raw` — that file is an untracked local artifact (never in git; exists only on machines that sealed the freeze). The middleware now loads it via `import.meta.glob(..., { eager: true })` so the build succeeds with or without it; `/freeze` serves the snapshot when present, 404s when absent. No behavior change where the file exists. Build is green in this clone.

## Quality gates (run before any push)

```
npm run typecheck   # must show no errors under src/
npm test            # 179 pass / 16 fail on pristine main too (pre-existing: scripts/* platform-chrome tests need .grok/ paths absent from this Linux clone)
npm run build
```

Push rule (user): KILN pushes allowed only if nothing breaks.

## Service port map

8080 forge · 8081 CapsulaBuilder · 8082 Sovereign Engine · 8084 NeurospaceAI · 8787 POCKET (down = ASAP).
