import { chromium } from "/home/hatch/workspace/repos/kiln-workspace/node_modules/playwright-core/index.mjs";
const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on("request", r => { if (r.url().includes("oauth")) console.log("REQ", r.method(), r.url()); });
page.on("response", r => { if (r.url().includes("oauth")) console.log("RES", r.status(), r.url()); });
page.on("pageerror", e => console.log("PAGEERROR", String(e.message||e).slice(0,200)));
const res = await fetch("http://127.0.0.1:18946/api/forge/v1/accounts/oauth/google/start?return=/login", { redirect: "manual" });
const loc = res.headers.get("location"); console.log("LOC", loc);
await page.goto(loc, { waitUntil: "domcontentloaded", timeout: 60000 });
for (let i=0;i<40;i++){ await page.waitForTimeout(2000); const ok=await page.evaluate(()=>document.body.innerText.includes("Finish your KILN account")).catch(()=>false); if (ok) break; }
const sec = () => page.evaluate(() => { const s=[...document.querySelectorAll("section")].find(x=>x.textContent.includes("Finish your KILN account")); return s ? s.innerText.replace(/\s+/g," ").slice(0,400) : "NO SECTION"; });
console.log("SEC0:", await sec());
const setv = (v) => page.evaluate((v) => { const s=[...document.querySelectorAll("section")].find(x=>x.textContent.includes("Finish your KILN account")); const i=s.querySelector("input"); const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set; st.call(i,v); i.dispatchEvent(new Event("input",{bubbles:true})); return i.value; }, v);
console.log("SET:", await setv("sponsor"));
await page.waitForTimeout(1000);
console.log("VAL_AFTER_1S:", await page.evaluate(() => { const s=[...document.querySelectorAll("section")].find(x=>x.textContent.includes("Finish your KILN account")); return s.querySelector("input").value; }));
await page.evaluate(() => { const s=[...document.querySelectorAll("section")].find(x=>x.textContent.includes("Finish your KILN account")); [...s.querySelectorAll("button")].find(b=>b.textContent.includes("Create account")).click(); });
for (let i=0;i<10;i++){ await page.waitForTimeout(2000); const t=await sec(); console.log("SEC"+(i+1)+":", t); if (t.includes("taken")) break; }
await browser.close();
