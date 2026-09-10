import type { Repo } from "./types";

/**
 * Provenance: which repos are real GitHub projects and which are demo fixtures.
 *
 * The forge ships demo fixtures so the UI is explorable offline, but their
 * stars/forks are sample data. They must never be presented as live GitHub
 * numbers. Real repos (everything not listed here) resolve live stats through
 * the GitHub bridge; the seed's static numbers are only an offline fallback.
 */
export const FIXTURE_OWNERS: ReadonlySet<string> = new Set([
  "kiln-labs",
  "meridian",
  "atlas",
  "harbor",
  "northwind",
  "lumen",
]);

export function isFixtureRepo(repo: Pick<Repo, "owner">): boolean {
  return FIXTURE_OWNERS.has(repo.owner.toLowerCase());
}

export type LiveRepoStats = {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  description: string;
  language: string;
  topics: string[];
  license: string;
  pushedAt: string;
  defaultBranch: string;
  fetchedAt: string;
};

/** Display stats: live when available, otherwise the seed fallback. */
export function displayStars(repo: Repo, live: LiveRepoStats | undefined): number {
  return live?.stars ?? repo.stars;
}

export function displayForks(repo: Repo, live: LiveRepoStats | undefined): number {
  return live?.forks ?? repo.forks;
}

/**
 * On-chain anchoring state.
 *
 * The KilnOwnershipRegistry has no recorded deployment yet, so no repo is
 * verifiably anchored. Seed `chainAddress` values are placeholders and must
 * never be presented as real. When a deployment exists, return
 * `{ anchored: true, address }` for the repos it covers.
 */
export function chainState(_repo: Repo): { anchored: false } | { anchored: true; address: string } {
  return { anchored: false };
}

/** What the UI shows where a chain address would go. */
export function displayChain(repo: Repo): string {
  const s = chainState(repo);
  return s.anchored ? `${s.address.slice(0, 10)}…` : "not anchored";
}
