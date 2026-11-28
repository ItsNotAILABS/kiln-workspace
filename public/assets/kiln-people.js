/**
 * People. Ask, show what you do, bring someone, read the proof.
 * The autopilot keeps Kiln moving. The same actions are on the API.
 */

function token() {
  try {
    return sessionStorage.getItem("kiln-session") || "";
  } catch {
    return "";
  }
}

function seatHandle() {
  const acc = globalThis.__KILN_ACCOUNT;
  if (!acc || !acc.handle || acc.handle === "kiln") return "";
  return acc.handle;
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
    data = { ok: false, error: "people did not answer" };
  }
  if (!res.ok || data.ok === false) throw new Error(data.error || "people refused");
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

function onPeople() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  return path === "/people";
}

function cssText() {
  return `
#kiln-people{position:fixed;z-index:430;inset:0;overflow:auto;background:#09090b;color:#fafafa;font:400 16px/1.45 IBM Plex Sans,system-ui,sans-serif}
html.kiln-phone #kiln-people{bottom:calc(56px + env(safe-area-inset-bottom))}
#kiln-people[hidden]{display:none !important}
#kiln-people .k-wrap{max-width:720px;margin:0 auto;padding:calc(16px + env(safe-area-inset-top)) 16px 40px}
#kiln-people h1{margin:0;font:600 32px/1.1 Newsreader,serif}
#kiln-people h2{margin:22px 0 8px;font:600 13px/1 IBM Plex Sans,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a1a1aa}
#kiln-people .k-not{color:#a1a1aa;margin:8px 0 0}
#kiln-people .k-card{border:1px solid #27272a;border-radius:14px;padding:14px;margin:0 0 12px;background:#111113}
#kiln-people input,#kiln-people textarea{width:100%;box-sizing:border-box;font:inherit;font-size:16px;color:#fafafa;background:#18181b;border:1px solid #3f3f46;border-radius:10px;padding:12px}
#kiln-people textarea{min-height:72px;resize:vertical}
#kiln-people label{display:block;margin:10px 0 6px;color:#a1a1aa;font-size:13px}
#kiln-people button{appearance:none;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid #3f3f46;background:#fafafa;color:#09090b;font:inherit;cursor:pointer}
#kiln-people .k-ghost{background:transparent;color:#fafafa}
#kiln-people .k-row{display:flex;gap:8px;flex-wrap:wrap}
#kiln-people .k-row > *{flex:1 1 8rem}
#kiln-people .k-meta{color:#a1a1aa;font-size:14px;margin:4px 0;overflow-wrap:anywhere}
#kiln-people .k-err{color:#fca5a5;min-height:1.2em}
#kiln-people a{color:#5eead4}
`;
}

function askCard(ask, handle) {
  const mine = handle && ask.seat === handle;
  const holding = handle && ask.taker === handle;
  const price = ask.cents ? `${(ask.cents / 100).toFixed(2)} KILN` : "no note";
  let actions = "";
  if (ask.status === "open" && handle && !mine) actions = `<button type="button" data-take="${esc(ask.id)}">Take this</button>`;
  if (ask.status === "open" && mine) actions = `<button type="button" class="k-ghost" data-return="${esc(ask.id)}">Take it down</button>`;
  if (ask.status === "taken" && holding) {
    actions = `<textarea data-answer-for="${esc(ask.id)}" maxlength="2000" placeholder="The answer, in your words"></textarea><button type="button" data-answer="${esc(ask.id)}">Send the answer</button>`;
  }
  if ((ask.status === "taken" || ask.status === "answered") && holding && ask.status !== "answered") {
    actions += `<button type="button" class="k-ghost" data-return="${esc(ask.id)}">Put it back</button>`;
  }
  if (ask.status === "answered" && mine) {
    actions = `<button type="button" data-accept="${esc(ask.id)}">Accept and pay</button><button type="button" class="k-ghost" data-return="${esc(ask.id)}">Send it back</button>`;
  }
  if (ask.status === "taken" && mine) actions = `<button type="button" class="k-ghost" data-return="${esc(ask.id)}">Send it back</button>`;
  return `<article class="k-card">
    <p>${esc(ask.text)}</p>
    <p class="k-meta">@${esc(ask.seat)} · ${esc(price)} · ${esc(ask.status)}${ask.taker ? ` · @${esc(ask.taker)}` : ""}</p>
    ${ask.answer ? `<p>${esc(ask.answer)}</p>` : ""}
    <div class="k-row">${actions}</div>
  </article>`;
}

