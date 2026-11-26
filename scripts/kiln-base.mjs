/**
 * Kiln Base — sovereign data plane.
 *
 * Superbase (Supabase) is a hosted Postgres plus a ring of open-source
 * services behind a gateway:
 *
 *   Postgres        dedicated cluster, WAL, extensions
 *   GoTrue          JWT auth (email, OAuth, SAML) → RLS
 *   PostgREST       schema → REST
 *   pg_graphql      schema → GraphQL
 *   postgres-meta   schema introspection
 *   Realtime        Elixir cluster, logical replication → websocket
 *   Storage         S3 objects, Postgres ACL
 *   Edge Functions  Deno isolates
 *   Supavisor       connection pooler
 *   Kong / Envoy    API gateway
 *   Studio          hosted dashboard
 *   pgvector        rented ANN index
 *   pgsodium/vault  secrets in the cluster
 *   pg_cron         in-database jobs
 *   Logflare        logs as a product
 *
 * Kiln Base covers that surface on the tree, then goes past it:
 * merkle is the database, L1 settles mutations, AES-256-GCM vaults
 * hold private rows, kiln://owner/repo is the isolation unit, and
 * agents write schema. No rented cluster. No Studio clone.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { ownsRepo, loadUserRepos, kilnPublicRepos, loadAccount, normalizeHandle } from "./kiln-accounts.mjs";
import { signObjectGrant, verifyObjectGrant, loadWallet } from "./kiln-wallet.mjs";
import { runInNamespace } from "./kiln-ns.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BASE = path.join(ROOT, "data", "base");
const CAS = path.join(ROOT, "cas", "sha256");
const USERS = path.join(ROOT, "data", "users");
export const baseBus = new EventEmitter();
baseBus.setMaxListeners(80);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function splitRepo(repoId) {
  const raw = String(repoId || "").replace(/^\/+/, "");
  const [owner, ...rest] = raw.split("/");
  const name = rest.join("/") || "home";
  return { owner: normalizeHandle(owner), name: name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 40), id: `${normalizeHandle(owner)}/${name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 40)}` };
}

function safe(s) {
  return String(s || "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48);
}

function baseDir(repoId) {
  const { owner, name } = splitRepo(repoId);
  return path.join(BASE, safe(owner), safe(name));
}

function schemaPath(repoId) {
  return path.join(baseDir(repoId), "SCHEMA.json");
}

function tablePath(repoId, table) {
  return path.join(baseDir(repoId), "tables", `${safe(table)}.json`);
}

function walPath(repoId) {
  return path.join(baseDir(repoId), "WAL.jsonl");
}

function sha(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function id12() {
  return crypto.randomBytes(6).toString("hex");
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&#38;";
    if (c === "<") return "&#60;";
    if (c === ">") return "&#62;";
    if (c === '"') return "&#34;";
    return "&#39;";
  });
}

function defaultSchema(repoId, visibility) {
  const vis = visibility === "private" ? "private" : "public";
  return {
    spec: "kiln-base/v1",
    repoId,
    isolation: `kiln://${repoId}`,
    cipher: vis === "private" ? "AES-256-GCM" : "open",
    visibility: vis,
    createdAt: nowIso(),
    tables: {
      events: {
        name: "events",
        policy: vis,
        rls: "owner",
        columns: [
          { name: "id", type: "id" },
          { name: "kind", type: "text" },
          { name: "body", type: "json" },
          { name: "owner", type: "handle" },
          { name: "at", type: "time" },
        ],
      },
      docs: {
        name: "docs",
        policy: vis,
        rls: "owner",
        vector: true,
        columns: [
          { name: "id", type: "id" },
          { name: "title", type: "text" },
          { name: "body", type: "text" },
          { name: "owner", type: "handle" },
        ],
      },
      objects: {
        name: "objects",
        policy: vis,
        rls: "owner",
        columns: [
          { name: "id", type: "id" },
          { name: "bucket", type: "text" },
          { name: "path", type: "text" },
          { name: "sha256", type: "hex" },
          { name: "bytes", type: "int" },
          { name: "owner", type: "handle" },
        ],
      },
    },
    buckets: { files: { policy: vis } },
    vectors: { docs: { dim: 64, table: "docs", field: "body" } },
    rpc: {
      search: { kind: "vector", collection: "docs" },
      describe: { kind: "describe" },
      merkle: { kind: "merkle" },
      sql: { kind: "sql" },
      tx: { kind: "tx" },
    },
    hooks: [{ table: "docs", op: "insert", deliver: "events" }],
    indexes: { docs: ["owner", "title"], events: ["kind", "owner"], objects: ["bucket", "path"] },
    unique: { objects: [["bucket", "path"]] },
    webhooks: [],
  };
}

export function ensureBase(repoId, { visibility, handle } = {}) {
  const { id, owner } = splitRepo(repoId);
  if (!id.includes("/")) return { ok: false, error: "repo id required" };
  const dir = baseDir(id);
  fs.mkdirSync(path.join(dir, "tables"), { recursive: true });
  fs.mkdirSync(path.join(dir, "buckets"), { recursive: true });
  fs.mkdirSync(path.join(dir, "vectors"), { recursive: true });
  let schema = readJson(schemaPath(id), null);
  if (!schema) {
    schema = defaultSchema(id, visibility);
    schema.owner = handle || owner;
    writeJson(schemaPath(id), schema);
    for (const t of Object.keys(schema.tables)) {
      const f = tablePath(id, t);
      if (!fs.existsSync(f)) writeJson(f, { table: t, rows: [] });
    }
    const genesis = {
      id: id12(),
      kind: "genesis",
      body: { isolation: schema.isolation, merkle: merkleSchema(schema) },
      owner: schema.owner,
      at: nowIso(),
    };
    writeJson(tablePath(id, "events"), { table: "events", rows: [genesis] });
    writeJson(tablePath(id, "docs"), {
      table: "docs",
      rows: [
        {
          id: id12(),
          title: `${id} base`,
          body: `Kiln Base for ${id}. Schema is the API. Merkle is the database. Isolation ${schema.isolation}.`,
          owner: schema.owner,
          at: nowIso(),
        },
      ],
    });
    appendWal(id, { kind: "schema", table: "*", op: "genesis", actor: schema.owner });
  } else {
    const d = defaultSchema(id, schema.visibility || visibility);
    let dirty = false;
    if (!schema.indexes || !Object.keys(schema.indexes).length) {
      schema.indexes = d.indexes;
      dirty = true;
    }
    if (!schema.unique) {
      schema.unique = d.unique;
      dirty = true;
    }
    if (!schema.hooks) {
      schema.hooks = d.hooks;
      dirty = true;
    }
    if (!Array.isArray(schema.webhooks)) {
      schema.webhooks = [];
      dirty = true;
    }
    if (dirty) {
      schema.updatedAt = nowIso();
      writeJson(schemaPath(id), schema);
      try {
        rebuildIndexes(id);
      } catch {
        /* */
      }
    }
    for (const t of Object.keys(schema.tables || {})) {
      const f = tablePath(id, t);
      if (!fs.existsSync(f)) writeJson(f, { table: t, rows: [] });
    }
  }
  return { ok: true, schema: publicSchema(schema), isolation: schema.isolation };
}

function publicSchema(schema) {
  if (!schema) return null;
  const tables = {};
  for (const [k, t] of Object.entries(schema.tables || {})) {
    tables[k] = { name: t.name, policy: t.policy, rls: t.rls, columns: t.columns, vector: !!t.vector };
  }
  return {
    spec: schema.spec,
    repoId: schema.repoId,
    owner: schema.owner,
    isolation: schema.isolation,
    cipher: schema.cipher,
    visibility: schema.visibility,
    tables,
    buckets: schema.buckets || {},
    vectors: schema.vectors || {},
    rpc: schema.rpc || {},
    merkle: merkleSchema(schema),
    indexes: schema.indexes || {},
    unique: schema.unique || {},
    hooks: (schema.hooks || []).length,
  };
}

function merkleSchema(schema) {
  const dir = baseDir(schema.repoId);
  const leaves = [];
  try {
    for (const f of fs.readdirSync(path.join(dir, "tables"))) {
      const p = path.join(dir, "tables", f);
      if (fs.statSync(p).isFile()) leaves.push(sha(fs.readFileSync(p)));
    }
  } catch {
    /* empty */
  }
  leaves.push(sha(JSON.stringify(schema.tables || {})));
  leaves.sort();
  return "0x" + sha(leaves.join("")).slice(0, 48);
}

function loadSchema(repoId) {
  return readJson(schemaPath(repoId), null);
}

function loadTable(repoId, table) {
  return readJson(tablePath(repoId, table), { table, rows: [] });
}

function saveTable(repoId, table, doc) {
  writeJson(tablePath(repoId, table), doc);
}

function appendWal(repoId, ev) {
  if (ev && ev.silent) return;
  const line = JSON.stringify({ ...ev, at: nowIso(), id: id12() }) + "\n";
  fs.mkdirSync(baseDir(repoId), { recursive: true });
  fs.appendFileSync(walPath(repoId), line);
  baseBus.emit("wal", { repoId, ...ev });
}

function indexDir(repoId) {
  return path.join(baseDir(repoId), "indexes");
}

