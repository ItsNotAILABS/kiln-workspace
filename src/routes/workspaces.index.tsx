import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  swarmCreateWorkspace,
  swarmGitRepos,
  swarmSites,
  swarmWorkspaces,
} from "@/lib/kiln/swarm";
import type { GitRepoView, SiteView, WorkspaceTreeNode, WorkspaceView } from "@/lib/kiln/swarm-proxy";
import { useKiln } from "@/lib/kiln/store";
import { ForgeVersion, ForgeDoors } from "@/components/ForgeVersion";

export const Route = createFileRoute("/workspaces/")({ component: Workspaces });

/**
 * The daemon answers 404 for /v1/workspaces until the workspaces rollout
 * reaches it (the routes ship in swarm/lib/httpapi.mjs and mount on the
 * daemon's next start). That state is rendered plainly — never mock data.
 */
export function workspaceRolloutNote(error: string | null): string | null {
  if (!error) return null;
  if (/not found/i.test(error)) {
    return "The connected daemon doesn't serve workspaces yet — the API ships in the forge code and mounts on the daemon's next start. Workspace records themselves are created with `swarm.mjs workspaces` against the registry.";
  }
  return null;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function flatten(nodes: WorkspaceTreeNode[]): WorkspaceView[] {
  const out: WorkspaceView[] = [];
  const walk = (ns: WorkspaceTreeNode[]) => {
    for (const n of ns) {
      out.push(n);
      walk(n.children ?? []);
    }
  };
  walk(nodes);
  return out;
}

function WorkspaceCard({ w }: { w: WorkspaceView }) {
  return (
    <Link
      to="/workspaces/$workspaceId"
      params={{ workspaceId: w.id }}
      className="panel block p-5 hover:border-seal"
    >
      <p className="font-display text-2xl">{w.name}</p>
      <p className="mt-1 font-mono text-sm text-muted">
        {w.owner}/{w.slug}
      </p>
      {w.description && <p className="mt-2 text-sm text-muted">{w.description}</p>}
      <p className="mt-3 text-xs text-subtle">
        {w.repos.length} {w.repos.length === 1 ? "repo" : "repos"} · {w.siteIds.length}{" "}
        {w.siteIds.length === 1 ? "site" : "sites"} · updated{" "}
        {new Date(w.updatedAt).toLocaleDateString()}
      </p>
    </Link>
  );
}

function TreeList({ nodes }: { nodes: WorkspaceTreeNode[] }) {
  return (
    <ul className="space-y-3">
      {nodes.map((w) => (
        <li key={w.id}>
          <WorkspaceCard w={w} />
          {w.children && w.children.length > 0 && (
            <div className="ml-5 mt-3 border-l border-border pl-4">
              <TreeList nodes={w.children} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Workspaces() {
  const kiln = useKiln();
  const [roots, setRoots] = useState<WorkspaceTreeNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fix, setFix] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await swarmWorkspaces({ data: { tree: true } }).catch(() => null);
    if (r && r.ok) {
      setRoots(r.workspaces as WorkspaceTreeNode[]);
      setError(null);
      setFix(null);
    } else if (r && !r.ok) {
      setError(r.error);
      setFix(r.fix ?? null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const flat = useMemo(() => (roots ? flatten(roots) : []), [roots]);
  const rollout = workspaceRolloutNote(error);

  // ---- create form state ----
  const [formOpen, setFormOpen] = useState(false);
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [repoChoices, setRepoChoices] = useState<GitRepoView[] | null>(null);
  const [siteChoices, setSiteChoices] = useState<SiteView[] | null>(null);
  const [choicesNote, setChoicesNote] = useState<string | null>(null);
  const [pickedRepos, setPickedRepos] = useState<string[]>([]);
  const [pickedSites, setPickedSites] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugTouched) setSlug(deriveSlug(name));
  }, [name, slugTouched]);

  // Prefill the owner from the signed-in handle, else the registry's owner.
  useEffect(() => {
    if (owner) return;
    const handle = kiln.wallet?.handle;
    if (handle) setOwner(handle.toLowerCase());
    else if (flat.length > 0) setOwner(flat[0].owner);
  }, [owner, kiln.wallet?.handle, flat]);

  useEffect(() => {
    if (!formOpen) return;
    let live = true;
    (async () => {
      const [g, s] = await Promise.all([
        swarmGitRepos().catch(() => null),
        swarmSites().catch(() => null),
      ]);
      if (!live) return;
      if (g && g.ok) setRepoChoices(g.repos);
      else if (g && !g.ok) setChoicesNote(`Couldn't list forge repos: ${g.error}`);
      if (s && s.ok) setSiteChoices(s.sites);
      else if (s && !s.ok) setChoicesNote((n) => n ?? `Couldn't list sites: ${s.error}`);
    })();
    return () => {
      live = false;
    };
  }, [formOpen]);

  const slugError = useMemo(() => {
    if (!slug) return "A slug is required.";
    if (!SLUG_RE.test(slug))
      return "Slug must start with a letter or number, then lowercase letters, numbers or hyphens (max 64).";
    if (owner && flat.some((w) => w.owner === owner && w.slug === slug))
      return `A workspace ${owner}/${slug} already exists.`;
    return null;
  }, [slug, owner, flat]);

  const toggle = (list: string[], setList: (v: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!owner.trim()) {
      setCreateError("An owner is required — the handle the workspace lives under.");
      return;
    }
    if (slugError) {
      setCreateError(slugError);
      return;
    }
    setSubmitting(true);
    const r = await swarmCreateWorkspace({
      data: {
        owner: owner.trim(),
        slug,
        name: name.trim(),
        description: description.trim() || undefined,
        repos: pickedRepos.length ? pickedRepos : undefined,
        siteIds: pickedSites.length ? pickedSites : undefined,
        parentId: parentId || undefined,
      },
    }).catch((err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "create failed",
    }));
    setSubmitting(false);
    if (!r.ok) {
      setCreateError(r.error);
      return;
    }
    setFormOpen(false);
    setName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setParentId("");
    setPickedRepos([]);
    setPickedSites([]);
    refresh();
  }

  const createForm = (
    <form onSubmit={submitCreate} className="panel mt-8 space-y-4 p-5">
      <p className="font-display text-2xl">New workspace</p>
      <label className="block text-sm">
        Owner
        <input
          className="input mt-1"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="handle"
        />
      </label>
      <label className="block text-sm">
        Name
        <input
          className="input mt-1"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ItsNotAILABS"
        />
      </label>
      <label className="block text-sm">
        Slug
        <input
          className="input mt-1 font-mono"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="itsnotailabs"
        />
        {slug && slugError ? (
          <span className="mt-1 block text-xs text-red-400">{slugError}</span>
        ) : slug ? (
          <span className="mt-1 block text-xs text-subtle">
            {owner ? `${owner}/${slug}` : slug}
          </span>
        ) : null}
      </label>
      <label className="block text-sm">
        Description
        <input
          className="input mt-1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this workspace groups"
        />
      </label>
      <label className="block text-sm">
        Parent workspace
        <select className="input mt-1" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">None — a root workspace</option>
          {flat.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.owner}/{w.slug})
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="text-sm">Member repos</p>
        {repoChoices === null ? (
          <p className="mt-1 text-xs text-muted">Loading forge repos…</p>
        ) : repoChoices.length === 0 ? (
          <p className="mt-1 text-xs text-muted">No repos hosted on this forge yet.</p>
        ) : (
          <ul className="mt-2 max-h-44 space-y-1 overflow-auto">
            {repoChoices.map((r) => {
              const ref = `${r.owner}/${r.repo}`;
              return (
                <li key={ref}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={pickedRepos.includes(ref)}
                      onChange={() => toggle(pickedRepos, setPickedRepos, ref)}
                    />
                    <span className="font-mono text-[13px]">{ref}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="text-sm">Linked sites</p>
        {siteChoices === null ? (
          <p className="mt-1 text-xs text-muted">Loading sites…</p>
        ) : siteChoices.length === 0 ? (
          <p className="mt-1 text-xs text-muted">No sites in the registry.</p>
        ) : (
          <ul className="mt-2 max-h-44 space-y-1 overflow-auto">
            {siteChoices.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={pickedSites.includes(s.id)}
                    onChange={() => toggle(pickedSites, setPickedSites, s.id)}
                  />
                  <span>
                    {s.name} <span className="font-mono text-xs text-subtle">({s.id})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {choicesNote && <p className="text-xs text-muted">{choicesNote}</p>}
      {createError && (
        <div className="border border-red-500/40 p-3">
          <p className="text-sm text-red-400">{createError}</p>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn-primary btn h-10 px-5"
          disabled={submitting || !name.trim() || !!slugError}
        >
          {submitting ? "Creating…" : "Create workspace"}
        </button>
        <button type="button" className="btn h-10 px-4" onClick={() => setFormOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Workspaces</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-4xl leading-[0.95] sm:text-6xl">Workspaces</h1>
        {!formOpen && (
          <button type="button" className="btn-primary btn h-10 px-5" onClick={() => setFormOpen(true)}>
            New workspace
          </button>
        )}
      </div>
      <p className="mt-3 max-w-xl text-sm text-muted">
        First-class groupings of the repos and sites that make one product — read live from the
        forge's own workspace registry. Workspaces nest: a workspace can live inside another, and
        its detail page rolls the whole subtree up. The registry is an index; the durable links
        live in each member repo's KILN Memory.
      </p>

      {formOpen && createForm}

      {error && (
        <div className="panel mt-8 border-red-500/40 p-5">
          <p className="text-sm font-medium text-red-400">Couldn't load workspaces</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          {rollout && <p className="mt-2 text-sm text-muted">{rollout}</p>}
          {fix && <p className="mt-2 font-mono text-xs text-subtle">{fix}</p>}
        </div>
      )}

      {!error && roots === null && <p className="mt-8 text-sm text-muted">Loading…</p>}

      {!error && roots !== null && roots.length === 0 && !formOpen && (
        <div className="panel mt-8 p-5">
          <p className="text-sm text-muted">No workspaces in the registry yet.</p>
          <button
            type="button"
            className="btn-primary btn mt-4 h-10 px-5"
            onClick={() => setFormOpen(true)}
          >
            Create the first workspace
          </button>
          <p className="mt-4 text-xs text-subtle">
            Or from the CLI:{" "}
            <span className="font-mono">
              swarm.mjs workspaces add --owner O --slug S --name N --repos o/r,o/r --sites site_…
            </span>
          </p>
        </div>
      )}

      {roots !== null && roots.length > 0 && (
        <div className="mt-8">
          <TreeList nodes={roots} />
        </div>
      )}

      <ForgeVersion />
      <ForgeDoors />
    </div>
  );
}
