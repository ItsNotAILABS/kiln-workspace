/**
 * First-hour seat. Sign in on the home page opened a native password sheet
 * on top of a 391KB origin catalog merge — that froze the thread. Send Sign
 * in to /login (freeze-safe fields), keep /login from being stolen back to
 * home, and slim the origin catalog so seating can finish.
 */
import { installKilnStudio, nextAfterSeat, rememberStudioNext } from "./kiln-studio.js";
import { installKilnDomain } from "./kiln-domain.js";
import { installGWebGpu } from "./gwebgpu-plane.js";
import { installKilnNav } from "./kiln-nav.js";
import { installKilnPhone } from "./kiln-phone.js";
import { installKilnMarket } from "./kiln-market.js";

(function slimOriginCatalog() {
  if (globalThis.__KILN_SLIM_ORIGIN) return;
  globalThis.__KILN_SLIM_ORIGIN = true;
  const orig = globalThis.fetch;
  if (typeof orig !== "function") return;
  globalThis.fetch = async function kilnSlimFetch(input, init) {
    const url = String(typeof input === "string" ? input : input && input.url ? input.url : "");
    const res = await orig.call(this, input, init);
    if (!/kiln-account\.json(?:\?|$)/.test(url)) return res;
    try {
      const data = await res.clone().json();
      const slim = {
        ...data,
        repos: (data.repos || []).map((r) => ({
          id: r.id,
          owner: r.owner || "kiln",
          name: r.name || String(r.id || "").split("/")[1],
          description: r.description || "",
          visibility: r.visibility || "public",
          encrypted: !!r.encrypted,
          topics: r.topics || [],
          language: r.language || "",
          languages: r.languages || {},
          stars: r.stars || 0,
          watchers: r.watchers || 0,
          forks: r.forks || 0,
          tvlKln: r.tvlKln || 0,
          githubUrl: r.githubUrl,
          chainAddress: r.chainAddress,
          readme: String(r.readme || "").slice(0, 400),
          files: (r.files || []).slice(0, 40).map((f) => ({
            path: f.path,
            size: f.size || 0,
            sha: f.sha || f.hash || "",
          })),
        })),
      };
      return new Response(JSON.stringify(slim), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch {
      return res;
    }
  };
})();

(function keepLoginRoute() {
  if (globalThis.__KILN_KEEP_LOGIN) return;
  globalThis.__KILN_KEEP_LOGIN = true;
  const rs = history.replaceState.bind(history);
  history.replaceState = function (state, title, url) {
    const next = url == null ? "" : String(url);
    const path = next.replace(location.origin, "").split("?")[0] || next;
    if (location.pathname === "/login" && (path === "/" || path === "" || path === location.origin + "/")) {
      return;
    }
    return rs(state, title, url);
  };
})();

function fieldText(el) {
  if (!el) return "";
  return String(el.innerText || el.textContent || el.value || "").replace(/\n/g, "").trim();
}

function accountAction(action, handle, secret) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/kiln/account");
    xhr.setRequestHeader("content-type", "application/json");
    xhr.timeout = 20000;
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText || "{}"));
      } catch {
        resolve({ ok: false, error: "account did not answer" });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: "network" });
    xhr.ontimeout = () => resolve({ ok: false, error: "account timed out" });
    xhr.send(JSON.stringify({ action, handle, secret }));
  });
}

function installCss() {
  if (document.getElementById("kiln-seat-css")) return;
  const css = document.createElement("style");
  css.id = "kiln-seat-css";
  css.textContent = `
#kiln-account-sheet{z-index:400}
body.kiln-on-login #kiln-account-sheet{display:none !important}
#kiln-account-sheet .kiln-safe-field{
  min-height:44px;border:0;border-radius:12px;padding:12px 14px;background:#09090b;color:#f4f4f5;
  box-shadow:0 0 0 1px rgba(255,255,255,.12);font:400 15px/1.3 "IBM Plex Sans",system-ui,sans-serif;
  outline:none;white-space:nowrap;overflow:hidden;
}
#kiln-account-sheet .kiln-safe-field:empty:before{
  content:attr(data-placeholder);color:#71717a;pointer-events:none;
}
#kiln-account-sheet .kiln-safe-secret{-webkit-text-security:disc;text-security:disc}
#kiln-account-handle,#kiln-account-secret{position:absolute;opacity:0;height:0;width:0;pointer-events:none}
#kiln-signup-more{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
#kiln-signup-more button{
  border:0;border-radius:999px;padding:8px 12px;cursor:pointer;
  background:#09090b;color:#f4efe4;font:500 12px/1 "IBM Plex Sans",system-ui,sans-serif;
  box-shadow:0 0 0 1px rgba(201,162,39,.45);
}
#kiln-signup-more p{flex:1 1 100%;margin:4px 0 0;color:#a1a1aa;font:400 12px/1.45 "IBM Plex Sans",system-ui,sans-serif}
#kiln-signup-card{margin-top:12px;padding:12px;border-radius:12px;background:#09090b;color:#f4efe4;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
#kiln-signup-card code{font:500 13px/1.4 ui-monospace,monospace;color:#e7d7a1}
#kiln-signup-card button{margin-top:10px}
`;
  document.head.appendChild(css);
}

