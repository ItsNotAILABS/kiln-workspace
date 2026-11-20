// Handoff probe vs the pre-boot gate stub: land on /login#oauth_handoff=x;
// the exchange gets the operator-gate 401. PASS = the panel shows the
// "isn't active yet" notice, never the raw daemon string, fragment scrubbed.
import { chromium } from "/home/hatch/workspace/repos/kiln-workspace/node_modules/playwright-core/index.mjs";
const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e && e.message || e).slice(0, 200)));
await page.goto("http://127.0.0.1:18948/login#oauth_handoff=boguscode", { waitUntil: "load", timeout: 45000 });
await page.waitForFunction(() => document.body && document.body.innerText.length > 40, null, { timeout: 30000 });
await page.waitForFunction(() => document.body.innerText.includes("isn't active yet"), null, { timeout: 20000 }).catch(() => {});
const out = await page.evaluate(() => ({
  hash: location.hash,
  activeYet: document.body.innerText.includes("That sign-in link isn't active yet"),
  rawGate: document.body.innerText.includes("valid token required"),
  signInFailed: document.body.innerText.includes("Sign-in failed"),
}));
const ok = out.activeYet && !out.rawGate && !out.signInFailed && out.hash === "" && errors.length === 0;
console.log(`handoff: ${ok ? "PASS" : "FAIL"} ${JSON.stringify(out)} pageerrors=${errors.length} ${errors.join(" | ")}`);
await browser.close();
process.exit(ok ? 0 : 1);
