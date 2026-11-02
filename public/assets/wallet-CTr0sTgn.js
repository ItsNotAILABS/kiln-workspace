// /wallet — the Vault. Restructured in Round 2 (Piece 3): the surface is
// now a vault that contains the wallets — a vault header with the total
// across all wallets, the main wallet (the transfer hub) as a card, agent
// wallets and model wallets each with Details, the agent ledger with its
// filters, and the repositories section. The implementation lives in
// kiln-vault.js (readable house module, module-scope components); this
// chunk keeps the route's `component` export and delegates, the
// kiln-receipt / kiln-inbox pattern. Route stays /wallet.
import { KilnVault } from "./kiln-vault.js";
const component = KilnVault;
export { component };
