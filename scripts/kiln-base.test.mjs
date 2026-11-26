import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import {
  matchWhere,
  matchOp,
  ensureBase,
  insertRow,
  updateRow,
  deleteRow,
  queryTable,
  runSql,
  runTransaction,
  touchPresence,
  listPresence,
  createRpc,
  callRpc,
  rebuildIndexes,
  graphqlQuery,
  handleBaseApi,
  parseRestQuery,
} from "./kiln-base.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const REPO = "unitbase/ops";
const V = "unitbase";

function wipe() {
  const dir = path.join(ROOT, "data", "base", "unitbase");
  fs.rmSync(dir, { recursive: true, force: true });
}

test("matchWhere PostgREST operators", () => {
  assert.equal(matchWhere({ title: "Kiln Base" }, { title: { ilike: "%base%" } }), true);
  assert.equal(matchWhere({ title: "Kiln Base" }, { title: { like: "%sovereign%" } }), false);
  assert.equal(matchOp(5, { gt: 3, lt: 10 }), true);
  assert.equal(matchOp("a", { in: ["a", "b"] }), true);
  assert.equal(matchWhere({ a: 1, b: 2 }, { or: [{ a: 9 }, { b: 2 }] }), true);
  assert.equal(matchWhere({ n: 4 }, { n: { not: { eq: 4 } } }), false);
});

test("kiln origin is share-only; unsigned cannot write", () => {
  const deny = insertRow("kiln/kiln", V, "docs", { title: "no" });
  assert.equal(deny.ok, false);
  assert.equal(deny.error, "not your base");
  const anon = insertRow(REPO, null, "docs", { title: "no" });
  assert.equal(anon.ok, false);
});

test("query, unique, sql, tx, presence, rpc, indexes", () => {
  wipe();
  const seat = ensureBase(REPO, { visibility: "public", handle: V });
  assert.equal(seat.ok, true);
  const a = insertRow(REPO, V, "docs", { id: "a1", title: "Kiln Base sovereign", body: "merkle proof" });
  assert.equal(a.ok, true);
  insertRow(REPO, V, "docs", { id: "a2", title: "other", body: "x" });
  const like = queryTable(REPO, V, "docs", { where: { title: { ilike: "%base%" } } });
  assert.ok(like.rows.some((r) => r.id === "a1"));
  const eq = queryTable(REPO, V, "docs", { where: { id: { eq: "a2" } } });
  assert.equal(eq.rows.length, 1);
  const sql = runSql(REPO, V, "select id, title from docs limit 8");
  assert.equal(sql.ok, true);
  assert.ok(sql.rows.length >= 2);

  const u1 = insertRow(REPO, V, "objects", { bucket: "files", path: "x.bin", sha256: "aa" });
  assert.equal(u1.ok, true);
  const clash = insertRow(REPO, V, "objects", { bucket: "files", path: "x.bin", sha256: "bb" });
  assert.equal(clash.ok, false);
  assert.equal(clash.error, "path taken");
  const up = insertRow(REPO, V, "objects", { bucket: "files", path: "x.bin", sha256: "cc" }, { upsert: true });
  assert.equal(up.ok, true);

  const tx = runTransaction(REPO, V, {
    ops: [
      { op: "insert", table: "events", row: { id: "tx1", kind: "t" } },
      { op: "delete", table: "docs", id: "missing-will-fail" },
    ],
  });
  assert.equal(tx.ok, false);
  assert.equal(tx.rolled, true);
  const leftover = queryTable(REPO, V, "events", { where: { id: { eq: "tx1" } } });
  assert.equal(leftover.rows.length, 0);

  const okTx = runTransaction(REPO, V, {
    ops: [
      { op: "insert", table: "events", row: { id: "tx2", kind: "ok" } },
      { op: "update", table: "docs", id: "a2", patch: { title: "patched" } },
    ],
  });
  assert.equal(okTx.ok, true);

  const p = touchPresence(REPO, V, { channel: "base" });
  assert.equal(p.ok, true);
  assert.ok(p.presence.some((x) => x.handle === V));
  const listed = listPresence(REPO, V);
  assert.ok(listed.presence.length >= 1);

  const rpc = createRpc(REPO, V, { name: "echo", kind: "js", source: "globalThis.main = (a) => a;" });
  assert.equal(rpc.ok, true);
  const called = callRpc(REPO, V, "echo", { args: { hi: 1 } });
  assert.equal(called.ok, true);
  assert.equal(called.result?.hi, 1);

  const idx = rebuildIndexes(REPO);
  assert.equal(idx.ok, true);
  assert.ok(idx.indexes >= 1);
  const indexed = queryTable(REPO, V, "docs", { where: { owner: { eq: V } } });
  assert.equal(indexed.indexed, true);
  assert.ok(indexed.rows.length >= 1);

  const rest = parseRestQuery({ title: "eq.Kiln Base sovereign", select: "id,title" });
  assert.equal(rest.where.title.eq, "Kiln Base sovereign");
  const viaRest = handleBaseApi("/api/kiln/base/unitbase/ops/docs", {
    method: "GET",
    viewer: V,
    secret: "",
    query: { title: "ilike.%base%", select: "id,title" },
    bodyText: "{}",
  });
  assert.equal(viaRest.status, 200);
  assert.ok((viaRest.body.rows || []).some((r) => r.id === "a1"));

  const gql = graphqlQuery(REPO, V, "{ docs { title } }");
  assert.equal(gql.ok, true);
  assert.ok(Array.isArray(gql.data.docs));
  assert.ok("title" in (gql.data.docs[0] || {}));

  const orSql = runSql(REPO, V, "select id, title from docs where title = 'other' or title ilike '%base%'");
  assert.equal(orSql.ok, true);
  assert.ok(orSql.rows.length >= 2);

  const inSql = runSql(REPO, V, "select id from docs where id in ('a1','a2')");
  assert.equal(inSql.ok, true);
  assert.equal(inSql.rows.length, 2);

  const clashUp = updateRow(REPO, V, "objects", up.row.id, { path: "y.bin", bucket: "files" });
  assert.equal(clashUp.ok, true);
  const other = insertRow(REPO, V, "objects", { bucket: "files", path: "z.bin", sha256: "dd" });
  assert.equal(other.ok, true);
  const taken = updateRow(REPO, V, "objects", other.row.id, { path: "y.bin", bucket: "files" });
  assert.equal(taken.ok, false);
  assert.equal(taken.error, "path taken");

  const gone = deleteRow(REPO, V, "docs", "a2", { silent: true });
  assert.equal(gone.ok, true);
  wipe();
});

