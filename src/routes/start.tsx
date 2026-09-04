import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/start")({ component: Start });

function Start() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-5xl">Get started</h1>
      <ol className="mt-8 list-decimal space-y-4 pl-5 text-muted">
        <li>
          Connect a handle. No password. The wallet is local.
        </li>
        <li>
          <Link to="/new" className="text-seal hover:underline">Create a repository</Link> or{" "}
          <Link to="/new" search={{ tab: "import" }} className="text-seal hover:underline">import GitHub</Link>.
        </li>
        <li>Open Computer. Type <code>ls</code>. The tree is the machine.</li>
        <li>File an issue. Lock KLN if you want a bounty.</li>
        <li>Open a pull. Merge. Tag a release. Actions run on push.</li>
      </ol>
      <Link to="/studio" search={{ prompt: "" }} className="btn-primary btn mt-8 h-10 px-5">
        Open Studio
      </Link>
    </div>
  );
}
