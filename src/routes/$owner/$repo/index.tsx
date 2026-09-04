import { createFileRoute, Link } from "@tanstack/react-router";
import { About, CodeToolbar, FileTree, Readme } from "@/components/RepoChrome";
import { allCommits, findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/")({
  component: CodeTab,
});

function CodeTab() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const commits = allCommits(repo);
  const branches = kiln.branches.filter((b) => b.repoId === repo.id);
  const tags = kiln.releases.filter((r) => r.repoId === repo.id);
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div>
        <CodeToolbar owner={owner} name={name} branch={repo.defaultBranch} files={repo.files} />
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
          <Link to="/$owner/$repo/commits" params={{ owner, repo: name }} className="hover:text-fg">
            {commits.length} commits
          </Link>
          <Link to="/$owner/$repo/branches" params={{ owner, repo: name }} className="hover:text-fg">
            {Math.max(branches.length, 1)} branches
          </Link>
          <Link to="/$owner/$repo/tags" params={{ owner, repo: name }} className="hover:text-fg">
            {tags.length} tags
          </Link>
          <Link to="/$owner/$repo/compare" params={{ owner, repo: name }} search={{ base: "main", head: "" }} className="hover:text-fg">
            Compare
          </Link>
        </div>
        <FileTree files={repo.files} owner={owner} name={name} />
        <Readme source={repo.readme} />
      </div>
      <About repo={repo} />
    </div>
  );
}
