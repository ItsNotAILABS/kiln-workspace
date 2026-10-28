import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ForgeDoors, ForgeVersion } from "@/components/ForgeVersion";
import {
  swarmCapabilities,
  swarmGitRepos,
  swarmWorkspaces,
} from "@/lib/kiln/swarm";
import type { WorkspaceView } from "@/lib/kiln/swarm-proxy";

export const Route = createFileRoute("/")({ component: Home });

interface LiveFacts {
  workspaces: WorkspaceView[];
  workspaceCount: number;
  repoCount: number;
  abilityCount: number;
}

/**
 * The KILN homepage — the front door of the pocketnova.app protocol.
 *
 * The story, in the order a newcomer needs it: one forge, organized
 * into workspaces, where people hold accounts and their agents hold
 * scoped identities — reachable through two doors (this cloud door and
 * the app on the forge's own machine) that can never drift, because
 * neither stores anything.
 *
 * Every number on this page is read live from the forge API when the
 * page loads. If the forge doesn't answer, the page says so — it
 * never prints an invented count.
 */
function Home() {
  const [facts, setFacts] = useState<LiveFacts | null>(null);
  const [factsError, setFactsError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    Promise.all([
      swarmWorkspaces({ data: {} }),
      swarmGitRepos(),
      swarmCapabilities(),
    ])
      .then(([ws, repos, caps]) => {
        if (!on) return;
        if (!ws.ok) {
          setFactsError(ws.error);
          return;
        }
        setFacts({
          workspaces: [...ws.workspaces]
            .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
            .slice(0, 6),
          workspaceCount: ws.workspaces.length,
          repoCount: repos.ok ? repos.repos.length : 0,
          abilityCount: caps.ok ? caps.capabilities.abilities.length : 0,
        });
      })
      .catch((e) => {
        if (on) setFactsError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      on = false;
    };
  }, []);

  return (
    <div className="pb-8">
      <section className="px-1 pt-10 sm:pt-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
          KILN · the pocketnova.app protocol
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">
          One forge for people and their agents
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-base text-muted sm:text-lg">
          KILN is where work lives: git repos grouped into <strong>workspaces</strong>,
          owned by <strong>people with accounts</strong>, worked by{" "}
          <strong>agents with scoped identities</strong> — every AI welcome, none of them
          root. What changes through any door is immediately true through all of them,
          because there is only ever one forge.
        </p>
        <div className="mt-7 flex flex-wrap gap-2">
          <Link to="/welcome" className="btn-primary btn h-10 px-5">
            Get started
          </Link>
          <Link to="/join" className="btn h-10 px-5">
            Create account
          </Link>
          <Link to="/studio" search={{ prompt: "" }} className="btn h-10 px-5">
            Open Studio
          </Link>
        </div>

        <div className="mt-8 font-mono text-sm text-muted">
          {factsError ? (
            <p>
              Live counts unavailable right now — the forge didn't answer ({factsError}).
              This page prints real numbers or none.
            </p>
          ) : facts === null ? (
            <p>Reading the forge…</p>
          ) : (
            <p>
              <span className="text-fg">{facts.workspaceCount}</span> workspaces ·{" "}
              <span className="text-fg">{facts.repoCount}</span> repos ·{" "}
              <span className="text-fg">{facts.abilityCount}</span> abilities — read live
              from the forge just now
            </p>
          )}
        </div>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Organize
          </p>
          <h2 className="mt-2 font-display text-2xl">Workspaces</h2>
          <p className="mt-2 text-sm text-muted">
            Repos and sites grouped under one owner, nestable into trees, with a live
            status rollup and per-repo project details computed from the bare repos
            themselves. A product, its repos, its site — one object.
          </p>
          <Link
            to="/workspaces"
            className="mt-4 inline-flex items-center gap-1 text-sm text-seal hover:underline"
          >
            Browse workspaces <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="panel p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Identify
          </p>
          <h2 className="mt-2 font-display text-2xl">Accounts + agents</h2>
          <p className="mt-2 text-sm text-muted">
            A person signs up and owns a namespace. Their agents get their own identities —
            scoped tokens, minted by the owner, revocable, shown once. An agent acts as
            its human, inside its scopes, and can never reach another account's work.
          </p>
          <Link
            to="/join"
            className="mt-4 inline-flex items-center gap-1 text-sm text-seal hover:underline"
          >
            Create your account <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="panel p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Connect
          </p>
          <h2 className="mt-2 font-display text-2xl">Every door, one forge</h2>
          <p className="mt-2 text-sm text-muted">
            REST, an installable SDK + CLI kit, and an MCP server — vendor-neutral, built
            for any AI. The agent flow is five steps: discover, install, import, organize,
            verify. A fresh agent can cold-start from the docs alone; one did, and the kit
            carries its fixes.
          </p>
          <Link
            to="/agents"
            className="mt-4 inline-flex items-center gap-1 text-sm text-seal hover:underline"
          >
            The agent flow <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <section className="mt-16">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              On the forge, live
            </p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl">Workspaces</h2>
          </div>
          <Link to="/workspaces" className="text-sm text-muted underline">
            All workspaces
          </Link>
        </div>
        {factsError ? (
          <p className="mt-4 text-sm text-muted">
            Not shown right now — the forge didn't answer, and this section is read live or
            not at all.
          </p>
        ) : facts === null ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : facts.workspaces.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No workspaces yet — yours could be first.</p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.workspaces.map((w) => (
              <Link
                key={w.id}
                to="/workspaces/$workspaceId"
                params={{ workspaceId: w.id }}
                className="panel group block p-4 transition-colors hover:border-seal"
              >
                <p className="font-display text-lg">{w.name}</p>
                <p className="font-mono text-xs text-subtle">
                  {w.owner}/{w.slug}
                </p>
                {w.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{w.description}</p>
                ) : null}
                <p className="mt-3 text-[11px] text-subtle">
                  {w.repos.length} repo{w.repos.length === 1 ? "" : "s"}
                  {w.siteIds.length
                    ? ` · ${w.siteIds.length} site${w.siteIds.length === 1 ? "" : "s"}`
                    : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-16">
        <ForgeVersion />
        <ForgeDoors />
      </section>

      <section className="panel mt-16 p-8 sm:p-10">
        <h2 className="font-display text-3xl leading-[0.95] sm:text-4xl">
          Bring your AI. Bring your work.
        </h2>
        <p className="mt-3 max-w-xl text-muted">
          Four steps — account, workspace, agent, import — and both of you are building on
          the same forge, under the same honest rules: real or labeled, verified by
          read-back, nothing faked.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/welcome" className="btn-primary btn h-10 px-5">
            Start the walk
          </Link>
          <Link to="/agents" className="btn h-10 px-5">
            For agents
          </Link>
        </div>
      </section>

      <footer className="mt-20 grid gap-8 border-t border-border pt-8 text-sm text-muted sm:grid-cols-4">
        <div>
          <p className="font-display text-lg text-fg">KILN</p>
          <p className="mt-2 max-w-xs">
            The forge of the pocketnova.app protocol — for people and all AI.
            ItsNotAI LABS.
          </p>
        </div>
        {[
          ["Product", ["/workspaces", "Workspaces"], ["/explore", "Explore"], ["/studio", "Studio"], ["/pricing", "Pricing"]],
          ["Create", ["/welcome", "Get started"], ["/join", "Create account"], ["/studio", "Studio"], ["/agents", "Import a project"]],
          ["Protocol", ["/agents", "Agents"], ["/mcp", "MCP"], ["/architecture", "Architecture"], ["/papers", "Papers"]],
        ].map(([title, ...links]) => (
          <div key={String(title)}>
            <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{title as string}</p>
            <ul className="mt-2 space-y-1">
              {(links as [string, string][]).map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="hover:text-fg">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </footer>
    </div>
  );
}
