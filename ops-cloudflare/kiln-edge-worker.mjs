/**
 * kiln.pocketnova.app — the REAL KILN app (Grok's original build) on
 * Cloudflare, working with the local machine the way the app works:
 *
 *   - Static app: the frozen original build (public/) served from
 *     Worker assets — production is NOT tied to Grok servers.
 *   - /_serverFn/*: the app's designed stub, {result:null} (parity
 *     with scripts/serve-original.mjs).
 *   - /api/kiln*, /api/mcp, /api/github*, /api/forge*: proxied through the tunnel
 *     to the original server running on the architect's iron
 *     (kiln-original.service, :8931) — agent turns, the Kiln API and
 *     the GitHub engine live there, SSE streams pass through.
 *   - Everything else: static file, else the SPA shell (fetched as / —
 *     the assets binding 307-redirects /index.html to /, so fetching the
 *     shell by name bounced every cold deep link home);
 *     missing /assets/* stays a real 404, like the original server.
 */
const FALLBACK_ORIGIN = "https://kiln-original.medinatechlabs.net";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/_serverFn/")) {
      return new Response(JSON.stringify({ result: null }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (path.startsWith("/api/kiln") || path === "/api/mcp" || path.startsWith("/api/github") || path.startsWith("/api/forge")) {
      const origin = env.ORIGINAL_API_URL || FALLBACK_ORIGIN;
      const target = new URL(path + url.search, origin);
      const headers = new Headers(request.headers);
      headers.delete("host");
      const init = { method: request.method, headers, redirect: "manual" };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
        init.duplex = "half";
      }
      const resp = await fetch(target, init);
      return new Response(resp.body, { status: resp.status, headers: resp.headers });
    }

    if (path === "/freeze" || path === "/freeze/") {
      return env.ASSETS.fetch(new Request(new URL("/freeze/index.html", url), request));
    }

    let resp;
    try {
      resp = await env.ASSETS.fetch(request);
    } catch {
      // The assets binding throws on non-GET/HEAD requests whose path
      // engages its not-found fallback (measured live: error 1101 on
      // POST /explore and POST /, while a real asset file answers 405).
      // Every dynamic POST belongs to /api/* or /_serverFn/* above, so
      // anything that lands here is an honest 404.
      return new Response("not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (resp.status === 404) {
      if (path.startsWith("/assets/")) return resp;
      // SPA fallback, scoped to navigation-like GETs: app routes are
      // extensionless or arrive with Accept: text/html. API-shaped paths,
      // non-GET methods and file-like paths keep the honest 404.
      if (path.startsWith("/api/")) return resp;
      if (request.method !== "GET" && request.method !== "HEAD") return resp;
      const accept = request.headers.get("accept") || "";
      const lastSeg = path.slice(path.lastIndexOf("/") + 1);
      if (!accept.includes("text/html") && lastSeg.includes(".")) return resp;
      // Fetch "/" rather than "/index.html": the assets binding
      // canonicalizes /index.html with a 307 redirect to /, which is what
      // used to bounce every cold deep link back home. "/" serves the
      // app shell directly with a 200.
      const shell = await env.ASSETS.fetch(new Request(new URL("/", url), request));
      // Public discovery routes get an agent-readable snapshot of their
      // public data injected into the shell (see ssrEnhance below).
      if (request.method === "GET") {
        const route = ssrRoute(url);
        if (route) return ssrServe(request, url, route, shell, env);
      }
      return shell;
    }
    return resp;
  },
};

// ---------------------------------------------------------------------------
// Agent-readable public surface.
//
// KILN's users are agents: a public page that only exists after JavaScript
// runs is a page that does not exist. For the public discovery routes —
// /explore, /:owner, /:owner/:repo — the edge injects a server-rendered,
// text-only snapshot of the route's anonymous public data into the shell.
// The data comes from the same origin endpoints the app itself reads
// (/api/kiln/public/*), which read the forge with no credential: public
// repos only, by construction, so a private repo can never appear here.
//
// Humans never see the snapshot: the shell's <head> adds a `js` class to
// <html> before first paint and hides [data-kiln-ssr] under it, and the
// app boots over #app exactly as before. Everything is fail-soft — a slow
// or dark origin yields the plain shell plus the machine pointer, and a
// page load never waits on the snapshot for more than SSR_TIMEOUT_MS.
// ---------------------------------------------------------------------------
const SSR_TIMEOUT_MS = 3000;
const SSR_HANDLE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const SSR_REPO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
// First segments that are app pages, not account handles.
const SSR_RESERVED = new Set([
  "models", "studio", "explore", "marketplace", "chain", "login", "signup",
  "new", "gists", "account", "settings", "wallet", "pricing", "gpu",
  "freeze", "world", "computer", "lattice", "memory", "security", "claims",
  "papers", "cloud", "insights", "diagrams", "tool-schema",
]);

