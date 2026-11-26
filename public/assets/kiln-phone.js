/**
 * Phone shell and the signed-in seat.
 * A phone gets a tab bar. Profile, account, and settings are the same
 * panel on every screen. Settings are stored on the seat.
 */

const TOKEN_KEY = "kiln-session";

function phoneNow() {
  const ua = navigator.userAgent || "";
  const byDevice = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile/i.test(ua);
  const narrow = window.matchMedia("(max-width: 840px)").matches;
  return byDevice || narrow;
}

function token() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function applySettings(settings) {
  const s = settings || {};
  const root = document.documentElement;
  root.dataset.kilnDensity = s.density === "compact" ? "compact" : "regular";
  root.dataset.kilnMotion = s.motion === "reduced" ? "reduced" : "full";
  root.dataset.kilnNotify = s.notify === "off" ? "off" : "on";
}

async function accountCall(body) {
  const res = await fetch("/api/kiln/account", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token() ? `Bearer ${token()}` : "" },
    body: JSON.stringify({ ...body, token: token() }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: "account did not answer" };
  }
  if (!res.ok && data.ok !== true) throw new Error(data.error || "account refused");
  return data;
}

async function saveSeat(body) {
  const res = await fetch("/api/kiln/loop", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token() ? `Bearer ${token()}` : "" },
    body: JSON.stringify({ action: "profile", token: token(), ...body }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: "account did not answer" };
  }
  if (!res.ok || data.ok === false) throw new Error(data.error || "account refused");
  return data;
}

function cssText() {
  return `
html.kiln-phone { height: 100%; }
html.kiln-phone body { min-height: 100dvh; padding-bottom: calc(58px + env(safe-area-inset-bottom)); overscroll-behavior-y: none; }
#kiln-tabbar { display: none; }
html.kiln-phone #kiln-tabbar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 520;
  height: calc(56px + env(safe-area-inset-bottom));
  padding: 0 8px env(safe-area-inset-bottom);
  background: #09090b;
  border-top: 1px solid #27272a;
  font: 500 13px/1 IBM Plex Sans, system-ui, sans-serif;
}
#kiln-tabbar a, #kiln-tabbar button {
  appearance: none;
  background: transparent;
  border: 0;
  color: #a1a1aa;
  text-decoration: none;
  min-height: 44px;
}
#kiln-tabbar [aria-current="page"], #kiln-tabbar [aria-pressed="true"] { color: #fafafa; }
#kiln-you-open {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 480;
  height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #3f3f46;
  background: #18181b;
  color: #fafafa;
  font: 500 14px/1 IBM Plex Sans, system-ui, sans-serif;
}
html.kiln-phone #kiln-you-open { display: none; }
#kiln-you {
  position: fixed;
  z-index: 500;
  background: #09090b;
  color: #fafafa;
  display: flex;
  flex-direction: column;
  font: 400 16px/1.4 IBM Plex Sans, system-ui, sans-serif;
}
html.kiln-phone #kiln-you { inset: 0 0 calc(56px + env(safe-area-inset-bottom)) 0; }
html:not(.kiln-phone) #kiln-you { top: 0; right: 0; bottom: 0; width: min(420px, 100%); border-left: 1px solid #27272a; }
#kiln-you[hidden] { display: none !important; }
#kiln-you header { display: flex; align-items: center; justify-content: space-between; padding: calc(12px + env(safe-area-inset-top)) 16px 12px; border-bottom: 1px solid #27272a; }
#kiln-you header p { margin: 0; font-weight: 600; }
#kiln-you header button, #kiln-you .k-tabs button, #kiln-you .k-choice, #kiln-you .k-save, #kiln-you .k-out {
  appearance: none; background: transparent; color: #fafafa; border: 1px solid #3f3f46; border-radius: 10px; min-height: 44px; padding: 0 12px; font: inherit;
}
#kiln-you .k-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px 16px; }
#kiln-you .k-tabs [aria-selected="true"] { background: #fafafa; color: #09090b; border-color: #fafafa; }
#kiln-you .k-panel { padding: 0 16px 24px; overflow: auto; }
#kiln-you .k-panel[hidden] { display: none !important; }
#kiln-you label { display: block; margin: 14px 0 6px; color: #a1a1aa; font-size: 13px; }
#kiln-you input, #kiln-you textarea {
  width: 100%; box-sizing: border-box; font: inherit; font-size: 16px;
  color: #fafafa; background: #18181b; border: 1px solid #3f3f46; border-radius: 10px; padding: 12px;
}
#kiln-you textarea { min-height: 88px; resize: vertical; }
#kiln-you .k-row { display: flex; gap: 8px; margin-top: 8px; }
#kiln-you .k-choice[aria-pressed="true"] { background: #fafafa; color: #09090b; }
#kiln-you .k-meta { color: #a1a1aa; font-size: 14px; word-break: break-all; }
#kiln-you .k-err { color: #fca5a5; min-height: 1.2em; font-size: 14px; }
html[data-kiln-motion="reduced"] *, html[data-kiln-motion="reduced"] *::before, html[data-kiln-motion="reduced"] *::after { animation: none !important; transition: none !important; }
html[data-kiln-density="compact"] #kiln-you { font-size: 15px; }
`;
}

