import { createFileRoute, Link } from "@tanstack/react-router";
import { allRepos, profileOf, starCount, useKiln } from "@/lib/kiln/store";
import { SEED_PACKAGES, SEED_PROFILES } from "@/lib/kiln/seed";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$owner/")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: String(s.tab ?? "overview") }),
  component: ProfilePage,
});

function ContributionGraph({ seed }: { seed: string }) {
  const cells = Array.from({ length: 53 * 7 }, (_, i) => {
    const d = new Date("2026-09-03T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (53 * 7 - 1 - i));
    let h = 0;
    const key = seed + d.toISOString().slice(0, 10);
    for (let k = 0; k < key.length; k++) h = (h * 33 + key.charCodeAt(k)) >>> 0;
    const n = h % 5;
    return n;
  });
  return (
    <div className="overflow-x-auto">
      <div className="grid w-max grid-rows-7 grid-flow-col gap-[3px]">
        {cells.map((n, i) => (
          <span
            key={i}
            title={`${n} contributions`}
            className="size-2.5 rounded-[2px]"
            style={{ background: n === 0 ? "#1a1a1e" : n === 1 ? "#2a3a40" : n === 2 ? "#3d5c66" : n === 3 ? "#5a8490" : "#7a9aa8" }}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-subtle">Contribution activity · last year</p>
    </div>
  );
}

function ProfilePage() {
  const { owner } = Route.useParams();
  const { tab } = Route.useSearch();
  const kiln = useKiln();
  const profile = profileOf(owner);
  const repos = allRepos(kiln).filter((r) => r.owner.toLowerCase() === owner.toLowerCase());
  const starred = allRepos(kiln).filter((r) => kiln.stars[r.id] && (kiln.wallet?.handle.toLowerCase() === owner.toLowerCase()));
  const packs = SEED_PACKAGES.filter((p) => p.repoId.toLowerCase().startsWith(owner.toLowerCase() + "/"));
  const orgPeople = Object.values(SEED_PROFILES).filter((p) => p.orgs.some((o) => o.toLowerCase().includes(owner.toLowerCase())) || (profile.kind === "org" && p.handle !== owner && p.kind === "user")).slice(0, 8);
  const me = kiln.wallet?.handle === owner;
  const following = kiln.following.includes(owner);
  const tabs = profile.kind === "org"
    ? ["overview", "repositories", "projects", "packages", "people", "stars"]
    : ["overview", "repositories", "projects", "packages", "stars"];
  const pinned = repos.filter((r) => profile.pinned.includes(r.id)).concat(repos).filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i).slice(0, 6);
  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      <aside>
        <div className="grid size-20 place-items-center rounded-full bg-surface-2 font-display text-3xl uppercase">{owner.slice(0, 1)}</div>
        <h1 className="mt-4 font-display text-3xl">{profile.displayName}</h1>
        <p className="font-mono text-sm text-muted">{profile.handle}</p>
        <p className="mt-3 text-sm text-muted">{profile.bio}</p>
        {!me ? (
          <button type="button" className="btn mt-3 h-8 w-full" onClick={() => kiln.follow(owner)}>
            {following ? "Unfollow" : "Follow"}
          </button>
        ) : (
          <Link to="/account" className="btn mt-3 h-8 w-full">
            Edit profile
          </Link>
        )}
        <dl className="mt-4 space-y-1 text-xs text-muted">
          {profile.location ? <div>{profile.location}</div> : null}
          <div>
            {profile.followers + (following ? 1 : 0)} followers · {profile.following} following
          </div>
          <div className="font-mono">{profile.address.slice(0, 12)}…</div>
          {profile.website ? (
            <a className="text-seal hover:underline" href={profile.website}>
              {profile.website}
            </a>
          ) : null}
          {profile.twitter ? <div>@{profile.twitter}</div> : null}
          {profile.company ? <div>{profile.company}</div> : null}
        </dl>
        {profile.orgs.length ? (
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Organizations</p>
            <p className="mt-1 text-sm">{profile.orgs.join(", ")}</p>
          </div>
        ) : null}
      </aside>
      <div>
        <div className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <Link
              key={t}
              to="/$owner"
              params={{ owner }}
              search={{ tab: t }}
              className={cn("relative shrink-0 px-3 py-2 text-sm capitalize text-muted hover:text-fg", tab === t && "text-fg")}
            >
              {t}
              {tab === t ? <span className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" /> : null}
            </Link>
          ))}
        </div>
        {tab === "overview" ? (
          <div className="mt-5 space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Pinned</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {pinned.map((r) => (
                  <li key={r.id}>
                    <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="panel block p-4 hover:border-seal">
                      <p className="font-mono text-sm">{r.name}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>
                      <p className="mt-2 text-[11px] text-subtle">
                        {r.language} · {starCount(r, kiln)} stars
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <ContributionGraph seed={owner} />
          </div>
        ) : null}
        {tab === "repositories" ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {repos.map((r) => (
              <li key={r.id}>
                <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="panel block p-4 hover:border-seal">
                  <p className="font-mono text-sm">{r.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>
                  <p className="mt-2 text-[11px] text-subtle">
                    {r.language} · {starCount(r, kiln)} stars · {r.visibility}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "projects" ? (
          <p className="mt-6 text-sm text-muted">Projects live on each tree. Open a repository and use the Projects tab.</p>
        ) : null}
        {tab === "packages" ? (
          <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
            {packs.length ? (
              packs.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <p className="font-mono text-sm">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.ecosystem} · {p.version} · {p.downloads.toLocaleString()} installs
                  </p>
                </li>
              ))
            ) : (
              <li className="px-4 py-10 text-center text-sm text-muted">No packages.</li>
            )}
          </ul>
        ) : null}
        {tab === "people" ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {orgPeople.map((p) => (
              <li key={p.handle}>
                <Link to="/$owner" params={{ owner: p.handle }} search={{ tab }} className="panel block p-4 hover:border-seal">
                  <p className="font-display text-xl">{p.displayName}</p>
                  <p className="font-mono text-sm text-muted">{p.handle}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "stars" ? (
          <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
            {(me ? starred : allRepos(kiln).filter((r) => r.stars > 40).slice(0, 8)).map((r) => (
              <li key={r.id} className="px-4 py-3">
                <Link to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="font-mono text-sm hover:text-seal">
                  {r.id}
                </Link>
                <p className="text-sm text-muted">{r.description}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
