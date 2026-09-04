import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { formatAgo } from "@/lib/utils";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/releases")({
  component: Releases,
});

function Releases() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  if (!repo) return null;
  const rows = kiln.releases.filter((r) => r.repoId === repo.id);
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Releases</h2>
        <button type="button" className="btn-primary btn h-8" onClick={() => setOpen((v) => !v)}>
          Draft a release
        </button>
      </div>
      {open ? (
        <form
          className="panel mt-4 space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            kiln.addRelease(repo.id, tag, title || tag, body);
            setOpen(false);
            setTag("");
            setTitle("");
            setBody("");
          }}
        >
          <input className="input" required placeholder="Tag (v1.0.0)" value={tag} onChange={(e) => setTag(e.target.value)} />
          <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input" placeholder="Notes" value={body} onChange={(e) => setBody(e.target.value)} />
          <button type="submit" className="btn-primary btn h-9">
            Publish
          </button>
        </form>
      ) : null}
      <ul className="mt-4 space-y-4">
        {rows.map((r) => (
          <li key={r.id} className="panel p-5">
            <p className="font-mono text-seal">{r.tag}</p>
            <h3 className="mt-1 font-display text-2xl">{r.title}</h3>
            <p className="text-xs text-muted">
              {r.author} · {formatAgo(r.createdAt)}
            </p>
            <div className="mt-3">
              <Markdown source={r.body} />
            </div>
            <ul className="mt-3 text-sm text-muted">
              {r.assets.map((a) => (
                <li key={a.name} className="font-mono">
                  {a.name} · {a.size}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {!rows.length ? <p className="text-sm text-muted">No releases yet.</p> : null}
      </ul>
    </div>
  );
}
