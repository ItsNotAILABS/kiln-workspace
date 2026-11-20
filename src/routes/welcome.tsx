import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  accountAgents,
  accountCreateAgent,
  accountCreateWorkspace,
  accountMyWorkspaces,
} from "@/lib/kiln/swarm";
import type { AccountView } from "@/lib/kiln/swarm-proxy";
import { loadSession, slugifyOwner } from "@/lib/kiln/account-session";

export const Route = createFileRoute("/welcome")({ component: Welcome });

const SKIP_KEY = "kiln_onboarding_skips";
type StepId = "account" | "workspace" | "agent" | "import";

function loadSkips(): Set<StepId> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SKIP_KEY) || "[]") as StepId[]);
  } catch {
    return new Set();
  }
}

/**
 * /welcome — the onboarding walk. Four steps, each one a real act on
 * the forge, each one skippable, no dead ends:
 *   1. account   — your KILN identity (the /join door)
 *   2. workspace — your first workspace, created with YOUR session,
 *                  under YOUR namespace (never the operator's)
 *   3. agent     — your first agent identity; its token shows once
 *   4. import    — the kit command that puts a real project on the
 *                  forge (the CLI reads it back live as proof)
 * Step state is derived from the daemon on every visit — a step is
 * "done" because the forge says the thing exists, not because a
 * checkbox was ticked. Skips are remembered locally and labeled.
 */
