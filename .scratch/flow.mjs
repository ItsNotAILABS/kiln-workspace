// OAuth browser flows vs stub origin. MODE=pending|handoff
import { chromium } from "/home/hatch/workspace/repos/kiln-workspace/node_modules/playwright-core/index.mjs";
const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const mode = process.env.MODE || "pending";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e && e.message || e).slice(0, 200)));
const text = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
const setHandle = (v) => page.evaluate((v) => {
  const secs = [...document.querySelectorAll("section")];
  const fin = secs.find((s) => s.textContent.includes("Finish your KILN account"));
  const input = fin && fin.querySelector("input");
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, v);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input.value;
}, v);
const submit = () => page.evaluate(() => {
  const secs = [...document.querySelectorAll("section")];
  const fin = secs.find((s) => s.textContent.includes("Finish your KILN account"));
  const btn = fin && [...fin.querySelectorAll("button")].find((b) => b.textContent.includes("Create account"));
  if (btn) { btn.click(); return true; } return false;
});
if (mode === "pending") {
  const res = await fetch("http://127.0.0.1:18946/api/forge/v1/accounts/oauth/x/start?return=/login", { redirect: "manual" });
  const loc = res.headers.get("location");
  console.log("PENDING_URL:", loc);
  await page.goto(loc, { waitUntil: "domcontentloaded", timeout: 60000 });
  let t = "";
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(2000); t = await text().catch(()=>""); if (t.includes("Finish your KILN account")) break; }
  console.log("PENDING_FORM:", t.includes("Finish your KILN account"));
  console.log("HASH_SCRUBBED:", await page.evaluate(() => location.hash === ""));
  console.log("SET_SPONSOR:", await setHandle("sponsor"));
  await page.waitForTimeout(500);
  console.log("SUBMIT1:", await submit());
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(1500); t = await text(); if (t.includes("is taken")) break; }
  console.log("TAKEN_INLINE:", t.includes("is taken — pick another handle"));
  console.log("SET_NEW:", await setHandle("newdev42"));
  await page.waitForTimeout(500);
  console.log("SUBMIT2:", await submit());
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(1500); t = await text(); if (t.includes("Sign-in & wallets")) break; }
  const sess = await page.evaluate(() => localStorage.getItem("kiln.daemon.session.v1"));
  console.log("COMPLETED_SESSION:", !!sess && JSON.parse(sess).account.owner === "newdev42");
  console.log("SIGNED_IN_VIEW:", t.includes("Sign-in & wallets"), "| GOOGLE_ROW:", /Google/.test(t), "| X_LINKED:", t.includes("Linked — can sign in"), "| PROVIDER_NOT_LINKED_PRESENT:", t.includes("Not linked"));
} else {
  const res = await fetch("http://127.0.0.1:18946/api/forge/v1/accounts/oauth/google/start?return=/login&sim=known", { redirect: "manual" });
  const loc = res.headers.get("location");
  console.log("HANDOFF_URL:", loc);
  await page.goto(loc, { waitUntil: "domcontentloaded", timeout: 60000 });
  let t = "";
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(1500); t = await text(); if (t.includes("Sign-in & wallets")) break; }
  const sess = await page.evaluate(() => localStorage.getItem("kiln.daemon.session.v1"));
  console.log("HANDOFF_SESSION:", !!sess && JSON.parse(sess).account.owner === "sponsor");
  console.log("HASH_SCRUBBED:", await page.evaluate(() => location.hash === ""));
  console.log("SIGNED_IN_VIEW:", t.includes("Sign-in & wallets"));
}
console.log("PAGEERRORS:", JSON.stringify(errors));
await browser.close();
