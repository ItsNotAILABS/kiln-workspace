// Render gate: cold-load routes in headless Chromium, collect pageerrors,
// and report DOM signals (error-boundary text vs expected content markers).
// Usage: node render_gate.mjs <baseUrl> <route> [route...]
// Env: VIEWPORT=mobile for 375x667, WAIT_MS per route (default 20000).
import { chromium } from "/home/hatch/workspace/repos/kiln-workspace/node_modules/playwright-core/index.mjs";

const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const base = process.argv[2];
const routes = process.argv.slice(3);
const waitMs = Number(process.env.WAIT_MS || 20000);
const mobile = process.env.VIEWPORT === "mobile";

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
for (const route of routes) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e && e.message || e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
  let nav = "ok";
  try { await page.goto(base + route, { waitUntil: "load", timeout: 60000 }); } catch (e) { nav = "goto: " + String(e.message || e).slice(0, 120); }
  // poll for settle: wait until body has text, up to waitMs
  const t0 = Date.now();
  let text = "";
  while (Date.now() - t0 < waitMs) {
    try { text = await page.evaluate(() => document.body ? document.body.innerText : ""); } catch {}
    if (text && text.trim().length > 40) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  let signals = {};
  try {
    signals = await page.evaluate(() => {
      const t = document.body ? document.body.innerText : "";
      return {
        len: t.length,
        hasError130: /Minified React error #130/.test(t),
        hasErrorBoundary: /Something went wrong|Application error|Unexpected error/i.test(t),
        hasStudio: /\bStudio\b/.test(t),
        hasDoors: /New repository/.test(t) && /Import from GitHub/.test(t) && /New gist/.test(t),
        hasYourRepos: /Your repositories/.test(t),
        hasOneShot: /One-shot/.test(t),
        hasDiscover: /Discover/.test(t),
        hasChain: /block/i.test(t),
        snippet: t.replace(/\s+/g, " ").slice(0, 220),
      };
    });
  } catch (e) { signals = { evalFail: String(e.message || e).slice(0, 160) }; }
  console.log(JSON.stringify({ route, nav, errors: errors.slice(0, 6), ...signals }));
  await ctx.close();
}
await browser.close();
process.exit(0);
