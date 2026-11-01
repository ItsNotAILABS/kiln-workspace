/**
 * Kiln × X plates. Unique lattice per seat/repo/token.
 * Share the JPEG file — a page URL does not unfurl on X from this preview.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";
import { settleRipple, loadRipple } from "./kiln-ripple.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BADGES_FILE = path.join(ROOT, "data", "badges.json");
const USERS = path.join(ROOT, "data", "users");
const ART = path.join(ROOT, "public", "badges");
const PY = path.join(ROOT, "python");
const SITE = "@ItsNotAILabs";
const X_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.822L2.002 2.25H8.08l4.253 5.622L16.856 2.25h1.388zM17.083 19.77h1.833L7.084 4.126H5.117z";

function shaHex(s, n = 64) {
  return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, n);
}

function rippleSha(s) {
  return "0x" + shaHex(s, 48);
}

function escapeXml(s) {
  const a = String.fromCharCode(38);
  return String(s ?? "")
    .replace(/&/g, a + "amp;")
    .replace(/</g, a + "lt;")
    .replace(/>/g, a + "gt;")
    .replace(/"/g, a + "quot;");
}

function clip(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd() + "…";
}

function abs(origin, p) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return String(origin || "").replace(/\/+$/, "") + (p.startsWith("/") ? p : "/" + p);
}

function publicHost(origin) {
  const host = String(origin || "")
    .replace(/^https?:\/\//i, "")
    .split("/")[0];
  if (!host || /^(127\.|0\.0\.0\.0|localhost|\[::1\])/i.test(host)) return "kiln";
  return host;
}

function crawlable(origin) {
  return /^https:\/\//i.test(String(origin || "")) && publicHost(origin) !== "kiln";
}

function seedBytes(meta) {
  const raw = `${meta.kind || ""}:${meta.owner || ""}/${meta.name || ""}:${meta.token || ""}:${meta.pqAddress || ""}:${meta.isolation || ""}:${meta.milestone || ""}:${meta.height || 0}`;
  return crypto.createHash("sha256").update(raw).digest();
}

function hueOf(meta) {
  return 164 + (seedBytes(meta)[0] / 255) * 36;
}

function loadDoc() {
  try {
    const d = JSON.parse(fs.readFileSync(BADGES_FILE, "utf8"));
    if (Array.isArray(d?.badges)) return d;
  } catch {
    /* empty ledger */
  }
  return { badges: [] };
}

function persistDoc(doc) {
  fs.mkdirSync(path.dirname(BADGES_FILE), { recursive: true });
  const seen = new Set();
  const badges = [];
  for (const b of doc.badges || []) {
    const k = String(b?.token || "");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    badges.push(b);
  }
  const tmp = BADGES_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ badges }, null, 2));
  fs.renameSync(tmp, BADGES_FILE);
}

function upsert(rec) {
  const doc = loadDoc();
  const i = doc.badges.findIndex((b) => b.token === rec.token);
  if (i >= 0) doc.badges[i] = rec;
  else doc.badges.unshift(rec);
  persistDoc(doc);
  return rec;
}

function writeJson(file, rec) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 2));
  fs.renameSync(tmp, file);
}

function raster(meta) {
  fs.mkdirSync(ART, { recursive: true });
  const r = spawnSync("python3", ["-m", "kiln.badge", JSON.stringify(meta)], {
    cwd: ROOT,
    env: { ...process.env, PYTHONPATH: PY },
    encoding: "utf8",
    timeout: 20000,
  });
  if (r.status !== 0) return { ok: false, error: (r.stderr || r.stdout || "raster failed").slice(0, 240) };
  try {
    return { ok: true, ...JSON.parse(r.stdout || "{}") };
  } catch {
    return { ok: true };
  }
}

function latticeGroup(meta, ox = 1180, oy = 180) {
  const seed = seedBytes(meta);
  const h = Math.round(hueOf(meta));
  const cells = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const bit = seed[(i * 11 + j * 7) % 32];
      if (bit < 70) continue;
      const x = i * 92;
      const y = j * 78 + (i % 2) * 22;
      const s = 30 + (bit % 6);
      const op = bit > 190 ? 0.65 : bit > 120 ? 0.5 : 0.35;
      cells.push(
        `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="4" fill="none" stroke="hsl(${h} 48% 62%)" stroke-opacity="${op}" transform="skewY(-18) rotate(18 ${x} ${y})"/>`,
      );
    }
  }
  return `<g opacity="0.85" transform="translate(${ox} ${oy})">${cells.join("")}</g>`;
}

