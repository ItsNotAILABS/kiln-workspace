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
