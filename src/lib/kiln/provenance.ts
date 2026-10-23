import type { Repo } from "./types";
import chainSnapshot from "./chain.json" with { type: "json" };

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
 * Read from the committed src/lib/kiln/chain.json snapshot (vendored by
 * `npm run sync:kiln` from the KILN checkout's deployments/chain.json).
 * With no recorded deployment, no repo is verifiably anchored and the UI
 * reports "not anchored" — never a placeholder address. When a deployment is
 * recorded, the registry covers every project in the registry, so repos are
 * anchored at that address.
 */
export type ChainDeployment = {
  address: string;
  network?: string;
  chainId?: number;
  txHash?: string;
  deployedAt?: string;
};

export type ChainSnapshot = {
  schema?: string;
  deployments: Record<string, ChainDeployment> | ChainDeployment[];
};

function isPlausibleAddress(address: unknown): address is string {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Recorded deployments as [network, deployment] pairs; tolerates object or array shapes. */
export function recordedDeployments(snapshot: ChainSnapshot = chainSnapshot): [string, ChainDeployment][] {
  const d = snapshot.deployments;
  const entries: [string, ChainDeployment][] = Array.isArray(d)
    ? d.map((dep, i) => [dep.network ?? `deployment-${i}`, dep])
    : Object.entries(d ?? {});
  return entries.filter(([, dep]) => dep && isPlausibleAddress(dep.address));
}

export function chainState(
  _repo: Repo,
  snapshot: ChainSnapshot = chainSnapshot
): { anchored: false } | { anchored: true; address: string; network: string } {
  const [first] = recordedDeployments(snapshot);
  if (!first) return { anchored: false };
  const [network, dep] = first;
  return { anchored: true, address: dep.address, network };
}

/** What the UI shows where a chain address would go. */
export function displayChain(repo: Repo, snapshot: ChainSnapshot = chainSnapshot): string {
  const s = chainState(repo, snapshot);
  return s.anchored ? `${s.address.slice(0, 10)}…` : "not anchored";
}
