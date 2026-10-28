import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { accountLive, accountLogin, accountSignup } from "@/lib/kiln/swarm";
import { loadSession, saveSession, slugifyOwner } from "@/lib/kiln/account-session";

export const Route = createFileRoute("/join")({ component: Join });

/**
 * /join — the forge's own account door. Signup and sign-in against the
 * daemon's account system (lib/accounts.mjs): an account is a person,
 * an owner namespace, and — later — the agents they mint. The app's
 * wallet handle on /account is a different, local thing; this is the
 * KILN identity your work on the forge runs under.
 *
 * Honest staging: account routes ride the daemon's Doctor-owned
 * boots. Until the boot that carries them, capabilities do not list
 * the accounts ability and this page says exactly that instead of
 * pretending a signup happened.
 */
function Join() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [live, setLive] = useState<boolean | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [owner, setOwner] = useState("");
  const [ownerTouched, setOwnerTouched] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (loadSession()) {
      navigate({ to: "/welcome" });
      return;
    }
    let on = true;
    accountLive()
      .then((r) => {
        if (!on) return;
        if (r.ok) setLive(r.live);
        else {
          setLive(false);
          setLiveError(r.error);
        }
      })
      .catch(() => {
        if (on) setLive(false);
      });
    return () => {
      on = false;
    };
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const s = await accountSignup({ data: { email, name, owner, password } });
        if (!s.ok) {
          setError(s.error);
          return;
        }
      }
      const l = await accountLogin({ data: { email, password } });
      if (!l.ok) {
        setError(l.error);
        return;
      }
      saveSession(l.sessionToken, l.account);
      navigate({ to: "/welcome" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="font-mono text-xs uppercase tracking-widest text-subtle">KILN identity</p>
      <h1 className="mt-2 font-display text-4xl">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-muted">
        One account is your namespace on the forge — your workspaces, your repos, and the
        agents you mint all live under it. This is the identity the{" "}
        <Link to="/agents" className="underline">
          agent flow
        </Link>{" "}
        runs on.
      </p>

      {live === false ? (
        <div className="panel mt-6 p-5">
          <p className="font-display text-lg">Accounts are built — and staged</p>
          <p className="mt-1 text-sm text-muted">
            The account system is finished and tested on the forge daemon, and it goes live
            on the daemon's next scheduled boot. Signup opens the moment that boot lands —
            nothing here will pretend an account exists before then.
            {liveError ? ` (Right now the forge reports: ${liveError}.)` : ""}
          </p>
          <p className="mt-3 text-sm text-muted">
            In the meantime the forge itself is fully open —{" "}
            <Link to="/workspaces" className="underline">
              browse the workspaces
            </Link>
            .
          </p>
        </div>
      ) : (
        <form className="panel mt-6 space-y-3 p-5" onSubmit={submit}>
          <div className="flex gap-2">
            <button
              type="button"
              className={mode === "signup" ? "btn-primary btn h-9" : "btn h-9"}
              onClick={() => setMode("signup")}
            >
              Create account
            </button>
            <button
              type="button"
              className={mode === "signin" ? "btn-primary btn h-9" : "btn h-9"}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
          </div>

          {mode === "signup" && (
            <>
              <input
                className="input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!ownerTouched) setOwner(slugifyOwner(e.target.value));
                }}
                placeholder="Your name"
                autoComplete="name"
              />
              <input
                className="input"
                value={owner}
                onChange={(e) => {
                  setOwner(e.target.value);
                  setOwnerTouched(true);
                }}
                placeholder="owner — your namespace, e.g. ada-labs"
                autoComplete="off"
              />
              <p className="font-mono text-xs text-subtle">
                owner: lowercase letters, digits, dashes — this names everything you make
                here (yourname/workspace).
              </p>
            </>
          )}
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
          />
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Password (10+ characters)" : "Password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          {error && <p className="text-sm text-[color:var(--danger,#e5484d)]">{error}</p>}
          <button type="submit" className="btn-primary btn h-9" disabled={busy || live === null}>
            {busy ? "Working…" : mode === "signup" ? "Create account & continue" : "Sign in & continue"}
          </button>
        </form>
      )}
    </div>
  );
}
