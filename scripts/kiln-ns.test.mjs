import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runInNamespace } from "./kiln-ns.mjs";
import { createRpc, callRpc, ensureBase } from "./kiln-base.mjs";
import { loginAccount, sessionPq, markSessionPq } from "./kiln-accounts.mjs";
import { setTwoFactor, twoFactorOn } from "./kiln-security.mjs";
import { runOnComputer } from "./agent-turn.mjs";

const TREE = "/workspace/computers/itsnotailabs_home";

test("namespace hides other seats and the session plane", () => {
  const py = `
import os, json
hits = {}
for p in [
  "/workspace/data/sessions.json",
  "/workspace/data/accounts/itsnotailabs.json",
  "/workspace/computers/itsnotailabs_kiln/COMPUTER.md",
  "/workspace/scripts/kiln-accounts.mjs",
]:
    hits[p] = os.path.exists(p)
print(json.dumps({"agent": os.path.exists("AGENT.md") or os.path.exists("COMPUTER.md"), "hits": hits, "cwd": os.getcwd()}))
`;
  fs.writeFileSync(path.join(TREE, ".kiln-ns-probe.py"), py);
  const r = runInNamespace(TREE, "python3", [".kiln-ns-probe.py"], { timeout: 8000 });
  assert.equal(r.ok, true, r.err);
  const j = JSON.parse(String(r.out).trim().split("\n").at(-1));
  assert.equal(j.agent, true);
  assert.equal(j.hits["/workspace/data/sessions.json"], false);
  assert.equal(j.hits["/workspace/data/accounts/itsnotailabs.json"], false);
  assert.equal(j.hits["/workspace/computers/itsnotailabs_kiln/COMPUTER.md"], false);
  assert.equal(j.hits["/workspace/scripts/kiln-accounts.mjs"], false);
});

test("edge rpc is namespaced and owner-only", () => {
  ensureBase("itsnotailabs/home", { visibility: "private", handle: "itsnotailabs" });
  const rpc = createRpc("itsnotailabs/home", "itsnotailabs", {
    name: "nsprobe",
    kind: "py",
    source: "def main(a):\n    import os\n    return {'hidden': not os.path.exists('/workspace/data/sessions.json'), 'ok': True}\n",
  });
  assert.equal(rpc.ok, true);
  const anon = callRpc("itsnotailabs/home", null, "nsprobe", { args: {} });
  assert.equal(anon.ok, false);
  const called = callRpc("itsnotailabs/home", "itsnotailabs", "nsprobe", { args: {} });
  assert.equal(called.ok, true, called.err);
  assert.equal(called.ns, true);
  assert.equal(called.result?.hidden, true);
});

test("python on the computer reports namespace cwd", async () => {
  const out = await runOnComputer({
    repoId: "itsnotailabs/home",
    lang: "python",
    source: "print('ns-ok')\n",
    viewer: "itsnotailabs",
  });
  assert.equal(out.ok, true, out.err);
  assert.equal(out.ns, true);
  assert.match(String(out.out), /ns-ok/);
  assert.equal(out.cwd, "kiln://itsnotailabs/home");
});

test("two-factor marks the session after attest", () => {
  const login = loginAccount({ handle: "itsnotailabs", secret: "Medina-Lattice-1848!" });
  assert.equal(login.ok, true);
  assert.equal(sessionPq(login.token), false);
  const marked = markSessionPq(login.token);
  assert.equal(marked.ok, true);
  assert.equal(sessionPq(login.token), true);
  const on = setTwoFactor("itsnotailabs", true);
  assert.equal(on.twoFactor, true);
  assert.equal(twoFactorOn("itsnotailabs"), true);
});
