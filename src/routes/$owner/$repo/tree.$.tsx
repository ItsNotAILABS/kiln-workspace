import { createFileRoute } from "@tanstack/react-router";
import { About, CodeToolbar, FileTree } from "@/components/RepoChrome";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/tree/$")({
  component: TreeView,
});

function TreeView() {
  const { owner, repo: name, _splat } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const dir = _splat || "";
  if (!repo) return null;
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div>
        <CodeToolbar owner={owner} name={name} branch={repo.defaultBranch} files={repo.files} />
        <FileTree files={repo.files} owner={owner} name={name} dir={dir} />
      </div>
      <About repo={repo} />
    </div>
  );
}
