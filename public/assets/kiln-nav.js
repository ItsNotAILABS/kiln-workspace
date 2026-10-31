/**
 * Landmarks a model can follow.
 * The labels match kiln_map. data-kiln-go is the control.
 */
const PAGES = [
  ["home", "/", "Home"],
  ["login", "/login", "Sign in"],
  ["studio", "/studio", "Studio"],
  ["explore", "/explore", "Explore"],
  ["models", "/models", "Models"],
  ["mcp", "/mcp", "MCP"],
  ["gpu", "/gpu", "GPU"],
  ["wallet", "/wallet", "Wallet"],
  ["marketplace", "/marketplace", "Marketplace"],
  ["account", "/account", "Account"],
  ["new", "/new", "New"],
  ["search", "/search", "Search"],
  ["start", "/start", "Start"],
];

function pageId() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const known = PAGES.find((page) => page[1] === path);
  if (known) return known[0];
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2) return "computer";
  return "home";
}

function stamp() {
  document.body.dataset.kilnPage = pageId();
  const wanted = new Map(PAGES.map((page) => [page[2].toLowerCase(), page[0]]));
  document.querySelectorAll("a, button").forEach((el) => {
    if (el.closest("#kiln-agent-nav")) return;
    const label = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    const id = wanted.get(label);
    if (!id || el.dataset.kilnGo) return;
    el.dataset.kilnGo = id;
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", PAGES.find((page) => page[0] === id)[2]);
  });
}

export function installKilnNav() {
  if (installKilnNav._on) return;
  installKilnNav._on = true;
  if (!document.getElementById("kiln-nav-css")) {
    const css = document.createElement("style");
    css.id = "kiln-nav-css";
    css.textContent = "#kiln-agent-nav{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}";
    document.head.appendChild(css);
  }
  let nav = document.getElementById("kiln-agent-nav");
  if (!nav) {
    nav = document.createElement("nav");
    nav.id = "kiln-agent-nav";
    nav.setAttribute("aria-label", "Kiln");
    nav.dataset.kilnNav = "1";
    nav.innerHTML = PAGES.map((page) => `<a data-kiln-go="${page[0]}" href="${page[1]}">${page[2]}</a>`).join("");
    document.body.appendChild(nav);
  }
  const api = {
    pages: PAGES.map((page) => ({ id: page[0], path: page[1], title: page[2] })),
    go(path) {
      const next = String(path || "/");
      if (next.startsWith("/")) location.assign(next);
    },
  };
  globalThis.kiln = Object.assign(globalThis.kiln || {}, { map: api.pages, go: api.go });
  stamp();
  const mo = new MutationObserver(() => stamp());
  mo.observe(document.body, { childList: true, subtree: true });
}