export function rebuildIndexes(repoId) {
  const schema = loadSchema(repoId);
  if (!schema) return { ok: false, error: "unknown base" };
  fs.mkdirSync(indexDir(repoId), { recursive: true });
  const idx = schema.indexes || {};
  let n = 0;
  for (const [table, cols] of Object.entries(idx)) {
    const doc = loadTable(repoId, table);
    for (const col of cols) {
      const map = {};
      for (const r of doc.rows || []) {
        const k = String(r[col] ?? "");
        if (!k) continue;
        (map[k] = map[k] || []).push(r.id);
      }
      writeJson(path.join(indexDir(repoId), `${safe(table)}__${safe(col)}.json`), { table, col, keys: Object.keys(map).length, map });
      n += 1;
    }
  }
  return { ok: true, indexes: n };
}

function probeIndex(repoId, table, col, key) {
  const doc = readJson(path.join(indexDir(repoId), `${safe(table)}__${safe(col)}.json`), null);
  if (!doc || !doc.map) return null;
  const hit = doc.map[String(key)];
  return Array.isArray(hit) ? hit : [];
}

function encFieldSet(schema) {
  return new Set(Array.isArray(schema?.encrypt) && schema.encrypt.length ? schema.encrypt : ["body", "title", "text"]);
}

function indexCandidates(schema, repoId, table, where) {
  if (!where || typeof where !== "object" || Array.isArray(where.or) || Array.isArray(where.and)) return null;
  const cols = schema?.indexes?.[table];
  if (!Array.isArray(cols) || !cols.length) return null;
  const sealed = schema?.visibility === "private" ? encFieldSet(schema) : new Set();
  let ids = null;
  let used = false;
  for (const [k, spec] of Object.entries(where)) {
    if (!cols.includes(k) || sealed.has(k)) continue;
    let keys = [];
    if (spec && typeof spec === "object" && !Array.isArray(spec)) {
      if (spec.eq != null) keys = [spec.eq];
      else if (Array.isArray(spec.in)) keys = spec.in;
      else continue;
    } else if (spec != null && typeof spec !== "object") {
      keys = [spec];
    } else continue;
    const hit = [];
    let missing = false;
    for (const key of keys) {
      const part = probeIndex(repoId, table, k, key);
      if (part === null) {
        missing = true;
        break;
      }
      hit.push(...part);
    }
    if (missing) continue;
    used = true;
    const set = new Set(hit);
    ids = ids ? ids.filter((x) => set.has(x)) : [...set];
  }
  return used ? ids : null;
}

export function parseRestQuery(q = {}) {
  const where = {};
  let select;
  let order;
  let limit;
  let offset;
  for (const [k, v] of Object.entries(q || {})) {
    if (k === "select") {
      select = v;
      continue;
    }
    if (k === "order") {
      order = v;
      continue;
    }
    if (k === "limit") {
      limit = v;
      continue;
    }
    if (k === "offset") {
      offset = v;
      continue;
    }
    if (k === "repo" || k === "table" || k === "action" || k === "token" || k === "sig" || k === "exp" || k === "path" || k === "bucket" || k === "viewer") continue;
    const s = String(v ?? "");
    const m = s.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|in|is|cs|contains|not)\.(.+)$/i);
    if (m) {
      const op = m[1].toLowerCase();
      let val = m[2];
      if (op === "in") val = val.replace(/^\(|\)$/g, "").split(",").map((x) => sqlVal(x));
      else if (op === "is") val = val.toLowerCase() === "null" ? "null" : sqlVal(val);
      else val = sqlVal(val);
      where[k] = { [op]: val };
    } else if (s.length) {
      where[k] = { eq: sqlVal(s) };
    }
  }
  return {
    where: Object.keys(where).length ? where : undefined,
    select,
    order,
    limit,
    offset,
  };
}

export function repoVisibility(repoId, viewer) {
  const { owner, id } = splitRepo(repoId);
  if (owner === "kiln") return "public";
  const doc = loadUserRepos(owner);
  const rec = (doc.repos || []).find((r) => r.id === id);
  if (!rec) return viewer === owner ? "private" : "missing";
  const vis = rec.visibility === "private" || rec.encrypted ? "private" : "public";
  if (vis === "private" && viewer !== owner) return "hidden";
  return vis;
}

export function canSeeBase(viewer, repoId) {
  const vis = repoVisibility(repoId, viewer);
  if (vis === "missing" || vis === "hidden") return false;
  return true;
}

function canWriteBase(viewer, repoId) {
  const { owner } = splitRepo(repoId);
  if (!viewer) return false;
  if (owner === "kiln") return false;
  return ownsRepo(viewer, repoId) || viewer === owner;
}

function canReadRow(viewer, tableDef, row, owner) {
  const pol = tableDef?.policy || "private";
  if (pol === "public") return true;
  if (pol === "signed") return !!viewer;
  if (tableDef?.rls === "owner" && row?.owner && viewer === row.owner) return true;
  return viewer === owner;
}

function canWriteRow(viewer, tableDef, row, owner) {
  if (viewer !== owner) {
    if (tableDef?.rls === "owner" && row?.owner && viewer === row.owner) return true;
    return false;
  }
  return true;
}

const OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is", "contains", "cs", "not"]);

function globLike(val, pat, insen) {
  const s = insen ? String(val ?? "").toLowerCase() : String(val ?? "");
  const p = insen ? String(pat ?? "").toLowerCase() : String(pat ?? "");
  const re = new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$");
  return re.test(s);
}

export function matchOp(val, spec) {
  if (spec == null || typeof spec !== "object" || Array.isArray(spec)) return val === spec;
  const keys = Object.keys(spec);
  if (!keys.length) return true;
  if (!keys.some((k) => OPS.has(k))) return val === spec;
  return keys.every((op) => {
    const want = spec[op];
    if (op === "eq") return val === want;
    if (op === "neq") return val !== want;
    if (op === "gt") return val > want;
    if (op === "gte") return val >= want;
    if (op === "lt") return val < want;
    if (op === "lte") return val <= want;
    if (op === "in") return Array.isArray(want) && want.includes(val);
    if (op === "is") return want === "null" ? val == null : val === want;
    if (op === "like") return globLike(val, want, false);
    if (op === "ilike") return globLike(val, want, true);
    if (op === "contains" || op === "cs") {
      if (Array.isArray(val)) return Array.isArray(want) ? want.every((x) => val.includes(x)) : val.includes(want);
      if (val && typeof val === "object") return Object.entries(want || {}).every(([k, v]) => val[k] === v);
      return String(val ?? "").includes(String(want ?? ""));
    }
    if (op === "not") return !matchOp(val, want);
    return true;
  });
}

export function matchWhere(row, where) {
  if (!where || typeof where !== "object") return true;
  if (Array.isArray(where.or)) return where.or.some((w) => matchWhere(row, w));
  if (Array.isArray(where.and)) return where.and.every((w) => matchWhere(row, w));
  return Object.entries(where).every(([k, v]) => {
    if (k === "or" || k === "and") return true;
    return matchOp(row[k], v);
  });
}

