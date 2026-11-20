// Click probe vs the pre-boot gate stub: cold /login, then click EACH
// "Continue with Google" button (chunk first, panel second, fresh page
// per click). PASS = honest not-switched-on copy appears, URL stays on
// /login (no navigation to raw JSON), no "Sign-in failed", 0 pageerrors.
import { chromium } from "/home/hatch/workspace/repos/kiln-workspace/node_modules/playwright-core/index.mjs";
const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const base = "http://127.0.0.1:18948";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
let fail = 0;
for (const idx of [0, 1]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e && e.message || e).slice(0, 200)));
  try {
    await page.goto(base + "/login", { waitUntil: "load", timeout: 45000 });
    await page.waitForFunction(() => document.body && document.body.innerText.length > 40, null, { timeout: 30000 });
    const btns = page.getByRole("button", { name: "Continue with Google" });
    const count = await btns.count();
    console.log(`click ${idx}: google buttons found=${count}`);
    if (count <= idx) { console.log(`click ${idx}: SKIP not enough buttons`); fail++; await ctx.close(); continue; }
    await btns.nth(idx).click({ timeout: 15000 });
    await page.waitForFunction(() => document.body.innerText.includes("isn't switched on yet"), null, { timeout: 20000 }).catch(() => {});
    const out = await page.evaluate(() => ({
      url: location.pathname,
      copyHits: (document.body.innerText.match(/isn't switched on yet/g) || []).length,
      signInFailed: document.body.innerText.includes("Sign-in failed"),
      rawGate: document.body.innerText.includes("valid token required"),
    }));
    const ok = out.url === "/login" && out.copyHits >= 1 && !out.signInFailed && !out.rawGate && errors.length === 0;
    console.log(`click ${idx}: ${ok ? "PASS" : "FAIL"} ${JSON.stringify(out)} pageerrors=${errors.length} ${errors.join(" | ")}`);
    if (!ok) fail++;
  } catch (e) {
    console.log(`click ${idx}: ERROR ${String(e.message || e).slice(0, 200)} pageerrors=${errors.join(" | ")}`);
    fail++;
  }
  await ctx.close();
}
await browser.close();
console.log(fail ? `probe: ${fail} FAIL` : "probe: ALL PASS");
process.exit(fail ? 1 : 0);
