/* KILN Forge page — PRs, releases, packages via /api/forge/* (daemon /v1/*).
   All server/user content is rendered with textContent — never innerHTML. */
"use strict";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let owner = (params.get("owner") || "kiln").trim();
let repo = (params.get("repo") || "kiln").trim();
const TOKEN_KEY = "kiln-forge-token";
let notLiveShown = false;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
}
function token() { return sessionStorage.getItem(TOKEN_KEY) || ""; }
function refreshAuthState() {
  $("auth-state").textContent = token()
    ? "token set for this tab (session only)"
    : "no token — read/write calls will 401";
}
function notice(msg, isError) {
  const n = $("notice");
  n.hidden = false;
  n.className = "notice" + (isError ? " error" : "");
  n.textContent = msg;
}
function clearNotice() { $("notice").hidden = true; }

async function api(path, opts) {
  opts = opts || {};
  const headers = {};
  if (token()) headers.authorization = "Bearer " + token();
  let body;
  if (opts.body !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.body); }
  const res = await fetch("/api/forge" + path, { method: opts.method || "GET", headers, body });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* non-JSON */ }
  if (!res.ok) {
    if (res.status === 404 && !notLiveShown) {
      notLiveShown = true;
      notice("Forge API not live yet — the daemon returned 404 for this route. This page is staged; lists and actions will work as soon as the daemon forge routes land.");
    } else if (res.status === 401) {
      notice("401 from the forge daemon: a valid account/agent bearer token is required. Paste one above (kept only in this tab's session storage).", true);
    }
    const err = new Error((data && (data.error || data.message)) || text || ("HTTP " + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
const repoBase = () => "/v1/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
const listOf = (data, keys) => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const k of keys) if (Array.isArray(data[k])) return data[k];
  return [];
};
const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== "") return o[k]; return ""; };
const when = (o) => pick(o, ["createdAt", "created_at", "updatedAt", "updated_at", "publishedAt", "date"]);

function ciBadge(parent, item) {
  const ci = item.ci || item.checks || item.check || null;
  let state = "";
  if (typeof ci === "string") state = ci;
  else if (ci && typeof ci === "object") state = pick(ci, ["conclusion", "status", "state", "result"]);
  else state = pick(item, ["ciStatus", "ci_status", "checkStatus"]);
  if (!state) return; // no CI data reported — show nothing rather than invent a status
  const s = String(state).toLowerCase();
  const cls = /pass|success|ok/.test(s) ? "pass" : /fail|error/.test(s) ? "fail" : "pending";
  parent.appendChild(el("span", "badge " + cls, "CI " + state));
}
function stateBadge(parent, state) {
  if (!state) return;
  const s = String(state).toLowerCase();
  parent.appendChild(el("span", "badge " + (s === "open" ? "open" : s === "merged" ? "merged" : "closed"), state));
}

/* ---------------- Pull Requests ---------------- */
let currentPr = null;

async function loadPulls() {
  const box = $("pr-list");
  box.replaceChildren(el("p", "muted", "Loading pull requests…"));
  try {
    const state = $("pr-state").value;
    const data = await api(repoBase() + "/pulls?state=" + encodeURIComponent(state));
    const pulls = listOf(data, ["pulls", "items", "results"]);
    box.replaceChildren();
    if (!pulls.length) { box.appendChild(el("p", "muted", "No pull requests in this state.")); return; }
    for (const pr of pulls) {
      const n = pick(pr, ["number", "id", "n"]);
      const b = el("button", "item");
      const t = el("div", "t", "#" + n + "  " + (pick(pr, ["title"]) || "(untitled)"));
      stateBadge(t, pick(pr, ["state", "status"]));
      ciBadge(t, pr);
      b.appendChild(t);
      const meta = el("div", "meta");
      const bits = [
        pick(pr, ["author", "user", "createdBy", "owner"]),
        pick(pr, ["head"]) && pick(pr, ["base"]) ? pick(pr, ["head"]) + " → " + pick(pr, ["base"]) : pick(pr, ["head"]),
        when(pr),
      ].filter(Boolean);
      meta.textContent = bits.join(" ");
      b.appendChild(meta);
      b.addEventListener("click", () => openPr(n, pr));
      box.appendChild(b);
    }
  } catch (e) {
    box.replaceChildren(el("p", "muted", "Could not load pull requests: " + e.message));
  }
}