function xMark(tx, ty, scale) {
  return `<g transform="translate(${tx} ${ty})" filter="url(#glow)"><g transform="scale(${scale}) translate(-12 -12)"><path fill="#fafafa" fill-rule="evenodd" d="${X_PATH}"/></g></g>`;
}

export function badgeSvg(b) {
  const owner = b.owner || "kiln";
  const name = b.name || "repo";
  const display = b.displayName || owner;
  const letter = (display[0] || "K").toUpperCase();
  const h = Math.round(hueOf(b));
  const height = b.height || b.block || 0;
  const token = b.token || "";
  const merkle = String(b.merkle || token).slice(0, 16);
  const mile = String(b.milestone || "").slice(0, 56);
  const desc = String(b.description || "").slice(0, 72);
  const files = Number(b.fileCount || 0);
  const filesBit = files ? `  ·  ${files} FILES` : "";
  const lab = b.lab ? `  ·  ${escapeXml(b.lab)}` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#09090b"/>
      <stop offset="1" stop-color="hsl(${h} 42% 8%)"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1920" height="1080" fill="url(#g)"/>
  ${latticeGroup(b, 1180, 180)}
  <rect x="48" y="48" width="1824" height="984" rx="36" fill="none" stroke="#2dd4bf" stroke-opacity="0.65" stroke-width="2"/>
  ${xMark(140, 140, 2.4)}
  <text x="210" y="155" font-family="Liberation Sans, Helvetica, sans-serif" font-size="32" font-weight="700" fill="#fafafa">KILN  ×  X</text>
  <circle cx="140" cy="360" r="56" fill="none" stroke="#5eead4" stroke-width="3"/>
  <text x="140" y="375" text-anchor="middle" font-family="Liberation Sans, Helvetica, sans-serif" font-size="48" fill="#fafafa">${escapeXml(letter)}</text>
  <text x="220" y="350" font-family="Liberation Sans, Helvetica, sans-serif" font-size="40" font-weight="700" fill="#fafafa">${escapeXml(display)}</text>
  <text x="220" y="395" font-family="Liberation Sans, Helvetica, sans-serif" font-size="24" fill="#5eead4">@${escapeXml(owner)}${lab}</text>
  <text x="88" y="540" font-family="Liberation Sans, Helvetica, sans-serif" font-size="28" fill="#a1a1aa">${escapeXml(owner)} /</text>
  <text x="88" y="630" font-family="Liberation Sans, Helvetica, sans-serif" font-size="72" font-weight="700" fill="#fafafa">${escapeXml(String(name).slice(0, 28))}</text>
  ${mile ? `<text x="88" y="710" font-family="Liberation Sans, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#5eead4">${escapeXml(mile)}</text>` : ""}
  ${desc ? `<text x="88" y="760" font-family="Liberation Sans, Helvetica, sans-serif" font-size="22" fill="#a1a1aa">${escapeXml(desc)}</text>` : ""}
  <line x1="88" y1="800" x2="820" y2="800" stroke="#2dd4bf" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="88" y="860" font-family="Liberation Sans, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#d4d4d8">MINTED  ·  KILN L1  ·  ${height}${filesBit}</text>
  <text x="88" y="910" font-family="Liberation Sans, Helvetica, sans-serif" font-size="18" fill="#71717a">${escapeXml(merkle)}</text>
  <text x="88" y="980" font-family="Liberation Sans, Helvetica, sans-serif" font-size="16" fill="#52525b">#${escapeXml(token)}</text>
</svg>`;
}

function mrzFill(s, n = 44) {
  const cleaned = [];
  for (const ch of String(s || "").toUpperCase()) cleaned.push(/[A-Z0-9]/.test(ch) ? ch : "<");
  return (cleaned.join("").replace(/ /g, "<") + "<".repeat(n)).slice(0, n);
}

export function passportSvg(p) {
  const owner = p.owner || "kiln";
  const display = p.displayName || owner;
  const letter = (display[0] || "K").toUpperCase();
  const isolation = p.isolation || `kiln://${owner}`;
  const pq = p.pqAddress || p.address || "";
  const scheme = p.scheme || "ml-dsa-65+ml-kem-768";
  const cipher = p.cipher || "AES-256-GCM+ML-KEM-768";
  const height = p.height || p.block || 0;
  const token = p.token || "";
  const merkle = String(p.claimsMerkle || p.merkle || token).slice(0, 48);
  const issued = String(p.issuedAt || p.mintedAt || "").slice(0, 10).replace(/-/g, "");
  const lab = p.lab ? `  ·  ${escapeXml(p.lab)}` : "";
  const h = Math.round(hueOf(p));
  const line1 = mrzFill(`P<KILN<<${owner}`);
  const line2 = mrzFill(`${token}<${height}<${issued}<${(pq || merkle).slice(-20)}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#09090b"/>
      <stop offset="1" stop-color="hsl(${h} 42% 8%)"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1920" height="1080" fill="url(#g)"/>
  ${latticeGroup(p, 1180, 160)}
  <rect x="48" y="48" width="1824" height="984" rx="36" fill="none" stroke="#2dd4bf" stroke-opacity="0.65" stroke-width="2"/>
  <rect x="64" y="64" width="1792" height="952" rx="28" fill="none" stroke="#f4f4f5" stroke-opacity="0.12" stroke-width="1"/>
  ${xMark(132, 94, 2.1)}
  <text x="196" y="128" font-family="Liberation Sans, Helvetica, sans-serif" font-size="32" font-weight="700" fill="#fafafa">KILN PASSPORT</text>
  <text x="1760" y="118" text-anchor="end" font-family="Liberation Sans, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#5eead4">TYPE P</text>
  <text x="1760" y="150" text-anchor="end" font-family="Liberation Sans, Helvetica, sans-serif" font-size="16" fill="#a1a1aa">CODE KILN</text>
  <circle cx="120" cy="288" r="44" fill="none" stroke="#5eead4" stroke-width="3"/>
  <text x="120" y="300" text-anchor="middle" font-family="Liberation Sans, Helvetica, sans-serif" font-size="32" fill="#fafafa">${escapeXml(letter)}</text>
  <rect x="84" y="356" width="72" height="52" rx="8" fill="none" stroke="#5eead4" stroke-opacity="0.85" stroke-width="2"/>
  <text x="300" y="248" font-family="Liberation Sans, Helvetica, sans-serif" font-size="14" fill="#71717a">NAME</text>
  <text x="300" y="296" font-family="Liberation Sans, Helvetica, sans-serif" font-size="40" font-weight="700" fill="#fafafa">${escapeXml(String(display).slice(0, 36))}</text>
  <text x="300" y="340" font-family="Liberation Sans, Helvetica, sans-serif" font-size="14" fill="#71717a">HANDLE</text>
  <text x="300" y="376" font-family="Liberation Sans, Helvetica, sans-serif" font-size="26" fill="#5eead4">@${escapeXml(owner)}${lab}</text>
  <text x="88" y="548" font-family="Liberation Sans, Helvetica, sans-serif" font-size="14" fill="#71717a">ISOLATION</text>
  <text x="88" y="588" font-family="ui-monospace, Liberation Mono, monospace" font-size="28" fill="#f4f4f5">${escapeXml(String(isolation).slice(0, 48))}</text>
  <text x="88" y="648" font-family="Liberation Sans, Helvetica, sans-serif" font-size="14" fill="#71717a">POST-QUANTUM SEAT</text>
  <text x="88" y="686" font-family="ui-monospace, Liberation Mono, monospace" font-size="22" fill="#5eead4">${escapeXml(String(pq || "pending").slice(0, 52))}</text>
  <text x="88" y="722" font-family="ui-monospace, Liberation Mono, monospace" font-size="16" fill="#a1a1aa">${escapeXml(String(scheme).slice(0, 48))}</text>
  <text x="88" y="776" font-family="Liberation Sans, Helvetica, sans-serif" font-size="14" fill="#71717a">VAULT</text>
  <text x="88" y="810" font-family="ui-monospace, Liberation Mono, monospace" font-size="18" fill="#d4d4d8">${escapeXml(String(cipher).slice(0, 48))}</text>
  <text x="88" y="862" font-family="Liberation Sans, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#d4d4d8">ISSUED  ·  KILN L1  ·  ${height}  ·  #${escapeXml(token)}</text>
  <text x="88" y="900" font-family="ui-monospace, Liberation Mono, monospace" font-size="16" fill="#71717a">${escapeXml(merkle)}</text>
  <rect x="48" y="948" width="1824" height="84" fill="#09090b" fill-opacity="0.72"/>
  <text x="72" y="984" font-family="ui-monospace, Liberation Mono, monospace" font-size="22" fill="#e2e8f0">${escapeXml(line1)}</text>
  <text x="72" y="1016" font-family="ui-monospace, Liberation Mono, monospace" font-size="22" fill="#e2e8f0">${escapeXml(line2)}</text>
</svg>`;
}

function writeArt(rec, svg) {
  fs.mkdirSync(ART, { recursive: true });
  const svgPath = path.join(ART, `${rec.token}.svg`);
  fs.writeFileSync(svgPath, svg);
  rec.svg = `/badges/${rec.token}.svg`;
  raster(rec);
  rec.png = rec.png || `/badges/${rec.token}.png`;
  rec.jpg = rec.jpg || `/badges/${rec.token}.jpg`;
  rec.card = rec.card || `/badges/${rec.token}-card.jpg`;
  rec.mp4 = rec.mp4 || "/badges/plate-loop.mp4";
  return rec;
}

export function getBadge(token) {
  const t = String(token || "").replace(/[^a-f0-9]/gi, "").slice(0, 12);
  if (!t) return null;
  const found = loadDoc().badges.find((b) => b.token === t);
  if (found) return found;
  try {
    const users = fs.readdirSync(USERS);
    for (const h of users) {
      const p = getPassport(h);
      if (p?.token === t) return p;
    }
  } catch {
    /* no users dir */
  }
  return null;
}

export function listBadges(repoId, { viewer } = {}) {
  const id = String(repoId || "");
  const [owner, ...rest] = id.split("/");
  const name = rest.join("/");
  return loadDoc().badges.filter((b) => {
    if (id && (b.owner !== owner || b.name !== name)) return false;
    if (b.visibility === "private" && viewer !== b.owner && viewer !== b.minter) return false;
    return true;
  });
}

export function getPassport(handle) {
  const h = String(handle || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  if (!h) return null;
  const file = path.join(USERS, h, "PASSPORT.json");
  try {
    const rec = JSON.parse(fs.readFileSync(file, "utf8"));
    if (rec?.token) return rec;
  } catch {
    /* fall through */
  }
  return loadDoc().badges.find((b) => b.kind === "passport" && b.owner === h) || null;
}

export async function mintBadge(input = {}) {
  const repoId = String(input.repoId || "");
  const parts = repoId.split("/");
  const owner = String(input.owner || parts[0] || "").toLowerCase();
  const name = String(input.name || parts.slice(1).join("/") || "home");
  if (!owner || owner === "kiln") return { ok: false, error: "kiln origin badges are sealed. Share the public mint." };
  if (!name) return { ok: false, error: "repo required" };
  const now = new Date().toISOString();
  const token = shaHex(`${owner}/${name}:${now}:${Math.random()}`, 12);
  const settled = settleRipple({
    type: "badge_mint",
    from: input.address || "",
    repoId: `${owner}/${name}`,
    merkleRoot: input.merkleRoot || "",
    memo: `mint ${owner}/${name} ${input.milestone || ""}`.slice(0, 240),
  });
  const height = settled.height || loadRipple().height;
  const rec = {
    owner,
    name,
    height,
    token,
    merkle: input.merkleRoot || settled.hash || rippleSha(`${owner}/${name}:${token}:${height}`),
    address: input.address || "",
    mintedAt: now,
    displayName: input.displayName || owner,
    lab: input.lab || "",
    visibility: input.visibility === "private" ? "private" : "public",
    minter: input.minter || owner,
    milestone: String(input.milestone || "").slice(0, 80),
    description: String(input.description || "").slice(0, 240),
    fileCount: Number(input.fileCount || 0) || 0,
    seed: shaHex(`${token}:${height}`, 16),
    tx: settled.tx || rippleSha(`badge:${token}`),
    block: height,
    png: `/badges/${token}.png`,
    jpg: `/badges/${token}.jpg`,
    card: `/badges/${token}-card.jpg`,
    svg: `/badges/${token}.svg`,
    mp4: "/badges/plate-loop.mp4",
    page: `/b/${token}`,
  };
  writeArt(rec, badgeSvg(rec));
  upsert(rec);
  return { ok: true, ...rec };
}

export async function mintPassport(input = {}) {
  const handle = String(input.handle || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  if (!handle) return { ok: false, error: "handle required" };
  if (handle === "kiln") return { ok: false, error: "kiln origin cannot hold a passport" };
  const existing = getPassport(handle);
  if (existing?.token) return { ok: true, created: false, ...existing };
  const now = new Date().toISOString();
  const token = shaHex(`kiln-passport:${handle}`, 12);
  const isolation = input.isolation || `kiln://${handle}`;
  const pqAddress = input.pqAddress || "";
  const settled = settleRipple({
    type: "passport_mint",
    from: input.address || pqAddress || "",
    repoId: `${handle}/home`,
    memo: `passport @${handle}`,
  });
  const height = settled.height || loadRipple().height;
  const claims = rippleSha(`passport:${handle}:${pqAddress}:${isolation}:${token}`);
  const rec = {
    kind: "passport",
    spec: "kiln-passport/v1",
    owner: handle,
    name: "passport",
    height,
    token,
    merkle: claims,
    claimsMerkle: claims,
    address: input.address || "",
    pqAddress,
    scheme: input.scheme || "ml-dsa-65+ml-kem-768",
    cipher: "AES-256-GCM+ML-KEM-768",
    isolation,
    mintedAt: now,
    issuedAt: now,
    displayName: input.displayName || handle,
    lab: input.lab || "",
    visibility: "public",
    minter: handle,
    milestone: "seated",
    description: `Kiln Passport for @${handle}. Isolation ${isolation}.`,
    fileCount: 0,
    seed: shaHex(`passport:${handle}:${token}`, 16),
    tx: settled.tx || rippleSha(`passport:${token}`),
    block: height,
    png: `/badges/${token}.png`,
    jpg: `/badges/${token}.jpg`,
    card: `/badges/${token}-card.jpg`,
    svg: `/badges/${token}.svg`,
    mp4: "/badges/plate-loop.mp4",
    page: `/p/${handle}`,
  };
  writeArt(rec, passportSvg(rec));
  writeJson(path.join(USERS, handle, "PASSPORT.json"), rec);
  upsert(rec);
  return { ok: true, created: true, ...rec };
}

export async function ensurePassport(input = {}) {
  const handle = String(input.handle || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const have = getPassport(handle);
  if (have?.token) return { ok: true, created: false, ...have };
  return mintPassport(input);
}

const SHARE_JS = `
(function () {
  function canShareFiles() {
    try {
      const f = new File(["x"], "x.jpg", { type: "image/jpeg" });
      return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [f] }));
    } catch (e) {
      return false;
    }
  }
  window.kilnSharePlate = function (btn, ev) {
    if (!canShareFiles()) return true;
    if (ev) ev.preventDefault();
    const href = btn.getAttribute("data-file") || btn.getAttribute("href") || "";
    const caption = btn.getAttribute("data-caption") || "";
    const name = btn.getAttribute("data-name") || "kiln-badge.jpg";
    const clean = href.replace(/[?&]dl=1/g, "").replace(/[?&]name=[^&]*/g, "").replace(/[?&]$/, "");
    fetch(clean, { cache: "force-cache" })
      .then(function (r) { if (!r.ok) throw new Error("plate missing"); return r.blob(); })
      .then(function (blob) {
        const file = new File([blob], name, { type: blob.type || "image/jpeg" });
        return navigator.share({ files: [file], text: caption, title: caption });
      })
      .catch(function () {
        try { location.assign(btn.getAttribute("href") || href); } catch (e) {}
      });
    return false;
  };
})();
`;

const CARD_CSS = `
    .xcard { width:min(504px,100%); display:flex; flex-direction:column; gap:10px; }
    .xcard-kicker { font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:#71717a; text-align:center; margin:8px 0 0; }
    .xcard-frame { background:#000; border:1px solid #2f3336; border-radius:16px; overflow:hidden; }
    .xcard-frame img { width:100%; aspect-ratio:1.91/1; object-fit:cover; display:block; background:#16181c; }
    .xcard-copy { padding:12px 14px 14px; }
    .xcard-host { color:#71767b; font-size:13px; margin:0; }
    .xcard-title { color:#e7e9ea; font-size:15px; font-weight:700; margin:2px 0 0; }
    .xcard-desc { color:#71767b; font-size:15px; margin:2px 0 0; line-height:1.3; }
    .xcard-spec { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
    .xcard-spec li { font-size:12px; color:#a1a1aa; padding-left:1.1em; position:relative; }
    .xcard-spec li::before { position:absolute; left:0; }
    .xcard-spec li.ok { color:#5eead4; }
    .xcard-spec li.ok::before { content:"✓"; }
    .xcard-spec li.no { color:#f59e0b; }
    .xcard-spec li.no::before { content:"!"; }
`;

function cardSpec(title, desc, image, origin) {
  const items = [];
  items.push({ ok: true, text: "twitter:card summary_large_image" });
  items.push({ ok: title.length <= 70, text: `title ${title.length} / 70` });
  items.push({ ok: desc.length <= 200, text: `description ${desc.length} / 200` });
  items.push({ ok: /\.(jpe?g|png|webp|gif)(\?|$)/i.test(image), text: "image is JPEG (X does not take SVG)" });
  items.push({ ok: true, text: "image size 1200×630 · under 5 MB" });
  items.push({ ok: true, text: `twitter:site ${SITE}` });
  const pub = crawlable(origin);
  items.push({
    ok: pub,
    text: pub
      ? "public HTTPS — X can fetch this plate"
      : "X cannot crawl this preview — attach the JPEG when you post",
  });
  return items;
}

function xCardPreview(title, desc, image, origin) {
  const host = publicHost(origin);
  const spec = cardSpec(title, desc, image, origin);
  return `
  <section class="xcard" aria-label="X card preview">
    <p class="xcard-kicker">How this plate unfurls on X</p>
    <div class="xcard-frame">
      <img src="${escapeXml(image)}" alt=""/>
      <div class="xcard-copy">
        <p class="xcard-host">${escapeXml(host)}</p>
        <p class="xcard-title">${escapeXml(title)}</p>
        <p class="xcard-desc">${escapeXml(desc)}</p>
      </div>
    </div>
    <ul class="xcard-spec">${spec
      .map((s) => `<li class="${s.ok ? "ok" : "no"}">${escapeXml(s.text)}</li>`)
      .join("")}</ul>
  </section>`;
}

function dlUrl(p, name) {
  const raw = String(p || "");
  let rel = raw;
  try {
    if (/^https?:\/\//i.test(raw)) rel = new URL(raw).pathname;
  } catch {
    rel = raw;
  }
  if (!rel.startsWith("/")) rel = "/" + rel;
  const q = "dl=1&name=" + encodeURIComponent(name || "kiln-badge.jpg");
  return rel + (rel.includes("?") ? "&" : "?") + q;
}

function shareRow({ file, card, png, name, caption, intent }) {
  const hdName = name;
  const cardName = name.replace(/\.jpg$/i, "-card.jpg");
  const pngName = name.replace(/\.jpg$/i, ".png");
  const hd = dlUrl(file, hdName);
  const cardDl = dlUrl(card, cardName);
  const pngDl = dlUrl(png, pngName);
  return `
    <div class="row">
      <a class="btn primary" href="${escapeXml(hd)}" download="${escapeXml(hdName)}" data-file="${escapeXml(file)}" data-name="${escapeXml(hdName)}" data-caption="${escapeXml(caption)}" onclick="return kilnSharePlate(this, event)">Share the JPEG</a>
      <a class="btn ghost" href="${escapeXml(hd)}" download="${escapeXml(hdName)}">Download HD</a>
      <a class="btn ghost" href="${escapeXml(cardDl)}" download="${escapeXml(cardName)}">X card 1200×630</a>
      <a class="btn ghost" href="${escapeXml(pngDl)}" download="${escapeXml(pngName)}">Square PNG</a>
      <a class="btn ghost" href="${escapeXml(intent)}" target="_blank" rel="noopener noreferrer">Post on X</a>
    </div>
    <p class="hint">Download saves the JPEG to your files. Attach that file when you post — a link will not show the plate.</p>
    <script>${SHARE_JS}</script>`;
}

function plateMeta({ title, desc, image, url, alt }) {
  return `
  <title>${escapeXml(title)}</title>
  <meta name="description" content="${escapeXml(desc)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${escapeXml(title)}"/>
  <meta property="og:description" content="${escapeXml(desc)}"/>
  <meta property="og:image" content="${escapeXml(image)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:image:type" content="image/jpeg"/>
  <meta property="og:url" content="${escapeXml(url)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:site" content="${SITE}"/>
  <meta name="twitter:creator" content="${SITE}"/>
  <meta name="twitter:title" content="${escapeXml(title)}"/>
  <meta name="twitter:description" content="${escapeXml(desc)}"/>
  <meta name="twitter:image" content="${escapeXml(image)}"/>
  <meta name="twitter:image:alt" content="${escapeXml(alt || title)}"/>`;
}

export function badgePageHtml(b, origin) {
  const owner = b.owner || "kiln";
  const name = b.name || "repo";
  const mile = b.milestone || "";
  const height = b.height || b.block || 0;
  const token = b.token || "";
  const title = clip(`${owner}/${name}${mile ? " · " + mile : ""} — minted on Kiln L1`, 70);
  const desc = clip(`${owner}${mile ? " · " + mile : ""}. Height ${height}. #${token}`, 200);
  const image = abs(origin, b.card || `/badges/${token}-card.jpg`);
  const hd = abs(origin, b.jpg || `/badges/${token}.jpg`);
  const page = abs(origin, b.page || `/b/${token}`);
  const file = b.jpg || `/badges/${token}.jpg`;
  const card = b.card || `/badges/${token}-card.jpg`;
  const png = b.png || `/badges/${token}.png`;
  const fname = `kiln-${owner}-${name}-${token}.jpg`;
  const caption = `Minted ${owner}/${name}${mile ? " · " + mile : ""} on Kiln L1 · height ${height} · #${token}`;
  const intent = "https://x.com/intent/tweet?text=" + encodeURIComponent(caption);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  ${plateMeta({ title, desc, image, url: page, alt: title })}
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"/>
  <style>
    :root { --bg:#09090b; --fg:#f4f4f5; --muted:#a1a1aa; --line:rgba(255,255,255,.12); --accent:#5eead4; }
    * { box-sizing:border-box; }
    html,body { margin:0; background:var(--bg); color:var(--fg); font-family:"IBM Plex Sans",system-ui,sans-serif; }
    main { min-height:100dvh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px 16px 48px; gap:20px; }
    .stage3d { perspective: 1400px; width:min(920px,100%); }
    .card3d { transform-style:preserve-3d; animation:turn 9s ease-in-out infinite; border-radius:20px; }
    .card3d img { width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:20px; display:block; outline:1px solid var(--line); outline-offset:-1px; }
    @keyframes turn {
      0%,100% { transform: rotateY(-16deg) rotateX(7deg); }
      50% { transform: rotateY(16deg) rotateX(5deg); }
    }
    @media (prefers-reduced-motion:reduce) { .card3d { animation:none; transform:none; } }
    h1 { font-size:18px; font-weight:600; margin:0; letter-spacing:.02em; }
    p { margin:0; color:var(--muted); font-size:13px; }
    .row { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
    a.btn { height:44px; padding:0 18px; display:inline-flex; align-items:center; border-radius:999px; text-decoration:none; font-size:12px; font-weight:500; letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
    a.primary { background:#f4f4f5; color:#09090b; }
    a.ghost { color:var(--fg); box-shadow:0 0 0 1px var(--line); }
    a.stage3d { color:inherit; text-decoration:none; display:block; cursor:pointer; }
    .hint { max-width:36rem; text-align:center; line-height:1.45; }
    ${CARD_CSS}
  </style>
</head>
<body>
  <main>
    <a class="stage3d" href="${escapeXml(dlUrl(file, fname))}" download="${escapeXml(fname)}" title="Save HD JPEG">
      <div class="card3d">
        <img src="${escapeXml(hd)}" alt="${escapeXml(title)}"/>
      </div>
    </a>
    <h1>${escapeXml(b.displayName || owner)}</h1>
    <p>@${escapeXml(owner)} · ${escapeXml(name)}${mile ? " · " + escapeXml(mile) : ""} · Kiln L1 ${height} · #${escapeXml(token)}</p>
    ${xCardPreview(title, desc, image, origin)}
    ${shareRow({ file, card, png, name: fname, caption, intent })}
    <div class="row">
      <a class="btn ghost" href="${escapeXml(abs(origin, "/u/" + owner))}">@${escapeXml(owner)}</a>
      <a class="btn ghost" href="/">Open Kiln</a>
    </div>
  </main>
</body>
</html>`;
}

export function passportPageHtml(p, origin) {
  const owner = p.owner || "kiln";
  const token = p.token || "";
  const height = p.height || p.block || 0;
  const isolation = p.isolation || `kiln://${owner}`;
  const pq = p.pqAddress || "";
  const title = clip(`Kiln Passport · @${owner}`, 70);
  const desc = clip(
    `${p.displayName || owner} seated on Kiln. Isolation ${isolation}. L1 ${height}.${pq ? " PQ " + pq : ""}`,
    200,
  );
  const image = abs(origin, p.card || `/badges/${token}-card.jpg`);
  const hd = abs(origin, p.jpg || `/badges/${token}.jpg`);
  const page = abs(origin, p.page || `/p/${owner}`);
  const file = p.jpg || `/badges/${token}.jpg`;
  const card = p.card || `/badges/${token}-card.jpg`;
  const png = p.png || `/badges/${token}.png`;
  const fname = `kiln-${owner}-passport-${token}.jpg`;
  const caption = `Seated @${owner} on Kiln. Passport #${token} · L1 ${height}`;
  const intent = "https://x.com/intent/tweet?text=" + encodeURIComponent(caption);
  const claims = [
    ["Type", "P · Kiln seat"],
    ["Code", "KILN"],
    ["Handle", `@${owner}`],
    ["Name", p.displayName || owner],
    ["Isolation", isolation],
    ["PQ", pq || "—"],
    ["Scheme", p.scheme || "ml-dsa-65+ml-kem-768"],
    ["Vault", p.cipher || "AES-256-GCM+ML-KEM-768"],
    ["L1", String(height)],
    ["Claims", p.claimsMerkle || p.merkle || ""],
    ["Token", `#${token}`],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  ${plateMeta({ title, desc, image, url: page, alt: title })}
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"/>
  <style>
    :root { --bg:#09090b; --fg:#f4f4f5; --muted:#a1a1aa; --line:rgba(255,255,255,.12); --accent:#5eead4; }
    * { box-sizing:border-box; }
    html,body { margin:0; background:var(--bg); color:var(--fg); font-family:"IBM Plex Sans",system-ui,sans-serif; }
    main { min-height:100dvh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px 16px 48px; gap:20px; }
    .stage3d { perspective: 1400px; width:min(920px,100%); }
    .card3d { transform-style:preserve-3d; animation:turn 11s ease-in-out infinite; border-radius:20px; }
    .card3d img { width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:20px; display:block; outline:1px solid var(--line); outline-offset:-1px; }
    @keyframes turn {
      0%,100% { transform: rotateY(-18deg) rotateX(8deg); }
      50% { transform: rotateY(18deg) rotateX(5deg); }
    }
    @media (prefers-reduced-motion:reduce) { .card3d { animation:none; transform:none; } }
    h1 { font-size:20px; font-weight:600; margin:0; letter-spacing:.02em; }
    p { margin:0; color:var(--muted); font-size:13px; }
    .claims { width:min(920px,100%); display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:0; box-shadow:0 0 0 1px var(--line); border-radius:16px; overflow:hidden; }
    .claims .rowc { display:flex; flex-direction:column; gap:4px; padding:12px 14px; box-shadow:0 1px 0 var(--line); }
    .claims span { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
    .claims b { font:500 13px/1.4 "IBM Plex Mono",ui-monospace,monospace; font-weight:500; word-break:break-all; }
    .row { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
    a.btn { height:44px; padding:0 18px; display:inline-flex; align-items:center; border-radius:999px; text-decoration:none; font-size:12px; font-weight:500; letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
    a.primary { background:#f4f4f5; color:#09090b; }
    a.ghost { color:var(--fg); box-shadow:0 0 0 1px var(--line); }
    a.stage3d { color:inherit; text-decoration:none; display:block; cursor:pointer; }
    .hint { max-width:36rem; text-align:center; line-height:1.45; }
    ${CARD_CSS}
  </style>
</head>
<body>
  <main>
    <p style="letter-spacing:.16em;text-transform:uppercase;font-size:11px;color:var(--muted);margin:0">Type P · Code Kiln</p>
    <a class="stage3d" href="${escapeXml(dlUrl(file, fname))}" download="${escapeXml(fname)}" title="Save HD JPEG">
      <div class="card3d">
        <img src="${escapeXml(hd)}" alt="${escapeXml(title)}"/>
      </div>
    </a>
    <h1>${escapeXml(p.displayName || owner)}</h1>
    <p>@${escapeXml(owner)} · ${escapeXml(isolation)} · Kiln L1 ${height} · #${escapeXml(token)}</p>
    <div class="claims">${claims
      .map(([k, v]) => `<div class="rowc"><span>${escapeXml(k)}</span><b>${escapeXml(v)}</b></div>`)
      .join("")}</div>
    ${xCardPreview(title, desc, image, origin)}
    ${shareRow({ file, card, png, name: fname, caption, intent })}
    <div class="row">
      <a class="btn ghost" href="${escapeXml(abs(origin, "/u/" + owner))}">@${escapeXml(owner)}</a>
      <a class="btn ghost" href="${escapeXml(abs(origin, "/base/" + owner + "/home"))}">Open Kiln Base</a>
      <a class="btn ghost" href="${escapeXml(abs(origin, "/ingest/" + owner))}">Ingest this seat</a>
      <a class="btn ghost" href="/">Open Kiln</a>
    </div>
  </main>
</body>
</html>`;
}
