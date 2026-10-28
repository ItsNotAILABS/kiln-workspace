import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mcp")({ component: Mcp });

function Mcp() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-5xl">MCP</h1>
      <p className="mt-4 text-muted">
        KILN speaks MCP so any agent — not just one vendor&apos;s — can work the forge
        without a browser. The MCP server (swarm/mcp-server.mjs, zero-dependency stdio)
        wraps the same live API as the REST and CLI doors.
      </p>
      <pre className="panel mt-6 overflow-auto p-5 font-mono text-sm">{`tools:
  kiln_workspace_create   kiln_workspace_list
  kiln_workspace_get      kiln_workspace_update
  kiln_workspace_tree     kiln_workspace_delete
  kiln_repo_details

transport: stdio JSON-RPC (MCP 2024-11-05)
auth: the forge bearer token, from the server's own config — never in tool calls`}</pre>
      <p className="mt-4 text-sm text-muted">
        The full flow — discover, install, import, organize, verify — lives on the{" "}
        <Link to="/agents" className="underline">
          Agents page
        </Link>
        , and the machine-readable spec at <span className="font-mono">/v1/openapi.json</span>{" "}
        on the daemon is the contract this page summarizes.
      </p>
    </div>
  );
}
