/**
 * Reserved owner names — top-level static routes that must never be treated
 * as usernames by the `/$owner` dynamic route.
 *
 * Without this guard, visiting /signin or /settings renders a fabricated
 * profile for a user named "signin"/"settings" instead of the real account
 * flow (see src/lib/kiln/store.ts `profileOf`, which synthesizes a profile
 * for any unknown handle).
 *
 * Keep in sync with the static route files directly under src/routes/.
 * `reserved.test.ts` fails if a new top-level static route is added without
 * updating this set.
 */
export const RESERVED_OWNER_NAMES: ReadonlySet<string> = new Set([
  "account",
  "apps",
  "architecture",
  "assistants",
  "cli",
  "cloud",
  "explore",
  "fleet",
  "gists",
  "gpu",
  "issues",
  "login",
  "marketplace",
  "mcp",
  "models",
  "new",
  "notifications",
  "orgs",
  "papers",
  "pricing",
  "pulls",
  "search",
  "settings",
  "shipaton",
  "signin",
  "stars",
  "start",
  "studio",
  "swarm",
  "topics",
  "trending",
  "wallet",
]);

/** True when `handle` collides with a reserved top-level route segment. */
export function isReservedOwnerName(handle: string): boolean {
  return RESERVED_OWNER_NAMES.has(handle.toLowerCase());
}

/**
 * Identity evidence for `isKnownOwnerName`, kept as plain data so this module
 * stays a dependency-free leaf (importable under plain node --test).
 */
export interface KnownOwnerInfo {
  /** Lowercase handles of seeded profiles. */
  seedHandles: string[];
  /** Lowercase owner names of known repositories (seed + user-created). */
  repoOwners: string[];
  /** Lowercase connected wallet handle, if any. */
  walletHandle: string | null;
}

/**
 * True when `handle` identifies a real forge identity rather than an arbitrary
 * string. Anything else must NOT render as a profile — `/$owner/` shows the
 * not-found page instead (a fabricated "A kiln member." identity is not honest).
 */
export function isKnownOwnerName(handle: string, known: KnownOwnerInfo): boolean {
  const lower = handle.toLowerCase();
  if (known.seedHandles.includes(lower)) return true;
  if (known.repoOwners.includes(lower)) return true;
  if (known.walletHandle !== null && known.walletHandle === lower) return true;
  return false;
}