function upgradeField(native, { secret, placeholder }) {
  if (!native) return null;
  if (native.dataset.kilnSafe === "1") {
    return document.getElementById(native.id + "-safe");
  }
  native.dataset.kilnSafe = "1";
  native.tabIndex = -1;
  native.setAttribute("aria-hidden", "true");
  native.autocomplete = "off";
  if (secret) native.type = "text";
  const field = document.createElement("div");
  field.id = native.id + "-safe";
  field.className = "kiln-safe-field" + (secret ? " kiln-safe-secret" : "");
  field.setAttribute("role", "textbox");
  field.contentEditable = "true";
  field.spellcheck = false;
  field.dataset.placeholder = placeholder;
  field.addEventListener("input", () => {
    native.value = fieldText(field);
  });
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("kiln-account-go")?.click();
    }
  });
  native.parentNode.insertBefore(field, native.nextSibling);
  return field;
}

function copyFields() {
  const handleSafe = document.getElementById("kiln-account-handle-safe");
  const secretSafe = document.getElementById("kiln-account-secret-safe");
  const handleEl = document.getElementById("kiln-account-handle");
  const secretEl = document.getElementById("kiln-account-secret");
  const handle = fieldText(handleSafe).replace(/^@/, "") || (handleEl ? handleEl.value.trim() : "");
  const secret = fieldText(secretSafe) || (secretEl ? secretEl.value : "");
  if (handleEl) handleEl.value = handle;
  if (secretEl) secretEl.value = secret;
  return { handle, secret };
}

function landAfterSeat() {
  const next = nextAfterSeat();
  try {
    sessionStorage.removeItem("kiln-next");
  } catch {
    /* private mode */
  }
  window.location.assign(next || "/studio");
}

function keepSession(acc) {
  if (acc?.token) {
    try {
      sessionStorage.setItem("kiln-session", acc.token);
      globalThis.__KILN_SESSION = acc.token;
    } catch {
      /* private mode */
    }
  }
  if (acc?.account) globalThis.__KILN_ACCOUNT = acc.account;
}

function showSeatCard(box, acc) {
  const card = document.createElement("div");
  card.id = "kiln-signup-card";
  const handle = (acc.account && acc.account.handle) || "";
  const secret = acc.secretShown ? acc.secret : "";
  card.innerHTML =
    "<p>You live on this site. Home computer <code>" +
    handle +
    "/home</code>.</p>" +
    (secret ? "<p>Secret, shown once: <code>" + secret + "</code></p>" : "<p>This sign-in resumed the seat. The old secret still works.</p>") +
    "<p>The public forge is visible. Another person's private computer is not.</p>";
  const go = document.createElement("button");
  go.type = "button";
  go.textContent = "Enter the site";
  go.addEventListener("click", () => landAfterSeat());
  card.appendChild(go);
  box.replaceWith(card);
}

