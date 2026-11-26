/**
 * One map of the webapp for every model.
 * The API, MCP, and the page itself all read this.
 * A model does not guess the URL.
 */
import { kilnPublicRepos } from "./kiln-accounts.mjs";
import { repoBoard } from "./kiln-board.mjs";
import { boardGpu } from "./kiln-gpu.mjs";
import { tillView } from "./kiln-market.mjs";
import { listSpace } from "./kiln-space.mjs";
import { sitComputer } from "./kiln-sit.mjs";

export const MODES = [
  { id: "grok", label: "Grok", native: true },
  { id: "claude", label: "Claude" },
  { id: "muse", label: "Muse" },
  { id: "gemini", label: "Gemini" },
  { id: "gpt", label: "GPT" },
  { id: "ollama", label: "Ollama" },
];

const PAGES = [
  { id: "home", path: "/", title: "Home", needsSeat: false, does: "The forge. Public computers are listed." },
  { id: "login", path: "/login", title: "Sign in", needsSeat: false, does: "Open a seat, or bring GitHub or X. Then Studio." },
  { id: "studio", path: "/studio", title: "Studio", needsSeat: true, does: "The working room. Sit, recall, write, bench, ship." },
  { id: "explore", path: "/explore", title: "Explore", needsSeat: false, does: "Public computers." },
  { id: "models", path: "/models", title: "Models", needsSeat: false, does: "Grok is native. Other modes use the same map and the same MCP." },
  { id: "mcp", path: "/mcp", title: "MCP", needsSeat: false, does: "How a model connects." },
  { id: "gpu", path: "/gpu", title: "GPU", needsSeat: false, does: "The compute plane. Offer, claim, receipt." },
  { id: "wallet", path: "/wallet", title: "Wallet", needsSeat: true, does: "Kiln-note till. Not a card." },
  { id: "marketplace", path: "/marketplace", title: "Marketplace", needsSeat: false, does: "Files other seats are selling." },
  { id: "account", path: "/account", title: "Account", needsSeat: true, does: "This seat." },
  { id: "new", path: "/new", title: "New computer", needsSeat: true, does: "Open another computer on this seat." },
  { id: "search", path: "/search", title: "Search", needsSeat: false, does: "Find a public computer." },
  { id: "start", path: "/start", title: "Start", needsSeat: false, does: "First hour. Ends in Studio." },
  { id: "cli", path: "/cli", title: "CLI", needsSeat: false, does: "kilnsh on a computer." },
  { id: "papers", path: "/papers", title: "Papers", needsSeat: false, does: "The written forge." },
];

const RESERVED = new Set(PAGES.map((page) => page.path.slice(1)).filter(Boolean));

function filesOf(repoId) {
  try {
    return listSpace(repoId, { withContent: false, maxFiles: 40 }).map((file) => ({
      path: file.path,
      size: file.size || 0,
    }));
  } catch {
    return [];
  }
}

export function siteMap(origin) {
  const root = String(origin || "").replace(/\/$/, "");
  return {
    ok: true,
    modes: MODES.map((mode) => ({
      ...mode,
      uses: "The same map, the same /api/mcp, the same /api/kiln/loop.",
    })),
    pages: PAGES.map((page) => ({
      ...page,
      url: root + page.path,
      landmark: `a[data-kiln-go="${page.id}"], [data-kiln-page="${page.id}"]`,
    })),
    api: {
      map: "GET /api/kiln/loop?action=map",
      go: "POST /api/kiln/loop { action: 'go', path }",
      mcp: root + "/api/mcp",
    },
    note: "Use kiln_map, then kiln_go. Do not invent a path. data-kiln-go is the control.",
  };
}

function pageByPath(pathname) {
  const path = String(pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const known = PAGES.find((page) => page.path === path);
  if (known) return { page: known, path, repoId: "" };
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2 && !RESERVED.has(parts[0])) {
    const repoId = `${parts[0]}/${parts[1]}`;
    const rest = parts.slice(2).join("/");
    return {
      page: {
        id: "computer",
        path,
        title: repoId,
        needsSeat: parts[0] !== "kiln",
        does: rest ? `Computer ${repoId}, ${rest}.` : `Computer ${repoId}.`,
      },
      path,
      repoId,
    };
  }
  return { page: null, path, repoId: "" };
}

export function openPage({ path, origin, handle } = {}) {
  const found = pageByPath(path);
  const root = String(origin || "").replace(/\/$/, "");
  if (!found.page) {
    return { ok: false, error: "no such page", path: found.path, map: siteMap(origin).pages.map((page) => page.path) };
  }
  const signedIn = !!handle;
  const url = root + found.path;
  if (found.page.needsSeat && !signedIn && !found.repoId) {
    return {
      ok: true,
      id: found.page.id,
      title: found.page.title,
      url,
      needsSeat: true,
      signedIn: false,
      next: `${root}/login?next=${encodeURIComponent(found.path)}`,
      does: found.page.does,
      data: null,
    };
  }
  let data = null;
  if (found.page.id === "home" || found.page.id === "explore" || found.page.id === "search") {
    data = {
      forge: kilnPublicRepos().map((repo) => ({ id: repo.id, description: String(repo.description || "").slice(0, 90) })),
    };
  } else if (found.page.id === "login" || found.page.id === "start") {
    data = {
      open: "POST /api/kiln/loop { action: 'open_seat' }",
      github: "POST /api/kiln/loop { action: 'signup_github', token }",
      x: "POST /api/kiln/loop { action: 'signup_x', token }",
    };
  } else if (found.page.id === "models" || found.page.id === "mcp") {
    data = { modes: MODES, mcp: root + "/api/mcp" };
  } else if (found.page.id === "gpu") {
    const board = boardGpu();
    data = { jobs: Array.isArray(board.jobs) ? board.jobs.length : Array.isArray(board) ? board.length : 0 };
  } else if (found.page.id === "studio" || found.page.id === "account" || found.page.id === "new") {
    const home = `${handle}/home`;
    data = {
      home,
      sit: sitComputer(home).text,
      repos: repoBoard(handle).text || "",
    };
  } else if (found.page.id === "wallet" || found.page.id === "marketplace") {
    data = found.page.id === "wallet" ? { till: tillView(handle) } : { sell: "POST /api/kiln/loop { action: 'products' }" };
  } else if (found.repoId) {
    const owner = found.repoId.split("/")[0];
    const mine = signedIn && owner === handle;
    if (owner !== "kiln" && !mine) {
      return {
        ok: true,
        id: "computer",
        title: found.repoId,
        url,
        needsSeat: true,
        signedIn,
        next: `${root}/login?next=${encodeURIComponent(found.path)}`,
        does: "Private to its owner.",
        data: null,
      };
    }
    data = { repoId: found.repoId, files: filesOf(found.repoId) };
    if (mine) data.sit = sitComputer(found.repoId).text;
  }
  return {
    ok: true,
    id: found.page.id,
    title: found.page.title,
    url,
    needsSeat: !!found.page.needsSeat,
    signedIn,
    does: found.page.does,
    data,
  };
}
