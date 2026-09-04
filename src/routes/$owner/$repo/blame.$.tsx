import { createFileRoute, Link } from "@tanstack/react-router";
import { PathCrumbs } from "@/components/RepoChrome";
import { findRepo, useKiln } from "@/lib/kiln/store";
import { formatAgo } from "@/lib/utils";

export const Route = createFileRoute("/$owner/$repo/blame/$")({
  component: BlameView,
});

function BlameView() {
  const { owner, repo: name, _splat } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const path = _splat || "";
  const file = repo?.files.find((f) => f.path === path);
  if (!repo) return null;
  const lines = file?.content.split("\n") ?? [];
  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <PathCrumbs owner={owner} name={name} dir={path} />
        <Link to="/$owner/$repo/blob/$" params={{ owner, repo: name, _splat: path }} className="text-sm text-seal hover:underline">
          View file
        </Link>
      </div>
      <div className="overflow-auto rounded-xl border border-border">
        {file ? (
          <table className="w-full text-left font-mono text-[12px]">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-border/60 hover:bg-surface/60">
                  <td className="whitespace-nowrap px-3 py-0.5 text-subtle">{file.sha.slice(0, 7)}</td>
                  <td className="whitespace-nowrap px-3 py-0.5 text-muted">{repo.owner}</td>
                  <td className="whitespace-nowrap px-3 py-0.5 text-subtle">{formatAgo(file.updatedAt)}</td>
                  <td className="w-10 px-2 py-0.5 text-right text-subtle">{i + 1}</td>
                  <td className="px-3 py-0.5 whitespace-pre">{line || " "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-8 text-center text-muted">File not in this tree.</p>
        )}
      </div>
    </div>
  );
}
