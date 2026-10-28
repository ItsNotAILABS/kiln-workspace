import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  accountAgents,
  accountCreateAgent,
  accountMe,
  accountRevokeAgent,
} from "@/lib/kiln/swarm";
import type { AccountView, AgentIdentityView } from "@/lib/kiln/swarm-proxy";
import { clearSession, loadSession, saveSession } from "@/lib/kiln/account-session";

/**
 * The KILN identity panel on /account: the daemon account behind this
 * browser's session, and the agent identities it owns. Minting shows
 * the raw agent token exactly once (the daemon stores only its hash);
 * revoking kills a token immediately. All state is read back from the
 * daemon — nothing here is rendered from hope.
 */
export function KilnIdentity() {
  const [session, setSession] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountView | null>(null);
  const [agents, setAgents] = useState<AgentIdentityView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [scopeWs, setScopeWs] = useState(true);
  const [scopePd, setScopePd] = useState(true);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (token: string) => {
    const me = await accountMe({ data: { session: token } });
    if (!me.ok) {
      // A dead session (expired, or accounts not live yet) is a state,
      // not a crash: drop it and say why.
      clearSession();
      setSession(null);
      setAccount(null);
      setAgents(null);
      setError(me.error);
      return;
    }
    setAccount(me.account);
    saveSession(token, me.account);
    const list = await accountAgents({ data: { session: token } });
    if (list.ok) setAgents(list.agents);
  }, []);

  useEffect(() => {
    const s = loadSession();
    if (s) {
      setSession(s.token);
      setAccount(s.account);
      void refresh(s.token);
    }
  }, [refresh]);

  async function mint(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    const scopes = [
      ...(scopeWs ? ["workspaces"] : []),
      ...(scopePd ? ["project-details"] : []),
    ];
    const r = await accountCreateAgent({
      data: { session, name: agentName, scopes: scopes.length ? scopes : undefined },
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setFreshToken(r.token);
    setCopied(false);
    setAgentName("");
    void refresh(session);
  }

  async function revoke(id: string) {
    if (!session) return;
    setError(null);
    const r = await accountRevokeAgent({ data: { session, id } });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    void refresh(session);
  }

  if (!session) {
    return (
      <div className="panel mt-6 p-5">
        <p className="font-display text-lg">KILN identity</p>
        <p className="mt-1 text-sm text-muted">
          The wallet handle above is this browser's local profile. Your KILN identity is a
          forge account: a namespace that owns your workspaces and repos, and the agent
          tokens your AI runs under.
          {error ? ` Last word from the forge: ${error}` : ""}
        </p>
        <div className="mt-3 flex gap-2">
          <Link to="/join" className="btn-primary btn h-9">
            Create account / sign in
          </Link>
          <Link to="/welcome" className="btn h-9">
            Get started
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel mt-6 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg">KILN identity</p>
        <button
          type="button"
          className="btn h-8"
          onClick={() => {
            clearSession();
            setSession(null);
            setAccount(null);
            setAgents(null);
            setFreshToken(null);
          }}
        >
          Sign out
        </button>
      </div>
      {account && (
        <div className="mt-2 space-y-1">
          <p className="font-mono">{account.owner}</p>
          <p className="text-sm text-muted">
            {account.name} · {account.email}
          </p>
          <p className="font-mono text-xs text-subtle">
            namespace: {account.owner}/* — workspaces and repos you create live under it
          </p>
        </div>
      )}

      <p className="mt-5 font-display">Your agents</p>
      <p className="mt-1 text-sm text-muted">
        Agent identities let your AI work the forge as you, inside scopes you choose. A
        token is shown once, at minting — the forge keeps only its hash.
      </p>
      {agents === null ? (
        <p className="mt-2 text-sm text-muted">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No agents yet — mint your first below.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {agents.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2 font-mono text-sm">
              <span>{g.name}</span>
              <span className="text-xs text-subtle">{g.scopes.join(" + ") || "no scopes"}</span>
              {g.revoked ? (
                <span className="text-xs text-subtle">revoked</span>
              ) : (
                <button type="button" className="btn h-7" onClick={() => revoke(g.id)}>
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {freshToken && (
        <div className="mt-4 rounded border border-[color:var(--line,#333)] p-3">
          <p className="text-sm">
            Your new agent token — <strong>copy it now, it is shown only once</strong>:
          </p>
          <p className="mt-1 break-all font-mono text-xs">{freshToken}</p>
          <button
            type="button"
            className="btn mt-2 h-8"
            onClick={() => {
              void navigator.clipboard?.writeText(freshToken).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy token"}
          </button>
        </div>
      )}

      <form className="mt-4 space-y-2" onSubmit={mint}>
        <input
          className="input"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          placeholder="Agent name — e.g. my-claude"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={scopeWs} onChange={(e) => setScopeWs(e.target.checked)} />
          workspaces scope
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={scopePd} onChange={(e) => setScopePd(e.target.checked)} />
          project-details scope
        </label>
        {error && <p className="text-sm text-[color:var(--danger,#e5484d)]">{error}</p>}
        <button type="submit" className="btn-primary btn h-9" disabled={busy || !agentName.trim()}>
          {busy ? "Minting…" : "Mint agent token"}
        </button>
      </form>
    </div>
  );
}