async function postSignup(body) {
  const res = await fetch("/api/kiln/loop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function providerRow(box, provider, label) {
  const row = document.createElement("div");
  row.hidden = true;
  const input = document.createElement("input");
  input.type = "password";
  input.placeholder = label + " token, read user only";
  input.autocomplete = "off";
  input.style.cssText = "flex:1 1 12rem;min-height:36px;border:0;border-radius:10px;padding:8px 10px;background:#09090b;color:#f4efe4;box-shadow:0 0 0 1px rgba(255,255,255,.12)";
  const go = document.createElement("button");
  go.type = "button";
  go.textContent = "Continue";
  go.addEventListener("click", async () => {
    const token = input.value.trim();
    input.value = "";
    if (token.length < 12) return;
    const acc = await postSignup({ action: provider === "github" ? "signup_github" : "signup_x", token });
    if (!acc.ok) {
      const err = document.getElementById("kiln-account-err");
      if (err) err.textContent = acc.error || "sign in failed";
      return;
    }
    keepSession(acc);
    showSeatCard(box, acc);
  });
  row.append(input, go);
  return { row, open: () => { row.hidden = false; input.focus(); } };
}

function installSignupChoices() {
  if (document.getElementById("kiln-signup-more")) return;
  const anchor = document.getElementById("kiln-account-create") || document.getElementById("kiln-auth-view");
  if (!anchor || !anchor.parentNode) return;
  const box = document.createElement("div");
  box.id = "kiln-signup-more";
  const open = document.createElement("button");
  open.type = "button";
  open.textContent = "Open a seat";
  const gh = document.createElement("button");
  gh.type = "button";
  gh.textContent = "GitHub";
  const x = document.createElement("button");
  x.type = "button";
  x.textContent = "X";
  const note = document.createElement("p");
  note.textContent = "Or let an agent call kiln_open_seat. It lives here and sees its home computer and the public forge.";
  const github = providerRow(box, "github", "GitHub");
  const ex = providerRow(box, "x", "X");
  open.addEventListener("click", async () => {
    const acc = await postSignup({ action: "open_seat", via: "site" });
    if (!acc.ok) {
      const err = document.getElementById("kiln-account-err");
      if (err) err.textContent = acc.error || "could not open a seat";
      return;
    }
    keepSession(acc);
    showSeatCard(box, acc);
  });
  gh.addEventListener("click", () => github.open());
  x.addEventListener("click", () => ex.open());
  box.append(open, gh, x, note, github.row, ex.row);
  anchor.parentNode.appendChild(box);
}

async function seat(create) {
  const err = document.getElementById("kiln-account-err");
  const setErr = (m) => {
    if (err) err.textContent = m || "";
  };
  setErr("");
  const { handle, secret } = copyFields();
  if (handle.length < 2 || secret.length < 12) {
    setErr("Handle and a secret of 12+ characters.");
    return;
  }
  setErr(create ? "Creating your seat…" : "Signing in…");
  try {
    let acc = null;
    if (create) {
      acc = await accountAction("register", handle, secret);
      if (!acc?.ok) throw new Error(acc?.error || "could not create");
    } else {
      acc = await accountAction("login", handle, secret);
      if (!acc?.ok) {
        const made = await accountAction("register", handle, secret);
        if (made?.ok) acc = made;
        else if (made?.error === "handle taken") throw new Error("unknown handle or secret");
        else throw new Error(acc?.error || made?.error || "unknown handle or secret");
      }
    }
    if (acc?.token) {
      try {
        sessionStorage.setItem("kiln-session", acc.token);
        globalThis.__KILN_SESSION = acc.token;
      } catch {
        /* private mode */
      }
    }
    if (acc?.account) globalThis.__KILN_ACCOUNT = acc.account;
    const sheet = document.getElementById("kiln-account-sheet");
    if (sheet) sheet.hidden = true;
    setErr("");
    landAfterSeat();
  } catch (e) {
    setErr(e instanceof Error ? e.message : "sign in failed");
  }
}

function bindSheet() {
  const sheet = document.getElementById("kiln-account-sheet");
  if (!sheet || sheet.dataset.kilnSeat === "1") return false;
  sheet.dataset.kilnSeat = "1";
  installCss();
  upgradeField(document.getElementById("kiln-account-handle"), { secret: false, placeholder: "itsnotailabs" });
  upgradeField(document.getElementById("kiln-account-secret"), { secret: true, placeholder: "12+ characters" });
  const hint = sheet.querySelector("#kiln-auth-view p");
  if (hint && /One handle/.test(hint.textContent || "")) {
    hint.textContent = "One handle. Sign in or Create — same secret. That handle owns the computers, vault, isolation, and crew.";
  }
  const intercept = (ev, asCreate) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    void seat(asCreate);
  };
  const go = document.getElementById("kiln-account-go");
  const create = document.getElementById("kiln-account-create");
  if (go && !go.dataset.kilnSeat) {
    const fresh = go.cloneNode(true);
    fresh.dataset.kilnSeat = "1";
    go.replaceWith(fresh);
    fresh.addEventListener("click", (e) => intercept(e, false));
  }
  if (create && !create.dataset.kilnSeat) {
    const fresh = create.cloneNode(true);
    fresh.dataset.kilnSeat = "1";
    create.replaceWith(fresh);
    fresh.addEventListener("click", (e) => intercept(e, true));
  }
  return true;
}

