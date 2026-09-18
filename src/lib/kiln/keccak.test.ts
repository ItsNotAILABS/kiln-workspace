import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keccak256Utf8, functionSelector } from "./keccak.ts";

// Reference vectors from `cast keccak` (foundry) — never hand-computed.
describe("keccak256", () => {
  it("hashes the empty string to the reference vector", () => {
    assert.equal(
      keccak256Utf8(""),
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    );
  });

  it("hashes 'abc' to the reference vector", () => {
    assert.equal(
      keccak256Utf8("abc"),
      "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
    );
  });

  it("derives the authorizeAgent selector matching `cast sig`", () => {
    // cast sig "authorizeAgent(bytes32,address,uint256,uint64)" -> 0xe29c462e
    assert.equal(functionSelector("authorizeAgent(bytes32,address,uint256,uint64)"), "0xe29c462e");
  });

  it("derives the delegateGrant selector matching `cast sig`", () => {
    // cast sig "delegateGrant(bytes32,address,uint256,uint64)" -> 0x40cfa8a7
    assert.equal(functionSelector("delegateGrant(bytes32,address,uint256,uint64)"), "0x40cfa8a7");
  });

  it("derives the revokeAuthorization selector matching `cast sig`", () => {
    // cast sig "revokeAuthorization(bytes32,address)" -> 0xcc1e6788
    assert.equal(functionSelector("revokeAuthorization(bytes32,address)"), "0xcc1e6788");
  });
});
