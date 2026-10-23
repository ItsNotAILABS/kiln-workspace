// Full user-journey walkthrough: visits routes, records final URL (redirects),
// console errors, and screenshots. Usage:
//   node scripts/walkthrough.mjs <base> <outdir> [W1xH1,W2xH2]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
const outdir = process.argv[3] || "/workspace/repos/kiln-workspace/screenshots/walk";
const viewports = (process.argv[4] || "1280x800").split(",").map((v) => {
  const [w, h] = v.split("x").map(Number);
  return { w, h, tag: `${w}x${h}` };
});

const ROUTES = (process.env.WALK_ROUTES ? process.env.WALK_ROUTES.split(",") : [
  "/",
  "/signin",
  "/settings",
  "/login",
  "/account",
  "/wallet",
  "/explore",
  "/swarm",
  "/new",
  "/studio",
  "/models",
  "/marketplace",
  "/issues",
  "/pulls",
  "/notifications",
  "/does-not-exist-xyz",
  "/settings/anything",
]);

mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const results = [];
for (const vp of viewports) {
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + String(e).split("\n")[0]));
    page.on("console", (m) => {
      if (m.type() === "error" && !String(m.text()).includes("ERR_EMPTY_RESPONSE")) {
        errors.push("console: " + String(m.text()).split("\n")[0].slice(0, 160));
      }
    });
    const slug = route.replace(/\//g, "_").replace(/^_/, "") || "home";
    try {
      const resp = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2500);
      const finalUrl = page.url().replace(base, "");
      const title = await page.title();
      const shot = join(outdir, `${slug}-${vp.tag}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      results.push({ route, vp: vp.tag, status: resp?.status(), finalUrl, title, errors, shot });
    } catch (e) {
      results.push({ route, vp: vp.tag, error: String(e).split("\n")[0] });
    }
    await page.close();
  }
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