const SSR_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function ssrEsc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => SSR_ESCAPES[c]);
}

function ssrJsonLd(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// Classify a path as a public discovery route, or return null. Handles
// are validated with the origin's own rule (lowercase [a-z0-9-]) so the
// snapshot only ever addresses accounts the public API can answer for.
function ssrRoute(url) {
  if (url.pathname === "/explore") {
    return { kind: "explore", q: (url.searchParams.get("q") || "").trim() };
  }
  const segs = url.pathname.split("/").filter(Boolean);
  if (
    segs.length === 1 &&
    SSR_HANDLE_RE.test(segs[0]) &&
    !SSR_RESERVED.has(segs[0].toLowerCase())
  ) {
    return { kind: "profile", owner: segs[0].toLowerCase() };
  }
  if (
    segs.length === 2 &&
    SSR_HANDLE_RE.test(segs[0]) &&
    !SSR_RESERVED.has(segs[0].toLowerCase()) &&
    SSR_REPO_RE.test(segs[1])
  ) {
    return { kind: "repo", owner: segs[0].toLowerCase(), repo: segs[1] };
  }
  return null;
}

function ssrApiUrl(route, site) {
  if (route.kind === "explore") {
    return `${site}/api/kiln/public/search?q=${encodeURIComponent(route.q)}`;
  }
  return `${site}/api/kiln/public/accounts/${encodeURIComponent(route.owner)}/repos`;
}

// { ok: true, data } is a real answer — a 200 with empty collections
// renders an honest snapshot of it. { ok: false } means "no answer"
// (timeout, error, non-200): the caller then serves the plain shell.
// The timeout runs on an explicit AbortController rather than
// AbortSignal.timeout so the budget holds in every runtime.
async function ssrFetchJson(origin, path) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SSR_TIMEOUT_MS);
  try {
    const res = await fetch(new URL(path, origin), {
      headers: { accept: "application/json" },
      signal: ctl.signal,
    });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, reason: ctl.signal.aborted ? "timeout" : "error" };
  } finally {
    clearTimeout(timer);
  }
}

function ssrRepoArticle(rec) {
  const meta = ["Public"];
  if (rec.language) meta.push(ssrEsc(rec.language));
  if (typeof rec.commitCount === "number") meta.push(`${rec.commitCount} commits`);
  if (typeof rec.fileCount === "number") meta.push(`${rec.fileCount} files`);
  let html =
    `<article><h2><a href="/${ssrEsc(rec.owner)}/${ssrEsc(rec.name)}">` +
    `${ssrEsc(rec.owner)}/${ssrEsc(rec.name)}</a></h2>`;
  if (rec.description) html += `<p>${ssrEsc(rec.description)}</p>`;
  html += `<p>${meta.join(" · ")}</p>`;
  if (rec.tip) {
    html +=
      `<p>Latest commit: ${ssrEsc(rec.tip.subject || "")} (${ssrEsc(rec.tip.shortSha || "")})` +
      `${rec.tip.author ? ` by ${ssrEsc(rec.tip.author)}` : ""}` +
      `${rec.tip.date ? ` on ${ssrEsc(rec.tip.date)}` : ""}</p>`;
  }
  return html + "</article>";
}

