/**
 * Domain bind — kiln.pocketnova.app is the public Kiln.
 */
function sessionToken() {
  try {
    return sessionStorage.getItem("kiln-session") || globalThis.__KILN_SESSION || "";
  } catch {
    return globalThis.__KILN_SESSION || "";
  }
}

function authHeaders() {
  const token = sessionToken();
  const h = { accept: "application/json", "content-type": "application/json" };
  if (token) h.authorization = "Bearer " + token;
  return h;
}

function targetHost() {
  const h = location.hostname || "";
  if (!h || h === "localhost" || h === "127.0.0.1" || /^(\d+\.){3}\d+$/.test(h) || h.endsWith(".local")) {
    return "your-kiln.grok.me";
  }
  return h;
}

async function domainApi(body) {
  const res = await fetch("/api/kiln/domain", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ ok: false, error: "domain failed" }));
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function installCss() {
  if (document.getElementById("kiln-domain-css")) return;
  const css = document.createElement("style");
  css.id = "kiln-domain-css";
  css.textContent = `
.k-domain{
  margin:1.25rem 0 0;
  padding:1.1rem 1.15rem 1.2rem;
  border:1px solid var(--color-border, rgba(255,255,255,.12));
  border-radius:1rem;
  background:color-mix(in srgb, var(--color-surface, #141418) 80%, var(--color-bg, #09090b));
}
.k-domain h2{
  margin:0;
  font:500 1.15rem/1.3 "Newsreader",Georgia,serif;
  letter-spacing:-.02em;
}
.k-domain .k-domain-kicker{
  margin:0 0 .35rem;
  color:var(--color-muted, #a1a1aa);
  font:11px/1.4 ui-sans-serif,system-ui,sans-serif;
  letter-spacing:.16em;text-transform:uppercase;
}
.k-domain p{margin:.45rem 0 0;color:var(--color-muted, #a1a1aa);font-size:13px;line-height:1.5}
.k-domain form{display:flex;flex-wrap:wrap;gap:.5rem;margin:.85rem 0 0}
.k-domain input{
  flex:1 1 12rem;min-height:44px;padding:.65rem .85rem;
  border:1px solid var(--color-border, rgba(255,255,255,.12));
  border-radius:.75rem;background:#09090b;color:#f4f4f5;
  font:400 15px/1.3 "IBM Plex Sans",system-ui,sans-serif;
}
.k-domain button,.k-domain .k-domain-copy{
  min-height:44px;padding:0 .9rem;
  border:1px solid var(--color-border, rgba(255,255,255,.12));
  border-radius:999px;background:transparent;color:#f4f4f5;
  font-size:12px;letter-spacing:.04em;cursor:pointer;
}
.k-domain button[data-primary]{background:#f4f4f5;color:#09090b;border-color:#f4f4f5}
.k-domain button:disabled{opacity:.5}
.k-domain button[aria-pressed="true"]{background:#f4f4f5;color:#09090b;border-color:#f4f4f5}
.k-domain-modes{display:flex;flex-wrap:wrap;gap:.4rem;margin:.85rem 0 0}
.k-domain ol{list-style:none;margin:.85rem 0 0;padding:0}
.k-domain li{
  display:grid;gap:.2rem;padding:.7rem 0;
  border-top:1px solid var(--color-border, rgba(255,255,255,.12));
  font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
}
.k-domain .k-domain-steps{list-style:decimal;padding-left:1.25rem;margin:.7rem 0 0}
.k-domain .k-domain-steps li{
  display:list-item;border-top:0;padding:.22rem 0;
  font:13px/1.5 "IBM Plex Sans",system-ui,sans-serif;color:#d4d4d8;
}
.k-domain .k-domain-row{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .7rem}
.k-domain .k-domain-status{
  font:10px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;
  color:var(--color-muted, #a1a1aa);
}
.k-domain .k-domain-status[data-on="live"]{color:#5eead4}
.k-domain a{color:#f4f4f5}
.k-domain pre{
  margin:.7rem 0 0;padding:.8rem .85rem;max-height:14rem;overflow:auto;
  border:1px solid var(--color-border, rgba(255,255,255,.12));
  border-radius:.75rem;background:#09090b;color:#e7e7ea;
  font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  white-space:pre-wrap;word-break:break-word;
}
.k-domain code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e7e7ea}
@media (max-width:767px){
  .k-domain{margin-top:1.1rem;padding:.95rem .9rem 1.05rem}
  .k-domain button,.k-domain input{min-height:44px}
}
`;
  document.head.appendChild(css);
}

