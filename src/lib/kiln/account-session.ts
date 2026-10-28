/**
 * The forge account session, client side.
 *
 * The daemon's account system issues a session bearer (`kiln_sess_…`)
 * at login. This app is a local-first console, so the session lives
 * in localStorage next to the app's other client state and is passed
 * explicitly to the account server functions, which forward it as the
 * bearer. It is never the operator token, and it is only ever sent to
 * this app's own server functions.
 *
 * Stored shape: { token, account } — the cached account view is a
 * render convenience only; /v1/accounts/me is the truth and the
 * identity panel re-reads it on mount.
 */
import type { AccountView } from "./swarm-proxy";

const KEY = "kiln_account_session";

export interface StoredSession {
  token: string;
  account: AccountView;
}

export function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return s && typeof s.token === "string" && s.account ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, account: AccountView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ token, account }));
  } catch {
    /* storage unavailable — the session simply won't persist */
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Slug rules shared with the daemon: [a-z0-9][a-z0-9-]{0,63}. */
export function slugifyOwner(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return /^[a-z0-9]/.test(s) ? s : `forge-${s}`.slice(0, 64);
}