function ssrExplore(route, data, site) {
  if (!route.q) {
    // No query: there is no anonymous "list everything" endpoint, so the
    // snapshot describes the surface and points at the machine-readable
    // doors instead of inventing a listing.
    return {
      block:
        `<section data-kiln-ssr="explore" aria-label="Public discovery on KILN">` +
        `<h1>Explore — public repositories on KILN</h1>` +
        `<p>KILN is a forge whose users are agents as much as people, so its public surface is readable without JavaScript and without an account. This page is the discovery view of the forge: public accounts and the repositories they publish.</p>` +
        `<p>Search it at /explore?q=&lt;handle-or-name&gt;. The same data is served as JSON at ${ssrEsc(ssrApiUrl(route, site))}, and every public account publishes its repositories at /api/kiln/public/accounts/&lt;owner&gt;/repos.</p>` +
        `</section>`,
      jsonLd: null,
    };
  }
  if (data === undefined) return { block: "", jsonLd: null };
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const repos = (Array.isArray(data?.repos) ? data.repos : []).filter((r) => r && r.owner && r.name);
  let inner = `<h1>Explore — public results for “${ssrEsc(route.q)}”</h1>`;
  if (!accounts.length && !repos.length) {
    inner += `<p>No public accounts or repositories in this snapshot. Live results: ${ssrEsc(ssrApiUrl(route, site))}</p>`;
  }
  if (accounts.length) {
    inner +=
      `<h2>Accounts</h2><ul>` +
      accounts
        .map(
          (a) =>
            `<li><a href="/${ssrEsc(a.owner)}">${ssrEsc(a.owner)}</a> — ${Number(a.repoCount) || 0} public repositories</li>`,
        )
        .join("") +
      `</ul>`;
  }
  if (repos.length) {
    inner += `<h2>Public repositories</h2>` + repos.map(ssrRepoArticle).join("");
  }
  const jsonLd = repos.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: repos.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${site}/${r.owner}/${r.name}`,
          name: `${r.owner}/${r.name}`,
        })),
      }
    : null;
  return {
    block: `<section data-kiln-ssr="explore" aria-label="Public discovery on KILN">${inner}</section>`,
    jsonLd,
  };
}

function ssrProfile(route, data, site) {
  if (data === undefined) return { block: "", jsonLd: null };
  const repos = (Array.isArray(data?.repos) ? data.repos : []).filter((r) => r && r.owner && r.name);
  let inner = `<h1>${ssrEsc(route.owner)}</h1>`;
  if (!repos.length) {
    // Unknown handles answer exactly like accounts with no public repos —
    // the same no-oracle posture as the public API itself.
    inner += `<p>No public repositories in this snapshot. Live data: ${ssrEsc(ssrApiUrl(route, site))}</p>`;
    return {
      block: `<section data-kiln-ssr="profile" aria-label="Public account on KILN">${inner}</section>`,
      jsonLd: null,
    };
  }
  inner +=
    `<p>${repos.length} public ${repos.length === 1 ? "repository" : "repositories"} on KILN.</p>` +
    repos.map(ssrRepoArticle).join("");
  return {
    block: `<section data-kiln-ssr="profile" aria-label="Public account on KILN">${inner}</section>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      mainEntity: { "@type": "Person", name: route.owner, url: `${site}/${route.owner}` },
    },
  };
}

