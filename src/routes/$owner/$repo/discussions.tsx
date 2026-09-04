import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { formatAgo } from "@/lib/utils";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/discussions")({
  component: Discussions,
});

function Discussions() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [sel, setSel] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  if (!repo) return null;
  const rows = kiln.discussions.filter((d) => d.repoId === repo.id);
  const current = rows.find((d) => d.id === sel);
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div>
        <form
          className="panel mb-4 space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            kiln.addDiscussion(repo.id, title, body, "General");
            setTitle("");
            setBody("");
          }}
        >
          <input className="input" placeholder="Start a discussion" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea className="input" placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} />
          <button type="submit" className="btn-primary btn h-9">
            Start discussion
          </button>
        </form>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((d) => (
            <li key={d.id}>
              <button type="button" className="w-full px-4 py-3 text-left" onClick={() => setSel(d.id)}>
                <p className="font-medium">{d.title}</p>
                <p className="text-xs text-muted">
                  #{d.number} · {d.category} · {d.author} · {formatAgo(d.createdAt)} · {d.comments.length} replies
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <aside>
        {current ? (
          <div className="panel p-4">
            <h3 className="font-display text-xl">{current.title}</h3>
            <div className="mt-2">
              <Markdown source={current.body} />
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {current.comments.map((c) => (
                <li key={c.id} className="border-t border-border pt-2">
                  <p className="text-xs text-muted">{c.author}</p>
                  {c.body}
                </li>
              ))}
            </ul>
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                kiln.replyDiscussion(current.id, reply);
                setReply("");
              }}
            >
              <textarea className="input" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply" />
              <button type="submit" className="btn mt-2 h-8">
                Reply
              </button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-muted">Select a thread.</p>
        )}
      </aside>
    </div>
  );
}
