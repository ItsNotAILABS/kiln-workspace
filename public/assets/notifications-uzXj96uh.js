// /notifications — the Inbox. Rebuilt in the design round (Piece 4b):
// the flat notice list that lived here is now the grouped KilnInbox in
// kiln-inbox.js (Needs attention / Activity / System over the store's
// notices, the forge activity mirror, and the account's chain
// transactions — real feeds only). This chunk keeps the route's
// `component` export and delegates, the kiln-receipt pattern.
import { KilnInbox } from "./kiln-inbox.js";
const component = KilnInbox;
export { component };
