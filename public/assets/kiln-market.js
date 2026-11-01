/**
 * The shelf. A price is a KILN note. Not a bank, not a card, not USDC.
 * Anyone can read it. A seat claims an opening note, lists a file, or buys one.
 */

function token() {
  try {
    return sessionStorage.getItem("kiln-session") || "";
  } catch {
    return "";
  }
}

async function loop(body) {
  const res = await fetch("/api/kiln/loop", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token() ? `Bearer ${token()}` : "" },
    body: JSON.stringify({ token: token(), ...body }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: "the shelf did not answer" };
  }
  if (!res.ok || data.ok === false) throw new Error(data.error || "the shelf refused");
  return data;
}

function esc(s) {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  return String(s ?? "")
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot);
}

function onShelf() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  return path === "/marketplace";
}

function cssText() {
  return `
#kiln-shelf{position:fixed;z-index:430;inset:0;overflow:auto;background:#09090b;color:#fafafa;font:400 16px/1.45 IBM Plex Sans,system-ui,sans-serif}
html.kiln-phone #kiln-shelf{bottom:calc(56px + env(safe-area-inset-bottom))}
#kiln-shelf[hidden]{display:none !important}
#kiln-shelf .k-wrap{max-width:720px;margin:0 auto;padding:calc(16px + env(safe-area-inset-top)) 16px 32px}
#kiln-shelf h1{margin:0;font:600 28px/1.2 Newsreader,serif}
#kiln-shelf .k-not{color:#a1a1aa;margin:8px 0 16px}
#kiln-shelf .k-till,#kiln-shelf .k-card{border:1px solid #27272a;border-radius:14px;padding:14px;margin:0 0 12px;background:#111113}
#kiln-shelf input,#kiln-shelf textarea{width:100%;box-sizing:border-box;font:inherit;font-size:16px;color:#fafafa;background:#18181b;border:1px solid #3f3f46;border-radius:10px;padding:12px}
#kiln-shelf textarea{min-height:72px;resize:vertical}
#kiln-shelf label{display:block;margin:12px 0 6px;color:#a1a1aa;font-size:13px}
#kiln-shelf button{appearance:none;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid #3f3f46;background:#fafafa;color:#09090b;font:inherit}
#kiln-shelf .k-ghost{background:transparent;color:#fafafa}
#kiln-shelf .k-row{display:flex;gap:8px;align-items:center}
#kiln-shelf .k-row input{flex:1}
#kiln-shelf .k-meta{color:#a1a1aa;font-size:14px;margin:4px 0}
#kiln-shelf .k-err{color:#fca5a5;min-height:1.2em}
#kiln-shelf .k-price{font-weight:600}
`;
}

function card(p, handle) {
  const mine = handle && p.seller === handle;
  return `<article class="k-card" data-id="${esc(p.id)}">
    <div class="k-row"><strong>${esc(p.title)}</strong><span class="k-price">${esc(p.notes)} KILN</span></div>
    <p class="k-meta">@${esc(p.seller)} · ${esc(p.path)} · ${esc(p.stock)} left</p>
    ${p.description ? `<p>${esc(p.description)}</p>` : ""}
    ${mine ? `<button type="button" class="k-ghost" data-unlist="${esc(p.id)}">Take down</button>` : `<button type="button" data-buy="${esc(p.id)}">Buy</button>`}
  </article>`;
}