function hideSheetOnLogin() {
  const onLogin = location.pathname === "/login";
  document.body.classList.toggle("kiln-on-login", onLogin);
  if (onLogin) {
    const sheet = document.getElementById("kiln-account-sheet");
    if (sheet) sheet.hidden = true;
  }
}

function goLoginFromSignIn(ev) {
  if (location.pathname === "/login") return;
  const t = ev.target;
  if (!t || t.closest("#kiln-account-sheet, #kiln-account-dock")) return;
  const b = t.closest("a, button, [role='button']");
  if (!b) return;
  const href = (b.getAttribute && (b.getAttribute("href") || "")) || "";
  const label = (b.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  const login =
    /\/login/.test(href) ||
    label === "sign in" ||
    label === "create your account" ||
    label === "create your seat" ||
    label === "connect to import";
  if (!login) return;
  ev.preventDefault();
  ev.stopPropagation();
  rememberStudioNext();
  try {
    const next = location.pathname === "/studio" ? "/login?next=/studio" : "/login";
    window.location.assign(next);
  } catch {
    /* stay */
  }
}

function installKilnPerf() {
  if (installKilnPerf._on) return;
  installKilnPerf._on = true;
  if (!document.getElementById("kiln-perf-css")) {
    const css = document.createElement("style");
    css.id = "kiln-perf-css";
    css.textContent = `video[data-kiln-defer="1"]{cursor:pointer;background:#09090b}
video[data-kiln-defer="1"]:not([src]){position:relative}`;
    document.head.appendChild(css);
  }
  function lazyImgs() {
    document.querySelectorAll("img").forEach((img) => {
      if (img.closest("header")) return;
      if (!img.hasAttribute("loading")) img.loading = "lazy";
      if (!img.hasAttribute("decoding")) img.decoding = "async";
    });
  }
  function stripSrc(v) {
    if (v.dataset.kilnPlay === "1") return;
    const sources = [...v.querySelectorAll("source")];
    const src = v.getAttribute("src") || (sources[0] && sources[0].getAttribute("src")) || "";
    if (!src) return;
    v.dataset.src = src;
    v.removeAttribute("src");
    sources.forEach((s) => {
      if (s.getAttribute("src")) {
        s.dataset.src = s.getAttribute("src");
        s.removeAttribute("src");
      }
    });
    try { v.pause(); } catch { /* ignore */ }
    try { v.removeAttribute("src"); v.load(); } catch { /* ignore */ }
  }
  function deferVideos() {
    document.querySelectorAll("video").forEach((v) => {
      v.preload = "none";
      v.autoplay = false;
      v.muted = true;
      v.playsInline = true;
      v.removeAttribute("autoplay");
      if (!v.dataset.kilnDefer) {
        v.dataset.kilnDefer = "1";
        const arm = () => {
          if (v.dataset.kilnPlay === "1") return;
          v.dataset.kilnPlay = "1";
          const sources = [...v.querySelectorAll("source")];
          sources.forEach((s) => {
            if (s.dataset.src) s.setAttribute("src", s.dataset.src);
          });
          if (v.dataset.src) v.src = v.dataset.src;
          v.play().catch(() => {});
        };
        v.addEventListener("click", arm, { capture: true });
        v.addEventListener("pointerdown", arm, { capture: true });
      }
      stripSrc(v);
    });
  }
  const tick = () => {
    try {
      lazyImgs();
      deferVideos();
    } catch {
      /* keep the page moving */
    }
  };
  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

export function installKilnSeat() {
  if (installKilnSeat._on) return;
  installKilnSeat._on = true;
  installCss();
  hideSheetOnLogin();
  try {
    installKilnNav();
  } catch {
    /* the map still exists on the API */
  }
  try {
    installKilnPhone();
  } catch {
    /* the seat panel is best-effort */
  }
  try {
    installKilnMarket();
  } catch {
    /* the shelf is best-effort */
  }
  try {
    installKilnStudio();
  } catch {
    /* studio layer is best-effort */
  }
  try {
    installKilnDomain();
  } catch {
    /* domain layer is best-effort */
  }
  try {
    installGWebGpu();
  } catch {
    /* compute plane is best-effort */
  }
  const boot = () => {
    try {
      hideSheetOnLogin();
      bindSheet();
      installSignupChoices();
      installKilnPerf();
    } catch (e) {
      console.warn("kiln seat", e);
    }
  };
  boot();
  const mo = new MutationObserver(() => boot());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("click", goLoginFromSignIn, true);
  window.addEventListener("popstate", hideSheetOnLogin);
}

installKilnSeat();
