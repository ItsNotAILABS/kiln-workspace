# KILN forge go-live checklist

For pointing `kiln.medinatechlabs.net` at the forge. Do not start until every box is checked.

## Code health

- [x] `npm run typecheck` — no errors under `src/` (2026-09-10)
- [x] `npm test` — no new failures vs pristine main (2026-09-10: 179 pass, 16 pre-existing script-env failures)
- [ ] `npm run build` — clean production build
- [ ] Dev smoke on :8080 (desktop + mobile viewports)
- [ ] Production-preview smoke

## Honest data

- [x] No fixture repo presents fabricated numbers as live (demo badges + separated section, 2026-09-10)
- [x] Explore sorts real repos by live GitHub stars with fallback
- [x] Repo header + About panel show live stats with provenance
- [ ] Registry (`KILN/projects/registry.json`) is the canonical project list — seed sync scripted (`scripts/sync-registry.mjs`), verify on a registry change
- [ ] Chain addresses: only verified on-chain values shown; everything else reads "not deployed" (still shows placeholder `0x1a1b…` values — needs a real KilnOwnershipRegistry deployment)

## Chain

- [ ] `KilnOwnershipRegistry` deployed to testnet, address recorded
- [ ] Commit anchoring + Merkle verification + receipts surfaced on repo pages
- [ ] Capability grant/revoke/expiry UI backed by real contract reads

## Operations

- [x] `/fleet` page probes 8080/8081/8082/8084/8787 with POCKET-down ASAP banner (2026-09-10)
- [ ] POCKET keep-alive/watchers verified against the fleet page
- [ ] Grok preview/PWA integration intact (do not remove)

## Shipaton (September 29, 2026)

- [x] `/shipaton` countdown + readiness checklist live (2026-09-10)
- [ ] Sovereign Books substrate demo path rehearsed

## DNS (last)

- [ ] All of the above green
- [ ] User approves the cutover
- [ ] Point `kiln.medinatechlabs.net` per `docs/DOMAIN.md`
- [ ] Verify TLS + preview parity after the switch