function Welcome() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [wsCount, setWsCount] = useState<number | null>(null);
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [skips, setSkips] = useState<Set<StepId>>(new Set());
  const [importDone, setImportDone] = useState(false);

  const [wsName, setWsName] = useState("");
  const [wsSlug, setWsSlug] = useState("");
  const [agentName, setAgentName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (token: string) => {
    const [ws, ag] = await Promise.all([
      accountMyWorkspaces({ data: { session: token } }),
      accountAgents({ data: { session: token } }),
    ]);
    if (ws.ok) setWsCount(ws.workspaces.length);
    if (ag.ok) setAgentCount(ag.agents.filter((g) => !g.revoked).length);
  }, []);

  useEffect(() => {
    setSkips(loadSkips());
    const s = loadSession();
    if (s) {
      setSession(s.token);
      setAccount(s.account);
      void refresh(s.token);
    }
  }, [refresh]);

  function skip(id: StepId) {
    const next = new Set(skips);
    next.add(id);
    setSkips(next);
    try {
      localStorage.setItem(SKIP_KEY, JSON.stringify([...next]));
    } catch {
      /* skips just won't persist */
    }
  }

  const done: Record<StepId, boolean> = {
    account: !!session,
    workspace: (wsCount ?? 0) > 0,
    agent: (agentCount ?? 0) > 0,
    import: importDone,
  };
  const resolved = (id: StepId) => done[id] || skips.has(id);
  const allResolved = (Object.keys(done) as StepId[]).every(resolved);

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !account) return;
    setBusy(true);
    setError(null);
    const r = await accountCreateWorkspace({
      data: { session, input: { owner: account.owner, slug: wsSlug, name: wsName } },
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    void refresh(session);
  }

  async function mintAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    const r = await accountCreateAgent({ data: { session, name: agentName } });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setFreshToken(r.token);
    void refresh(session);
  }

  function StepShell({
    id,
    n,
    title,
    children,
  }: {
    id: StepId;
    n: number;
    title: string;
    children: React.ReactNode;
  }) {
    return (
      <section className="panel mt-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-lg">
            {n}. {title}{" "}
            {done[id] ? (
              <span className="text-sm text-muted">— done</span>
            ) : skips.has(id) ? (
              <span className="text-sm text-muted">— skipped</span>
            ) : null}
          </p>
          {!done[id] && !skips.has(id) && (
            <button type="button" className="btn h-8" onClick={() => skip(id)}>
              Skip
            </button>
          )}
        </div>
        {children}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-widest text-subtle">Get started</p>
      <h1 className="mt-2 font-display text-4xl">Welcome to the forge</h1>
      <p className="mt-2 text-muted">
        Four small steps and you — and your agents — are building on KILN: an identity, a
        workspace to hold the work, an agent to work it, and your first real project
        imported. Every step is a real act on the live forge, and every one can be skipped
        and picked up later.
      </p>

      <StepShell id="account" n={1} title="Your account">
        {session && account ? (
          <p className="mt-1 text-sm text-muted">
            Signed in as <span className="font-mono">{account.owner}</span> ({account.email}).
            This namespace owns everything below.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              A forge account is a person plus a namespace. It takes a minute, and it is
              what your agents will act under.
            </p>
            <Link to="/join" className="btn-primary btn mt-3 h-9">
              Create account / sign in
            </Link>
          </>
        )}
      </StepShell>

      <StepShell id="workspace" n={2} title="Your first workspace">
        {!session ? (
          <p className="mt-1 text-sm text-muted">Needs step 1 — workspaces live under your namespace.</p>
        ) : done.workspace ? (
          <p className="mt-1 text-sm text-muted">
            You have {wsCount} workspace{wsCount === 1 ? "" : "s"} under {account?.owner}.{" "}
            <Link to="/workspaces" className="underline">
              See them
            </Link>
            .
          </p>
        ) : (
          <form className="mt-2 space-y-2" onSubmit={createWorkspace}>
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
            <p className="font-mono text-xs text-subtle">
              it will live at {account?.owner}/{wsSlug || "…"}
            </p>
            <button type="submit" className="btn-primary btn h-9" disabled={busy || !wsName || !wsSlug}>
              {busy ? "Creating…" : "Create workspace"}
            </button>
          </form>
        )}
      </StepShell>

      <StepShell id="agent" n={3} title="Your first agent">
        {!session ? (
          <p className="mt-1 text-sm text-muted">Needs step 1 — agents belong to an account.</p>
        ) : done.agent && !freshToken ? (
          <p className="mt-1 text-sm text-muted">
            You have {agentCount} active agent{agentCount === 1 ? "" : "s"}. Manage them on{" "}
            <Link to="/account" className="underline">
              your account page
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              An agent identity is how your AI works the forge as you — scoped, revocable,
              and honest about who acted. Mint one and hand it the token.
            </p>
            {freshToken ? (
              <div className="mt-3 rounded border border-[color:var(--line,#333)] p-3">
                <p className="text-sm">
                  Agent minted — <strong>copy the token now, it is shown only once</strong>:
                </p>
                <p className="mt-1 break-all font-mono text-xs">{freshToken}</p>
              </div>
            ) : (
              <form className="mt-2 flex gap-2" onSubmit={mintAgent}>
                <input
                  className="input"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Agent name — e.g. my-claude"
                />
                <button type="submit" className="btn-primary btn h-9" disabled={busy || !agentName.trim()}>
                  {busy ? "Minting…" : "Mint agent"}
                </button>
              </form>
            )}
          </>
        )}
      </StepShell>

      <StepShell id="import" n={4} title="Import your first project">
        <p className="mt-1 text-sm text-muted">
          Importing runs through the agent kit's CLI — the same door your agents use. From
          the kit checkout:
        </p>
        <p className="mt-2 overflow-x-auto rounded bg-[color:var(--panel-2,#16181d)] p-3 font-mono text-xs">
          node cli/kiln-kit.mjs import ./your-project --owner {account?.owner || "your-owner"}
          {wsSlug ? ` --workspace ${wsSlug}` : ""}
        </p>
        <p className="mt-2 text-sm text-muted">
          The CLI creates the repo, pushes, attaches it, and reads it back live — the read-back
          is the proof. The full flow is written out on the{" "}
          <Link to="/agents" className="underline">
            Agents page
          </Link>
          .
        </p>
        {!done.import && !skips.has("import") && (
          <button type="button" className="btn mt-3 h-9" onClick={() => setImportDone(true)}>
            I've run my first import
          </button>
        )}
      </StepShell>

      {error && <p className="mt-4 text-sm text-[color:var(--danger,#e5484d)]">{error}</p>}

      {allResolved && (
        <section className="panel mt-4 p-5">
          <p className="font-display text-lg">You're set up</p>
          <p className="mt-1 text-sm text-muted">
            Identity, workspace, agent, import — the whole flow is yours now. The forge
            keeps every claim honest: if it exists, a read-back proves it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/workspaces" className="btn-primary btn h-9">
              Go to your workspaces
            </Link>
            <Link to="/agents" className="btn h-9">
              The agent flow
            </Link>
            <Link to="/studio" search={{ prompt: "" }} className="btn h-9">
              Open the Studio
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
