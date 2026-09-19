// Probe failing network resources on a page. Usage:
//   node scripts/probe-resources.mjs <url> [viewport WxH]
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080/";
const [w, h] = (process.argv[3] || "1280x800").split("x").map(Number);

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const failed = [];
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
});
page.on("requestfailed", (r) => {
  failed.push(`FAILED ${r.url()} :: ${r.failure()?.errorText}`);
});
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => console.log("goto:", e.message));
await page.waitForTimeout(2000);
console.log(JSON.stringify({ url, failed }, null, 2));
await browser.close();
