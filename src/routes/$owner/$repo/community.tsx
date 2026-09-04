import { createFileRoute, Link } from "@tanstack/react-router";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/community")({
  component: Community,
});

function Community() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  if (!repo) return null;
  const has = (re: RegExp) => repo.files.some((f) => re.test(f.path));
  const items = [
    ["README", has(/readme/i), `/${owner}/${name}`],
    ["License", !!repo.license || has(/license/i), `/${owner}/${name}/blob/${repo.files.find((f) => /license/i.test(f.path))?.path || "LICENSE"}`],
    ["Contributing", has(/contributing/i), `/${owner}/${name}`],
    ["Code of conduct", has(/code.of.conduct/i), `/${owner}/${name}`],
    ["Security policy", true, `/${owner}/${name}/security`],
    ["Issue templates", true, `/${owner}/${name}/issues`],
    ["Pull request template", true, `/${owner}/${name}/compare`],
  ] as const;
  const score = items.filter((i) => i[1]).length;
  return (
    <div className="mt-5 mx-auto max-w-2xl">
      <h1 className="font-display text-3xl">Community</h1>
      <p className="mt-2 text-sm text-muted">Recommended files for a healthy public tree. {score}/{items.length} present.</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-ok" style={{ width: `${(score / items.length) * 100}%` }} />
      </div>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
        {items.map(([label, ok, href]) => (
          <li key={label} className="flex items-center justify-between px-4 py-3">
            <span>{label}</span>
            <span className={ok ? "text-ok text-sm" : "text-muted text-sm"}>{ok ? "Added" : "Missing"}</span>
            <a href={href} className="text-sm text-seal hover:underline">
              Open
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        Code of conduct: be precise, cite the tree, no drive-by noise. Security reports go through{" "}
        <Link to="/$owner/$repo/security" params={{ owner, repo: name }} className="text-seal hover:underline">
          Security
        </Link>
        .
      </p>
    </div>
  );
}
