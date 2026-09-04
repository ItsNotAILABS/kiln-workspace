import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("page "+e.message));
page.on("console", (m) => { if (m.type()==="error") errors.push("console "+m.text()); });

async function shot(path, name) {
  await page.goto("http://127.0.0.1:8080"+path, { waitUntil: "networkidle", timeout: 30000 }).catch(e => errors.push("goto "+path+" "+e.message));
  await page.waitForTimeout(1200);
  const text = await page.evaluate(() => document.body?.innerText?.slice(0, 1500) || "");
  await page.screenshot({ path: "/workspace/screenshots/"+name+".png", fullPage: false });
  return { path, name, title: await page.title(), text, url: page.url() };
}

const results = [];
results.push(await shot("/", "home"));
results.push(await shot("/itsnotailabs/vlaptop", "code"));
results.push(await shot("/itsnotailabs/vlaptop/computer", "computer"));
results.push(await shot("/itsnotailabs/vlaptop/world", "world"));
results.push(await shot("/itsnotailabs/vlaptop/preview", "preview"));
results.push(await shot("/itsnotailabs/vlaptop/projects", "projects"));
results.push(await shot("/new", "new"));
results.push(await shot("/itsnotailabs/vlaptop/issues", "issues"));
results.push(await shot("/itsnotailabs/vlaptop/wiki", "wiki"));
results.push(await shot("/explore", "explore"));

console.log(JSON.stringify({ errors, results: results.map(r => ({ name: r.name, url: r.url, text: r.text.slice(0, 400) })) }, null, 2));
await browser.close();
