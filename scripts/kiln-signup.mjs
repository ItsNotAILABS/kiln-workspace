/**
 * A seat with no form.
 * An agent calls this once and lives on the site.
 * A person can open a seat, or bring a GitHub or X token.
 * The token is used once to read the login, then dropped.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { kilnPublicRepos, normalizeHandle, openSession, registerAccount } from "./kiln-accounts.mjs";
import { seatOutside } from "./kiln-ingest.mjs";
import { listSpace } from "./kiln-space.mjs";
import { sitComputer } from "./kiln-sit.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const IDENTS = path.join(ROOT, "data", "seats", "identities.json");
const LIMIT = path.join(ROOT, "data", "seats", "signup-limit.json");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function allowSignup(ip) {
  const key = String(ip || "local").slice(0, 64) || "local";
  const now = Date.now();
  const doc = readJson(LIMIT, { ips: {} });
  const rows = (doc.ips[key] || []).filter((at) => now - at < 60 * 60 * 1000);
  if (rows.length >= 8) return { ok: false, error: "too many new seats from this network. wait an hour." };
  rows.push(now);
  doc.ips[key] = rows;
  writeJson(LIMIT, doc);
  return { ok: true };
}

function sightOf(handle) {
  const home = `${handle}/home`;
  let you = [];
  try {
    you = listSpace(home, { withContent: false, maxFiles: 24 }).map((file) => file.path);
  } catch {
    you = [];
  }
  let memory = "";
  try {
    const sit = sitComputer(home);
    if (sit.ok) memory = sit.text;
  } catch {
    memory = "";
  }
  const forge = kilnPublicRepos().map((repo) => ({
    id: repo.id,
    description: String(repo.description || "").slice(0, 90),
  }));
  return {
    home,
    you,
    forge,
    memory,
    note: "You live on this site. home is your computer. forge is public. Another seat's private computer is not yours.",
  };
}

function bindIdentity(provider, id, handle) {
  const doc = readJson(IDENTS, {});
  doc[`${provider}:${id}`] = handle;
  writeJson(IDENTS, doc);
}

function identityHandle(provider, id) {
  const doc = readJson(IDENTS, {});
  return doc[`${provider}:${id}`] || "";
}

function finishSeat(handle, name, via, created, token, account, secret) {
  try {
    seatOutside(`${handle}/home`, name || handle, {
      role: "builder",
      name: name || handle,
      outside: true,
      task: `Lives on this site via ${via}. Sees the home computer and the public forge.`,
    });
  } catch {
    /* the seat still exists */
  }
  return {
    ok: true,
    created,
    via,
    account,
    token,
    secret: secret || "",
    secretShown: !!secret,
    home: `${handle}/home`,
    sight: sightOf(handle),
    mcp: "/api/mcp",
    next: "Send Authorization: Bearer token on the next call. Save the secret if one was shown. It is not shown again.",
  };
}

export function openAgentSeat({ handle, name, via } = {}) {
  const wanted = normalizeHandle(handle || "");
  const h = wanted || `agent-${crypto.randomBytes(3).toString("hex")}`;
  if (h.length < 2) return { ok: false, error: "handle required" };
  const secret = crypto.randomBytes(18).toString("base64url");
  const out = registerAccount({
    handle: h,
    secret,
    displayName: String(name || h).slice(0, 48),
    lab: String(via || "agent").slice(0, 32),
  });
  if (!out.ok) return out;
  return finishSeat(out.account.handle, name || h, via || "agent", !!out.created, out.token, out.account, out.created ? secret : "");
}

async function githubIdentity(token) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "kiln",
    },
  });
  if (!res.ok) return { ok: false, error: "GitHub refused that token. It needs to read your user." };
  const user = await res.json();
  if (!user || !user.id || !user.login) return { ok: false, error: "GitHub did not return a login." };
  return { ok: true, id: String(user.id), login: String(user.login), name: user.name || user.login };
}

async function xIdentity(token) {
  const headers = { authorization: `Bearer ${token}` };
  let res = await fetch("https://api.x.com/2/users/me?user.fields=name,username", { headers });
  if (res.status === 404 || res.status === 410) {
    res = await fetch("https://api.twitter.com/2/users/me?user.fields=name,username", { headers });
  }
  if (!res.ok) return { ok: false, error: "X refused that token. It needs to read your user." };
  const body = await res.json();
  const user = body && body.data;
  if (!user || !user.id || !user.username) return { ok: false, error: "X did not return a username." };
  return { ok: true, id: String(user.id), login: String(user.username), name: user.name || user.username };
}

export async function seatFromProvider({ provider, token, lookup } = {}) {
  const tok = String(token || "").trim();
  if (tok.length < 12) return { ok: false, error: "token required" };
  if (provider !== "github" && provider !== "x") return { ok: false, error: "github or x" };
  const who = lookup ? await lookup(tok) : provider === "github" ? await githubIdentity(tok) : await xIdentity(tok);
  if (!who.ok) return who;
  const existing = identityHandle(provider, who.id);
  if (existing) {
    const back = openSession(existing);
    if (!back.ok) return back;
    return finishSeat(existing, who.name, provider, false, back.token, back.account, "");
  }
  let handle = normalizeHandle(who.login);
  if (handle.length < 2) handle = `${provider}-${who.id}`.slice(0, 24);
  const secret = crypto.randomBytes(18).toString("base64url");
  let out = registerAccount({
    handle,
    secret,
    displayName: String(who.name || handle).slice(0, 48),
    lab: provider,
  });
  if (!out.ok && out.error === "handle taken") {
    handle = normalizeHandle(`${who.login}-${provider}`).slice(0, 24);
    out = registerAccount({
      handle,
      secret,
      displayName: String(who.name || handle).slice(0, 48),
      lab: provider,
    });
  }
  if (!out.ok) return out;
  bindIdentity(provider, who.id, out.account.handle);
  return finishSeat(out.account.handle, who.name, provider, true, out.token, out.account, secret);
}
