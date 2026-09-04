# KILN true workspace

This folder (`E:\KILN`) is the **live forge app** (TanStack Start, port **8080**).
It is **not** the Foundry L1 repo.

| Tree | Role |
|------|------|
| **This repo** `ItsNotAILABS/kiln-workspace` | Live site source. Grok Build + Codex share it via git. |
| `ItsNotAILABS/KILN` (`E:\repos\KILN`) | L1 ownership contracts + **project registry** |
| https://kiln-git.grok.me/ | Current live preview (Grok Build) |
| **Your domain (later)** | `kiln.medinatechlabs.net` — Cloudflare tunnel after this workspace is stable. Do not point DNS until `main` deploys cleanly. |

## Why this exists

Codex worked here **yesterday** (`recovery-before-codex-20260903-094935/`, not in git).
Grok Build works here **today**. Without git they overwrite each other.

## Agent lanes (do not share a dirty working tree)

| Agent | Path | Branch |
|-------|------|--------|
| **Grok Build / Grok CLI** | `E:\KILN` | `grok/work` (merge to `main`) |
| **Codex** | `E:\workspaces\kiln-codex` | `codex/work` (merge to `main`) |
| **Deploy / domain** | only `main` | never commit deploy secrets |

```powershell
# Codex machine / session
cd E:\workspaces\kiln-codex
git fetch origin
git checkout codex/work
git pull --rebase origin codex/work

# Grok
cd E:\KILN
git checkout grok/work
git pull --rebase origin grok/work
```

Merge to `main` only when checks pass: `npm test` · `npm run typecheck`.

## Pickup

1. Read this file.
2. `git status` — if dirty, commit on **your** lane, do not switch branches dirty.
3. Live app: `npm run dev` → `0.0.0.0:8080`.
4. Pocket is already in `src/lib/kiln/seed.ts` as `itsnotailabs/pocket`.
5. Domain: see `docs/DOMAIN.md` — **not now**.

## Related

Pocket parked: `OneDrive/pocket-os/docs/PICKUP.md`.
Sovereign Engine: `E:\repos\sovereign-engine`.
PhoneAI: Pocket `/phoneai/app`.
