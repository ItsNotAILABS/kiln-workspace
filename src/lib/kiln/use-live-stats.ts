import { useEffect, useMemo, useState } from "react";
import { githubRepoStatsBatch } from "./github";
import { isFixtureRepo, type LiveRepoStats } from "./provenance";
import { allRepos, useKiln } from "./store";
import type { Repo } from "./types";

type Target = { id: string; owner: string; repo: string };

/** Module-level cache so every component on the page shares one batch fetch. */
const fetchCache = new Map<string, Promise<Map<string, LiveRepoStats>>>();

function cacheKey(targets: Target[]): string {
  return targets.map((t) => `${t.owner}/${t.repo}`.toLowerCase()).sort().join(",");
}

function fetchBatch(targets: Target[]): Promise<Map<string, LiveRepoStats>> {
  const key = cacheKey(targets);
  const hit = fetchCache.get(key);
  if (hit) return hit;
  const p = githubRepoStatsBatch({ data: { repos: targets } })
    .then((res) => {
      const byId = new Map<string, LiveRepoStats>();
      if (res.ok) {
        for (const t of targets) {
          const s = res.stats[`${t.owner}/${t.repo}`.toLowerCase()];
          if (s) byId.set(t.id, s);
        }
      }
      return byId;
    })
    .catch(() => new Map<string, LiveRepoStats>());
  fetchCache.set(key, p);
  return p;
}

/**
 * Live GitHub stats for the forge's real repos.
 *
 * Fetches once per page-load for every non-fixture repo that carries a
 * githubOwner/githubRepo pointer, then overlays the live numbers on the
 * seed's static fallback. Fixtures are never fetched — their numbers are
 * sample data and stay clearly labeled as demo.
 */
export function useLiveRepoStats(): Map<string, LiveRepoStats> {
  const extraRepos = useKiln((s) => s.extraRepos);
  const [stats, setStats] = useState<Map<string, LiveRepoStats>>(new Map());

  const targets = useMemo<Target[]>(() => {
    const seen = new Set<string>();
    const out: Target[] = [];
    for (const r of allRepos({ extraRepos })) {
      if (isFixtureRepo(r)) continue;
      const owner = r.githubOwner || r.owner;
      const repo = r.githubRepo || r.name;
      const key = `${owner}/${repo}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: r.id, owner, repo });
    }
    return out;
  }, [extraRepos]);

  useEffect(() => {
    if (targets.length === 0) return;
    let cancelled = false;
    fetchBatch(targets).then((byId) => {
      if (!cancelled) setStats(byId);
    });
    return () => {
      cancelled = true;
    };
  }, [targets]);

  return stats;
}

/** Live stats for a single repo, if it is real and the fetch landed. */
export function liveStatsFor(repo: Repo, stats: Map<string, LiveRepoStats>): LiveRepoStats | undefined {
  if (isFixtureRepo(repo)) return undefined;
  return stats.get(repo.id);
}
