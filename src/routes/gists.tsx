import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/gists")({ component: Gists });

function Gists() {
  const kiln = useKiln();
  const nav = useNavigate();
  const [description, setDescription] = useState("");
  const [name, setName] = useState("note.ts");
  const [content, setContent] = useState("");
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div>
        <h1 className="font-display text-4xl">Gists</h1>
        <form
          className="panel mt-4 space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const g = kiln.createGist(description, name, content, true);
            nav({ to: "/gists/$id", params: { id: g.id } });
          }}
        >
          <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="input min-h-32 font-mono" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Snippet" required />
          <button type="submit" className="btn-primary btn h-9">
            Create gist
          </button>
        </form>
      </div>
      <aside>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Public</p>
        <ul className="mt-2 space-y-2">
          {kiln.gists.map((g) => (
            <li key={g.id}>
              <Link to="/gists/$id" params={{ id: g.id }} className="text-sm hover:text-seal">
                {g.owner} / {g.files[0]?.name}
              </Link>
              <p className="text-xs text-muted">{g.description}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
