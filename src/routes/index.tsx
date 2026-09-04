import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { VideoFrame } from "@/components/VideoFrame";
import { allRepos, starCount, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const kiln = useKiln();
  const featured = allRepos(kiln)
    .filter((r) => r.visibility === "public")
    .sort((a, b) => starCount(b, kiln) - starCount(a, kiln))
    .slice(0, 6);
  return (
    <div className="pb-8">
      <section className="relative overflow-hidden rounded-xl border border-border">
        <video className="aspect-[16/8] w-full object-cover sm:aspect-[21/9]" src="/marketing/hero.mp4" poster="/marketing/hero.jpg" autoPlay muted loop playsInline />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 py-8 sm:px-10 sm:py-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">Source control · L1</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            The repository is the computer
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base text-muted sm:text-lg">
            A sealed folder. A live runtime. A Merkle tree you can sit in.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/studio" search={{ prompt: "" }} className="btn-primary btn h-10 px-5">
              Open Studio
            </Link>
            <Link to="/new" className="btn h-10 px-5">
              New repository
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Runtime</p>
          <h2 className="mt-3 font-display text-4xl leading-[0.95] sm:text-5xl">The tree is the runtime</h2>
          <p className="mt-4 max-w-md text-muted">
            Open a repo and you get a computer: kilnsh, GPU, folder memory, a live preview of the working tree. Agents are processes on it. Issues lock KLN.
          </p>
          <Link to="/explore" search={{ q: "" }} className="mt-5 inline-flex items-center gap-1 text-sm text-seal hover:underline">
            Explore the forge <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <VideoFrame src="/marketing/computer.mp4" poster="/marketing/computer.jpg" caption="kilnsh on a sealed tree" />
      </section>

      <section className="mt-16 grid gap-10 lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
        <VideoFrame src="/marketing/git.mp4" poster="/marketing/git.jpg" caption="Every push settles" className="lg:order-1" />
        <div className="lg:order-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Git</p>
          <h2 className="mt-3 font-display text-4xl leading-[0.95] sm:text-5xl">Git, rewritten as a computer</h2>
          <p className="mt-4 max-w-md text-muted">
            Clone, commit, push — the verbs you already know. Under them: commit transactions, AES-256-GCM leaves, viewer grants with TTL. GitHub’s surface, a chain underneath.
          </p>
          <Link to="/new" search={{ tab: "import" }} className="mt-5 inline-flex items-center gap-1 text-sm text-seal hover:underline">
            Import a GitHub tree <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Memory</p>
          <h2 className="mt-3 font-display text-4xl leading-[0.95] sm:text-5xl">4D folder memory</h2>
          <p className="mt-4 max-w-md text-muted">
            50 GiB per folder. 4 MiB Merkle leaves. Occupied by agents. The same lattice that stores the tree boots a capsule — a live preview of the site, the app, the stream.
          </p>
          <Link to="/architecture" className="mt-5 inline-flex items-center gap-1 text-sm text-seal hover:underline">
            Read the architecture <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <VideoFrame src="/marketing/lattice.mp4" poster="/marketing/lattice.jpg" caption="Hilbert-painted cells" />
      </section>

      <section className="mt-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">On the forge</p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl">Public trees</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((r) => (
            <Link key={r.id} to="/$owner/$repo" params={{ owner: r.owner, repo: r.name }} className="panel group p-4 transition-colors hover:border-seal">
              <p className="font-mono text-sm">
                <span className="text-seal">{r.owner}</span>
                <span className="text-subtle"> / </span>
                {r.name}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{r.description}</p>
              <p className="mt-3 flex gap-3 text-[11px] text-subtle">
                <span>{r.language}</span>
                <span className="tabular-nums">{starCount(r, kiln)} stars</span>
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16 overflow-hidden rounded-xl border border-border">
        <div className="grid lg:grid-cols-2">
          <VideoFrame src="/marketing/merkle.mp4" poster="/marketing/merkle.jpg" className="rounded-none border-0" />
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <h2 className="font-display text-4xl leading-[0.95]">Open the Studio</h2>
            <p className="mt-4 max-w-md text-muted">One prompt. A sealed repository with a computer, a preview, and a resident agent. No empty README.</p>
            <Link to="/studio" search={{ prompt: "" }} className="btn-primary btn mt-6 h-10 w-fit px-5">
              Open Studio
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-20 grid gap-8 border-t border-border pt-8 text-sm text-muted sm:grid-cols-4">
        <div>
          <p className="font-display text-lg text-fg">KILN</p>
          <p className="mt-2 max-w-xs">The repository is the computer. Claimed 2026, ItsNotAI LABS.</p>
        </div>
        {[
          ["Product", ["/explore", "Explore"], ["/marketplace", "Marketplace"], ["/pricing", "Pricing"], ["/apps", "Apps"]],
          ["Create", ["/studio", "Studio"], ["/new", "New repository"], ["/new?tab=import", "Import GitHub"], ["/gists", "Gists"]],
          ["Docs", ["/start", "Get started"], ["/architecture", "Architecture"], ["/papers", "Papers"], ["/cli", "CLI"], ["/mcp", "MCP"]],
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