const state = {
  domain: null,
  pack: null,
  note: "",
  busy: false,
  host: "kiln.pocketnova.app",
  mode: "worker",
};

function packOf() {
  return (state.domain && state.domain) || state.pack || {};
}

function txtOf() {
  if (!state.domain) return null;
  const pack = packOf();
  if (pack.txt && pack.txt.content && !String(pack.txt.content).endsWith(":pending")) return pack.txt;
  const recs = pack.cloudflare && pack.cloudflare.records;
  const row = (Array.isArray(recs) && recs.find((r) => r.type === "TXT")) || null;
  if (row && String(row.content).endsWith(":pending")) return null;
  return row;
}

function recordLine(r) {
  return `<li>
    <div class="k-domain-row">
      <strong>${esc(r.type)}</strong>
      <span>${esc(r.name)}</span>
      <button type="button" class="k-domain-copy" data-copy="${esc(r.content)}">Copy value</button>
    </div>
    <div>${esc(r.content)}</div>
    <div class="k-domain-status">${esc(r.proxy)} · ${esc(r.hint || r.ttl || "")}</div>
  </li>`;
}

function txtBlock() {
  const txt = txtOf();
  if (!txt) return "";
  return `<ol>
    ${recordLine({ type: "TXT", name: txt.name, content: txt.content, proxy: txt.proxy || "DNS only", hint: txt.hint || "Grey cloud. Then Verify." })}
  </ol>`;
}

function modeBody() {
  const pack = packOf();
  const origin = pack.origin || targetHost();
  const host = (state.domain && state.domain.host) || state.host || "kiln.pocketnova.app";
  const www = host.startsWith("www.") ? host : "www." + host;
  if (state.mode === "tunnel") {
    return `<p>Skip this. Tunnel is a machine you own — not the public Kiln. Everyone else would depend on that box staying on.</p>
      <ol class="k-domain-steps">
        <li>Only if this Kiln is the origin on hardware you run.</li>
        <li><code>cloudflared tunnel create kiln</code> then route DNS for <code>${esc(host)}</code>.</li>
        <li>Not for all users. Worker is.</li>
      </ol>
      <div class="k-domain-row" style="margin-top:.7rem">
        <button type="button" class="k-domain-copy" data-copy="${esc(pack.tunnel || "")}">Copy tunnel.yml</button>
        <a href="/cloudflare/tunnel.yml">tunnel.yml</a>
      </div>
      <pre>${esc(pack.tunnel || "")}</pre>
      ${txtBlock()}`;
  }
  if (state.mode === "dns") {
    const records = pack.cloudflare && Array.isArray(pack.cloudflare.records) ? pack.cloudflare.records.map(recordLine).join("") : "";
    return `<p>Raw CNAME if you refuse a Worker. Orange cloud. SSL Full. Apex is messier. The public site uses Worker.</p>
      ${records ? `<ol>${records}</ol>` : ""}`;
  }
  return `<p>One Worker. After that, <code>${esc(host)}</code> is Kiln for every visitor. You do not connect a Git repo. You do not run a Mini.</p>
    <ol class="k-domain-steps">
      <li>Publish this Kiln. That host is <code>ORIGIN</code>.</li>
      <li>Workers → <code>kiln</code> → Edit code. Replace Hello World. Paste. Deploy.</li>
      <li>Settings → Variables → <code>ORIGIN</code> = <code>${esc(origin)}</code> (published host, no https).</li>
      <li>Domains → Custom Domain is already <code>${esc(host)}</code>. Leave it. Don't add www.</li>
      <li>Bind on <em>your</em> seat. Kiln prints a TXT. Grey cloud. Verify. Other people just sign in.</li>
    </ol>
    <div class="k-domain-row" style="margin-top:.7rem">
      <button type="button" class="k-domain-copy" data-copy="${esc(pack.worker || "")}">Copy worker</button>
      <button type="button" class="k-domain-copy" data-copy="${esc(origin)}">Copy ORIGIN</button>
      <button type="button" class="k-domain-copy" data-copy="${esc(pack.wrangler || "")}">Copy wrangler.toml</button>
      <a href="/cloudflare/worker.js">worker.js</a>
    </div>
    <pre>${esc(pack.worker || "")}</pre>
    ${txtBlock()}`;
}