function panelHtml() {
  return `
<header>
  <p data-title>Account</p>
  <button type="button" data-close>Close</button>
</header>
<div class="k-tabs" role="tablist">
  <button type="button" data-tab="profile" role="tab" aria-selected="true">Profile</button>
  <button type="button" data-tab="account" role="tab" aria-selected="false">Account</button>
  <button type="button" data-tab="settings" role="tab" aria-selected="false">Settings</button>
</div>
<form class="k-panel" data-panel="profile">
  <label for="kiln-you-name">Name</label>
  <input id="kiln-you-name" name="displayName" maxlength="48" autocomplete="name" />
  <label for="kiln-you-lab">Lab</label>
  <input id="kiln-you-lab" name="lab" maxlength="48" autocomplete="organization" />
  <label for="kiln-you-bio">Bio</label>
  <textarea id="kiln-you-bio" name="bio" maxlength="240"></textarea>
  <p class="k-err" data-err></p>
  <button class="k-save" type="submit">Save profile</button>
</form>
<div class="k-panel" data-panel="account" hidden>
  <p class="k-meta" data-handle></p>
  <p class="k-meta" data-address></p>
  <p class="k-meta" data-client></p>
  <button class="k-out" type="button" data-out>Sign out</button>
</div>
<form class="k-panel" data-panel="settings" hidden>
  <label>Density</label>
  <div class="k-row" data-set="density">
    <button class="k-choice" type="button" data-value="regular" aria-pressed="true">Regular</button>
    <button class="k-choice" type="button" data-value="compact" aria-pressed="false">Compact</button>
  </div>
  <label>Motion</label>
  <div class="k-row" data-set="motion">
    <button class="k-choice" type="button" data-value="full" aria-pressed="true">Full</button>
    <button class="k-choice" type="button" data-value="reduced" aria-pressed="false">Reduced</button>
  </div>
  <label>Notes</label>
  <div class="k-row" data-set="notify">
    <button class="k-choice" type="button" data-value="on" aria-pressed="true">On</button>
    <button class="k-choice" type="button" data-value="off" aria-pressed="false">Off</button>
  </div>
  <p class="k-meta">Saved on this seat. This kiln does not send push.</p>
  <p class="k-err" data-err></p>
  <button class="k-save" type="submit">Save settings</button>
</form>`;
}

function markTabs(root, name) {
  root.querySelectorAll("[data-tab]").forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  root.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
}

function markChoices(root, settings) {
  root.querySelectorAll("[data-set]").forEach((row) => {
    const key = row.dataset.set;
    row.querySelectorAll("[data-value]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.value === settings[key] ? "true" : "false");
    });
  });
}

function choiceValue(root, key) {
  const pressed = root.querySelector(`[data-set="${key}"] [aria-pressed="true"]`);
  return pressed ? pressed.dataset.value : "";
}

