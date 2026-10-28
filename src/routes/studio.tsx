import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { studioGenerate } from "@/lib/kiln/github";
import { langOf, useKiln } from "@/lib/kiln/store";
import type { RepoFile } from "@/lib/kiln/types";
import { AppErrorComponent } from "@/lib/error-component";
import {
  accountCreateAgent,
  accountCreateWorkspace,
  swarmCreateGitRepo,
  swarmCreateWorkspace,
  swarmWorkspaces,
} from "@/lib/kiln/swarm";
import type { WorkspaceView } from "@/lib/kiln/swarm-proxy";
import { loadSession, slugifyOwner } from "@/lib/kiln/account-session";

export const Route = createFileRoute("/studio")({
  validateSearch: (s: Record<string, unknown>) => ({
    prompt: typeof s.prompt === "string" ? s.prompt : "",
  }),
  errorComponent: AppErrorComponent,
  component: StudioGate,
});

/** Live grok.me SSR was crashing here — paint only after the client is up. */
function StudioGate() {
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);
  if (!live) {
    return (
      <div className="px-4 py-24 text-center">
        <p className="font-display text-4xl tracking-tight">Studio</p>
        <p className="mt-3 text-sm text-muted">Opening the forge…</p>
      </div>
    );
  }
  return <Studio />;
}

function studioPromptFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get("prompt") || "";
  } catch {
    return "";
  }
}

