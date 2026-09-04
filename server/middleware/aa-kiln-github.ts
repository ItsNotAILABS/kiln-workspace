/**
 * Same-origin GitHub import engine + agent turn on deploy.
 * Preview uses scripts/serve-original.mjs; Nitro uses this middleware.
 */
import { handleGithubRequest } from "../../scripts/github-engine.mjs";
import { handleKilnApi, runAgentTurnStream } from "../../scripts/agent-turn.mjs";

interface KilnEvent {
  url: URL;
  req: { method: string; headers: Headers; text?: () => Promise<string> };
}

export default async function kilnGithubMiddleware(
  event: KilnEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const path = event.url.pathname;
  if (path.startsWith("/api/kiln") || path === "/api/mcp") {
    const bodyText = event.req.method === "POST" || event.req.method === "PUT" ? (await event.req.text?.()) || "" : "";
    let parsed = {};
    try {
      parsed = JSON.parse(bodyText || "{}");
    } catch {
      parsed = {};
    }
    const accept = event.req.headers?.get?.("accept") || "";
    const wantsStream =
      path === "/api/kiln/agent-turn" && ((parsed as { stream?: boolean }).stream === true || accept.includes("text/event-stream"));
    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          await runAgentTurnStream(parsed, (ev: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
          });
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
        },
      });
    }
    const result = await handleKilnApi(path, {
      method: event.req.method,
      bodyText,
      query: Object.fromEntries(event.url.searchParams),
    });
    if (result) return new Response(result.body, { status: result.status, headers: result.headers });
    return next();
  }
  if (!path.startsWith("/api/github")) return next();

  const q = new URLSearchParams(event.url.searchParams);
  if (event.req.method === "POST" || event.req.method === "PUT") {
    try {
      const body = JSON.parse((await event.req.text?.()) || "{}") as Record<string, unknown>;
      const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
      if (data.query || data.q) q.set("q", String(data.query || data.q));
      if (data.owner) q.set("owner", String(data.owner));
      if (data.repo) q.set("repo", String(data.repo));
    } catch {
      /* ignore */
    }
  }
  const result = await handleGithubRequest(path, q);
  if (!result) return next();
  return new Response(result.body, { status: result.status, headers: result.headers });
}