async function openPr(n, stub) {
  const box = $("pr-detail");
  box.hidden = false;
  box.replaceChildren(el("p", "muted", "Loading PR #" + n + "…"));
  box.scrollIntoView({ block: "nearest" });
  let pr = stub || {};
  try {
    const data = await api(repoBase() + "/pulls/" + encodeURIComponent(n));
    pr = (data && (data.pull || data.pr)) || data || pr;
  } catch (e) {
    box.replaceChildren(el("p", "muted", "Could not load PR #" + n + ": " + e.message));
    return;
  }
  currentPr = pr;
  const num = pick(pr, ["number", "id"]) || n;
  box.replaceChildren();
  const h = el("h2", null, "#" + num + "  " + (pick(pr, ["title"]) || "(untitled)"));
  stateBadge(h, pick(pr, ["state", "status"]));
  ciBadge(h, pr);
  box.appendChild(h);
  const meta = el("p", "muted", [pick(pr, ["author", "user", "createdBy"]), pick(pr, ["head"]) + " → " + pick(pr, ["base"]), when(pr)].filter(Boolean).join(" · "));
  box.appendChild(meta);
  const bodyText = pick(pr, ["body", "description", "notes"]);
  if (bodyText) { const pre = el("pre", "body", bodyText); box.appendChild(pre); }

  // Diff summary via compare (base..head), when both refs are known.
  const base = pick(pr, ["base"]), head = pick(pr, ["head"]);
  if (base && head) {
    box.appendChild(el("h3", null, "Diff summary"));
    const diffBox = el("div", null, "Loading diff…");
    box.appendChild(diffBox);
    api(repoBase() + "/compare?base=" + encodeURIComponent(base) + "&head=" + encodeURIComponent(head))
      .then((cmp) => {
        const c = (cmp && (cmp.compare || cmp)) || {};
        diffBox.replaceChildren();
        const bits = [];
        if (c.ahead != null) bits.push(c.ahead + " ahead");
        if (c.behind != null) bits.push(c.behind + " behind");
        const files = listOf(c, ["files", "changedFiles"]);
        if (files.length) bits.push(files.length + " file(s) changed");
        if (bits.length) diffBox.appendChild(el("p", "muted", bits.join(" · ")));
        if (files.length) {
          const table = el("table", "files");
          for (const f of files) {
            const tr = el("tr");
            tr.appendChild(el("td", "mono", pick(f, ["path", "filename", "name"])));
            tr.appendChild(el("td", null, pick(f, ["status", "change"]) || ""));
            const add = pick(f, ["additions", "added"]), del = pick(f, ["deletions", "removed"]);
            tr.appendChild(el("td", null, (add !== "" ? "+" + add : "") + (del !== "" ? " −" + del : "")));
            table.appendChild(tr);
          }
          diffBox.appendChild(table);
        }
        const patch = pick(c, ["patch", "diff"]);
        if (patch) diffBox.appendChild(el("pre", "patch", String(patch).slice(0, 60000)));
        if (!bits.length && !files.length && !patch) diffBox.appendChild(el("p", "muted", "Compare returned no file changes."));
      })
      .catch((e) => { diffBox.replaceChildren(el("p", "muted", "Diff unavailable: " + e.message)); });
  }

  // Comments + reviews already on the PR record.
  const comments = listOf(pr, ["comments"]);
  const reviews = listOf(pr, ["reviews"]);
  box.appendChild(el("h3", null, "Discussion"));
  const disc = el("div");
  if (!comments.length && !reviews.length) disc.appendChild(el("p", "muted", "No comments or reviews yet."));
  for (const c of comments) {
    const d = el("div", "comment");
    d.appendChild(el("div", "who", [pick(c, ["author", "user", "createdBy"]), when(c)].filter(Boolean).join(" · ")));
    d.appendChild(el("pre", "body", pick(c, ["body", "text", "comment"])));
    disc.appendChild(d);
  }
  for (const r of reviews) {
    const d = el("div", "comment");
    const who = el("div", "who", [pick(r, ["author", "user", "reviewer"]), when(r)].filter(Boolean).join(" · "));
    stateBadge(who, pick(r, ["state", "status", "decision"]));
    d.appendChild(who);
    const rb = pick(r, ["body", "text"]);
    if (rb) d.appendChild(el("pre", "body", rb));
    disc.appendChild(d);
  }
  box.appendChild(disc);

  // Comment form
  const cForm = el("form");
  const cArea = el("textarea"); cArea.rows = 3; cArea.placeholder = "Add a comment"; cArea.required = true;
  const cBtn = el("button", "btn btn-small", "Comment"); cBtn.type = "submit";
  const cMsg = el("span", "msg");
  cForm.append(cArea, cBtn, cMsg);
  cForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try { await api(repoBase() + "/pulls/" + encodeURIComponent(num) + "/comments", { method: "POST", body: { body: cArea.value } }); cMsg.textContent = "Posted."; cMsg.className = "msg ok"; openPr(num); }
    catch (e) { cMsg.textContent = e.message; cMsg.className = "msg err"; }
  });
  box.appendChild(cForm);

  // Review form
  const rForm = el("form");
  const rSel = el("select");
  for (const v of ["approved", "changes_requested", "commented"]) { const o = el("option", null, v); o.value = v; rSel.appendChild(o); }
  const rArea = el("textarea"); rArea.rows = 2; rArea.placeholder = "Review notes (optional)";
  const rBtn = el("button", "btn btn-small", "Submit review"); rBtn.type = "submit";
  const rMsg = el("span", "msg");
  const rRow = el("div", "btn-row"); rRow.append(rSel, rBtn, rMsg);
  rForm.append(rArea, rRow);
  rForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try { await api(repoBase() + "/pulls/" + encodeURIComponent(num) + "/reviews", { method: "POST", body: { state: rSel.value, body: rArea.value } }); rMsg.textContent = "Review submitted."; rMsg.className = "msg ok"; openPr(num); }
    catch (e) { rMsg.textContent = e.message; rMsg.className = "msg err"; }
  });
  box.appendChild(el("h3", null, "Review"));
  box.appendChild(rForm);

  // Merge / close actions
  const actions = el("div", "btn-row");
  const mSel = el("select");
  for (const v of ["merge", "fast-forward"]) { const o = el("option", null, v); o.value = v; mSel.appendChild(o); }
  const mBtn = el("button", "btn", "Merge pull request"); mBtn.type = "button";
  const xBtn = el("button", "btn btn-danger", pick(pr, ["state"]) === "closed" ? "Reopen" : "Close"); xBtn.type = "button";
  const aMsg = el("span", "msg");
  mBtn.addEventListener("click", async () => {
    try { const r = await api(repoBase() + "/pulls/" + encodeURIComponent(num) + "/merge", { method: "POST", body: { method: mSel.value } }); aMsg.textContent = "Merged" + (r && r.commit ? " (" + r.commit + ")" : "") + "."; aMsg.className = "msg ok"; loadPulls(); openPr(num); }
    catch (e) { aMsg.textContent = (e.status === 409 ? "Conflict / blocked: " : "") + e.message; aMsg.className = "msg err"; }
  });
  xBtn.addEventListener("click", async () => {
    try { await api(repoBase() + "/pulls/" + encodeURIComponent(num), { method: "PATCH", body: { state: pick(pr, ["state"]) === "closed" ? "open" : "closed" } }); loadPulls(); openPr(num); }
    catch (e) { aMsg.textContent = e.message; aMsg.className = "msg err"; }
  });
  actions.append(mSel, mBtn, xBtn, aMsg);
  box.appendChild(actions);
}

