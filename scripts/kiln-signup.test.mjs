import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { openAgentSeat, seatFromProvider } from "./kiln-signup.mjs";
import { spaceHome } from "./kiln-space.mjs";
import { readCrew } from "./kiln-ingest.mjs";

function cleanup(handle) {
  fs.rmSync(path.join("data", "accounts", `${handle}.json`), { force: true });
  fs.rmSync(spaceHome(`${handle}/home`), { recursive: true, force: true });
}

test("an agent opens a seat and can see the forge", () => {
  const handle = `agent${process.pid}`.slice(0, 24);
  const seat = openAgentSeat({ handle, name: "Muse", via: "agent" });
  assert.equal(seat.ok, true);
  assert.equal(seat.created, true);
  assert.equal(seat.home, `${handle}/home`);
  assert.ok(seat.secret.length >= 12);
  assert.ok(seat.sight.forge.length >= 1);
  assert.ok(seat.sight.memory.includes(seat.home));
  const crew = readCrew(seat.home);
  assert.equal(crew.members.some((member) => member.name === "Muse"), true);
  const again = openAgentSeat({ handle, name: "Muse" });
  assert.equal(again.ok, false);
  cleanup(handle);
});

test("the same GitHub user resumes the seat and the token is not kept", async () => {
  const id = String(process.pid);
  const lookup = async () => ({ ok: true, id, login: `gh${process.pid}`, name: "Git Hub" });
  const first = await seatFromProvider({ provider: "github", token: "github-token-not-stored", lookup });
  assert.equal(first.ok, true);
  assert.equal(first.created, true);
  assert.equal(first.secretShown, true);
  assert.equal(JSON.stringify(first).includes("github-token-not-stored"), false);
  const second = await seatFromProvider({ provider: "github", token: "another-github-token", lookup });
  assert.equal(second.ok, true);
  assert.equal(second.created, false);
  assert.equal(second.secret, "");
  assert.equal(second.account.handle, first.account.handle);
  cleanup(first.account.handle);
  const idents = path.join("data", "seats", "identities.json");
  const doc = JSON.parse(fs.readFileSync(idents, "utf8"));
  delete doc[`github:${id}`];
  fs.writeFileSync(idents, JSON.stringify(doc, null, 2));
});
