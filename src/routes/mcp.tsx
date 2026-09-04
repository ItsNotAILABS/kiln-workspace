import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mcp")({ component: Mcp });

function Mcp() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-5xl">MCP</h1>
      <p className="mt-4 text-muted">Kiln speaks MCP so agents can list repos, look up GitHub, and import trees without a browser.</p>
      <pre className="panel mt-6 overflow-auto p-5 font-mono text-sm">{`tools:
  repos.list
  github.lookup
  github.import
  computer.help

POST /mcp  { "method": "tools/list" }`}</pre>
    </div>
  );
}