function ssrRepo(route, data, site) {
  if (data === undefined) return { block: "", jsonLd: null };
  const repos = Array.isArray(data?.repos) ? data.repos : [];
  const rec = repos.find((r) => r && r.name === route.repo);
  const title = `${ssrEsc(route.owner)}/${ssrEsc(route.repo)}`;
  if (!rec) {
    // Private and nonexistent repos answer identically — no oracle.
    return {
      block:
        `<section data-kiln-ssr="repo" aria-label="Public repository on KILN">` +
        `<h1>${title}</h1>` +
        `<p>This repository is not available in the public snapshot — it may be private or may not exist. Public data for this account: ${ssrEsc(ssrApiUrl(route, site))}</p>` +
        `</section>`,
      jsonLd: null,
    };
  }
  const meta = ["Public"];
  if (rec.language) meta.push(ssrEsc(rec.language));
  if (rec.defaultBranch) meta.push(`default branch ${ssrEsc(rec.defaultBranch)}`);
  if (typeof rec.commitCount === "number") meta.push(`${rec.commitCount} commits`);
  if (typeof rec.fileCount === "number") meta.push(`${rec.fileCount} files`);
  let inner =
    `<h1><a href="/${ssrEsc(rec.owner)}/${ssrEsc(rec.name)}">${title}</a></h1>` +
    (rec.description ? `<p>${ssrEsc(rec.description)}</p>` : "") +
    `<p>${meta.join(" · ")}</p>`;
  if (rec.tip) {
    inner +=
      `<p>Latest commit: ${ssrEsc(rec.tip.subject || "")} (${ssrEsc(rec.tip.shortSha || "")})` +
      `${rec.tip.author ? ` by ${ssrEsc(rec.tip.author)}` : ""}` +
      `${rec.tip.date ? ` on ${ssrEsc(rec.tip.date)}` : ""}</p>`;
  }
  const files = Array.isArray(rec.files) ? rec.files.filter((f) => f && f.path) : [];
  if (files.length) {
    inner +=
      `<h2>Files</h2><ul>` +
      files
        .map((f) => `<li>${ssrEsc(f.path)}${f.language ? ` (${ssrEsc(f.language)})` : ""}</li>`)
        .join("") +
      `</ul>`;
  }
  if (typeof rec.readme === "string" && rec.readme) {
    const cap = 12000;
    const text =
      rec.readme.length > cap
        ? rec.readme.slice(0, cap) + "\n… (truncated — full text via the public API)"
        : rec.readme;
    inner += `<h2>README</h2><pre>${ssrEsc(text)}</pre>`;
  }
  const commits = Array.isArray(rec.commits) ? rec.commits.filter((c) => c && c.subject) : [];
  if (commits.length) {
    inner +=
      `<h2>Recent commits</h2><ul>` +
      commits
        .slice(0, 12)
        .map(
          (c) =>
            `<li>${ssrEsc(c.subject)} — ${ssrEsc(c.author || "unknown")}${c.date ? `, ${ssrEsc(c.date)}` : ""}</li>`,
        )
        .join("") +
      `</ul>`;
  }
  return {
    block: `<section data-kiln-ssr="repo" aria-label="Public repository on KILN">${inner}</section>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: rec.name,
      ...(rec.description ? { description: rec.description } : {}),
      codeRepository: `${site}/${rec.owner}/${rec.name}`,
      ...(rec.language ? { programmingLanguage: rec.language } : {}),
      author: { "@type": "Person", name: rec.owner },
    },
  };
}

// Inject the snapshot + machine pointers into the shell and serve it.
// Cache: enriched snapshots are public and anonymous, so they may be
// shared at the edge for 60s; the plain fail-soft shell is never cached
// by this layer.
async function ssrServe(request, url, route, shell, env) {
  const cache = globalThis.caches?.default;
  if (cache) {
    try {
      const hit = await cache.match(request);
      if (hit) return hit;
    } catch {
      /* the cache is an optimization only */
    }
  }
  const site = url.origin;
  let block = "";
  let jsonLd = null;
  // Reported on the x-kiln-ssr header so an agent reader can tell a
  // rendered snapshot from a fail-soft shell without guessing.
  let outcome = "unavailable";
  try {
    const origin = env.ORIGINAL_API_URL || FALLBACK_ORIGIN;
    let built;
    if (route.kind === "explore" && !route.q) {
      built = ssrExplore(route, null, site);
      outcome = "descriptive";
    } else if (route.kind === "explore") {
      const r = await ssrFetchJson(
        origin,
        `/api/kiln/public/search?q=${encodeURIComponent(route.q)}`,
      );
      built = ssrExplore(route, r.ok ? r.data : undefined, site);
      outcome = r.ok ? "data" : "unavailable";
    } else {
      const r = await ssrFetchJson(
        origin,
        `/api/kiln/public/accounts/${encodeURIComponent(route.owner)}/repos`,
      );
      const data = r.ok ? r.data : undefined;
      built = route.kind === "profile" ? ssrProfile(route, data, site) : ssrRepo(route, data, site);
      outcome = r.ok ? "data" : "unavailable";
    }
    block = built.block;
    jsonLd = built.jsonLd;
  } catch {
    /* fail-soft: plain shell + machine pointer below */
    outcome = "unavailable";
  }

  let html = await shell.text();
  let head = `<link rel="alternate" type="application/json" href="${ssrEsc(ssrApiUrl(route, site))}" />`;
  if (jsonLd) head += `<script type="application/ld+json">${ssrJsonLd(jsonLd)}</script>`;
  // Function replacers: snapshot text is untrusted and may contain $&
  // and friends, which string replacements would reinterpret.
  html = html.replace("</head>", () => head + "\n  </head>");
  if (block) html = html.replace("</body>", () => block + "\n</body>");
  const headers = new Headers(shell.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("x-kiln-ssr", outcome);
  if (block) headers.set("cache-control", "public, max-age=60");
  const out = new Response(html, { status: shell.status, headers });
  if (cache && block) {
    try {
      await cache.put(request, out.clone());
    } catch {
      /* the cache is an optimization only */
    }
  }
  return out;
}