/* ---------------- Releases ---------------- */
async function loadReleases() {
  const box = $("rel-list");
  box.replaceChildren(el("p", "muted", "Loading releases…"));
  try {
    const data = await api(repoBase() + "/releases");
    const rels = listOf(data, ["releases", "items", "results"]);
    box.replaceChildren();
    if (!rels.length) { box.appendChild(el("p", "muted", "No releases yet.")); return; }
    for (const r of rels) {
      const tag = pick(r, ["tag", "tagName", "tag_name", "version"]);
      const b = el("button", "item");
      b.appendChild(el("div", "t", tag + (pick(r, ["name", "title"]) ? " — " + pick(r, ["name", "title"]) : "")));
      b.appendChild(el("div", "meta", [pick(r, ["target"]), when(r)].filter(Boolean).join(" ")));
      b.addEventListener("click", () => openRelease(tag, r));
      box.appendChild(b);
    }
  } catch (e) { box.replaceChildren(el("p", "muted", "Could not load releases: " + e.message)); }
}
async function openRelease(tag, stub) {
  const box = $("rel-detail");
  box.hidden = false;
  let r = stub || {};
  try { const d = await api(repoBase() + "/releases/" + encodeURIComponent(tag)); r = (d && (d.release || d)) || r; }
  catch { /* list data is enough to show; detail route may not exist yet */ }
  box.replaceChildren();
  box.appendChild(el("h2", null, pick(r, ["tag", "tagName", "tag_name"]) || tag));
  const name = pick(r, ["name", "title"]); if (name) box.appendChild(el("p", "muted", name));
  const notes = pick(r, ["notes", "body", "description"]);
  if (notes) box.appendChild(el("pre", "body", notes));
  box.scrollIntoView({ block: "nearest" });
}

