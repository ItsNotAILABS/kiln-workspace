import { createFileRoute } from "@tanstack/react-router";
import { useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/gists/$id")({ component: GistView });

function GistView() {
  const { id } = Route.useParams();
  const kiln = useKiln();
  const gist = kiln.gists.find((g) => g.id === id);
  if (!gist) return <p className="py-16 text-center text-muted">Gist not found.</p>;
  const starred = kiln.gistStars[id];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-muted">{gist.owner}</p>
          <h1 className="font-display text-3xl">{gist.description || gist.files[0]?.name}</h1>
          <p className="mt-1 text-xs text-subtle">{gist.public ? "Public" : "Secret"} gist</p>
        </div>
        <button type="button" className="btn h-8" onClick={() => kiln.starGist(id)}>
          {starred ? "Unstar" : "Star"} · {gist.stars + (starred ? 1 : 0)}
        </button>
      </div>
      {gist.files.map((f) => (
        <div key={f.name} className="mt-4 overflow-hidden rounded-xl border border-border">
          <p className="border-b border-border bg-surface px-3 py-2 font-mono text-xs">{f.name}</p>
          <pre className="overflow-auto p-4 font-mono text-[13px]">{f.content}</pre>
        </div>
      ))}
    </div>
  );
}
