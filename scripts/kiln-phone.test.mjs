import test from "node:test";
import assert from "node:assert/strict";
import { handleLoop } from "./kiln-loop.mjs";

test("a phone model can open the API and call a tool without MCP", async () => {
  const card = await handleLoop("/api/kiln/loop", {
    method: "GET",
    query: {},
    bodyText: "",
    authorization: "",
    origin: "https://kiln.example",
  });
  const phone = JSON.parse(card.body);
  assert.equal(phone.ok, true);
  assert.deepEqual(phone.for, ["muse", "claude", "phone"]);
  assert.equal(phone.api, "https://kiln.example/api/kiln/loop");
  assert.match(phone.clients.muse.notLocal, /127\.0\.0\.1:8787/);
  assert.equal(phone.clients.muse.mcp_servers.kiln.url.includes("8787"), false);
  assert.equal(phone.publicForge.live, false);
  assert.match(phone.publicForge.note, /Hello World/);

  const map = await handleLoop("/api/kiln/loop", {
    method: "POST",
    query: {},
    bodyText: JSON.stringify({ tool: "map" }),
    authorization: "",
    origin: "https://kiln.example",
  });
  const pages = JSON.parse(map.body);
  assert.equal(pages.pages.some((page) => page.path === "/studio"), true);
});
