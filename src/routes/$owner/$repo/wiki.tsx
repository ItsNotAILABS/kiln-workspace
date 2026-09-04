import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/wiki")({
  component: Wiki,
});

function Wiki() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const pages = kiln.wiki.filter((w) => w.repoId === repo?.id);
  const [slug, setSlug] = useState(pages[0]?.slug ?? "Home");
  const page = pages.find((p) => p.slug === slug);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(page?.title ?? "Home");
  const [body, setBody] = useState(page?.body ?? "");
  const [newSlug, setNewSlug] = useState("");
  useEffect(() => {
    setTitle(page?.title ?? slug);
    setBody(page?.body ?? "");
  }, [page?.title, page?.body, slug]);
  if (!repo) return null;
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[14rem_1fr]">
      <aside className="panel p-3">
        <p className="px-2 text-[11px] uppercase tracking-[0.16em] text-muted">Pages</p>
        <ul className="mt-2">
          {pages.map((p) => (
            <li key={p.slug}>
              <button type="button" className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${p.slug === slug ? "bg-surface-2" : "text-muted hover:text-fg"}`} onClick={() => { setSlug(p.slug); setEditing(false); }}>
                {p.title}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newSlug.trim()) return;
            kiln.saveWiki(repo.id, newSlug.trim().replace(/\s+/g, "-"), newSlug, `# ${newSlug}\n`);
            setSlug(newSlug.trim().replace(/\s+/g, "-"));
            setNewSlug("");
          }}
        >
          <input className="input h-8" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="New page" />
        </form>
      </aside>
      <div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl">{page?.title ?? slug}</h1>
          <button type="button" className="btn h-8" onClick={() => setEditing((v) => !v)}>
            {editing ? "Preview" : "Edit"}
          </button>
        </div>
        {editing ? (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              kiln.saveWiki(repo.id, slug, title, body);
              setEditing(false);
            }}
          >
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="input min-h-[22rem] font-mono text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
            <button type="submit" className="btn-primary btn h-9">
              Save page
            </button>
          </form>
        ) : (
          <div className="panel mt-4 p-5">
            <Markdown source={page?.body ?? "_Empty page._"} />
          </div>
        )}
      </div>
    </div>
  );
}
