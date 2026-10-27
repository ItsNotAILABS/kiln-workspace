import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { githubImport, githubList } from "@/lib/kiln/github";
import { swarmCreateGitRepo, swarmUpdateWorkspace, swarmWorkspaces } from "@/lib/kiln/swarm";
import type { WorkspaceView } from "@/lib/kiln/swarm-proxy";
import { langOf, tallyLangs, useKiln } from "@/lib/kiln/store";
import { REPO_KINDS } from "@/lib/kiln/types";
import type { RepoFile } from "@/lib/kiln/types";

type Search = { tab?: string; q?: string };

export const Route = createFileRoute("/new")({
  validateSearch: (s: Record<string, unknown>): Search => ({ tab: String(s.tab ?? "create"), q: String(s.q ?? "") }),
  component: NewRepo,
});

function NewRepo() {
  const { tab } = Route.useSearch();
  const kiln = useKiln();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [kind, setKind] = useState<(typeof REPO_KINDS)[number]["id"]>("code");
  const [license, setLicense] = useState("MIT");
  const [gitignore, setGitignore] = useState("");
  const [query, setQuery] = useState("");
  const [looking, setLooking] = useState(false);
  const [hits, setHits] = useState<{ fullName: string; name: string; owner: string; description: string; language: string; stars: number; htmlUrl: string }[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const [wsOptions, setWsOptions] = useState<WorkspaceView[]>([]);
  const [targetWs, setTargetWs] = useState("");
  const [forgeBusy, setForgeBusy] = useState(false);
  const [forgeNote, setForgeNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [createdRepo, setCreatedRepo] = useState<{ owner: string; name: string } | null>(null);

  useEffect(() => {
    let live = true;
    swarmWorkspaces({ data: {} })
      .then((r) => {
        if (live && r.ok) setWsOptions(r.workspaces as WorkspaceView[]);
      })
      .catch(() => null);
    return () => {
      live = false;
    };
  }, []);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setForgeNote(null);
    const repo = kiln.createRepo({
      name,
      description,
      visibility,
      kind,
      license,
      gitignore: gitignore
        ? gitignore === "Node"
          ? "node_modules\ndist\n.env\n"
          : gitignore === "Python"
            ? "__pycache__/\n.venv/\n"
            : gitignore === "Rust"
              ? "/target\n"
              : ""
        : undefined,
    });
    if (!repo) return;
    if (!targetWs) {
      nav({ to: "/$owner/$repo", params: { owner: repo.owner, repo: repo.name } });
      return;
    }
    // Workspace chosen: also create the repo on the forge under the
    // signed-in handle and attach it. Each step reports its own outcome —
    // attachment is only claimed when the daemon confirms it.
    const ws = wsOptions.find((w) => w.id === targetWs);
    const wsName = ws ? `${ws.name} (${ws.owner}/${ws.slug})` : "the workspace";
    const forgeOwner = repo.owner.toLowerCase();
    const ref = `${forgeOwner}/${repo.name}`;
    setCreatedRepo({ owner: repo.owner, name: repo.name });
    setForgeBusy(true);
    const created = await swarmCreateGitRepo({
      data: { owner: forgeOwner, repo: repo.name },
    }).catch((err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "forge create failed",
    }));
    if (!created.ok) {
      setForgeBusy(false);
      setForgeNote({
        ok: false,
        text: `Created here, but creating ${ref} on the forge failed: ${created.error} — it was not attached to ${wsName}.`,
      });
      return;
    }
    const attached = await swarmUpdateWorkspace({
      data: { id: targetWs, patch: { addRepos: [ref] } },
    }).catch((err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "attach failed",
    }));
    setForgeBusy(false);
    if (!attached.ok) {
      setForgeNote({
        ok: false,
        text: `Created on the forge as ${ref}, but attaching it to ${wsName} failed: ${attached.error}`,
      });
      return;
    }
    setForgeNote({ ok: true, text: `Created on the forge as ${ref} and attached to ${wsName}.` });
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLooking(true);
    setError("");
    const res = await githubList({ data: { query } });
    setLooking(false);
    if (!res.ok) {
      setError(res.error);
      setHits([]);
      return;
    }
    setHits(res.items);
  }

  async function doImport(owner: string, repo: string) {
    setImporting(`${owner}/${repo}`);
    setError("");
    const res = await githubImport({ data: { owner, repo, handle: kiln.wallet?.handle || owner.toLowerCase() } });
    setImporting(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const files: RepoFile[] = res.repo.files.map((f) => ({ ...f, language: langOf(f.path) }));
    const imported = kiln.importRepo({ ...res.repo, files, languages: tallyLangs(files), owner: kiln.wallet?.handle || res.repo.owner, id: `${kiln.wallet?.handle || res.repo.owner}/${res.repo.name}` });
    nav({ to: "/$owner/$repo", params: { owner: imported.owner, repo: imported.name } });
  }

  return (
    <div className="mx-auto max-w-2xl pb-20">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Create</p>
      <h1 className="mt-3 font-display text-4xl leading-[0.95] sm:text-5xl">New repository</h1>
      <p className="mt-3 text-muted">A sealed folder on L1. Or import a public GitHub tree and it boots as a computer.</p>
      <div className="mt-6 inline-flex rounded-sm border border-border text-sm">
        {(["create", "import"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`px-4 py-2 capitalize ${tab === t ? "bg-surface text-fg" : "text-muted"}`}
            onClick={() => nav({ to: "/new", search: { tab: t } })}
          >
            {t === "create" ? "Create" : "Import GitHub"}
          </button>
        ))}
      </div>

      {tab !== "import" ? (
        <form className="mt-8 space-y-4" onSubmit={submitCreate}>
          <label className="block text-sm">
            Name
            <input className="input mt-1" required value={name} onChange={(e) => setName(e.target.value)} placeholder="protocol" />
          </label>
          <label className="block text-sm">
            Description
            <input className="input mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this computer is for" />
          </label>
          <div>
            <p className="text-sm">Kind</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {REPO_KINDS.map((k) => (
                <button key={k.id} type="button" className={`rounded-lg border p-3 text-left ${kind === k.id ? "border-seal bg-surface" : "border-border"}`} onClick={() => setKind(k.id)}>
                  <p className="text-sm">{k.label}</p>
                  <p className="mt-1 text-xs text-muted">{k.blurb}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 text-sm">
            {(["public", "private"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" checked={visibility === v} onChange={() => setVisibility(v)} />
                {v}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              License
              <select className="input mt-1" value={license} onChange={(e) => setLicense(e.target.value)}>
                <option>MIT</option>
                <option>Apache-2.0</option>
                <option>GPL-3.0</option>
                <option>Unlicense</option>
              </select>
            </label>
            <label className="text-sm">
              .gitignore
              <select className="input mt-1" value={gitignore} onChange={(e) => setGitignore(e.target.value)}>
                <option value="">None</option>
                <option>Node</option>
                <option>Python</option>
                <option>Rust</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Add to workspace <span className="text-subtle">(optional)</span>
            <select className="input mt-1" value={targetWs} onChange={(e) => setTargetWs(e.target.value)}>
              <option value="">None</option>
              {wsOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.owner}/{w.slug})
                </option>
              ))}
            </select>
            {targetWs && (
              <span className="mt-1 block text-xs text-muted">
                On create, the repo is also created on the forge under your handle and attached to
                this workspace.
              </span>
            )}
          </label>
          <button type="submit" className="btn-primary btn h-10 px-5" disabled={forgeBusy}>
            {forgeBusy ? "Creating on the forge…" : "Create repository"}
          </button>
          {forgeNote && (
            <div className={`border p-3 ${forgeNote.ok ? "border-seal/50" : "border-red-500/40"}`}>
              <p className={`text-sm ${forgeNote.ok ? "text-seal" : "text-red-400"}`}>{forgeNote.text}</p>
              {createdRepo && (
                <Link
                  to="/$owner/$repo"
                  params={{ owner: createdRepo.owner, repo: createdRepo.name }}
                  className="mt-2 inline-block text-sm text-seal hover:underline"
                >
                  Open {createdRepo.owner}/{createdRepo.name} →
                </Link>
              )}
            </div>
          )}
        </form>
      ) : (
        <div className="mt-8">
          <form onSubmit={lookup} className="flex gap-2">
            <input className="input" placeholder="user, org, or owner/repo" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="submit" className="btn-primary btn h-9 px-4" disabled={looking}>
              {looking ? "Looking…" : "Look up"}
            </button>
          </form>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {hits.map((h) => (
              <li key={h.fullName} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-sm">{h.fullName}</p>
                  <p className="text-xs text-muted">{h.description || h.language}</p>
                </div>
                <button type="button" className="btn h-8" disabled={!!importing} onClick={() => doImport(h.owner, h.name)}>
                  {importing === h.fullName ? "Importing…" : "Import"}
                </button>
              </li>
            ))}
          </ul>
          {!hits.length ? <p className="mt-6 text-sm text-muted">Try <button type="button" className="text-seal hover:underline" onClick={() => { setQuery("ItsNotAILABS"); }}>ItsNotAILABS</button> or a public owner/repo.</p> : null}
        </div>
      )}
    </div>
  );
}
