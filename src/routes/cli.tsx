import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cli")({ component: Cli });

function Cli() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-5xl">CLI</h1>
      <pre className="panel mt-6 overflow-auto p-5 font-mono text-sm">{`kiln auth --wallet
kiln clone kiln-labs/protocol
kiln verify --on-chain
git clone kiln://kiln-labs/protocol.git
# drop public/cli/git-remote-kiln on your PATH`}</pre>
      <p className="mt-4 text-sm text-muted">The remote helper speaks capabilities, list, push, fetch. Every git push settles.</p>
    </div>
  );
}