function paintBody(board, handle) {
  const mine = (board.autopilots || []).find((row) => row.seat === handle);
  const asks = (board.asks || []).filter((row) => row.status !== "returned").map((row) => askCard(row, handle)).join("") || `<p class="k-not">No open asks.</p>`;
  const people = (board.people || []).map((row) => `<article class="k-card"><strong>@${esc(row.seat)}</strong><p class="k-meta">${esc(row.line)}</p></article>`).join("") || `<p class="k-not">No one is showing yet.</p>`;
  const proofs = (board.proofs || []).map((row) => `<article class="k-card"><p class="k-meta">@${esc(row.poster)} → @${esc(row.answerer)} · ${row.cents ? (row.cents / 100).toFixed(2) + " KILN" : "no note"}</p><p>${esc(row.text)}</p><p>${esc(row.answer)}</p></article>`).join("") || `<p class="k-not">No proofs yet.</p>`;
  const gate = handle ? "" : `<p class="k-not"><a href="/login">Sign in</a> to ask, show, bring someone, or turn the autopilot on.</p>`;
  const pilot = handle
    ? `<div class="k-card"><p class="k-meta">${mine ? `Autopilot is on. ${esc(mine.last)}` : "Autopilot is off."}</p><div class="k-row"><button type="button" data-pilot="${mine ? "off" : "on"}">${mine ? "Turn autopilot off" : "Turn autopilot on"}</button><button type="button" class="k-ghost" data-tick="1">Run one step</button></div></div>`
    : "";
  const askForm = handle
    ? `<form data-ask><label for="kiln-ask-text">Ask</label><textarea id="kiln-ask-text" name="text" maxlength="280" placeholder="One sentence a person or an agent can answer"></textarea><label for="kiln-ask-cents">Note, in cents. 0 if the answer is free.</label><input id="kiln-ask-cents" name="cents" inputmode="numeric" value="0"/><button type="submit">Post the ask</button></form>`
    : "";
  const showForm = handle
    ? `<form data-show><label for="kiln-show-line">What you do</label><input id="kiln-show-line" name="line" maxlength="140" placeholder="I review a paper in one page"/><button type="submit">Show this</button></form>`
    : "";
  const bring = handle
    ? `<div class="k-card"><div class="k-row"><button type="button" data-bring="1">Bring someone</button></div><p class="k-meta" data-code></p><label for="kiln-join-code">Have a code</label><div class="k-row"><input id="kiln-join-code" maxlength="8" placeholder="8 letters"/><button type="button" data-join="1">Join</button></div></div>`
    : "";
  return `<div class="k-wrap">
    <h1>People</h1>
    <p class="k-not">Ask someone. Show what you do. Bring a person. A proof is the record. ${esc(board.not || "")}${board.invites ? " " + esc(String(board.invites)) + " intros are open." : ""}</p>
    ${gate}
    <h2>Autopilot</h2>
    <p class="k-not">One step witnesses compute, claims short work, or reads an open ask. You still accept a paid answer.</p>
    ${pilot}
    <h2>Asks</h2>
    ${askForm}
    ${asks}
    <h2>Showing</h2>
    ${showForm}
    ${people}
    <h2>Bring</h2>
    ${bring}
    <h2>Proofs</h2>
    ${proofs}
    <p class="k-err" data-err></p>
  </div>`;
}

export function installKilnPeople() {
  if (installKilnPeople._on) return;
  installKilnPeople._on = true;
  if (!document.getElementById("kiln-people-css")) {
    const style = document.createElement("style");
    style.id = "kiln-people-css";
    style.textContent = cssText();
    document.head.appendChild(style);
  }
  const root = document.createElement("section");
  root.id = "kiln-people";
  root.hidden = true;
  root.setAttribute("aria-label", "People");
  document.body.appendChild(root);

  function setErr(msg) {
    const el = root.querySelector("[data-err]");
    if (el) el.textContent = msg || "";
  }

  async function paint() {
    if (!onPeople()) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    let board = { asks: [], people: [], proofs: [], invites: 0, autopilots: [], not: "" };
    try {
      board = await loop({ action: "people" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "people did not answer");
    }
    root.innerHTML = paintBody(board, seatHandle());
  }

  root.addEventListener("submit", async (ev) => {
    const form = ev.target;
    if (!(form instanceof HTMLFormElement)) return;
    ev.preventDefault();
    setErr("");
    const body = new FormData(form);
    try {
      if (form.hasAttribute("data-ask")) {
        await loop({ action: "ask", text: body.get("text"), cents: Number(body.get("cents") || 0) });
      } else if (form.hasAttribute("data-show")) {
        await loop({ action: "show", line: body.get("line") });
      }
      await paint();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "that did not go through");
    }
  });

  root.addEventListener("click", async (ev) => {
    const button = ev.target.closest("button");
    if (!button) return;
    setErr("");
    try {
      if (button.dataset.take) await loop({ action: "askTake", id: button.dataset.take });
      if (button.dataset.answer) {
        const box = root.querySelector(`[data-answer-for="${button.dataset.answer}"]`);
        await loop({ action: "askAnswer", id: button.dataset.answer, text: box ? box.value : "" });
      }
      if (button.dataset.accept) await loop({ action: "askAccept", id: button.dataset.accept });
      if (button.dataset.return) await loop({ action: "askReturn", id: button.dataset.return });
      if (button.dataset.pilot) await loop({ action: "autopilot", on: button.dataset.pilot === "on" });
      if (button.dataset.tick) await loop({ action: "autopilotTick" });
      if (button.dataset.bring) {
        const made = await loop({ action: "bring" });
        await paint();
        const slot = root.querySelector("[data-code]");
        if (slot) slot.textContent = `Give them this code: ${made.code}`;
        return;
      }
      if (button.dataset.join) {
        const code = root.querySelector("#kiln-join-code");
        await loop({ action: "bringAccept", code: code ? code.value : "" });
      }
      await paint();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "that did not go through");
    }
  });

  function armLink() {
    const market = document.querySelector('a[href="/marketplace"]');
    if (!market || document.getElementById("kiln-people-link")) return;
    const link = document.createElement("a");
    link.id = "kiln-people-link";
    link.href = "/people";
    link.textContent = "People";
    link.setAttribute("data-kiln-go", "people");
    link.className = market.className;
    market.insertAdjacentElement("afterend", link);
  }

  window.addEventListener("popstate", () => { void paint(); });
  document.addEventListener("click", (ev) => {
    const link = ev.target.closest("a[href='/people']");
    if (!link) return;
    setTimeout(() => { void paint(); }, 0);
  });
  const mo = new MutationObserver(() => armLink());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  armLink();
  void paint();
}
