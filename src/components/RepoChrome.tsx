import { useMemo, useState } from "react";
import { Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Copy, Eye, File as FileIcon, Folder, GitFork, Lock, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { cn, formatAgo, formatKln } from "@/lib/utils";
import {
  allIssues,
  allPulls,
  allRepos,
  cloneCli,
  cloneGit,
  cloneHttps,
  entriesAt,
  findRepo,
  kilnHost,
  useKiln,
} from "@/lib/kiln/store";
import { LANG_COLOR } from "@/lib/kiln/types";
import { Markdown } from "@/components/Markdown";
import type { RepoFile } from "@/lib/kiln/types";
import { isFixtureRepo, displayStars, displayForks, displayChain } from "@/lib/kiln/provenance";
import { useLiveRepoStats, liveStatsFor } from "@/lib/kiln/use-live-stats";

export function RepoLayout() {
  const { owner, repo: name } = useParams({ strict: false }) as { owner: string; repo: string };
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) {
    return <p className="py-16 text-center text-muted">No public tree with that name.</p>;
  }
  return (
    <div>
      <RepoHeader repoId={repo.id} />
      <Outlet />
    </div>
  );
}

export function RepoHeader({ repoId }: { repoId: string }) {
  const kiln = useKiln();
  const repo = allRepos(kiln).find((r) => r.id === repoId);
  const live = useLiveRepoStats();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [clone, setClone] = useState<"git" | "https" | "cli">("git");
  if (!repo) return null;
  const fixture = isFixtureRepo(repo);
  const stats = liveStatsFor(repo, live);
  const stars = fixture ? null : displayStars(repo, stats) + (kiln.stars[repo.id] ? 1 : 0);
  const forks = fixture ? null : displayForks(repo, stats) + (kiln.forksOf.includes(repo.id) ? 1 : 0);
  const watchers = fixture ? null : (stats?.watchers ?? repo.watchers) + (kiln.watches[repo.id] ? 1 : 0);
  const issues = allIssues(kiln).filter((i) => i.repoId === repo.id && i.state === "open").length;
  const pulls = allPulls(kiln).filter((p) => p.repoId === repo.id && p.state === "open").length;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const cmd = clone === "https" ? cloneHttps(repo.owner, repo.name, origin) : clone === "cli" ? cloneCli(repo.owner, repo.name) : cloneGit(repo.owner, repo.name);
  const host = kiln.domains.find((d) => d.repoId === repo.id)?.host ?? kilnHost(repo.owner, repo.name);
  const s = `/${repo.owner}/${repo.name}`;
  const tabs = [
    { to: s, label: "Code", match: pathname === s || pathname.includes("/blob/") || pathname.includes("/edit/") || pathname.includes("/tree/") || pathname.includes("/blame/") || pathname.includes("/create") || pathname.includes("/compare") || pathname.includes("/branches") || pathname.includes("/tags") || pathname.includes("/forks") || pathname.includes("/stargazers") || pathname.includes("/watchers") },
    { to: `${s}/computer`, label: "Computer", match: pathname.includes("/computer") },
    { to: `${s}/world`, label: "4D", match: pathname.includes("/world") },
    { to: `${s}/preview`, label: "Preview", match: pathname.includes("/preview") || pathname.includes("/deployments") },
    { to: `${s}/projects`, label: "Projects", match: pathname.includes("/projects") },
    { to: `${s}/issues`, label: "Issues", extra: issues, match: pathname.includes("/issues") || pathname.includes("/labels") || pathname.includes("/milestones") },
    { to: `${s}/pulls`, label: "Pull requests", extra: pulls, match: pathname.includes("/pulls") },
    { to: `${s}/discussions`, label: "Discussions", match: pathname.includes("/discussions") },
    { to: `${s}/actions`, label: "Actions", match: pathname.includes("/actions") },
    { to: `${s}/commits`, label: "Commits", match: pathname.includes("/commits") },
    { to: `${s}/releases`, label: "Releases", match: pathname.includes("/releases") },
    { to: `${s}/wiki`, label: "Wiki", match: pathname.includes("/wiki") },
    { to: `${s}/packages`, label: "Packages", match: pathname.includes("/packages") },
    { to: `${s}/insights`, label: "Insights", match: pathname.includes("/insights") || pathname.includes("/network") || pathname.includes("/community") },
    { to: `${s}/security`, label: "Security", match: pathname.includes("/security") },
    { to: `${s}/settings`, label: "Settings", match: pathname.includes("/settings") },
  ];
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold tracking-tight">
            {repo.visibility === "private" ? <Lock className="size-4 text-muted" /> : null}
            <Link to="/$owner" params={{ owner: repo.owner }} search={{ tab: "overview" }} className="text-seal hover:underline">
              {repo.owner}
            </Link>
            <span className="text-subtle">/</span>
            <Link to="/$owner/$repo" params={{ owner: repo.owner, repo: repo.name }} className="text-fg hover:underline">
              {repo.name}
            </Link>
            <span className="chip capitalize">{repo.visibility}</span>
            {repo.encrypted ? <span className="chip">sealed</span> : null}
            {repo.archived ? <span className="chip">archived</span> : null}
            {fixture ? (
              <span className="chip border-dashed text-subtle" title="Demo fixture — sample data for exploring the forge, not a real repository">
                demo fixture
              </span>
            ) : stats ? (
              <span className="flex items-center gap-1 text-[11px] font-normal text-seal" title={`Live from GitHub · fetched ${new Date(stats.fetchedAt).toLocaleDateString()}`}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-seal" />
                live from GitHub
              </span>
            ) : null}
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted">{stats?.description || repo.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn h-8" onClick={() => kiln.watchRepo(repo.id)}>
            <Eye className={cn("size-3.5", kiln.watches[repo.id] && "text-seal")} />
            {kiln.watches[repo.id] ? "Unwatch" : "Watch"}
            {watchers !== null ? <span className="tabular-nums text-muted">{watchers}</span> : null}
          </button>
          <button
            type="button"
            className="btn h-8"
            onClick={() => {
              const f = kiln.fork(repo.id);
              if (f) window.location.assign(`/${f.owner}/${f.name}`);
            }}
          >
            <GitFork className="size-3.5" />
            Fork
            {forks !== null ? <span className="tabular-nums text-muted">{forks}</span> : null}
          </button>
          <button type="button" className="btn h-8" onClick={() => kiln.star(repo.id)}>
            <Star className={cn("size-3.5", kiln.stars[repo.id] && "fill-fg")} />
            Star
            {stars !== null ? <span className="tabular-nums text-muted">{stars}</span> : null}
          </button>
          <button type="button" className="btn h-8" onClick={() => kiln.sponsor(repo.id, 50)}>
            Sponsor
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        {fixture ? (
          <span className="text-subtle">sample data — star, fork and watcher counts are illustrative</span>
        ) : (
          <>
            <Link to="/$owner/$repo/stargazers" params={{ owner: repo.owner, repo: repo.name }} className="hover:text-fg">
              {stars} stars
            </Link>
            <Link to="/$owner/$repo/forks" params={{ owner: repo.owner, repo: repo.name }} className="hover:text-fg">
              {forks} forks
            </Link>
          </>
        )}
        <span className="tabular-nums">{formatKln(repo.tvlKln)} locked</span>
        <span className="font-mono" title="No KilnOwnershipRegistry deployment recorded — this repo is not anchored on-chain">{displayChain(repo)}</span>
        <Link to="/$owner/$repo/preview" params={{ owner: repo.owner, repo: repo.name }} className="font-mono text-seal hover:underline">
          {host}
        </Link>
        <span>Updated {formatAgo(repo.updatedAt)}</span>
      </div>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={cn("relative shrink-0 px-3 py-2 text-sm text-muted hover:text-fg", t.match && "text-fg")}>
            {t.label}
            {t.extra ? <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums">{t.extra}</span> : null}
            {t.match ? <span className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" /> : null}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-sm border border-border text-[11px]">
          {(["git", "https", "cli"] as const).map((k) => (
            <button key={k} type="button" className={cn("px-2 py-1 uppercase tracking-wide", clone === k ? "bg-surface text-fg" : "text-muted")} onClick={() => setClone(k)}>
              {k === "cli" ? "Kiln CLI" : k === "https" ? "HTTPS" : "Git"}
            </button>
          ))}
        </div>
        <code className="rounded-sm border border-border bg-surface px-2 py-1 font-mono text-[12px]">{cmd}</code>
        <button
          type="button"
          className="btn h-8 px-2"
          aria-label="Copy clone command"
          onClick={() => {
            navigator.clipboard.writeText(cmd);
            toast("Copied git clone");
          }}
        >
          <Copy className="size-3.5" />
        </button>
        <span className="chip">{repo.modelId}</span>
        {repo.topics.slice(0, 5).map((t) => (
          <Link key={t} to="/topics/$slug" params={{ slug: t }} className="chip hover:border-seal">
            {t}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PathCrumbs({ owner, name, dir }: { owner: string; name: string; dir?: string }) {
  const parts = (dir || "").split("/").filter(Boolean);
  return (
    <p className="flex flex-wrap items-center gap-1 font-mono text-sm">
      <Link to="/$owner/$repo" params={{ owner, repo: name }} className="text-seal hover:underline">
        {name}
      </Link>
      {parts.map((p, i) => {
        const path = parts.slice(0, i + 1).join("/");
        return (
          <span key={path} className="inline-flex items-center gap-1">
            <ChevronRight className="size-3 text-subtle" />
            <Link to="/$owner/$repo/tree/$" params={{ owner, repo: name, _splat: path }} className="hover:text-seal hover:underline">
              {p}
            </Link>
          </span>
        );
      })}
    </p>
  );
}

export function FileTree({
  files,
  owner,
  name,
  current,
  dir = "",
}: {
  files: RepoFile[];
  owner: string;
  name: string;
  current?: string;
  dir?: string;
}) {
  const { folders, files: at } = useMemo(() => entriesAt(files, dir), [files, dir]);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2 text-xs text-muted">
        <PathCrumbs owner={owner} name={name} dir={dir} />
        <span>{folders.length + at.length} entries</span>
      </div>
      <ul>
        {dir ? (
          <li className="border-b border-border px-3 py-2 text-sm">
            <Link
              to={dir.includes("/") ? "/$owner/$repo/tree/$" : "/$owner/$repo"}
              params={dir.includes("/") ? { owner, repo: name, _splat: dir.split("/").slice(0, -1).join("/") } : { owner, repo: name }}
              className="inline-flex items-center gap-2 text-muted hover:text-fg"
            >
              <Folder className="size-3.5" />
              ..
            </Link>
          </li>
        ) : null}
        {folders.map((f) => {
          const path = dir ? `${dir}/${f}` : f;
          return (
            <li key={path} className="flex items-center gap-3 border-b border-border px-3 py-2 text-sm hover:bg-surface/60">
              <Folder className="size-3.5 shrink-0 text-seal" />
              <Link to="/$owner/$repo/tree/$" params={{ owner, repo: name, _splat: path }} className="min-w-0 flex-1 truncate font-mono text-[13px] hover:text-seal hover:underline">
                {f}
              </Link>
            </li>
          );
        })}
        {at.map((f) => (
          <li key={f.path} className={cn("flex items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-0 hover:bg-surface/60", current === f.path && "bg-surface")}>
            <FileIcon className="size-3.5 shrink-0 text-muted" />
            <Link
              to="/$owner/$repo/blob/$"
              params={{ owner, repo: name, _splat: f.path }}
              className="min-w-0 flex-1 truncate font-mono text-[13px] hover:text-seal hover:underline"
            >
              {f.path.split("/").pop()}
            </Link>
            <span className="hidden truncate text-xs text-muted sm:inline">{f.message}</span>
            <span className="font-mono text-[11px] text-subtle">{f.sha.slice(0, 7)}</span>
          </li>
        ))}
        {!folders.length && !at.length ? <li className="px-3 py-8 text-center text-sm text-muted">Empty folder.</li> : null}
      </ul>
    </div>
  );
}

export function CodeToolbar({ owner, name, branch, files }: { owner: string; name: string; branch: string; files: { path: string }[] }) {
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [go, setGo] = useState("");
  const [open, setOpen] = useState(false);
  const branches = kiln.branches.filter((b) => b.repoId === repo?.id);
  const hits = go.trim()
    ? files.filter((f) => f.path.toLowerCase().includes(go.toLowerCase())).slice(0, 12)
    : [];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <details className="relative">
        <summary className="btn h-8 list-none">{branch}</summary>
        <div className="absolute z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-panel)]">
          {(branches.length ? branches : [{ name: branch, sha: "", protected: true, repoId: repo?.id ?? "", updatedAt: "" }]).map((b) => (
            <p key={b.name} className="flex items-center justify-between px-3 py-2 font-mono text-xs">
              {b.name}
              {b.protected ? <span className="text-subtle">protected</span> : null}
            </p>
          ))}
          <Link to="/$owner/$repo/branches" params={{ owner, repo: name }} className="block border-t border-border px-3 py-2 text-xs text-seal hover:underline">
            View all branches
          </Link>
        </div>
      </details>
      <div className="relative min-w-0 flex-1">
        <input
          className="input h-8"
          placeholder="Go to file"
          value={go}
          onChange={(e) => setGo(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
        />
        {open && hits.length ? (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface shadow-[var(--shadow-panel)]">
            {hits.map((f) => (
              <li key={f.path}>
                <Link to="/$owner/$repo/blob/$" params={{ owner, repo: name, _splat: f.path }} className="block px-3 py-2 font-mono text-xs hover:bg-surface-2">
                  {f.path}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Link to="/$owner/$repo/create" params={{ owner, repo: name }} className="btn h-8">
        <Plus className="size-3.5" /> Add file
      </Link>
      <Link to="/$owner/$repo/compare" params={{ owner, repo: name }} search={{ base: branch, head: "" }} className="btn h-8">
        Compare
      </Link>
    </div>
  );
}

export function LanguageBar({ langs }: { langs: Record<string, number> }) {
  const entries = Object.entries(langs);
  const total = entries.reduce((n, [, v]) => n + v, 0) || 1;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full">
        {entries.map(([k, v]) => (
          <span key={k} style={{ width: `${(v / total) * 100}%`, background: LANG_COLOR[k] ?? "#5e5e5a" }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        {entries.map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: LANG_COLOR[k] ?? "#5e5e5a" }} />
            {k} {v}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function About({ repo }: { repo: ReturnType<typeof allRepos>[number] }) {
  const kiln = useKiln();
  const live = useLiveRepoStats();
  const fixture = isFixtureRepo(repo);
  const stats = liveStatsFor(repo, live);
  const releases = kiln.releases.filter((r) => r.repoId === repo.id);
  const packs = kiln.pages.find((p) => p.repoId === repo.id);
  const shipaton = repo.id === "freddycreates/sovereign-engine";
  return (
    <aside className="space-y-4">
      {shipaton && (
        <div className="panel border-seal/40 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-seal">Shipaton</p>
          <p className="mt-2 text-sm font-medium">Sovereign Books substrate — shipping September 29, 2026.</p>
          <Link to="/shipaton" className="mt-3 inline-block text-sm text-seal hover:underline">
            Countdown &amp; readiness →
          </Link>
        </div>
      )}
      <div className="panel p-4">
        <h3 className="text-sm font-medium">About</h3>
        <p className="mt-2 text-sm text-muted">{stats?.description || repo.description}</p>
        {repo.website ? (
          <a href={repo.website} className="mt-2 block truncate text-sm text-seal hover:underline">
            {repo.website}
          </a>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.topics.map((t) => (
            <Link key={t} to="/topics/$slug" params={{ slug: t }} className="chip hover:border-seal">
              {t}
            </Link>
          ))}
        </div>
        <dl className="mt-4 space-y-1.5 text-xs text-muted">
          <div className="flex justify-between"><dt>License</dt><dd className="text-fg">{stats?.license || repo.license}</dd></div>
          <div className="flex justify-between"><dt>Default branch</dt><dd className="font-mono text-fg">{stats?.defaultBranch || repo.defaultBranch}</dd></div>
          {fixture ? (
            <div className="flex justify-between"><dt>Data</dt><dd className="text-subtle">demo fixture</dd></div>
          ) : (
            <>
              <div className="flex justify-between"><dt>Stars</dt><dd className="tabular-nums text-fg">{displayStars(repo, stats)}</dd></div>
              <div className="flex justify-between"><dt>Watchers</dt><dd className="tabular-nums text-fg">{stats?.watchers ?? repo.watchers}</dd></div>
              <div className="flex justify-between"><dt>Forks</dt><dd className="tabular-nums text-fg">{displayForks(repo, stats)}</dd></div>
            </>
          )}
          {releases[0] ? (
            <div className="flex justify-between">
              <dt>Latest</dt>
              <dd className="font-mono text-fg">{releases[0].tag}</dd>
            </div>
          ) : null}
          {packs?.enabled ? (
            <div className="flex justify-between">
              <dt>Pages</dt>
              <dd className="text-ok">live</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-4">
          <LanguageBar langs={repo.languages} />
        </div>
      </div>
      <div className="panel p-4 text-sm">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Community</p>
        <ul className="mt-2 space-y-1">
          <li>
            <Link to="/$owner/$repo/security" params={{ owner: repo.owner, repo: repo.name }} className="hover:text-seal">
              Security policy
            </Link>
          </li>
          <li>
            <Link to="/$owner/$repo/community" params={{ owner: repo.owner, repo: repo.name }} className="hover:text-seal">
              Code of conduct
            </Link>
          </li>
          <li>
            <Link to="/$owner/$repo/network" params={{ owner: repo.owner, repo: repo.name }} className="hover:text-seal">
              Network
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}

export function Readme({ source }: { source: string }) {
  if (!source) return null;
  return (
    <div className="panel mt-4 p-5 sm:p-6">
      <Markdown source={source} />
    </div>
  );
}
