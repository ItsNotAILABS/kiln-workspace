import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RESERVED_OWNER_NAMES, isKnownOwnerName, isReservedOwnerName } from "./reserved.ts";

// Regression tests for the /$owner route trap: reserved top-level route names
// (signin, settings, …) must never render as fabricated user profiles.

describe("isReservedOwnerName", () => {
  it("flags signin and settings", () => {
    assert.equal(isReservedOwnerName("signin"), true);
    assert.equal(isReservedOwnerName("settings"), true);
  });

  it("is case-insensitive", () => {
    assert.equal(isReservedOwnerName("SignIn"), true);
    assert.equal(isReservedOwnerName("SETTINGS"), true);
    assert.equal(isReservedOwnerName("Wallet"), true);
  });

  it("reserves the auth sign-in path even though no route file exists yet", () => {
    // src/lib/auth/gates.tsx SIGN_IN_PATH = "/login"
    assert.equal(isReservedOwnerName("login"), true);
  });

  it("does not flag real handles", () => {
    assert.equal(isReservedOwnerName("auro"), false);
    assert.equal(isReservedOwnerName("kiln-labs"), false);
    assert.equal(isReservedOwnerName("you"), false);
    assert.equal(isReservedOwnerName("octocat"), false);
  });
});

describe("isKnownOwnerName", () => {
  const known = {
    seedHandles: ["kiln-labs", "meridian"],
    repoOwners: ["kiln-labs", "itsnotailabs", "freddycreates"],
    walletHandle: "you",
  };
  it("accepts seeded profiles, repo owners, and the wallet handle", () => {
    assert.equal(isKnownOwnerName("kiln-labs", known), true);
    assert.equal(isKnownOwnerName("meridian", known), true);
    assert.equal(isKnownOwnerName("itsnotailabs", known), true);
    assert.equal(isKnownOwnerName("freddycreates", known), true);
    assert.equal(isKnownOwnerName("you", known), true);
  });

  it("is case-insensitive", () => {
    assert.equal(isKnownOwnerName("Kiln-Labs", known), true);
    assert.equal(isKnownOwnerName("YOU", known), true);
  });

  it("rejects arbitrary handles", () => {
    assert.equal(isKnownOwnerName("does-not-exist-xyz", known), false);
    assert.equal(isKnownOwnerName("signin", known), false);
    assert.equal(isKnownOwnerName("", known), false);
  });

  it("works without a wallet", () => {
    assert.equal(isKnownOwnerName("you", { ...known, walletHandle: null }), false);
    assert.equal(isKnownOwnerName("kiln-labs", { ...known, walletHandle: null }), true);
  });
});

describe("RESERVED_OWNER_NAMES coverage", () => {
  it("covers every top-level static route segment in src/routes/", () => {
    const routesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "routes");
    const files = readdirSync(routesDir).filter((f) => f.endsWith(".tsx"));
    const missing: string[] = [];
    for (const f of files) {
      const base = f.replace(/\.tsx$/, "");
      if (base === "__root" || base === "index") continue;
      // gists.$id -> gists, topics.$slug -> topics
      const segment = base.split(".$")[0];
      if (!RESERVED_OWNER_NAMES.has(segment)) missing.push(segment);
    }
    assert.deepEqual(missing, [], `top-level routes missing from RESERVED_OWNER_NAMES: ${missing.join(", ")}`);
  });

  it("every reserved name is a plausible single path segment", () => {
    for (const name of RESERVED_OWNER_NAMES) {
      assert.match(name, /^[a-z0-9-]+$/, `reserved name must be a clean path segment: ${name}`);
    }
  });
});
