# Round 2 — Piece 3: Wallet becomes the Vault — checkpoint notes

Worktree: ~/workspace/.worktrees/kiln-round2-vault · branch round2-vault off
improve/ws-system-ui @ ee78c97. NO deploy, main tree untouched; coordinator lands.

## Step 0 — inventory (done)

### Current /wallet IA (wallet-CTr0sTgn.js, component `h`)
- Signed in: h1 = wallet handle (not "Wallet"); address line; stat grids
  (Balance = store balance (main), Repositories, Agent wallets count, Model
  wallets count; then Agent total `z`, Model total `j`, All wallets
  `e.balance+z+j`); GitHub-link form; actions (Copy address, Reveal secret,
  Claim 2,500 KLN, Disconnect, Switch wallet → AppShell modal `r`); secret reveal.
- "Your repositories" list (allRepos selector `d` in store lettering).
- "Agent wallets": description, ONE search input (state `w`) that filters agent
  AND model lists; each agent row: name · role, address · repoId · modelId,
  balance `wallet.balance`, Details → closure `L(addr, bal)`.
- "Model wallets": rows with ledger-derived balance `W(addr)` (net of allTxs
  touching the address, null when no txs → shows 0 via `?? 0` in format call
  `c(e.ledgerBalance??0)`); Details → same `L`; models without a wallet show a
  "No wallet yet" chip + **Mint wallet** button → `state.upsertConnection(t)`.
- `L(addr, bal)` (Details): address + Copy (toast via sonner `n`), transfer
  controls **Fund from main / Sweep to main** only (hub rules: from=main→addr
  or addr→main; NO agent↔agent / model↔model), amount input, Confirm validates
  `amt>0`, `amt<=avail` (fund avail = main `e.balance`; sweep avail = `bal`),
  calls `globalThis.__KILN_TRANSFER({fromAddress,toAddress,amount,memo})`;
  buttons disabled when `__KILN_TRANSFER` is not a function. Then last-20 txs
  for that address (`q(addr).slice(0,20)`), "No settlements yet." when empty.
- "Settled activity": main wallet's last-20 txs (`b`). Switch modal at end.
- Signed out: h1 `Wallet`, blurb, AppShell `a` (Connect gate component).
- Data: store selectors — allTxs `p`, allRepos `d`, formatKln `G`, useStore `b`
  (store-sx46DNi5.js lettering, per design-round notes). Balances are exactly:
  main = `state.balance`, agent = `agent.wallet.balance`, model = ledger net.
  NO math may change; Vault total = the existing `e.balance+z+j` sum verbatim.

### Agent ledger — where it lives
- The agent ledger is the /chain page's second section (chain-BeGhQWqf.js):
  actor map (wallet→you, agents→agent, modelConnections→model, else system),
  kind filters [all, agent, model, you, system], text search over
  memo/type/repoId/actor label/hash/from/to, rows link to /chain/$id,
  Show more (25 → +50). To make it + its filters reachable INSIDE the Vault,
  the Vault embeds the same ledger (same selectors, same actor mapping, same
  filter set + search, read-only presentation) as its own section.

### Receipt wiring — NOT landed in main tree
- Main tree @ ee78c97: wallet chunk has NO /chain links (checked).
- Completeness worktree ~/workspace/.worktrees/kiln-wallet-receipt
  (branch wallet-receipt-links) HAS it: commit af8f0bd adds module-scope
  TxReceiptRow to wallet-CTr0sTgn.js, wiring both tx-row sites. Its parent
  chain diverges at 9c9f413, which IS an ancestor of this branch, and the
  wallet file is byte-identical between 9c9f413 and ee78c97 → cherry-pick
  af8f0bd is clean. Plan: cherry-pick it (inherited wiring, credited), then
  carry TxReceiptRow's exact idiom into kiln-vault.js (Link to /chain/$id,
  className `block hover:bg-surface`, no-hash rows unwrapped).

### Build shape (house pattern, notifications precedent)
- NEW readable house module `public/assets/kiln-vault.js` exporting
  `KilnVault` — ALL components at module scope (React #130 lesson: no
  component construction inside another component's scope; the old chunk's
  `L` closure + shadowed bindings are exactly the trap family).
- `wallet-CTr0sTgn.js` becomes a thin delegate shim keeping the route's
  `component` export (same as notifications-uzXj96uh.js → kiln-inbox.js).
- React via the kiln-inbox idiom: `i as reactNs, t as React` from
  react-SIfiwpqq.js, `reactNs(React(), 1)` → useState; jsx runtime `t` from
  jsx-runtime-0vZSBttN.js; toast `n` from dist-gk9u-W-R.js (sonner);
  Link `t` from link-BhiAFiqq.js; hash shortener `E` from fs-ri9Mkfbm.js;
  AppShell `a` = Connect gate, `r` = switch/connect modal.
- Classes: only tokens present in styles-A_fIl0Ci.css (audit after build) —
  reuse the exact class strings the wallet/chain chunks already use.

### Vault IA (after)
1. Header: h1 **Vault**; line: handle + "· main wallet is the transfer hub";
   Vault total card = `balance+z+j` (same sum) + breakdown cards
   (Main wallet balance / Agent total / Model total) + counts row
   (Repositories / Agent wallets / Model wallets) — all figures reused.
2. **Main wallet** card: chip "Transfer hub", address + Copy address,
   balance, actions (Copy / Reveal secret / Claim faucet / Disconnect /
   Switch wallet), secret reveal, GitHub-link form, Settled activity
   (last-20, receipt rows) inside the card.
3. **Agent wallets** section: existing description + the shared wallet
   search; each wallet a row/card with Details (address+copy, Fund/Sweep
   hub transfers, last-20 receipt rows). Honest empty notes preserved.
4. **Model wallets** section: same; no-wallet models keep Mint wallet
   (real upsertConnection). Honest empty notes preserved.
5. **Agent ledger** section: kind filter buttons + search + receipt-linked
   rows + Show more (chain idiom, embedded).
6. **Your repositories** section: preserved as-is.
7. Signed out: h1 **Vault**, vault blurb, Connect gate.

### Rename (surface name only; route stays /wallet)
- wallet page headings → Vault (in kiln-vault.js).
- AppShell-H-m5HQPd.js bottom bar: [`/wallet`, icon, `Wallet`] → `Vault`.
- AppShell ⌘K palette item {id:`wallet`, label:`Wallet`, href:`/wallet`} → `Vault`.
- kiln-repos.js repos-hub Link to /wallet labeled `Wallet` → `Vault`.
- NOT renamed: the Connect dialog eyebrow "Wallet" (it is the wallet-connect
  dialog used app-wide, not this surface's name), marketplace "Wallet faucet"
  (names the faucet, links here for it), store/identity "wallet" concepts
  (the wallets inside the Vault keep their name — that is the point).

## Steps
- [x] 0 Inventory + this file
- [ ] 1 Cherry-pick receipt wiring af8f0bd
- [ ] 2 kiln-vault.js + wallet delegate shim
- [ ] 3 Renames (AppShell ×2, kiln-repos ×1)
- [ ] 4 Gates: node --check, class audit, load sim, cold renders /wallet +
  / desktop + 375px 0 pageerrors, seeded click probes (Details, transfers,
  Mint, ledger filters, receipt click-through, bottom-bar label)
