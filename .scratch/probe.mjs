// Cold-render probe: full text + pageerrors for routes; optional actions via env JSON.
// Usage: node probe.mjs <base> <route> [waitMs]
import { chromium } from "/home/hatch/workspace/repos/kiln-workspace/node_modules/playwright-core/index.mjs";
const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const [base, route] = process.argv.slice(2);
const waitMs = Number(process.argv[4] || 20000);
const mobile = process.env.VIEWPORT === "mobile";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"] });
const ctx = await browser.newContext(mobile ? { viewport:{width:375,height:667}, isMobile:true, hasTouch:true } : { viewport:{width:1280,height:800} });
if (process.env.SEED) { // SEED=localStorage JSON {key:val}
  const kv = JSON.parse(process.env.SEED);
  await ctx.addInitScript((kv) => { for (const [k,v] of Object.entries(kv)) { try{localStorage.setItem(k,v);}catch{} } }, kv);
}
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push("pageerror: "+String(e&&e.message||e).slice(0,300)));
try { await page.goto(base+route, { waitUntil:"load", timeout:60000 }); } catch(e){ errors.push("goto: "+String(e.message||e).slice(0,120)); }
const t0=Date.now(); let text="";
while(Date.now()-t0<waitMs){ try{ text=await page.evaluate(()=>document.body?document.body.innerText:""); }catch{} if(text && text.trim().length>40 && !process.env.FULL_WAIT) break; await new Promise(r=>setTimeout(r,1500)); }
if (process.env.CLICK_TEXT) {
  const clicked = await page.evaluate((t)=>{ const b=[...document.querySelectorAll("button,a")].find(e=>e.textContent.trim().startsWith(t)); if(b){b.click(); return b.textContent.trim();} return null; }, process.env.CLICK_TEXT);
  console.log("CLICKED:", clicked);
  await new Promise(r=>setTimeout(r, Number(process.env.CLICK_WAIT||4000)));
  text = await page.evaluate(()=>document.body?document.body.innerText:"").catch(()=>text);
}
const sess = await page.evaluate(()=>{ try{return localStorage.getItem("kiln.daemon.session.v1");}catch{return null;} }).catch(()=>null);
const url = page.url(); const hash = await page.evaluate(()=>location.hash).catch(()=>"");
console.log(JSON.stringify({route, url, hash, errors, session: sess, text: text.replace(/\s+/g," ").slice(0, Number(process.env.TEXTLEN||3000))}, null, 1));
await browser.close();
