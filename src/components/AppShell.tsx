import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { ArrowRight, Bell, Plus, Search } from "lucide-react";
import { KilnMark } from "@/components/KilnMark";
import { cn, formatKln } from "@/lib/utils";
import { allRepos, useKiln } from "@/lib/kiln/store";

const PALETTE = [
  { id: "studio", group: "Create", label: "Studio — one-shot a project", hint: "g s", href: "/studio" },
  { id: "new", group: "Create", label: "New repository", hint: "g n", href: "/new" },
  { id: "import", group: "Create", label: "Import from GitHub", href: "/new?tab=import" },
  { id: "explore", group: "Platform", label: "Explore", hint: "g e", href: "/explore" },
  { id: "trending", group: "Platform", label: "Trending", href: "/trending" },
  { id: "stars", group: "Account", label: "Your stars", href: "/stars" },
  { id: "issues", group: "Platform", label: "Issues", href: "/issues" },
  { id: "pulls", group: "Platform", label: "Pull requests", href: "/pulls" },
  { id: "models", group: "Platform", label: "Models", href: "/models" },
  { id: "assistants", group: "Platform", label: "Coding assistants", href: "/assistants" },
  { id: "marketplace", group: "Platform", label: "Marketplace", href: "/marketplace" },
  { id: "orgs", group: "Platform", label: "Organizations", href: "/orgs" },
  { id: "apps", group: "Platform", label: "Apps & add-ons", href: "/apps" },
  { id: "gists", group: "Platform", label: "Gists", href: "/gists" },
  { id: "cloud", group: "Platform", label: "Encrypted cloud", href: "/cloud" },
  { id: "pricing", group: "Platform", label: "Pricing", href: "/pricing" },
  { id: "account", group: "Account", label: "Profile", href: "/account" },
  { id: "wallet", group: "Account", label: "Wallet", href: "/wallet" },
  { id: "inbox", group: "Account", label: "Inbox", href: "/notifications" },
  { id: "architecture", group: "Docs", label: "Architecture", href: "/architecture" },
  { id: "papers", group: "Docs", label: "Working papers", href: "/papers" },
  { id: "start", group: "Docs", label: "Get started", href: "/start" },
  { id: "cli", group: "Tools", label: "CLI", href: "/cli" },
  { id: "gpu", group: "Tools", label: "WebGPU", href: "/gpu" },
  { id: "mcp", group: "Tools", label: "MCP", href: "/mcp" },
];