/* ---------------- Packages ---------------- */
async function loadPackages() {
  const box = $("pkg-list");
  box.replaceChildren(el("p", "muted", "Loading packages…"));
  try {
    const data = await api("/v1/packages?owner=" + encodeURIComponent(owner));
    const pkgs = listOf(data, ["packages", "items", "results"]);
    box.replaceChildren();
    if (!pkgs.length) { box.appendChild(el("p", "muted", "No packages for owner “" + owner + "”.")); return; }
    for (const p of pkgs) {
      const name = pick(p, ["name", "package"]);
      const b = el("button", "item");
      b.appendChild(el("div", "t", name));
      const vers = listOf(p, ["versions"]);
      b.appendChild(el("div", "meta", [pick(p, ["description"]), vers.length ? vers.length + " version(s)" : pick(p, ["latest", "version"]), when(p)].filter(Boolean).join(" ")));
      b.addEventListener("click", () => openPackage(name, p));
      box.appendChild(b);
    }
  } catch (e) { box.replaceChildren(el("p", "muted", "Could not load packages: " + e.message)); }
}
async function openPackage(name, stub) {
  const box = $("pkg-detail");
  box.hidden = false;
  box.replaceChildren(el("p", "muted", "Loading package…"));
  let p = stub || {};
  try { const d = await api("/v1/packages/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name)); p = (d && (d.package || d)) || p; } catch (e) { box.replaceChildren(el("p", "muted", "Could not load package: " + e.message)); return; }
  box.replaceChildren();
  box.appendChild(el("h2", null, name));
  const desc = pick(p, ["description"]); if (desc) box.appendChild(el("p", "muted", desc));
  let versions = listOf(p, ["versions"]);
  if (versions.length && typeof versions[0] === "string") versions = versions.map((v) => ({ version: v }));
  if (!versions.length) { box.appendChild(el("p", "muted", "No versions reported.")); return; }
  for (const v of versions) {
    const ver = pick(v, ["version", "name", "tag"]);
    const vb = el("button", "item");
    vb.appendChild(el("div", "t", ver));
    vb.appendChild(el("div", "meta", when(v)));
    vb.addEventListener("click", () => openVersion(name, ver, box));
    box.appendChild(vb);
  }
}
async function openVersion(name, ver, box) {
  const holder = el("div", "detail");
  holder.appendChild(el("p", "muted", "Loading " + name + "@" + ver + "…"));
  box.appendChild(holder);
  try {
    const d = await api("/v1/packages/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) + "/" + encodeURIComponent(ver));
    const vd = (d && (d.version || d)) || {};
    const files = listOf(vd, ["files", "entries"]);
    holder.replaceChildren();
    holder.appendChild(el("h3", null, name + "@" + ver + " — files"));
    if (!files.length) { holder.appendChild(el("p", "muted", "No files reported for this version.")); return; }
    const table = el("table", "files");
    for (const f of files) {
      const fname = typeof f === "string" ? f : pick(f, ["filename", "name", "path"]);
      const tr = el("tr");
      tr.appendChild(el("td", "mono", fname));
      tr.appendChild(el("td", null, typeof f === "object" && f.size != null ? f.size + " B" : ""));
      const dl = el("button", "btn btn-small btn-ghost", "Download");
      dl.type = "button";
      dl.addEventListener("click", async () => {
        try {
          const headers = {}; if (token()) headers.authorization = "Bearer " + token();
          const res = await fetch("/api/forge/v1/packages/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) + "/" + encodeURIComponent(ver) + "/" + encodeURIComponent(fname), { headers });
          if (!res.ok) throw new Error("HTTP " + res.status);
          const blob = await res.blob();
          const a = el("a"); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        } catch (e) { dl.textContent = "Failed: " + e.message; }
      });
      const td = el("td"); td.appendChild(dl); tr.appendChild(td);
      table.appendChild(tr);
    }
    holder.appendChild(table);
  } catch (e) { holder.replaceChildren(el("p", "muted", "Could not load version: " + e.message)); }
}

/* ---------------- Wiring ---------------- */
function setRepo(o, r) {
  owner = o || "kiln"; repo = r || "kiln";
  $("owner-input").value = owner; $("repo-input").value = repo;
  $("repo-title").textContent = owner + "/" + repo;
  document.title = "KILN — Forge · " + owner + "/" + repo;
  const q = new URLSearchParams({ owner, repo });
  history.replaceState(null, "", "/forge.html?" + q.toString());
  $("pr-detail").hidden = true; $("rel-detail").hidden = true; $("pkg-detail").hidden = true;
  notLiveShown = false; clearNotice();
  loadPulls(); loadReleases(); loadPackages();
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
  for (const name of ["pulls", "releases", "packages"]) $("tab-" + name).hidden = name !== t.dataset.tab;
}));
$("repo-form").addEventListener("submit", (ev) => { ev.preventDefault(); setRepo($("owner-input").value.trim(), $("repo-input").value.trim()); });
$("token-save").addEventListener("click", () => {
  const v = $("token-input").value.trim();
  if (v) sessionStorage.setItem(TOKEN_KEY, v.replace(/^Bearer\s+/i, ""));
  $("token-input").value = "";
  refreshAuthState(); loadPulls(); loadReleases(); loadPackages();
});
$("token-clear").addEventListener("click", () => { sessionStorage.removeItem(TOKEN_KEY); refreshAuthState(); });
$("pr-state").addEventListener("change", loadPulls);
$("pr-refresh").addEventListener("click", loadPulls);
$("rel-refresh").addEventListener("click", loadReleases);
$("pkg-refresh").addEventListener("click", loadPackages);
$("pr-create").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const msg = $("pr-create-msg"); msg.className = "msg"; msg.textContent = "Opening…";
  try {
    const r = await api(repoBase() + "/pulls", { method: "POST", body: { title: $("pr-title").value, body: $("pr-body").value, head: $("pr-head").value.trim(), base: $("pr-base").value.trim() } });
    msg.textContent = "Opened PR #" + pick(r || {}, ["number", "id"]) + "."; msg.className = "msg ok";
    ev.target.reset(); $("pr-base").value = "main"; loadPulls();
  } catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
});
$("rel-create").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const msg = $("rel-create-msg"); msg.className = "msg"; msg.textContent = "Creating…";
  const body = { tag: $("rel-tag").value.trim(), notes: $("rel-notes").value };
  if ($("rel-name").value.trim()) body.name = $("rel-name").value.trim();
  if ($("rel-target").value.trim()) body.target = $("rel-target").value.trim();
  try { await api(repoBase() + "/releases", { method: "POST", body }); msg.textContent = "Release created."; msg.className = "msg ok"; ev.target.reset(); loadReleases(); }
  catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
});

refreshAuthState();
setRepo(owner, repo);
