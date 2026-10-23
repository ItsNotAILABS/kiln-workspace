import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encodeRegistryCall,
  decodeCapabilities,
  decodeAgentGrantReturn,
  canonicalSignature,
  selectorOf,
  registryFunction,
  CAPABILITY_FLAGS,
} from "./capabilities.ts";

// Fixed fixture inputs for every vector below.
const PROJECT_ID = "0x1111111111111111111111111111111111111111111111111111111111111111";
const AGENT = "0x2222222222222222222222222222222222222222";
const EXPIRES_AT = 1900000000; // 0x713fb300

// Expected calldata was produced by `cast calldata` (foundry), NOT hand-written:
//   cast calldata "authorizeAgent(bytes32,address,uint256,uint64)" \
//     0x1111...1111 0x2222...2222 5 1900000000
const AUTHORIZE_VECTOR =
  "0xe29c462e" +
  "1111111111111111111111111111111111111111111111111111111111111111" +
  "0000000000000000000000002222222222222222222222222222222222222222" +
  "0000000000000000000000000000000000000000000000000000000000000005" +
  "00000000000000000000000000000000000000000000000000000000713fb300";

//   cast calldata "delegateGrant(bytes32,address,uint256,uint64)" \
//     0x1111...1111 0x2222...2222 9 1900000000
const DELEGATE_VECTOR =
  "0x40cfa8a7" +
  "1111111111111111111111111111111111111111111111111111111111111111" +
  "0000000000000000000000002222222222222222222222222222222222222222" +
  "0000000000000000000000000000000000000000000000000000000000000009" +
  "00000000000000000000000000000000000000000000000000000000713fb300";

//   cast calldata "revokeAuthorization(bytes32,address)" 0x1111...1111 0x2222...2222
const REVOKE_VECTOR =
  "0xcc1e6788" +
  "1111111111111111111111111111111111111111111111111111111111111111" +
  "0000000000000000000000002222222222222222222222222222222222222222";

// getAgentGrant return data for (capabilities=5, expiresAt=1900000000,
// parent=0x2222...2222), from `cast calldata "f(uint256,uint64,address)" 5
// 1900000000 0x2222...2222` with the 4-byte selector stripped.
const GRANT_RETURN_DATA =
  "0x" +
  "0000000000000000000000000000000000000000000000000000000000000005" +
  "00000000000000000000000000000000000000000000000000000000713fb300" +
  "0000000000000000000000002222222222222222222222222222222222222222";

describe("registry ABI (from the synced artifact)", () => {
  it("exposes the three grant actions with the real signatures", () => {
    assert.equal(canonicalSignature(registryFunction("authorizeAgent")), "authorizeAgent(bytes32,address,uint256,uint64)");
    assert.equal(canonicalSignature(registryFunction("delegateGrant")), "delegateGrant(bytes32,address,uint256,uint64)");
    assert.equal(canonicalSignature(registryFunction("revokeAuthorization")), "revokeAuthorization(bytes32,address)");
  });

  it("computes selectors matching `cast sig`", () => {
    assert.equal(selectorOf(registryFunction("authorizeAgent")), "0xe29c462e");
    assert.equal(selectorOf(registryFunction("delegateGrant")), "0x40cfa8a7");
    assert.equal(selectorOf(registryFunction("revokeAuthorization")), "0xcc1e6788");
  });
});

describe("encodeRegistryCall", () => {
  it("encodes authorizeAgent exactly like cast", () => {
    assert.equal(encodeRegistryCall("authorizeAgent", [PROJECT_ID, AGENT, 5, EXPIRES_AT]), AUTHORIZE_VECTOR);
  });

  it("encodes delegateGrant exactly like cast", () => {
    assert.equal(encodeRegistryCall("delegateGrant", [PROJECT_ID, AGENT, 9, EXPIRES_AT]), DELEGATE_VECTOR);
  });

  it("encodes revokeAuthorization exactly like cast", () => {
    assert.equal(encodeRegistryCall("revokeAuthorization", [PROJECT_ID, AGENT]), REVOKE_VECTOR);
  });

  it("rejects a bad address instead of encoding garbage", () => {
    assert.throws(() => encodeRegistryCall("authorizeAgent", [PROJECT_ID, "0x123", 5, EXPIRES_AT]), /invalid address/);
  });

  it("rejects a bad projectId instead of encoding garbage", () => {
    assert.throws(() => encodeRegistryCall("revokeAuthorization", ["kiln-workspace", AGENT]), /invalid bytes32/);
  });

  it("rejects arg-count mismatches", () => {
    assert.throws(() => encodeRegistryCall("authorizeAgent", [PROJECT_ID, AGENT]), /expects 4 args/);
  });

  it("rejects unknown functions", () => {
    assert.throws(() => encodeRegistryCall("mintOwnership", []), /no function/);
  });
});

describe("capability flags", () => {
  it("matches the contract constants CAP_COMMIT=1, CAP_RELEASE=2, CAP_PROPOSE=4, CAP_DELEGATE=8", () => {
    assert.deepEqual(CAPABILITY_FLAGS.map((f) => [f.name, f.bit]), [
      ["CAP_COMMIT", 1n],
      ["CAP_RELEASE", 2n],
      ["CAP_PROPOSE", 4n],
      ["CAP_DELEGATE", 8n],
    ]);
  });

  it("decodes mask 5 to CAP_COMMIT + CAP_PROPOSE", () => {
    const decoded = decodeCapabilities(5n);
    assert.deepEqual(decoded.map((d) => d.name), ["CAP_COMMIT", "CAP_PROPOSE"]);
  });

  it("decodes mask 0 to nothing", () => {
    assert.deepEqual(decodeCapabilities(0n), []);
  });

  it("marks unknown bits RESERVED instead of inventing names", () => {
    const decoded = decodeCapabilities(1n | 16n);
    assert.deepEqual(decoded.map((d) => d.name), ["CAP_COMMIT", "RESERVED"]);
    assert.equal(decoded[1].bit, 16n);
  });

  it("marks CAP_RELEASE/CAP_PROPOSE as not enforced on-chain", () => {
    const byName = Object.fromEntries(decodeCapabilities(15n).map((d) => [d.name, d]));
    assert.equal(byName.CAP_COMMIT.enforced, true);
    assert.equal(byName.CAP_DELEGATE.enforced, true);
    assert.equal(byName.CAP_RELEASE.enforced, false);
    assert.equal(byName.CAP_PROPOSE.enforced, false);
  });
});

describe("decodeAgentGrantReturn", () => {
  it("decodes the 3-field grant tuple (capabilities, expiresAt, parent)", () => {
    const grant = decodeAgentGrantReturn(GRANT_RETURN_DATA);
    assert.ok(grant);
    assert.equal(grant.capabilities, 5n);
    assert.equal(grant.expiresAt, 1900000000n);
    assert.equal(grant.parent, AGENT);
  });

  it("returns null on malformed data instead of inventing a grant", () => {
    assert.equal(decodeAgentGrantReturn("0x1234"), null);
    assert.equal(decodeAgentGrantReturn("not-hex"), null);
  });
});