function cardHtml() {
  const d = state.domain;
  const status = (d && d.status) || "unbound";
  const url = d && d.url ? d.url : "";
  const modes = [
    ["worker", "Worker"],
    ["tunnel", "Tunnel"],
    ["dns", "DNS"],
  ];
  return `
    <p class="k-domain-kicker">kiln.pocketnova.app</p>
    <h2>Public Kiln. One Worker.</h2>
    <p>This host is the site for every user. You paste the Worker once. Visitors open kiln.pocketnova.app and sign in. No Mini. No Git repo.</p>
    <form data-k-domain="bind">
      <input name="host" type="text" inputmode="url" autocomplete="off" spellcheck="false" value="${esc(state.host)}" placeholder="kiln.pocketnova.app" aria-label="Hostname" />
      <button type="submit" data-primary ${state.busy ? "disabled" : ""}>Bind</button>
      ${d ? `<button type="button" data-k-domain-act="verify" ${state.busy ? "disabled" : ""}>Verify</button>` : ""}
      ${d ? `<button type="button" data-k-domain-act="clear" ${state.busy ? "disabled" : ""}>Unbind</button>` : ""}
    </form>
    <p><span class="k-domain-status" data-on="${esc(status)}">${esc(status)}</span>${url ? ` · <a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(d.host)}</a>` : ""} · ORIGIN <code>${esc((d && d.origin) || (state.pack && state.pack.origin) || targetHost())}</code></p>
    <div class="k-domain-modes">
      ${modes
        .map(
          ([id, label]) =>
            `<button type="button" data-k-mode="${id}" aria-pressed="${state.mode === id ? "true" : "false"}">${label}</button>`,
        )
        .join("")}
    </div>
    ${modeBody()}
    ${state.note ? `<p>${esc(state.note)}</p>` : ""}
  `;
}

function paintCard() {
  if (location.pathname !== "/account" && !location.pathname.startsWith("/account")) return;
  installCss();
  const root =
    document.querySelector("main") ||
    document.querySelector("[class*='max-w-2xl']") ||
    document.querySelector("#app > div") ||
    document.body;
  if (!root) return;
  const h1 = root.querySelector("h1");
  const buttons = root.querySelector(".mt-6.flex.flex-wrap") || root.querySelector(".flex.flex-wrap.gap-2");
  let card = document.querySelector("[data-kiln-domain]");
  if (!card) {
    card = document.createElement("section");
    card.className = "k-domain";
    card.setAttribute("data-kiln-domain", "1");
    card.addEventListener("submit", (ev) => {
      const form = ev.target && ev.target.closest("form");
      if (!form) return;
      ev.preventDefault();
      const input = form.querySelector("input[name='host']");
      state.host = (input && input.value) || state.host;
      void bindHost(state.host);
    });
    card.addEventListener("click", (ev) => {
      const modeBtn = ev.target && ev.target.closest("[data-k-mode]");
      if (modeBtn) {
        state.mode = modeBtn.getAttribute("data-k-mode") || "worker";
        paintCard();
        return;
      }
      const copy = ev.target && ev.target.closest("[data-copy]");
      if (copy) {
        const v = copy.getAttribute("data-copy") || "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(v).then(
            () => {
              state.note = "Copied.";
              paintCard();
            },
            () => {},
          );
        }
        return;
      }
      const act = ev.target && ev.target.closest("[data-k-domain-act]");
      if (!act) return;
      const kind = act.getAttribute("data-k-domain-act");
      if (kind === "verify") void verifyHost();
      if (kind === "clear") void unbindHost();
    });
  }
  if (buttons && card.previousElementSibling !== buttons) buttons.insertAdjacentElement("afterend", card);
  else if (!card.parentNode) {
    if (h1 && h1.parentNode) h1.insertAdjacentElement("afterend", card);
    else root.appendChild(card);
  }
  const html = cardHtml();
  if (card.getAttribute("data-html") !== html) {
    card.innerHTML = html;
    card.setAttribute("data-html", html);
  }
}

