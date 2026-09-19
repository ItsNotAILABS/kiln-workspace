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
