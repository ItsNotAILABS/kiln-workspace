/**
 * Public / deployed document = the recovered KILN client.
 * Preview uses scripts/serve-original.mjs. Nitro/Vercel otherwise SSR
 * KilnBoot + TanStack Scripts on top of index-DkUKO55P.js (two Reacts,
 * blank public link). This middleware returns the original HTML for
 * every app document so the published origin matches the recovered app.
 */
import originalHtml from "../../public/index.html?raw";
// The frozen legacy snapshot (public/freeze/index.html) is a local, untracked
// artifact — it exists on machines that sealed the freeze but not in fresh
// clones. Load it with import.meta.glob so the build succeeds either way;
// /freeze serves it when present and 404s when it isn't.
const freezeModules = import.meta.glob("../../public/freeze/index.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const freezeHtml: string | null = freezeModules["../../public/freeze/index.html"] ?? null;
import { isDocumentPath } from "../../scripts/grok-pwa-shared.mjs";

interface KilnEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

function html(body: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default async function kilnOriginalDocument(
  event: KilnEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();

  const path = event.url.pathname;
  if (path === "/freeze" || path === "/freeze/" || path === "/freeze/index.html") {
    if (!freezeHtml) return new Response("Not found", { status: 404 });
    return html(freezeHtml);
  }
  if (!isDocumentPath(path)) return next();
  return html(originalHtml);
}