function takePack(out) {
  if (!out) return;
  state.pack = {
    origin: out.origin,
    cloudflare: out.cloudflare,
    worker: out.worker,
    tunnel: out.tunnel,
    wrangler: out.wrangler,
    txt: out.txt,
    files: out.files,
  };
}

async function refresh() {
  if (!sessionToken()) return;
  try {
    const out = await domainApi({ action: "me" });
    if (out && out.domain) {
      state.domain = out.domain;
      state.host = out.domain.host || state.host;
      state.mode = out.domain.edge || state.mode;
      takePack(out.domain);
    } else if (out && out.ok) {
      state.domain = null;
      if (out.suggest) state.host = out.suggest;
      takePack(out);
    }
    paintCard();
  } catch {
    paintCard();
  }
}

async function bindHost(host) {
  state.busy = true;
  paintCard();
  try {
    const out = await domainApi({ action: "bind", host, edge: state.mode === "dns" ? "dns" : state.mode });
    if (out && out.ok && out.domain) {
      state.domain = out.domain;
      state.host = out.domain.host;
      takePack(out.domain);
      state.note =
        state.mode === "tunnel"
          ? "Tunnel is a machine you own, not the public site. Worker is what all users hit."
          : "Paste the Worker once. ORIGIN is the published Kiln. Custom domain kiln.pocketnova.app. Other seats just sign in.";
    } else {
      state.note = (out && out.error) || "could not bind";
    }
  } catch {
    state.note = "could not bind";
  } finally {
    state.busy = false;
    paintCard();
  }
}

async function verifyHost() {
  state.busy = true;
  paintCard();
  try {
    const out = await domainApi({ action: "verify" });
    if (out && out.domain) {
      state.domain = out.domain;
      takePack(out.domain);
    }
    state.note = out && out.live ? "Live. kiln.pocketnova.app is this Kiln." : "Pending. Paste the Worker, set ORIGIN, then TXT and Verify.";
  } catch {
    state.note = "verify failed";
  } finally {
    state.busy = false;
    paintCard();
  }
}

async function unbindHost() {
  state.busy = true;
  paintCard();
  try {
    await domainApi({ action: "unbind" });
    state.domain = null;
    state.host = "kiln.pocketnova.app";
    state.note = "Unbound.";
    const out = await domainApi({ action: "me" });
    if (out && out.ok) takePack(out);
  } finally {
    state.busy = false;
    paintCard();
  }
}

export function installKilnDomain() {
  if (installKilnDomain._on) return;
  installKilnDomain._on = true;
  const boot = () => {
    try {
      if (location.pathname === "/account" || location.pathname.startsWith("/account")) {
        paintCard();
        void refresh();
      }
    } catch {
      /* keep moving */
    }
  };
  boot();
  window.setTimeout(boot, 400);
  window.setTimeout(boot, 1400);
  window.addEventListener("popstate", boot);
  const mo = new MutationObserver(() => {
    if (location.pathname === "/account" || location.pathname.startsWith("/account")) paintCard();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

installKilnDomain();
