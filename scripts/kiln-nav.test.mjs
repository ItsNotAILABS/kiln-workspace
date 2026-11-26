import test from "node:test";
import assert from "node:assert/strict";
import { openPage, siteMap } from "./kiln-nav.mjs";

test("every mode shares one map, and a closed page sends you to login", () => {
  const map = siteMap("https://kiln.example");
  assert.equal(map.modes.length, 6);
  assert.equal(map.pages.some((page) => page.path === "/studio"), true);
  assert.equal(map.pages.every((page) => page.landmark.includes("data-kiln-go")), true);
  const login = openPage({ path: "/login", origin: "https://kiln.example" });
  assert.equal(login.ok, true);
  assert.equal(login.url, "https://kiln.example/login");
  const studio = openPage({ path: "/studio", origin: "https://kiln.example" });
  assert.equal(studio.signedIn, false);
  assert.match(studio.next, /\/login\?next=%2Fstudio/);
  const missing = openPage({ path: "/no-such-room" });
  assert.equal(missing.ok, false);
  const forge = openPage({ path: "/explore" });
  assert.ok(forge.data.forge.length >= 1);
});