test("private rows encrypt, fail closed, never wipe ciphertext", () => {
  const PRIV = "unitbase/priv";
  const dir = path.join(ROOT, "data", "base", "unitbase");
  fs.rmSync(dir, { recursive: true, force: true });
  const seat = ensureBase(PRIV, { visibility: "private", handle: V });
  assert.equal(seat.ok, true);
  const secret = "unit-row-secret-01";
  const ins = insertRow(PRIV, V, "docs", { id: "p1", title: "sealed title", body: "secret body" }, { secret });
  assert.equal(ins.ok, true);
  assert.equal(ins.row.title, "sealed title");
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "priv", "tables", "docs.json"), "utf8"));
  const stored = (raw.rows || []).find((r) => r.id === "p1");
  assert.ok(stored._enc);
  assert.equal(stored.title, undefined);
  const closed = queryTable(PRIV, V, "docs", { where: { id: { eq: "p1" } } });
  assert.equal(closed.rows[0].title, undefined);
  assert.equal(closed.rows[0]._sealed, true);
  const open = queryTable(PRIV, V, "docs", { where: { id: { eq: "p1" } }, secret });
  assert.equal(open.rows[0].title, "sealed title");
  const wipeTry = updateRow(PRIV, V, "docs", "p1", { title: "hacked" });
  assert.equal(wipeTry.ok, false);
  assert.equal(wipeTry.error, "row sealed");
  const still = JSON.parse(fs.readFileSync(path.join(dir, "priv", "tables", "docs.json"), "utf8"));
  const after = (still.rows || []).find((r) => r.id === "p1");
  assert.ok(after._enc);
  assert.notEqual(after._enc, true);
  const patched = updateRow(PRIV, V, "docs", "p1", { title: "opened" }, { secret });
  assert.equal(patched.ok, true);
  assert.equal(patched.row.title, "opened");
  fs.rmSync(dir, { recursive: true, force: true });
});