export function installKilnPhone() {
  if (installKilnPhone._on) return;
  installKilnPhone._on = true;
  const phone = phoneNow();
  document.documentElement.classList.toggle("kiln-phone", phone);
  document.documentElement.dataset.kilnClient = phone ? "phone" : "desk";
  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const meta = document.createElement("meta");
    meta.name = "apple-mobile-web-app-capable";
    meta.content = "yes";
    document.head.appendChild(meta);
  }
  if (!document.getElementById("kiln-phone-css")) {
    const style = document.createElement("style");
    style.id = "kiln-phone-css";
    style.textContent = cssText();
    document.head.appendChild(style);
  }
  if (!document.getElementById("kiln-tabbar")) {
    const bar = document.createElement("nav");
    bar.id = "kiln-tabbar";
    bar.setAttribute("aria-label", "Kiln");
    bar.innerHTML = `<a href="/" data-kiln-go="home">Home</a><a href="/studio" data-kiln-go="studio">Studio</a><a href="/marketplace" data-kiln-go="marketplace">Market</a><button type="button" data-kiln-go="account" data-open>Account</button>`;
    document.body.appendChild(bar);
  }
  if (!document.getElementById("kiln-you-open")) {
    const open = document.createElement("button");
    open.id = "kiln-you-open";
    open.type = "button";
    open.textContent = "Account";
    document.body.appendChild(open);
  }
  if (!document.getElementById("kiln-you")) {
    const sheet = document.createElement("section");
    sheet.id = "kiln-you";
    sheet.hidden = true;
    sheet.setAttribute("aria-label", "Your seat");
    sheet.innerHTML = panelHtml();
    document.body.appendChild(sheet);
  }
  const sheet = document.getElementById("kiln-you");
  const state = { account: null, settings: { density: "regular", motion: "full", notify: "on" }, tab: "profile" };

  function paint() {
    const acc = state.account;
    const title = sheet.querySelector("[data-title]");
    if (title) title.textContent = acc ? acc.displayName || acc.handle : "Account";
    const name = sheet.querySelector("#kiln-you-name");
    const lab = sheet.querySelector("#kiln-you-lab");
    const bio = sheet.querySelector("#kiln-you-bio");
    if (name && document.activeElement !== name) name.value = acc ? acc.displayName || "" : "";
    if (lab && document.activeElement !== lab) lab.value = acc ? acc.lab || "" : "";
    if (bio && document.activeElement !== bio) bio.value = acc ? acc.bio || "" : "";
    const handle = sheet.querySelector("[data-handle]");
    const address = sheet.querySelector("[data-address]");
    const client = sheet.querySelector("[data-client]");
    if (handle) handle.textContent = acc ? `@${acc.handle}` : "Sign in to keep a seat.";
    if (address) address.textContent = acc && acc.address ? acc.address : "";
    if (client) client.textContent = phone ? "This screen is a phone." : "This screen is a desk.";
    markChoices(sheet, state.settings);
    applySettings(state.settings);
    const path = location.pathname.replace(/\/+$/, "") || "/";
    document.querySelectorAll("#kiln-tabbar a").forEach((a) => {
      const on = a.getAttribute("href") === path;
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const accountBtn = document.querySelector("#kiln-tabbar [data-open]");
    if (accountBtn) accountBtn.setAttribute("aria-pressed", sheet.hidden ? "false" : "true");
  }

  async function load() {
    if (!token()) {
      state.account = null;
      paint();
      return;
    }
    try {
      const data = await accountCall({ action: "me" });
      state.account = data.account;
      state.settings = (data.account && data.account.settings) || state.settings;
      if (data.client === "phone") {
        document.documentElement.classList.add("kiln-phone");
        document.documentElement.dataset.kilnClient = "phone";
      }
      paint();
    } catch {
      state.account = null;
      paint();
    }
  }

  function open(tab) {
    if (!token()) {
      location.assign("/login");
      return;
    }
    state.tab = tab || state.tab;
    markTabs(sheet, state.tab);
    sheet.hidden = false;
    paint();
  }

  sheet.querySelector("[data-close]").addEventListener("click", () => {
    sheet.hidden = true;
    paint();
  });
  sheet.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => open(btn.dataset.tab));
  });
  sheet.addEventListener("click", (ev) => {
    const choice = ev.target.closest("[data-value]");
    if (!choice) return;
    const row = choice.closest("[data-set]");
    row.querySelectorAll("[data-value]").forEach((btn) => btn.setAttribute("aria-pressed", btn === choice ? "true" : "false"));
  });
  sheet.querySelector('[data-panel="profile"]').addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const err = sheet.querySelector('[data-panel="profile"] [data-err]');
    err.textContent = "";
    const body = new FormData(ev.target);
    try {
      const data = await saveSeat({
        displayName: body.get("displayName"),
        lab: body.get("lab"),
        bio: body.get("bio"),
        settings: state.settings,
      });
      state.account = data.account;
      state.settings = data.settings || state.settings;
      paint();
    } catch (e) {
      err.textContent = e instanceof Error ? e.message : "save failed";
    }
  });
  sheet.querySelector('[data-panel="settings"]').addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const err = sheet.querySelector('[data-panel="settings"] [data-err]');
    err.textContent = "";
    const settings = {
      density: choiceValue(sheet, "density"),
      motion: choiceValue(sheet, "motion"),
      notify: choiceValue(sheet, "notify"),
    };
    try {
      const data = await saveSeat({ settings });
      state.account = data.account || state.account;
      state.settings = data.settings || settings;
      paint();
    } catch (e) {
      err.textContent = e instanceof Error ? e.message : "save failed";
    }
  });
  sheet.querySelector("[data-out]").addEventListener("click", async () => {
    try {
      await accountCall({ action: "logout" });
    } catch {
      /* the local seat still closes */
    }
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    state.account = null;
    sheet.hidden = true;
    location.assign("/");
  });
  document.getElementById("kiln-you-open").addEventListener("click", () => open("profile"));
  document.querySelector("#kiln-tabbar [data-open]").addEventListener("click", () => {
    if (sheet.hidden) open("profile");
    else {
      sheet.hidden = true;
      paint();
    }
  });
  window.addEventListener("resize", () => {
    const next = phoneNow();
    document.documentElement.classList.toggle("kiln-phone", next || document.documentElement.dataset.kilnClient === "phone");
    paint();
  });
  paint();
  void load();
}