function inField(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const studio = pathname.startsWith("/studio");
  const kiln = useKiln();
  const [q, setQ] = useState("");
  const [plus, setPlus] = useState(false);
  const [palette, setPalette] = useState(false);
  const unread = kiln.notices.filter((n) => !n.read).length;

  useEffect(() => {
    if (!kiln.hydrated) {
      const p = useKiln.persist.rehydrate();
      if (p && typeof p.then === "function") p.then(() => kiln.setHydrated(true));
      else kiln.setHydrated(true);
    }
  }, [kiln]);

  useEffect(() => {
    if (kiln.hydrated && !kiln.wallet) kiln.connect("you");
  }, [kiln.hydrated, kiln.wallet, kiln]);

  useEffect(() => {
    const onPalette = () => setPalette(true);
    window.addEventListener("kiln:palette", onPalette);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (inField(e)) return;
      if (e.key === "g") {
        const once = (ev: KeyboardEvent) => {
          window.removeEventListener("keydown", once);
          if (ev.key === "s") window.location.assign("/studio");
          if (ev.key === "n") window.location.assign("/new");
          if (ev.key === "e") window.location.assign("/explore");
        };
        window.addEventListener("keydown", once, { once: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("kiln:palette", onPalette);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-fg">
            <KilnMark />
            <span className="font-display text-[1.35rem] leading-none tracking-tight">KILN</span>
            <span className="hidden rounded-full border border-border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted lg:inline">
              Git · L1
            </span>
          </Link>
          <form
            className="hidden min-w-0 flex-1 md:block"
            onSubmit={(e) => {
              e.preventDefault();
              window.location.assign(`/search?q=${encodeURIComponent(q)}`);
            }}
          >
            <label className="relative block max-w-xl">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
              <input
                className="input pl-8 pr-14"
                placeholder="Search or jump to…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setPalette(true)}
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-subtle sm:inline">
                ⌘K
              </kbd>
            </label>
          </form>
          <nav className="ml-auto flex max-w-[68%] items-center gap-0.5 overflow-x-auto text-sm text-muted sm:max-w-none sm:gap-1">
            <NavLink href="/pulls" active={pathname.startsWith("/pulls")}>
              Pulls
            </NavLink>
            <NavLink href="/issues" active={pathname === "/issues" || pathname.startsWith("/issues?")}>
              Issues
            </NavLink>
            <NavLink href="/studio" active={pathname.startsWith("/studio")}>
              Studio
            </NavLink>
            <NavLink href="/explore" active={pathname.startsWith("/explore") || pathname.startsWith("/trending")}>
              Explore
            </NavLink>
            <NavLink href="/marketplace" active={pathname.startsWith("/marketplace")} className="hidden sm:inline">
              Marketplace
            </NavLink>
            <div className="relative">
              <button type="button" className="btn-ghost btn h-8 px-2" aria-label="Create" onClick={() => setPlus((v) => !v)}>
                <Plus className="size-4" />
              </button>
              {plus ? (
                <div className="absolute right-0 top-9 z-40 w-52 overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-panel)]">
                  {[
                    ["New repository", "/new"],
                    ["Import GitHub", "/new?tab=import"],
                    ["New gist", "/gists"],
                    ["New organization", "/orgs"],
                    ["New issue", "/issues"],
                  ].map(([label, href]) => (
                    <a
                      key={href}
                      href={href}
                      className="block px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
                      onClick={() => setPlus(false)}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <Link to="/notifications" className="relative btn-ghost btn h-8 px-2" aria-label="Notifications">
              <Bell className="size-4" />
              {unread ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-seal" /> : null}
            </Link>
            {kiln.wallet ? (
              <Link to="/$owner" params={{ owner: kiln.wallet.handle }} search={{ tab: "overview" }} className="hidden items-center gap-2 rounded-sm px-2 py-1 hover:text-fg sm:inline-flex">
                <span className="grid size-6 place-items-center rounded-full bg-surface-2 font-mono text-[10px] uppercase">
                  {kiln.wallet.handle.slice(0, 2)}
                </span>
                <span className="font-mono text-[11px] text-subtle">{formatKln(kiln.balance)}</span>
              </Link>
            ) : (
              <button type="button" className="btn h-8" onClick={() => kiln.connect("you")}>
                Connect
              </button>
            )}
          </nav>
        </div>
      </header>
      <div className={studio ? "w-full" : "mx-auto w-full max-w-[1320px] px-4 pb-16 pt-5 sm:px-6"}>{children}</div>
      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "#121214", border: "1px solid #2a2a2e", color: "#ecece8" } }} />
      {palette ? <CommandPalette onClose={() => setPalette(false)} /> : null}
    </div>
  );
}

function NavLink({ href, active, children, className }: { href: string; active: boolean; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} className={cn("shrink-0 rounded-sm px-2 py-1 hover:text-fg", active && "text-fg", className)}>
      {children}
    </a>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const kiln = useKiln();
  const repos = allRepos(kiln)
    .slice(0, 40)
    .map((r) => ({ id: r.id, group: "Repositories", label: r.id, hint: r.language, href: `/${r.id}` }));
  const items = useMemo(() => {
    const all = [...PALETTE, ...repos];
    const t = q.trim().toLowerCase();
    return t
      ? all.filter((e) => e.label.toLowerCase().includes(t) || e.group.toLowerCase().includes(t) || e.hint?.toLowerCase().includes(t))
      : all;
  }, [q, repos]);
  const groups = [...new Set(items.map((e) => e.group))];
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setI((n) => Math.min(items.length - 1, n + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setI((n) => Math.max(0, n - 1));
      }
      if (e.key === "Enter") {
        const hit = items[i];
        if (hit) {
          onClose();
          window.location.assign(hit.href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, items, onClose, nav]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-bg/70 p-4 pt-[12vh]" onClick={onClose}>
      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-panel)]" onClick={(e) => e.stopPropagation()}>
        <label className="relative block border-b border-border">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input autoFocus className="input min-h-12 border-0 bg-transparent pl-10" placeholder="Go to a repo, app, model, or page" value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} />
        </label>
        <ul className="max-h-[min(24rem,50vh)] overflow-auto p-2">
          {items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches.</li> : null}
          {groups.map((g) => (
            <li key={g} className="mb-2">
              <p className="px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted">{g}</p>
              <ul>
                {items
                  .filter((e) => e.group === g)
                  .map((e) => {
                    const n = items.indexOf(e);
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-sm ${n === i ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}
                          onMouseEnter={() => setI(n)}
                          onClick={() => {
                            onClose();
                            window.location.assign(e.href);
                          }}
                        >
                          <span>{e.label}</span>
                          <span className="inline-flex items-center gap-2 font-mono text-[10px] text-subtle">
                            {e.hint} <ArrowRight className="size-3" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </li>
          ))}
        </ul>
        <p className="border-t border-border px-3 py-2 font-mono text-[10px] text-subtle">↑↓ move · enter open · esc close · g s studio · g n new</p>
      </div>
    </div>
  );
}