function orderRows(rows, order) {
  if (!order) return rows;
  const parts = Array.isArray(order)
    ? order
    : String(order)
        .split(",")
        .map((s) => {
          const [col, dir] = String(s).trim().split(".");
          return { col, dir: (dir || "asc").toLowerCase() };
        });
  const copy = rows.slice();
  copy.sort((a, b) => {
    for (const p of parts) {
      const av = a[p.col];
      const bv = b[p.col];
      if (av === bv) continue;
      const cmp = av > bv ? 1 : -1;
      return p.dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return copy;
}

function projectRows(rows, select) {
  if (!select) return rows;
  const cols = Array.isArray(select) ? select : String(select).split(",").map((s) => s.trim()).filter(Boolean);
  if (!cols.length || cols.includes("*")) return rows;
  return rows.map((r) => {
    const o = {};
    for (const c of cols) o[c] = r[c];
    return o;
  });
}

function rowKey(secret, repoId, table) {
  return crypto.createHash("sha256").update(`kiln-row:${secret}:${repoId}:${table}`).digest();
}

function encryptRow(schema, rec, secret, table) {
  if (!secret || schema?.visibility !== "private") return rec;
  const fields = [...encFieldSet(schema)];
  const payload = {};
  for (const k of fields) {
    if (Object.prototype.hasOwnProperty.call(rec, k)) payload[k] = rec[k] ?? null;
  }
  if (!Object.keys(payload).length) return rec;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", rowKey(secret, schema.repoId, table || rec._table || "row"), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]);
  const tag = c.getAuthTag();
  const next = { ...rec, _enc: Buffer.concat([iv, tag, enc]).toString("base64"), _enc_alg: "AES-256-GCM", _enc_fields: fields, _table: table || rec._table || "row" };
  for (const k of fields) delete next[k];
  return next;
}

function decryptRow(schema, rec, secret) {
  if (!rec?._enc) return rec;
  if (!secret) return { ...rec, _sealed: true };
  try {
    const buf = Buffer.from(rec._enc, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", rowKey(secret, schema.repoId, rec._table || "row"), iv);
    d.setAuthTag(tag);
    const plain = JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8"));
    const next = { ...rec, ...plain };
    delete next._enc;
    delete next._enc_alg;
    delete next._enc_fields;
    delete next._sealed;
    return next;
  } catch {
    return { ...rec, _sealed: true };
  }
}

const PRESENCE = new Map();

export function touchPresence(repoId, viewer, { channel, meta } = {}) {
  if (!viewer || !canSeeBase(viewer, repoId)) return { ok: false, error: "unknown base" };
  const id = splitRepo(repoId).id;
  const now = Date.now();
  const room = PRESENCE.get(id) || {};
  for (const [h, rec] of Object.entries(room)) {
    if (now - rec.at > 90_000) delete room[h];
  }
  room[viewer] = { handle: viewer, at: now, channel: channel || "wal", meta: meta || {} };
  PRESENCE.set(id, room);
  baseBus.emit("presence", { repoId: id, handles: Object.keys(room), actor: viewer });
  return { ok: true, repoId: id, presence: Object.values(room).map((p) => ({ handle: p.handle, channel: p.channel, at: new Date(p.at).toISOString() })) };
}

export function listPresence(repoId, viewer) {
  if (!canSeeBase(viewer, repoId)) return { ok: false, error: "unknown base" };
  const id = splitRepo(repoId).id;
  const now = Date.now();
  const room = PRESENCE.get(id) || {};
  const live = Object.values(room).filter((p) => now - p.at < 90_000);
  return { ok: true, repoId: id, presence: live.map((p) => ({ handle: p.handle, channel: p.channel, at: new Date(p.at).toISOString() })) };
}

export function broadcast(repoId, viewer, { event, payload, channel } = {}) {
  if (!canWriteBase(viewer, repoId) && !canSeeBase(viewer, repoId)) return { ok: false, error: "unknown base" };
  const ev = { repoId: splitRepo(repoId).id, kind: "broadcast", event: event || "message", channel: channel || "wal", actor: viewer, payload: payload || {}, at: nowIso(), id: id12() };
  appendWal(ev.repoId, ev);
  baseBus.emit("broadcast", ev);
  return { ok: true, event: ev };
}

export function describeBase(repoId, viewer) {
  const vis = repoVisibility(repoId, viewer);
  if (vis === "hidden" || vis === "missing") return { ok: false, error: "unknown base" };
  ensureBase(repoId, { visibility: vis === "private" ? "private" : "public" });
  const schema = loadSchema(repoId);
  const stats = {};
  for (const name of Object.keys(schema.tables || {})) {
    const t = loadTable(repoId, name);
    const rows = (t.rows || []).filter((r) => canReadRow(viewer, schema.tables[name], r, schema.owner));
    stats[name] = { rows: rows.length, policy: schema.tables[name].policy };
  }
  let wal = 0;
  try {
    wal = fs.readFileSync(walPath(repoId), "utf8").split("\n").filter(Boolean).length;
  } catch {
    wal = 0;
  }
  return {
    ok: true,
    ...publicSchema(schema),
    stats,
    wal,
    write: canWriteBase(viewer, repoId),
  };
}

export function listBases(viewer) {
  const out = [];
  const kiln = kilnPublicRepos();
  for (const r of kiln.slice(0, 12)) {
    const d = describeBase(r.id, viewer);
    if (d.ok) out.push({ repoId: r.id, owner: "kiln", visibility: "public", tables: Object.keys(d.tables || {}), merkle: d.merkle });
  }
  if (viewer) {
    const mine = loadUserRepos(viewer);
    for (const r of mine.repos || []) {
      const d = describeBase(r.id, viewer);
      if (d.ok) out.push({ repoId: r.id, owner: viewer, visibility: r.visibility || "public", tables: Object.keys(d.tables || {}), merkle: d.merkle });
    }
  }
  try {
    for (const owner of fs.readdirSync(BASE)) {
      if (viewer && owner === viewer) continue;
      if (owner === "kiln") continue;
      const dir = path.join(BASE, owner);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const name of fs.readdirSync(dir)) {
        const id = `${owner}/${name}`;
        if (!canSeeBase(viewer, id)) continue;
        const d = describeBase(id, viewer);
        if (d.ok) out.push({ repoId: id, owner, visibility: d.visibility, tables: Object.keys(d.tables || {}), merkle: d.merkle });
      }
    }
  } catch {
    /* none */
  }
  const seen = new Set();
  return { ok: true, viewer: viewer || null, bases: out.filter((b) => (seen.has(b.repoId) ? false : (seen.add(b.repoId), true))) };
}

let seeded = false;
export function seedBases() {
  if (seeded) return { ok: true, bases: 0, cached: true };
  const n = [];
  for (const r of kilnPublicRepos().slice(0, 16)) {
    n.push(ensureBase(r.id, { visibility: "public", handle: "kiln" }));
  }
  try {
    for (const owner of fs.readdirSync(USERS)) {
      const doc = loadUserRepos(owner);
      for (const r of doc.repos || []) {
        n.push(ensureBase(r.id, { visibility: r.visibility === "private" ? "private" : "public", handle: owner }));
      }
    }
  } catch {
    /* none */
  }
  seeded = true;
  return { ok: true, bases: n.filter((x) => x.ok).length };
}

export function createTable(repoId, viewer, { name, policy, columns, rls, indexes, unique } = {}) {
  if (!canWriteBase(viewer, repoId)) return { ok: false, error: "not your base" };
  ensureBase(repoId);
  const live = loadSchema(repoId);
  const slug = safe(name).replace(/^_+/, "").slice(0, 40);
  if (!slug) return { ok: false, error: "table name required" };
  if (live.tables[slug]) return { ok: true, table: live.tables[slug], created: false };
  live.tables[slug] = {
    name: slug,
    policy: policy === "public" || policy === "signed" ? policy : "private",
    rls: rls || "owner",
    columns: Array.isArray(columns) && columns.length ? columns : [{ name: "id", type: "id" }, { name: "body", type: "json" }, { name: "owner", type: "handle" }],
  };
  live.updatedAt = nowIso();
  if (Array.isArray(indexes) && indexes.length) {
    live.indexes = live.indexes || {};
    live.indexes[slug] = indexes.map(String);
  }
  if (unique) {
    live.unique = live.unique || {};
    live.unique[slug] = Array.isArray(unique[0]) ? unique : [unique];
  }
  writeJson(schemaPath(repoId), live);
  writeJson(tablePath(repoId, slug), { table: slug, rows: [] });
  appendWal(repoId, { kind: "schema", table: slug, op: "create", actor: viewer });
  return { ok: true, table: live.tables[slug], created: true, schema: publicSchema(live), mutated: true };
}

export function queryTable(repoId, viewer, table, { where, limit, offset, select, order, secret } = {}) {
  if (!canSeeBase(viewer, repoId)) return { ok: false, error: "unknown base" };
  const schema = loadSchema(repoId) || (ensureBase(repoId) && loadSchema(repoId));
  const def = schema.tables?.[table];
  if (!def) return { ok: false, error: "unknown table" };
  const doc = loadTable(repoId, table);
  const idxIds = indexCandidates(schema, repoId, table, where);
  let source = doc.rows || [];
  let indexed = false;
  if (idxIds !== null) {
    const set = new Set(idxIds);
    source = source.filter((r) => set.has(r.id));
    indexed = true;
  }
  let rows = source
    .map((r) => decryptRow(schema, r, secret))
    .filter((r) => canReadRow(viewer, def, r, schema.owner));
  rows = rows.filter((r) => matchWhere(r, where));
  const total = rows.length;
  rows = orderRows(rows, order);
  const start = Math.max(0, Number(offset) || 0);
  const n = Math.min(500, Math.max(1, Number(limit) || 50));
  rows = projectRows(rows.slice(start, start + n), select);
  return {
    ok: true,
    table,
    policy: def.policy,
    rows,
    total,
    indexed,
    merkle: "0x" + sha(JSON.stringify(doc.rows || [])).slice(0, 48),
  };
}

function uniqueClash(schema, table, rows, rec) {
  const rules = [];
  const listed = schema?.unique?.[table];
  if (Array.isArray(listed)) {
    for (const r of listed) rules.push(Array.isArray(r) ? r : [r]);
  }
  if (table === "objects") rules.push(["bucket", "path"]);
  for (const cols of rules) {
    const hit = (rows || []).find(
      (r) => r.id !== rec.id && cols.every((c) => rec[c] != null && rec[c] !== "" && String(r[c] ?? "") === String(rec[c])),
    );
    if (hit) return { cols, id: hit.id, objects: table === "objects" };
  }
  return null;
}

export function insertRow(repoId, viewer, table, row, { secret, upsert, silent } = {}) {
  if (!canWriteBase(viewer, repoId)) return { ok: false, error: "not your base" };
  const schema = loadSchema(repoId);
  const def = schema?.tables?.[table];
  if (!def) return { ok: false, error: "unknown table" };
  const doc = loadTable(repoId, table);
  const rec = { ...(row && typeof row === "object" ? row : {}) };
  rec.id = rec.id || id12();
  rec.owner = rec.owner || viewer;
  rec.at = rec.at || nowIso();
  delete rec.sha256;
  doc.rows = doc.rows || [];
  const taken = doc.rows.findIndex((r) => r.id === rec.id);
  if (taken >= 0) {
    if (!upsert) return { ok: false, error: "id taken" };
    return updateRow(repoId, viewer, table, rec.id, rec, { secret, silent });
  }
  const clash = uniqueClash(schema, table, doc.rows, rec);
  if (clash) {
    if (upsert) return updateRow(repoId, viewer, table, clash.id, rec, { secret, silent });
    return { ok: false, error: clash.objects ? "path taken" : "unique" };
  }
  const stored = encryptRow(schema, rec, secret, table);
  doc.rows.push(stored);
  saveTable(repoId, table, doc);
  if (!silent) appendWal(repoId, { kind: "insert", table, row: rec.id, actor: viewer });
  if (def.vector) upsertVector(repoId, table, rec);
  if (!silent) fireHooks(repoId, "insert", table, rec, viewer);
  try {
    rebuildIndexes(repoId);
  } catch {
    /* */
  }
  return { ok: true, row: rec, table, mutated: true };
}

export function updateRow(repoId, viewer, table, id, patch, { secret, silent } = {}) {
  if (!canWriteBase(viewer, repoId)) return { ok: false, error: "not your base" };
  const schema = loadSchema(repoId);
  const def = schema?.tables?.[table];
  const doc = loadTable(repoId, table);
  const i = (doc.rows || []).findIndex((r) => r.id === id);
  if (i < 0) return { ok: false, error: "unknown row" };
  const raw = doc.rows[i];
  if (raw._enc && !secret) return { ok: false, error: "row sealed" };
  const cur = decryptRow(schema, raw, secret);
  if (raw._enc && cur._enc) return { ok: false, error: "row sealed" };
  if (!canWriteRow(viewer, def, cur, schema.owner)) return { ok: false, error: "row locked" };
  const next = { ...cur, ...(patch && typeof patch === "object" ? patch : {}), id: cur.id, owner: cur.owner };
  delete next._sealed;
  const clash = uniqueClash(schema, table, doc.rows, next);
  if (clash) return { ok: false, error: clash.objects ? "path taken" : "unique" };
  doc.rows[i] = encryptRow(schema, next, secret, table);
  saveTable(repoId, table, doc);
  if (!silent) appendWal(repoId, { kind: "update", table, row: id, actor: viewer });
  if (def?.vector) upsertVector(repoId, table, next);
  if (!silent) fireHooks(repoId, "update", table, next, viewer);
  try {
    rebuildIndexes(repoId);
  } catch {
    /* */
  }
  return { ok: true, row: next, mutated: true };
}

export function deleteRow(repoId, viewer, table, id, { silent } = {}) {
  if (!canWriteBase(viewer, repoId)) return { ok: false, error: "not your base" };
  const schema = loadSchema(repoId);
  const def = schema?.tables?.[table];
  const doc = loadTable(repoId, table);
  const row = (doc.rows || []).find((r) => r.id === id);
  if (!row) return { ok: false, error: "unknown row" };
  if (!canWriteRow(viewer, def, row, schema.owner)) return { ok: false, error: "row locked" };
  doc.rows = doc.rows.filter((r) => r.id !== id);
  saveTable(repoId, table, doc);
  if (!silent) appendWal(repoId, { kind: "delete", table, row: id, actor: viewer });
  if (!silent) fireHooks(repoId, "delete", table, row, viewer);
  try {
    rebuildIndexes(repoId);
  } catch {
    /* */
  }
  return { ok: true, deleted: id, mutated: true };
}

function fireHooks(repoId, op, table, rec, viewer) {
  const schema = loadSchema(repoId);
  const hooks = (schema?.hooks || []).filter((h) => (!h.table || h.table === table) && (!h.op || h.op === op || h.op === "*"));
  if (hooks.length) {
    for (const h of hooks) {
      const deliver = h.deliver || "events";
      if (deliver === "events" && table !== "events") {
        try {
          const events = loadTable(repoId, "events");
          events.rows = events.rows || [];
          events.rows.push({ id: id12(), kind: `hook.${op}`, body: { table, id: rec?.id, hook: h.table }, owner: viewer, at: nowIso() });
          events.rows = events.rows.slice(-400);
          saveTable(repoId, "events", events);
        } catch {
          /* */
        }
      }
    }
  }
  for (const w of schema?.webhooks || []) {
    if (w.table && w.table !== table) continue;
    if (w.op && w.op !== op && w.op !== "*") continue;
    appendWal(repoId, {
      kind: "webhook",
      table,
      op,
      row: rec?.id,
      actor: viewer,
      hook: String(w.name || w.url || "hook").slice(0, 80),
      url: String(w.url || "").slice(0, 240),
    });
  }
  baseBus.emit("hook", { repoId, op, table, id: rec?.id, actor: viewer });
}

export function runTransaction(repoId, viewer, { ops, secret } = {}) {
  if (!canWriteBase(viewer, repoId)) return { ok: false, error: "not your base" };
  if (!Array.isArray(ops) || !ops.length) return { ok: false, error: "ops required" };
  const results = [];
  const snap = {};
  const schema = loadSchema(repoId);
  for (const name of Object.keys(schema.tables || {})) {
    snap[name] = JSON.parse(JSON.stringify(loadTable(repoId, name)));
  }
  try {
    for (const step of ops.slice(0, 40)) {
      const table = step.table;
      const op = step.op || step.action;
      let out;
      if (op === "insert") out = insertRow(repoId, viewer, table, step.row || step, { secret, upsert: !!step.upsert, silent: true });
      else if (op === "update") out = updateRow(repoId, viewer, table, step.id, step.patch || step.row, { secret, silent: true });
      else if (op === "delete") out = deleteRow(repoId, viewer, table, step.id, { silent: true });
      else if (op === "upsert") out = insertRow(repoId, viewer, table, step.row || step, { secret, upsert: true, silent: true });
      else return { ok: false, error: `unknown op ${op}` };
      if (!out.ok) throw new Error(out.error || "tx failed");
      results.push(out);
    }
  } catch (e) {
    for (const [name, doc] of Object.entries(snap)) saveTable(repoId, name, doc);
    return { ok: false, error: e instanceof Error ? e.message : "tx failed", rolled: true };
  }
  appendWal(repoId, { kind: "tx", count: results.length, actor: viewer });
  for (let i = 0; i < results.length; i++) {
    const step = ops[i] || {};
    const rec = results[i].row || { id: step.id || results[i].deleted };
    try {
      fireHooks(repoId, step.op || step.action || "update", step.table, rec, viewer);
    } catch {
      /* */
    }
  }
  try {
    rebuildIndexes(repoId);
  } catch {
    /* */
  }
  return { ok: true, results, mutated: true, merkle: publicSchema(loadSchema(repoId)).merkle };
}

export function runSql(repoId, viewer, sql, { secret } = {}) {
  const s = String(sql || "").trim().replace(/;+\s*$/, "");
  if (!s) return { ok: false, error: "sql required" };
  const sel = s.match(/^select\s+(.+?)\s+from\s+([a-zA-Z0-9_]+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+([a-zA-Z0-9_]+)(?:\s+(asc|desc))?)?(?:\s+limit\s+(\d+))?(?:\s+offset\s+(\d+))?$/i);
  if (sel) {
    const where = parseSqlWhere(sel[3]);
    return queryTable(repoId, viewer, sel[2], {
      select: sel[1].trim(),
      where,
      order: sel[4] ? `${sel[4]}.${(sel[5] || "asc").toLowerCase()}` : undefined,
      limit: sel[6],
      offset: sel[7],
      secret,
    });
  }
  const ins = s.match(/^insert\s+into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*values\s*\((.+)\)$/i);
  if (ins) {
    const cols = ins[2].split(",").map((c) => c.trim());
    const vals = splitSqlList(ins[3]).map(sqlVal);
    const row = {};
    cols.forEach((c, i) => {
      row[c] = vals[i];
    });
    return insertRow(repoId, viewer, ins[1], row, { secret });
  }
  const upd = s.match(/^update\s+([a-zA-Z0-9_]+)\s+set\s+(.+?)(?:\s+where\s+(.+))?$/i);
  if (upd) {
    const patch = {};
    for (const part of splitSqlList(upd[2])) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      if (k) patch[k] = sqlVal(v);
    }
    const where = parseSqlWhere(upd[3]);
    if (where?.id?.eq) return updateRow(repoId, viewer, upd[1], where.id.eq, patch, { secret });
    const found = queryTable(repoId, viewer, upd[1], { where, secret, limit: 200 });
    if (!found.ok) return found;
    const results = [];
    for (const r of found.rows || []) results.push(updateRow(repoId, viewer, upd[1], r.id, patch, { secret }));
    return { ok: true, results, count: results.length, mutated: results.some((x) => x.ok), table: upd[1] };
  }
  const del = s.match(/^delete\s+from\s+([a-zA-Z0-9_]+)(?:\s+where\s+(.+))?$/i);
  if (del) {
    const where = parseSqlWhere(del[2]);
    if (where?.id?.eq) return deleteRow(repoId, viewer, del[1], where.id.eq);
    const found = queryTable(repoId, viewer, del[1], { where, secret, limit: 200 });
    if (!found.ok) return found;
    const results = [];
    for (const r of found.rows || []) results.push(deleteRow(repoId, viewer, del[1], r.id));
    return { ok: true, results, count: results.length, mutated: results.some((x) => x.ok), table: del[1] };
  }
  return { ok: false, error: "sql not supported. select/insert/update/delete on one table." };
}

function splitSqlList(raw) {
  const out = [];
  let cur = "";
  let q = null;
  for (const ch of String(raw)) {
    if (q) {
      if (ch === q) q = null;
      else cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      q = ch;
      continue;
    }
    if (ch === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function sqlVal(v) {
  const s = String(v ?? "").trim();
  if (s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s.replace(/^['"]|['"]$/g, "");
}

function parseSqlWhere(raw) {
  if (!raw) return undefined;
  const src = String(raw).trim();
  if (!src) return undefined;
  if (/\s+or\s+/i.test(src)) {
    return { or: src.split(/\s+or\s+/i).map((p) => parseSqlWhere(p) || {}) };
  }
  const where = {};
  const parts = src.split(/\s+and\s+/i);
  for (const p of parts) {
    const inn = p.trim().match(/^([a-zA-Z0-9_]+)\s+in\s*\((.+)\)$/i);
    if (inn) {
      where[inn[1]] = { in: splitSqlList(inn[2]).map(sqlVal) };
      continue;
    }
    const isn = p.trim().match(/^([a-zA-Z0-9_]+)\s+is\s+(not\s+)?null$/i);
    if (isn) {
      where[isn[1]] = isn[2] ? { neq: null } : { is: "null" };
      continue;
    }
    const m = p.trim().match(/^([a-zA-Z0-9_]+)\s*(=|!=|>=|<=|>|<|like|ilike)\s*(.+)$/i);
    if (!m) continue;
    const val = sqlVal(m[3]);
    const op = m[2].toLowerCase();
    if (op === "=") where[m[1]] = { eq: val };
    else if (op === "!=") where[m[1]] = { neq: val };
    else if (op === ">") where[m[1]] = { gt: val };
    else if (op === ">=") where[m[1]] = { gte: val };
    else if (op === "<") where[m[1]] = { lt: val };
    else if (op === "<=") where[m[1]] = { lte: val };
    else if (op === "like") where[m[1]] = { like: val };
    else if (op === "ilike") where[m[1]] = { ilike: val };
  }
  return Object.keys(where).length ? where : undefined;
}

export function listObjects(repoId, viewer, { bucket } = {}) {
  const where = bucket ? { bucket } : undefined;
  return queryTable(repoId, viewer, "objects", { where, limit: 200 });
}

export function deleteObject(repoId, viewer, { bucket, name } = {}) {
  if (!canWriteBase(viewer, repoId)) return { ok: false, error: "not your base" };
  const b = safe(bucket || "files");
  const n = String(name || "").replace(/^\/+/, "").replace(/\.\./g, "");
  const dest = path.join(baseDir(repoId), "buckets", b, n);
  if (dest.startsWith(path.join(baseDir(repoId), "buckets")) && fs.existsSync(dest)) {
    fs.unlinkSync(dest);
  }
  const doc = loadTable(repoId, "objects");
  const row = (doc.rows || []).find((r) => r.path === n && r.bucket === b);
  if (row) deleteRow(repoId, viewer, "objects", row.id);
  appendWal(repoId, { kind: "storage_delete", bucket: b, path: n, actor: viewer });
  return { ok: true, deleted: n, bucket: b, mutated: true };
}

export function signedObjectUrl(repoId, viewer, { bucket, name, ttl } = {}) {
  if (!canSeeBase(viewer, repoId)) return { ok: false, error: "unknown object" };
  const grant = signObjectGrant({
    repoId,
    bucket: bucket || "files",
    name,
    exp: Date.now() + Math.min(24 * 3600_000, Math.max(30_000, Number(ttl) || 15 * 60_000)),
    viewer: viewer || "",
  });
  return {
    ok: true,
    url: `/api/kiln/base/object?repo=${encodeURIComponent(repoId)}&bucket=${encodeURIComponent(grant.bucket)}&path=${encodeURIComponent(grant.path)}&exp=${grant.exp}&sig=${grant.sig}`,
    exp: grant.exp,
  };
}

export function embedText(text, dim = 64) {
  const toks = String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 80);
  const v = new Array(dim).fill(0);
  if (!toks.length) return v;
  for (const t of toks) {
    const h = sha(t);
    for (let i = 0; i < dim; i++) {
      const byte = parseInt(h.slice((i * 2) % 60, (i * 2) % 60 + 2), 16);
      v[i] += ((byte % 13) - 6) / Math.sqrt(toks.length);
    }
  }
  let n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
  return s;
}

function vectorFile(repoId, collection) {
  return path.join(baseDir(repoId), "vectors", `${safe(collection)}.json`);
}

function upsertVector(repoId, collection, rec) {
  const text = [rec.title, rec.body, rec.text].filter(Boolean).join("\n");
  const v = embedText(text);
  const doc = readJson(vectorFile(repoId, collection), { collection, dim: 64, items: [] });
  doc.items = (doc.items || []).filter((x) => x.id !== rec.id);
  doc.items.push({ id: rec.id, v, meta: { title: rec.title || "", owner: rec.owner } });
  doc.items = doc.items.slice(-400);
  writeJson(vectorFile(repoId, collection), doc);
}

export function queryVector(repoId, viewer, { collection, q, limit, where } = {}) {
  if (!canSeeBase(viewer, repoId)) return { ok: false, error: "unknown base" };
  const col = collection || "docs";
  const doc = readJson(vectorFile(repoId, col), { items: [] });
  if (!(doc.items || []).length) {
    const table = loadTable(repoId, col);
    for (const rec of table.rows || []) upsertVector(repoId, col, rec);
  }
  const live = readJson(vectorFile(repoId, col), { items: [] });
  const qv = embedText(q || "");
  let hits = (live.items || []).map((it) => ({ id: it.id, score: cosine(qv, it.v || []), meta: it.meta || {} }));
  if (where && typeof where === "object") hits = hits.filter((h) => matchWhere(h.meta, where));
  hits.sort((a, b) => b.score - a.score);
  hits = hits.slice(0, Math.min(20, Number(limit) || 8));
  return { ok: true, collection: col, hits };
}

export function putObject(repoId, viewer, { bucket, name, content, type } = {}) {
  if (!canWriteBase(viewer, repoId)) return { ok: false, error: "not your base" };
  ensureBase(repoId);
  const b = safe(bucket || "files");
  const n = String(name || "").replace(/^\/+/, "").replace(/\.\./g, "").slice(0, 120);
  if (!n) return { ok: false, error: "path required" };
  let buf;
  if (typeof content === "string" && content.startsWith("base64:")) buf = Buffer.from(content.slice(7), "base64");
  else buf = Buffer.from(String(content || ""), "utf8");
  if (buf.length > 2_000_000) return { ok: false, error: "object too large" };
  const digest = sha(buf);
  const cas = path.join(CAS, digest.slice(0, 2), digest);
  fs.mkdirSync(path.dirname(cas), { recursive: true });
  if (!fs.existsSync(cas)) fs.writeFileSync(cas, buf);
  const dest = path.join(baseDir(repoId), "buckets", b, n);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(cas, dest);
  const row = insertRow(repoId, viewer, "objects", {
    bucket: b,
    path: n,
    sha256: digest,
    bytes: buf.length,
    type: type || "application/octet-stream",
  });
  appendWal(repoId, { kind: "storage", bucket: b, path: n, sha256: digest, actor: viewer });
  return { ok: true, sha256: digest, bytes: buf.length, path: n, bucket: b, row: row.row, url: `/api/kiln/base/object?repo=${encodeURIComponent(repoId)}&bucket=${encodeURIComponent(b)}&path=${encodeURIComponent(n)}`, mutated: true };
}

export function getObject(repoId, viewer, { bucket, name } = {}) {
  if (!canSeeBase(viewer, repoId)) return { ok: false, error: "unknown object" };
  const b = safe(bucket || "files");
  const n = String(name || "").replace(/^\/+/, "").replace(/\.\./g, "");
  const dest = path.join(baseDir(repoId), "buckets", b, n);
  if (!dest.startsWith(path.join(baseDir(repoId), "buckets")) || !fs.existsSync(dest)) {
    return { ok: false, error: "unknown object" };
  }
  const buf = fs.readFileSync(dest);
  const objects = loadTable(repoId, "objects");
  const meta = (objects.rows || []).find((r) => r.path === n && r.bucket === b);
  return { ok: true, bytes: buf.length, sha256: sha(buf), buffer: buf, path: n, bucket: b, type: meta?.type || "application/octet-stream" };
}

export function readWal(repoId, viewer, { after, limit } = {}) {
  if (!canSeeBase(viewer, repoId)) return { ok: false, error: "unknown base" };
  let lines = [];
  try {
    lines = fs.readFileSync(walPath(repoId), "utf8").split("\n").filter(Boolean);
  } catch {
    lines = [];
  }
  const n = Math.min(100, Number(limit) || 40);
  const slice = lines.slice(-n).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);
  const out = after ? slice.filter((e) => e.id > after || e.at > after) : slice;
  return { ok: true, events: out };
}

export function graphqlQuery(repoId, viewer, query) {
  if (!canSeeBase(viewer, repoId)) return { ok: false, error: "unknown base" };
  let q = query;
  if (typeof query === "string") {
    const parsed = parseGraphqlString(query);
    if (!parsed) return { ok: false, error: "graphql subset: { docs { title } } or { docs: { where, select } }" };
    q = parsed;
  }
  q = q && typeof q === "object" ? q : {};
  const data = {};
  const tables = q.from ? { [q.from]: q } : q;
  for (const [table, spec] of Object.entries(tables)) {
    if (!spec || typeof spec !== "object") continue;
    if (table === "repo" || table === "query" || table === "action" || table === "secret") continue;
    const r = queryTable(repoId, viewer, table, { where: spec.where, limit: spec.limit, offset: spec.offset, select: spec.select, order: spec.order, secret: q.secret });
    if (r.ok) {
      let rows = r.rows;
      if (Array.isArray(spec.select) && spec.select.length) {
        rows = rows.map((row) => {
          const o = {};
          for (const k of spec.select) o[k] = row[k];
          return o;
        });
      }
      data[table] = rows;
    } else {
      data[table] = { error: r.error };
    }
  }
  return { ok: true, data, repoId };
}

function parseGraphqlString(src) {
  const s = String(src || "").trim();
  if (!s.startsWith("{")) return null;
  const tables = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(([^)]*)\))?\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(s))) {
    const table = m[1];
    if (table === "query") continue;
    const args = {};
    if (m[2]) {
      for (const part of m[2].split(",")) {
        const kv = part.split(":");
        if (kv.length >= 2) args[kv[0].trim()] = sqlVal(kv.slice(1).join(":"));
      }
    }
    const select = m[3].trim().split(/[\s,]+/).filter(Boolean);
    tables[table] = { select: select.length ? select : undefined, limit: args.limit, offset: args.offset };
  }
  return Object.keys(tables).length ? tables : null;
}

export function callRpc(repoId, viewer, name, args = {}) {
  if (!canSeeBase(viewer, repoId)) return { ok: false, error: "unknown base" };
  const schema = loadSchema(repoId) || (ensureBase(repoId) && loadSchema(repoId));
  const fn = (schema.rpc || {})[name] || { kind: name };
  const kind = fn.kind || name;
  const secret = args.secret;
  if (kind === "describe") return describeBase(repoId, viewer);
  if (kind === "vector" || kind === "search") {
    return queryVector(repoId, viewer, { collection: fn.collection || args.collection || "docs", q: args.q || args.text || args.query, limit: args.limit, where: args.where });
  }
  if (kind === "merkle") return { ok: true, merkle: publicSchema(schema).merkle, isolation: schema.isolation };
  if (kind === "query") return queryTable(repoId, viewer, args.table, { ...args, secret });
  if (kind === "sql") return runSql(repoId, viewer, args.sql || args.q || args.query, { secret });
  if (kind === "tx") return runTransaction(repoId, viewer, { ops: args.ops || args.steps, secret });
  if (kind === "presence") return listPresence(repoId, viewer);
  if (kind === "js" || kind === "py" || kind === "edge") return runEdge(repoId, viewer, fn, args);
  return { ok: false, error: `unknown rpc ${name}` };
}

function computerDir(repoId) {
  const { owner, name } = splitRepo(repoId);
  return path.join(ROOT, "computers", `${owner}_${name}`);
}

export function createRpc(repoId, viewer, { name, kind, source } = {}) {
  if (!canWriteBase(viewer, repoId)) return { ok: false, error: "not your base" };
  const live = loadSchema(repoId) || (ensureBase(repoId) && loadSchema(repoId));
  const slug = safe(name).slice(0, 40);
  if (!slug) return { ok: false, error: "rpc name required" };
  const k = kind === "py" || kind === "python" ? "py" : kind === "sql" ? "sql" : "js";
  live.rpc = live.rpc || {};
  live.rpc[slug] = { kind: k, source: String(source || "").slice(0, 20_000), updatedAt: nowIso(), owner: viewer };
  writeJson(schemaPath(repoId), live);
  appendWal(repoId, { kind: "rpc", name: slug, actor: viewer });
  return { ok: true, rpc: { name: slug, kind: k }, mutated: true };
}

export function runEdge(repoId, viewer, fn, args = {}) {
  if (!canWriteBase(viewer, repoId)) return { ok: false, error: "not your base" };
  const source = String(fn.source || "");
  if (!source) return { ok: false, error: "rpc has no source" };
  const dir = computerDir(repoId);
  fs.mkdirSync(dir, { recursive: true });
  const isPy = fn.kind === "py" || fn.kind === "python";
  const fileName = isPy ? ".kiln-rpc.py" : ".kiln-rpc.mjs";
  const payload = JSON.stringify({ repo: repoId, viewer, args: args.args || args });
  const body = isPy
    ? `${source}\nimport json,sys\npayload=json.loads(sys.argv[1] if len(sys.argv)>1 else "{}")\nargs=payload.get("args", payload) if isinstance(payload, dict) else payload\nfn=globals().get("main") or globals().get("handler")\nprint(json.dumps(fn(args) if callable(fn) else args))\n`
    : `${source}\nconst payload = JSON.parse(process.argv[2] || "{}");\nconst args = payload && payload.args ? payload.args : payload;\nconst fn = globalThis.main || globalThis.handler;\nPromise.resolve(typeof fn === "function" ? fn(args) : args).then((r) => console.log(JSON.stringify(r)));\n`;
  fs.writeFileSync(path.join(dir, fileName), body);
  const r = runInNamespace(dir, isPy ? "python3" : "node", [fileName, payload], { timeout: 4000 });
  let parsed = null;
  try {
    parsed = JSON.parse(String(r.out || "").trim().split("\n").at(-1) || "null");
  } catch {
    parsed = null;
  }
  return {
    ok: r.ok,
    kind: isPy ? "py" : "js",
    result: parsed,
    out: String(r.out || "").slice(0, 8000),
    err: String(r.err || "").slice(0, 2000),
    ns: true,
  };
}

export function runBaseTool(viewer, args = {}) {
  const repo = args.repo || args.repoId || "";
  const action = args.action || "describe";
  if (action === "list" || (!repo && action === "describe")) return listBases(viewer);
  if (!repo) return { ok: false, error: "repo required" };
  if (action === "describe") return describeBase(repo, viewer);
  if (action === "query") return queryTable(repo, viewer, args.table, { ...args, secret: args.secret });
  if (action === "insert") return insertRow(repo, viewer, args.table, args.row || args, { secret: args.secret, upsert: !!args.upsert });
  if (action === "update") return updateRow(repo, viewer, args.table, args.id, args.patch || args.row, { secret: args.secret });
  if (action === "delete") return deleteRow(repo, viewer, args.table, args.id);
  if (action === "vector" || action === "search") return queryVector(repo, viewer, args);
  if (action === "table") return createTable(repo, viewer, args);
  if (action === "graphql") return graphqlQuery(repo, viewer, args.query || args);
  if (action === "rpc") return callRpc(repo, viewer, args.name || args.fn, { ...(args.args || args), secret: args.secret });
  if (action === "edge" || action === "create_rpc") return args.source ? createRpc(repo, viewer, args) : runBaseTool(viewer, { ...args, action: "rpc" });
  if (action === "sql") return runSql(repo, viewer, args.sql || args.q, { secret: args.secret });
  if (action === "tx") return runTransaction(repo, viewer, { ops: args.ops || args.steps, secret: args.secret });
  if (action === "presence") return args.touch ? touchPresence(repo, viewer, args) : listPresence(repo, viewer);
  if (action === "broadcast") return broadcast(repo, viewer, args);
  if (action === "sign") return signedObjectUrl(repo, viewer, args);
  return describeBase(repo, viewer);
}

function statusOf(out) {
  if (!out) return { status: 404, body: { ok: false, error: "unknown base route" } };
  if (out.ok === false) {
    const err = String(out.error || "");
    const code = err === "unknown base" || err === "unknown object" || err === "unknown table" || err === "unknown row" ? 404 : err === "not your base" || err === "row locked" ? 403 : 400;
    return { status: code, body: out };
  }
  return { status: 200, body: out };
}

export function handleBaseApi(pathname, req) {
  const viewer = req.viewer || null;
  const secret = req.secret || "";
  const q = req.query || {};
  let data = {};
  try {
    data = JSON.parse(req.bodyText || "{}");
  } catch {
    data = {};
  }
  const repoId = data.repoId || data.repo || q.repo || "";
  const table = data.table || q.table || "";
  const action = data.action || q.action || "";
  const rest = parseRestQuery(q);
  const qopts = { where: data.where || rest.where, limit: data.limit || rest.limit || q.limit, offset: data.offset || rest.offset || q.offset, select: data.select || rest.select || q.select, order: data.order || rest.order || q.order, secret };

  if (pathname === "/api/kiln/base" || pathname === "/api/kiln/base/") {
    if (req.method === "GET" && !repoId) return { status: 200, body: listBases(viewer) };
    if (repoId) return statusOf(describeBase(repoId, viewer));
    return { status: 200, body: listBases(viewer) };
  }
  if (pathname === "/api/kiln/base/meta") {
    const wallet = viewer ? loadWallet(viewer) : null;
    return { status: 200, body: { ok: true, spec: "kiln-base/v1", layers: LAYERS, better: BETTER, wallet: wallet ? { scheme: wallet.scheme, address: wallet.address, quantum: true } : null } };
  }
  if (pathname === "/api/kiln/base/seed" && req.method === "POST") {
    return { status: 200, body: seedBases() };
  }
  if (pathname === "/api/kiln/base/sql") {
    if (!repoId) return { status: 400, body: { ok: false, error: "repo required" } };
    return statusOf(runSql(repoId, viewer, data.sql || data.q || q.sql, { secret }));
  }
  if (pathname === "/api/kiln/base/tx") {
    return statusOf(runTransaction(repoId, viewer, { ops: data.ops || data.steps, secret }));
  }
  if (pathname === "/api/kiln/base/presence") {
    if (req.method === "POST") return statusOf(touchPresence(repoId, viewer, data));
    return statusOf(listPresence(repoId, viewer));
  }
  if (pathname === "/api/kiln/base/broadcast" && req.method === "POST") {
    return statusOf(broadcast(repoId, viewer, data));
  }
  if (pathname === "/api/kiln/base/sign") {
    return statusOf(signedObjectUrl(repoId, viewer, data));
  }
  if (pathname === "/api/kiln/base/query") {
    if (!repoId || !table) return { status: 400, body: { ok: false, error: "repo and table required" } };
    return statusOf(queryTable(repoId, viewer, table, qopts));
  }
  if (pathname === "/api/kiln/base/graphql") {
    if (!repoId) return { status: 400, body: { ok: false, error: "repo required" } };
    return statusOf(graphqlQuery(repoId, viewer, data.query || data));
  }
  if (pathname === "/api/kiln/base/rpc") {
    if (!repoId) return { status: 400, body: { ok: false, error: "repo required" } };
    if ((action === "create" || data.kind) && data.source) {
      return statusOf(createRpc(repoId, viewer, { name: data.name || data.fn || q.name, kind: data.kind, source: data.source }));
    }
    return statusOf(callRpc(repoId, viewer, data.name || data.fn || q.name, data.args || data));
  }
  if (pathname === "/api/kiln/base/vector") {
    if (!repoId) return { status: 400, body: { ok: false, error: "repo required" } };
    return statusOf(queryVector(repoId, viewer, { collection: data.collection || q.collection, q: data.q || q.q, limit: data.limit }));
  }
  if (pathname === "/api/kiln/base/storage" && req.method === "POST") {
    if (action === "delete") return statusOf(deleteObject(repoId, viewer, data));
    if (action === "sign") return statusOf(signedObjectUrl(repoId, viewer, data));
    if (action === "list") return statusOf(listObjects(repoId, viewer, data));
    return statusOf(putObject(repoId, viewer, data));
  }
  if (pathname === "/api/kiln/base/storage" && req.method === "GET") {
    return statusOf(listObjects(repoId, viewer, { bucket: q.bucket || data.bucket }));
  }
  if (pathname === "/api/kiln/base/object" && req.method === "GET") {
    let who = viewer;
    if (q.sig) {
      const g = verifyObjectGrant({ repoId: q.repo, bucket: q.bucket, name: q.path || q.name, exp: q.exp, sig: q.sig, viewer: q.viewer || "" });
      if (!g.ok) return { status: 403, body: g };
      who = q.viewer || viewer;
    }
    const obj = getObject(q.repo, who, { bucket: q.bucket, name: q.path || q.name });
    if (!obj.ok) return { status: 404, body: obj };
    return { status: 200, raw: obj.buffer, headers: { "content-type": obj.type || "application/octet-stream", "x-kiln-sha256": obj.sha256, "cache-control": "public, max-age=31536000, immutable" } };
  }
  if (pathname === "/api/kiln/base/wal") {
    if (!repoId) return { status: 400, body: { ok: false, error: "repo required" } };
    return statusOf(readWal(repoId, viewer, { after: q.after, limit: q.limit }));
  }
  if (pathname === "/api/kiln/base/table" || pathname.startsWith("/api/kiln/base/table")) {
    if (!repoId) return { status: 400, body: { ok: false, error: "repo required" } };
    if (action === "create" || (data.name && !table && req.method === "POST")) {
      return statusOf(createTable(repoId, viewer, data));
    }
    if (action === "insert" || req.method === "POST") {
      return statusOf(insertRow(repoId, viewer, table, data.row || data, { secret, upsert: !!data.upsert }));
    }
    if (action === "update" || req.method === "PATCH" || req.method === "PUT") {
      return statusOf(updateRow(repoId, viewer, table, data.id, data.patch || data.row, { secret }));
    }
    if (action === "delete" || req.method === "DELETE") {
      return statusOf(deleteRow(repoId, viewer, table, data.id || q.id));
    }
    return statusOf(queryTable(repoId, viewer, table, data));
  }

  const m = pathname.match(/^\/api\/kiln\/base\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
  if (m) {
    const id = `${decodeURIComponent(m[1])}/${decodeURIComponent(m[2])}`;
    const rest = m[3] ? decodeURIComponent(m[3]) : "";
    if (!rest) return statusOf(describeBase(id, viewer));
    if (rest === "vector") return statusOf(queryVector(id, viewer, data));
    if (rest === "graphql") return statusOf(graphqlQuery(id, viewer, data.query || data));
    if (rest === "sql") return statusOf(runSql(id, viewer, data.sql || data.q || q.sql, { secret }));
    if (rest === "tx") return statusOf(runTransaction(id, viewer, { ops: data.ops, secret }));
    if (rest === "presence") {
      if (req.method === "POST") return statusOf(touchPresence(id, viewer, data));
      return statusOf(listPresence(id, viewer));
    }
    if (rest === "broadcast") return statusOf(broadcast(id, viewer, data));
    if (rest === "rpc") {
      if ((action === "create" || data.kind) && data.source) {
        return statusOf(createRpc(id, viewer, { name: data.name || data.fn || q.name, kind: data.kind, source: data.source }));
      }
      return statusOf(callRpc(id, viewer, data.name || data.fn || q.name, { ...data, secret }));
    }
    if (rest === "storage") {
      if (req.method === "POST") return statusOf(putObject(id, viewer, data));
      return statusOf(queryTable(id, viewer, "objects", {}));
    }
    if (rest === "wal") return statusOf(readWal(id, viewer, q));
    if (req.method === "GET") {
      const filters = parseRestQuery(q);
      return statusOf(queryTable(id, viewer, rest, { where: data.where || filters.where, limit: filters.limit || q.limit, select: filters.select || q.select, order: filters.order || q.order, offset: filters.offset || q.offset, secret }));
    }
    if (req.method === "PATCH" || req.method === "PUT" || action === "update") {
      return statusOf(updateRow(id, viewer, rest, data.id, data.patch || data.row, { secret }));
    }
    if (req.method === "DELETE" || action === "delete") {
      return statusOf(deleteRow(id, viewer, rest, data.id || q.id));
    }
    if (action === "insert" || req.method === "POST") {
      return statusOf(insertRow(id, viewer, rest, data.row || data, { secret, upsert: !!data.upsert }));
    }
  }
  return null;
}

export const LAYERS = [
  { supabase: "Postgres (dedicated cluster, WAL, extensions)", kiln: "Merkle is the proof. Query, SQL, transactions, indexes, and hooks sit on the tree. L1 settles the write." },
  { supabase: "GoTrue / JWT / RLS", kiln: "Handle+secret sessions. ML-DSA-65 wallet (FIPS 204). Row policy public|signed|private. Origin kiln is share-only." },
  { supabase: "PostgREST auto REST", kiln: "eq/neq/gt/gte/lt/lte/like/ilike/in/is/contains, select, order, upsert. Query string col=eq.value. Schema is the API." },
  { supabase: "pg_graphql", kiln: "POST /api/kiln/base/graphql — { docs { title } } or { docs: { where, select } }. Merkle stays the proof." },
  { supabase: "postgres-meta / Studio", kiln: "/api/kiln/base/meta + /base. Query console. Not a dashboard clone." },
  { supabase: "Realtime (Elixir, logical replication, websocket)", kiln: "WAL.jsonl + SSE + presence + broadcast. Every insert is an L1-ready event." },
  { supabase: "Storage / S3", kiln: "CAS sha256 buckets, list/delete, HMAC signed URLs. Same kiln:// isolation." },
  { supabase: "Edge Functions / Deno", kiln: "Per-repo computer. SQL/RPC/tx as functions. Agents are the edge." },
  { supabase: "pgvector", kiln: "64-d lattice embed + metadata filter. Cosine on the tree." },
  { supabase: "Supavisor pooler", kiln: "No pooler. Python watchers keep census when the document sleeps." },
  { supabase: "Kong / Envoy gateway", kiln: "One origin. Session bearer. kiln OSS is public-read, private trees stay hidden." },
  { supabase: "pgsodium / vault", kiln: "AES-256-GCM wrapped by ML-KEM-768 (FIPS 203). Key never hits disk." },
  { supabase: "pg_cron / database webhooks", kiln: "Python job_base_hooks + WAL webhook events. Mind observes mutations. Merkle is still the proof." },
  { supabase: "ECDSA / RSA wallets", kiln: "ML-DSA-65 signs the seat. ML-KEM-768 wraps the vault. Address is a commitment to the PQ public keys." },
];

export const BETTER = [
  "Merkle root is the proof. Query, SQL, tx, presence, and storage are systems on that root.",
  "Wallets are post-quantum. ML-DSA-65 + ML-KEM-768. Private keys never hit disk.",
  "Private rows encrypt under the seat. Superbase RLS still leaves plaintext in Postgres.",
  "Mutations settle on Kiln L1. Superbase has no chain.",
  "Isolation is kiln://owner/repo, not a shared cluster role.",
  "Agents write schema. Crew is the edge runtime.",
  "Origin kiln OSS is share-only. A signed-up user cannot mint or write kiln/*.",
  "No Studio clone. /base is the data plane, signed in for private trees.",
];

export function basePageHtml(repoId, origin, viewer) {
  const listed = listBases(viewer);
  const hidden = repoId && !canSeeBase(viewer, repoId);
  const focus = repoId && !hidden && canSeeBase(viewer, repoId) ? describeBase(repoId, viewer) : null;
  const acc = viewer ? loadAccount(viewer) : null;
  const rows = (listed.bases || [])
    .map((b) => `<li><a href="${esc(origin)}/base/${esc(b.repoId)}">${esc(b.repoId)}</a><span>${esc(b.visibility)} · ${(b.tables || []).join(", ")} · ${esc(b.merkle || "")}</span></li>`)
    .join("");
  const stats = focus?.stats
    ? Object.entries(focus.stats)
        .map(([k, v]) => `<div class="stat"><b>${esc(String(v.rows))}</b>${esc(k)}<em>${esc(v.policy)}</em></div>`)
        .join("")
    : "";
  const layers = LAYERS.map((l) => `<tr><td>${esc(l.supabase)}</td><td>${esc(l.kiln)}</td></tr>`).join("");
  const better = BETTER.map((b) => `<li>${esc(b)}</li>`).join("");
  const focusJson = focus && focus.ok ? JSON.stringify({ repoId: focus.repoId, merkle: focus.merkle, isolation: focus.isolation, write: focus.write, stats: focus.stats }) : "null";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Kiln Base${focus ? " · " + esc(focus.repoId) : ""}</title>
<style>
  :root{--bg:#09090b;--fg:#f4f4f5;--muted:#a1a1aa;--line:rgba(255,255,255,.12);--teal:#5eead4}
  html,body{margin:0;background:var(--bg);color:var(--fg);font-family:"IBM Plex Sans",system-ui,sans-serif}
  main{max-width:920px;margin:0 auto;padding:40px 20px 80px}
  a{color:var(--teal);text-decoration:none}
  .mono{letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:var(--muted)}
  ul{list-style:none;padding:0} li{padding:10px 0;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:4px}
  li span{color:var(--muted);font-size:13px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin:16px 0}
  .stat{padding:12px;border-radius:12px;box-shadow:0 0 0 1px var(--line)} .stat b{display:block;font-size:22px} .stat em{color:var(--muted);font-style:normal;font-size:11px}
  table{width:100%;border-collapse:collapse;font-size:13px} td{padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top} td:first-child{color:var(--muted);width:32%}
  .who{margin:8px 0 24px}
  pre{background:#121214;padding:14px;border-radius:12px;overflow:auto;font-size:12px;line-height:1.45}
  .better li{border:0;padding:6px 0}
  .console{display:flex;flex-direction:column;gap:8px;margin:16px 0 28px}
  .console textarea,.console input{background:#121214;color:var(--fg);border:0;box-shadow:0 0 0 1px var(--line);border-radius:12px;padding:12px;font:400 13px/1.4 ui-monospace,monospace}
  .console button{height:40px;border:0;border-radius:12px;background:#f4f4f5;color:#09090b;font:500 12px/1 IBM Plex Sans,system-ui;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;width:max-content;padding:0 16px}
</style></head>
<body><main>
  <p class="mono">Kiln Base</p>
  <h1 style="margin:8px 0 0;font:600 28px/1.2 IBM Plex Sans,system-ui">${focus && focus.ok ? esc(focus.repoId) : "Sovereign data plane"}</h1>
  <p class="who">${acc ? "@" + esc(acc.handle) + " · " + esc(acc.isolation || "kiln://" + acc.handle) : hidden ? "This tree is private. Sign in as the owner to open kiln://" + esc(repoId) + "." : "Public kiln OSS bases. Sign in for your trees."}</p>
  ${focus && focus.ok ? `<div id="kiln-base-focus">
  <p class="mono">${esc(focus.isolation)} · merkle ${esc(focus.merkle)} · cipher ${esc(focus.cipher)}</p>
  <p class="mono" id="kiln-base-presence" style="text-transform:none;letter-spacing:.04em"></p>
  <div class="grid">${stats}</div>
  <h2 class="mono">Query</h2>
  <div class="console">
    <input id="kiln-sql-repo" value="${esc(focus.repoId || "")}"/>
    <textarea id="kiln-sql" rows="3">select id, title, owner from docs limit 8</textarea>
    <button type="button" id="kiln-sql-go">Run</button>
  </div></div>` : `<div id="kiln-base-focus"></div>`}
  <h2 class="mono">Bases</h2>
  <ul id="kiln-base-list">${rows || "<li>None visible</li>"}</ul>
  <h2 class="mono">Superbase, then past it</h2>
  <table>${layers}</table>
  <ul class="better">${better}</ul>
  <p style="margin-top:28px;color:var(--muted);font-size:13px">Postgres is a rented cluster. Kiln Base is the tree: schema, rows, objects, and vectors merklized, vaulted, and isolated per repo.</p>
  <pre id="kiln-base-live">${esc(focusJson)}</pre>
  <p><a href="${esc(origin)}/">Open Kiln</a>${acc ? ` · <a href="${esc(origin)}/u/${esc(acc.handle)}">@${esc(acc.handle)}</a>` : ""}</p>
</main>
<script>
(function(){
  var tok = null;
  try { tok = sessionStorage.getItem("kiln-session") || sessionStorage.getItem("kiln-token"); } catch(e) {}
  var headers = { accept: "application/json", "content-type": "application/json" };
  if (tok) headers.authorization = "Bearer " + tok;
  var focus = ${JSON.stringify(repoId || "")};
  function bindRun(){
    var go = document.getElementById("kiln-sql-go");
    if (!go || go.getAttribute("data-bound")) return;
    go.setAttribute("data-bound", "1");
    go.addEventListener("click", function(){
      var repo = (document.getElementById("kiln-sql-repo") || {}).value || focus;
      var sql = (document.getElementById("kiln-sql") || {}).value || "";
      fetch("/api/kiln/base/sql", { method: "POST", headers: headers, body: JSON.stringify({ repoId: repo, sql: sql }) }).then(function(r){ return r.json(); }).then(function(d){
        var pre = document.getElementById("kiln-base-live");
        if (pre) pre.textContent = JSON.stringify(d, null, 2);
      }).catch(function(e){
        var pre = document.getElementById("kiln-base-live");
        if (pre) pre.textContent = String(e);
      });
    });
  }
  function paintFocus(d){
    if (!d || !d.ok) return;
    document.title = "Kiln Base · " + d.repoId;
    var h1 = document.querySelector("h1");
    if (h1) h1.textContent = d.repoId;
    var who = document.querySelector(".who");
    if (who) who.textContent = (d.isolation || ("kiln://" + d.repoId)) + (d.write ? " · write" : " · read");
    var mount = document.getElementById("kiln-base-focus");
    if (mount && !document.getElementById("kiln-sql-go")) {
      var stats = "";
      if (d.stats) Object.keys(d.stats).forEach(function(k){
        var s = d.stats[k] || {};
        stats += "<div class=\\"stat\\"><b>" + String(s.rows || 0) + "</b>" + k + "<em>" + (s.policy || "") + "</em></div>";
      });
      mount.innerHTML = "<p class=\\"mono\\">" + (d.isolation || "") + " · merkle " + (d.merkle || "") + " · cipher " + (d.cipher || "") + "</p>" +
        "<p class=\\"mono\\" id=\\"kiln-base-presence\\" style=\\"text-transform:none;letter-spacing:.04em\\"></p>" +
        "<div class=\\"grid\\">" + stats + "</div>" +
        "<h2 class=\\"mono\\">Query</h2><div class=\\"console\\">" +
        "<input id=\\"kiln-sql-repo\\" value=\\"" + String(d.repoId || "").replace(/"/g, "") + "\\"/>" +
        "<textarea id=\\"kiln-sql\\" rows=\\"3\\">select id, title, owner from docs limit 8</textarea>" +
        "<button type=\\"button\\" id=\\"kiln-sql-go\\">Run</button></div>";
    }
    bindRun();
    var pre = document.getElementById("kiln-base-live");
    if (pre) pre.textContent = JSON.stringify({ repoId: d.repoId, merkle: d.merkle, isolation: d.isolation, write: d.write, stats: d.stats }, null, 2);
  }
  if (tok) {
    fetch("/api/kiln/base", { headers: headers }).then(function(r){ return r.json(); }).then(function(d){
      if (!d || !d.ok) return;
      var ul = document.getElementById("kiln-base-list");
      if (!ul || !d.bases) return;
      ul.innerHTML = d.bases.map(function(b){
        return "<li><a href=\\"/base/" + encodeURIComponent(b.repoId).replace("%2F","/") + "\\">" + b.repoId + "</a><span>" + (b.visibility||"") + " · " + ((b.tables||[]).join(", ")) + "</span></li>";
      }).join("") || ul.innerHTML;
    }).catch(function(){});
  }
  bindRun();
  if (tok && focus) {
    var parts = String(focus).split("/");
    fetch("/api/kiln/base/" + encodeURIComponent(parts[0] || "") + "/" + encodeURIComponent(parts[1] || ""), { headers: headers }).then(function(r){ return r.json(); }).then(paintFocus).catch(function(){});
  }
  if (focus) {
    var esUrl = "/api/kiln/base/realtime?repo=" + encodeURIComponent(focus);
    if (tok) esUrl += "&token=" + encodeURIComponent(tok);
    try {
      var es = new EventSource(esUrl);
      es.onmessage = function(ev){
        try {
          var d = JSON.parse(ev.data);
          if (d && d.hello) return;
          var pre = document.getElementById("kiln-base-live");
          if (pre && d) pre.textContent = JSON.stringify(d, null, 2);
          var p = document.getElementById("kiln-base-presence");
          if (p && d && (d.handles || d.presence)) {
            var names = d.handles || (d.presence || []).map(function(x){ return x.handle; });
            p.textContent = "presence " + names.join(", ");
          }
        } catch (e) {}
      };
    } catch (e) {}
    fetch("/api/kiln/base/presence", { method: "POST", headers: headers, body: JSON.stringify({ repoId: focus, channel: "base" }) }).then(function(r){ return r.json(); }).then(function(d){
      var p = document.getElementById("kiln-base-presence");
      if (p && d && d.presence) p.textContent = "presence " + d.presence.map(function(x){ return x.handle; }).join(", ");
    }).catch(function(){});
  }
})();
</script>
</body></html>`;
}

export function BASE_TOOL() {
  return {
    name: "kiln_base",
    description: "Kiln Base data plane on a repo: schema, query, insert, vector search, graphql, rpc, storage. The tree is the database. Superbase, then past it.",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string" },
        action: { type: "string", description: "describe|query|insert|update|delete|vector|table|graphql|rpc|sql|tx|presence|broadcast|sign|edge|create_rpc|list" },
        table: { type: "string" },
        q: { type: "string" },
        sql: { type: "string" },
        row: { type: "object" },
        name: { type: "string" },
        kind: { type: "string" },
        source: { type: "string" },
        query: { type: "object" },
        ops: { type: "array" },
      },
      required: ["repo"],
    },
  };
}