export function installKilnMarket() {
  if (installKilnMarket._on) return;
  installKilnMarket._on = true;
  if (!document.getElementById("kiln-market-css")) {
    const style = document.createElement("style");
    style.id = "kiln-market-css";
    style.textContent = cssText();
    document.head.appendChild(style);
  }
  const root = document.createElement("section");
  root.id = "kiln-shelf";
  root.hidden = true;
  root.setAttribute("aria-label", "Marketplace");
  root.innerHTML = `<div class="k-wrap">
    <h1>Marketplace</h1>
    <p class="k-not">Not a bank, not a card, not USDC. A price is a KILN note.</p>
    <div class="k-till" data-till>Sign in to claim an opening note.</div>
    <form class="k-row" data-search>
      <input name="q" placeholder="Search title, seller, or file" maxlength="80" />
      <button type="submit">Search</button>
    </form>
    <div data-cards></div>
    <p class="k-err" data-err></p>
    <form data-list>
      <h2>List a file</h2>
      <label for="kiln-list-repo">Computer</label>
      <input id="kiln-list-repo" name="repo" placeholder="you/home" />
      <label for="kiln-list-path">File</label>
      <input id="kiln-list-path" name="path" placeholder="README.md" />
      <label for="kiln-list-title">Title</label>
      <input id="kiln-list-title" name="title" maxlength="80" />
      <label for="kiln-list-cents">Price in cents</label>
      <input id="kiln-list-cents" name="cents" inputmode="numeric" placeholder="1000" />
      <label for="kiln-list-stock">Stock</label>
      <input id="kiln-list-stock" name="stock" inputmode="numeric" placeholder="1" />
      <label for="kiln-list-about">About</label>
      <textarea id="kiln-list-about" name="description" maxlength="240"></textarea>
      <p class="k-err" data-err></p>
      <button type="submit">List</button>
    </form>
  </div>`;
  document.body.appendChild(root);

  const state = { handle: "", claimed: false, cents: 0, notes: "0.00" };

  function setErr(msg) {
    const err = root.querySelector(":scope .k-wrap > .k-err");
    if (err) err.textContent = msg || "";
  }

  async function paint() {
    root.hidden = !onShelf();
    if (root.hidden) return;
    const q = new FormData(root.querySelector("[data-search]")).get("q") || "";
    let products = [];
    try {
      const shelf = await loop({ action: "products", q });
      products = shelf.products || [];
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the shelf did not answer");
    }
    if (token()) {
      try {
        const till = await loop({ action: "wallet" });
        state.handle = till.handle || "";
        state.claimed = !!till.claimed;
        state.cents = till.cents || 0;
        state.notes = till.notes || "0.00";
      } catch {
        state.handle = "";
      }
    } else {
      state.handle = "";
    }
    const till = root.querySelector("[data-till]");
    if (!state.handle) {
      till.innerHTML = `<p>Sign in to claim an opening note, list a file, or buy one.</p><p><a href="/login">Sign in</a></p>`;
    } else if (!state.claimed) {
      till.innerHTML = `<p>@${esc(state.handle)} · no opening note yet.</p><button type="button" data-claim>Claim 25.00 KILN</button>`;
    } else {
      till.innerHTML = `<p>@${esc(state.handle)} · <strong>${esc(state.notes)} KILN</strong></p>`;
    }
    const cards = root.querySelector("[data-cards]");
    cards.innerHTML = products.length ? products.map((p) => card(p, state.handle)).join("") : `<p class="k-meta">Nothing on the shelf.</p>`;
    const list = root.querySelector("[data-list]");
    list.hidden = !state.handle;
    const repo = list.querySelector('[name="repo"]');
    if (state.handle && repo && !repo.value) repo.value = `${state.handle}/home`;
  }

  root.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    if (form.matches("[data-search]")) {
      setErr("");
      await paint();
      return;
    }
    if (!form.matches("[data-list]")) return;
    const err = form.querySelector("[data-err]");
    err.textContent = "";
    const body = new FormData(form);
    try {
      await loop({
        action: "list_product",
        repo: body.get("repo"),
        path: body.get("path"),
        title: body.get("title"),
        cents: Number(body.get("cents")),
        stock: Number(body.get("stock") || 1),
        description: body.get("description"),
      });
      form.reset();
      await paint();
    } catch (e) {
      err.textContent = e instanceof Error ? e.message : "list failed";
    }
  });

  root.addEventListener("click", async (ev) => {
    const claim = ev.target.closest("[data-claim]");
    const buy = ev.target.closest("[data-buy]");
    const down = ev.target.closest("[data-unlist]");
    if (!claim && !buy && !down) return;
    setErr("");
    try {
      if (claim) await loop({ action: "claim" });
      if (buy) await loop({ action: "buy", productId: buy.dataset.buy });
      if (down) await loop({ action: "unlist", productId: down.dataset.unlist });
      await paint();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "that did not go through");
    }
  });

  window.addEventListener("popstate", () => { void paint(); });
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("a[href='/marketplace']");
    if (!a) return;
    setTimeout(() => { void paint(); }, 0);
  });
  void paint();
}