function Studio() {
  let fromRoute = "";
  try {
    fromRoute = Route.useSearch().prompt || "";
  } catch {
    fromRoute = studioPromptFromUrl();
  }
  const [prompt, setPrompt] = useState(fromRoute);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kiln = useKiln();
  const nav = useNavigate();

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!kiln.wallet) kiln.connect("you");
    setBusy(true);
    setError("");
    try {
      const res = await studioGenerate({ data: { prompt } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const files: RepoFile[] = (res.files || []).map((f) => ({
        path: f.path,
        language: langOf(f.path),
        content: f.content,
        size: f.content.length,
        sha: f.path,
        message: "studio genesis",
        updatedAt: new Date().toISOString(),
      }));
      const repo = kiln.createRepo({
        name: res.name || "studio-project",
        description: res.description || prompt.slice(0, 140),
        visibility: "public",
        kind: "code",
        files,
      });
      if (repo) nav({ to: "/$owner/$repo", params: { owner: repo.owner, repo: repo.name } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Studio failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <div className="relative min-h-[calc(100dvh-3.5rem)]">
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
        src="/marketing/lab.mp4"
        poster="/marketing/lab.jpg"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/80 to-bg" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col justify-center px-4 py-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">Studio</p>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] sm:text-7xl">One-shot a project</h1>
        <p className="mt-4 max-w-xl text-muted">
          Describe the computer. Studio writes a sealed repository — files, README, a working tree you can open, fork, and run.
        </p>
        <form onSubmit={run} className="mt-8">
          <textarea
            className="input min-h-[7.5rem] text-base"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A light-client in Rust that verifies Kiln headers…"
            required
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary btn h-10 px-5" disabled={busy}>
              {busy ? "Forging…" : "Forge repository"}
            </button>
            <span className="text-xs text-subtle">User-initiated · grok-4.5 · capped</span>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </form>
      </div>
    </div>
    <StudioCreate />
    </>
  );
}

/**
 * Added below the hero (2026-10-28, as an edit — the hero above is the
 * original page, untouched): the forge's other create doors, each a real
 * act with a read-back or a link to the thing it made, plus the forge's
 * recent workspaces read live.
 */
function StudioCreate() {
  const nav = useNavigate();
  const [session, setSession] = useState<string | null>(null);
  const [sessionOwner, setSessionOwner] = useState<string | null>(null);
  const [recent, setRecent] = useState<WorkspaceView[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);

  const [wsName, setWsName] = useState("");
  const [wsSlug, setWsSlug] = useState("");
  const [wsOwner, setWsOwner] = useState("auro");
  const [wsBusy, setWsBusy] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  const [repoOwner, setRepoOwner] = useState("auro");
  const [repoName, setRepoName] = useState("");
  const [repoBusy, setRepoBusy] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  const [agentName, setAgentName] = useState("");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (s) {
      setSession(s.token);
      setSessionOwner(s.account.owner);
      setWsOwner(s.account.owner);
      setRepoOwner(s.account.owner);
    }
    let on = true;
    swarmWorkspaces({ data: {} })
      .then((r) => {
        if (!on) return;
        if (r.ok) {
          setRecent(
            [...r.workspaces].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 6)
          );
        } else setRecentError(r.error);
      })
      .catch((e) => {
        if (on) setRecentError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      on = false;
    };
  }, []);

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setWsBusy(true);
    setWsError(null);
    try {
      const input = { owner: sessionOwner ?? wsOwner, slug: wsSlug, name: wsName };
      const r = session
        ? await accountCreateWorkspace({ data: { session, input } })
        : await swarmCreateWorkspace({ data: input });
      if (!r.ok) {
        setWsError(r.error);
        return;
      }
      nav({ to: "/workspaces/$workspaceId", params: { workspaceId: r.workspace.id } });
    } catch (err) {
      setWsError(err instanceof Error ? err.message : String(err));
    } finally {
      setWsBusy(false);
    }
  }

  async function createRepo(e: React.FormEvent) {
    e.preventDefault();
    setRepoBusy(true);
    setRepoError(null);
    try {
      const r = await swarmCreateGitRepo({ data: { owner: repoOwner, repo: repoName } });
      if (!r.ok) {
        setRepoError(r.error);
        return;
      }
      nav({ to: "/$owner/$repo", params: { owner: repoOwner, repo: repoName } });
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : String(err));
    } finally {
      setRepoBusy(false);
    }
  }

  async function mintAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setAgentBusy(true);
    setAgentError(null);
    const r = await accountCreateAgent({ data: { session, name: agentName } });
    setAgentBusy(false);
    if (!r.ok) {
      setAgentError(r.error);
      return;
    }
    setFreshToken(r.token);
    setAgentName("");
  }

  const ownerForImport = sessionOwner ?? wsOwner;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <p className="font-mono text-xs uppercase tracking-widest text-subtle">More ways to create</p>
      <h2 className="mt-2 font-display text-3xl">Start it on the forge directly</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        A workspace to hold the work, a repo to hold the code, an import to bring a project
        in, an agent to work it.
        {sessionOwner ? (
          <>
            {" "}
            You're signed in as <span className="font-mono">{sessionOwner}</span> — new
            workspaces and agents are created as you.
          </>
        ) : null}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="panel p-5">
          <p className="font-display text-lg">New workspace</p>
          <p className="mt-1 text-sm text-muted">
            Group repos and sites under one owner — nestable, with a live status rollup.
          </p>
          <form className="mt-3 space-y-2" onSubmit={createWorkspace}>
            {!sessionOwner && (
              <input
                className="input"
                value={wsOwner}
                onChange={(e) => setWsOwner(e.target.value)}
                placeholder="owner"
              />
            )}
            <input
              className="input"
              value={wsName}
              onChange={(e) => {
                setWsName(e.target.value);
                setWsSlug(slugifyOwner(e.target.value));
              }}
              placeholder="Workspace name — e.g. My Lab"
            />
            <input
              className="input"
              value={wsSlug}
              onChange={(e) => setWsSlug(e.target.value)}
              placeholder="slug"
            />
            {wsError && <p className="text-sm text-danger">{wsError}</p>}
            <button
              type="submit"
              className="btn-primary btn h-9"
              disabled={wsBusy || !wsName || !wsSlug}
            >
              {wsBusy ? "Creating…" : "Create workspace"}
            </button>
          </form>
        </section>

        <section className="panel p-5">
          <p className="font-display text-lg">New repo</p>
          <p className="mt-1 text-sm text-muted">
            A real hosted git repo on the forge — clone, push, and CI from the first commit.
          </p>
          <form className="mt-3 space-y-2" onSubmit={createRepo}>
            <input
              className="input"
              value={repoOwner}
              onChange={(e) => setRepoOwner(e.target.value)}
              placeholder="owner"
            />
            <input
              className="input"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="repo name — e.g. my-service"
            />
            {repoError && <p className="text-sm text-danger">{repoError}</p>}
            <button
              type="submit"
              className="btn-primary btn h-9"
              disabled={repoBusy || !repoOwner || !repoName}
            >
              {repoBusy ? "Creating…" : "Create repo"}
            </button>
          </form>
        </section>

        <section className="panel p-5">
          <p className="font-display text-lg">Import a project</p>
          <p className="mt-1 text-sm text-muted">
            Bring an existing project onto the forge through the agent kit — the same door
            your agents use. It creates the repo, pushes, attaches, and reads back live.
          </p>
          <p className="mt-3 overflow-x-auto rounded bg-[color:var(--panel-2,#16181d)] p-3 font-mono text-xs">
            node cli/kiln-kit.mjs import ./your-project --owner {ownerForImport}
          </p>
          <Link to="/agents" className="btn mt-3 h-9">
            The agent flow, written out
          </Link>
        </section>

        <section className="panel p-5">
          <p className="font-display text-lg">New agent</p>
          {session ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Mint an agent identity under {sessionOwner}. Its token is shown once — hand
                it to your AI, and it works the forge as you, inside its scopes.
              </p>
              {freshToken ? (
                <div className="mt-3 rounded border border-[color:var(--line,#333)] p-3">
                  <p className="text-sm">
                    <strong>Copy it now — shown only once:</strong>
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">{freshToken}</p>
                </div>
              ) : (
                <form className="mt-3 flex gap-2" onSubmit={mintAgent}>
                  <input
                    className="input"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Agent name — e.g. my-claude"
                  />
                  <button
                    type="submit"
                    className="btn-primary btn h-9"
                    disabled={agentBusy || !agentName.trim()}
                  >
                    {agentBusy ? "Minting…" : "Mint"}
                  </button>
                </form>
              )}
              {agentError && <p className="mt-2 text-sm text-danger">{agentError}</p>}
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                Agents belong to an account. Sign in and you can mint scoped, revocable
                tokens for your AI right here.
              </p>
              <Link to="/join" className="btn-primary btn mt-3 h-9">
                Create account / sign in
              </Link>
            </>
          )}
        </section>
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-2xl">Recent workspaces</h3>
          <Link to="/workspaces" className="text-sm text-muted underline">
            All workspaces
          </Link>
        </div>
        {recentError ? (
          <p className="mt-3 text-sm text-muted">
            The forge didn't answer just now ({recentError}) — recent workspaces are read
            live, never cached.
          </p>
        ) : recent === null ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No workspaces yet — yours could be first.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((w) => (
              <Link
                key={w.id}
                to="/workspaces/$workspaceId"
                params={{ workspaceId: w.id }}
                className="panel block p-4"
              >
                <p className="font-display">{w.name}</p>
                <p className="font-mono text-xs text-subtle">
                  {w.owner}/{w.slug}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {w.repos.length} repo{w.repos.length === 1 ? "" : "s"}
                  {w.siteIds.length ? ` · ${w.siteIds.length} site${w.siteIds.length === 1 ? "" : "s"}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
