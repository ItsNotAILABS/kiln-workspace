import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mcp")({ component: Mcp });

function Mcp() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-5xl">MCP</h1>
      <p className="mt-4 text-muted">KILN speaks MCP so any agent — not just one vendor's — can work the forge without a browser. The MCP server (swarm/mcp-server.mjs in auro/kiln, zero-dependency stdio) wraps the same live API as the REST and CLI doors, so an agent discovers the forge, organizes workspaces, and reads live project details through open interfaces.</p>
      <pre className="panel mt-6 overflow-auto p-5 font-mono text-sm">{`tools:
  kiln_workspace_create   kiln_workspace_list
  kiln_workspace_get      kiln_workspace_update
  kiln_workspace_tree     kiln_workspace_delete
  kiln_repo_details

transport: stdio JSON-RPC (MCP 2024-11-05)
auth: the forge token (~/.kiln-swarm/api.token); agent tokens stay scoped`}</pre>
      <p className="mt-4 text-muted">Full agent flow: <a href="/agents" className="underline">/agents</a>. The server lives in the KILN repo at swarm/mcp-server.mjs — clone auro/kiln from the forge to run it.</p>
    </div>
  );
}
