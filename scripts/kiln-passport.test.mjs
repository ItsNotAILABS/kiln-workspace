import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mintPassport, getPassport, ensurePassport, passportSvg } from "./kiln-badge.mjs";

test("kiln origin cannot hold a passport", async () => {
  const out = await mintPassport({ handle: "kiln", displayName: "KILN" });
  assert.equal(out.ok, false);
});

test("passport token is one per seat and art lands", async () => {
  const handle = "unitpass";
  const first = await mintPassport({
    handle,
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    pqAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    displayName: "Unit Pass",
    isolation: "kiln://unitpass",
    scheme: "ml-dsa-65+ml-kem-768",
  });
  assert.equal(first.ok, true);
  assert.equal(first.kind, "passport");
  assert.equal(first.owner, handle);
  assert.ok(first.claimsMerkle?.startsWith("0x"));
  assert.ok(first.jpg);
  const jpg = path.join("/workspace", "public", first.jpg);
  assert.equal(fs.existsSync(jpg), true);
  const svg = passportSvg(first);
  assert.match(svg, /KILN PASSPORT/);
  assert.match(svg, /TYPE P/);
  assert.match(svg, /@unitpass/);
  const again = await ensurePassport({ handle, pqAddress: first.pqAddress });
  assert.equal(again.created, false);
  assert.equal(again.token, first.token);
  const loaded = getPassport(handle);
  assert.equal(loaded.token, first.token);
});
