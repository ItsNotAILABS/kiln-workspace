#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiln-gov-"));
process.env.KILN_STATE_ROOT = root;
const gov = await import("./kiln-governance.mjs");

const repoId = "kiln/research-test";
const evidence = gov.putEvidence({ repoId, content: "minority proof: boundary must remain owner-controlled", source: "test" });
assert.match(evidence.digest, /^[a-f0-9]{64}$/);

const capsule = gov.compileCapsule({
  repoId,
  objective: "Review a proposed source change without receiving parent private context",
  role: "reviewer",
  principalId: "owner:test",
  contextOwner: "owner:test",
  modelId: "test-model",
  constraints: ["no irreversible action", "preserve dissent"],
  evidenceRefs: [evidence.digest],
  expectedPostconditions: ["review receipt exists"],
  budget: { maxInputTokens: 1200, maxOutputTokens: 600, timeoutMs: 5000, maxToolCalls: 4 },
});
assert.equal(gov.validateCapsule(capsule).ok, true);
assert.equal(Object.prototype.hasOwnProperty.call(capsule, "parentPrivateContext"), false);

const proposalHash = gov.sha256({ action: "commit", path: "src/example.js", contentHash: gov.sha256("export const ok = true;\n") });
const approval = gov.issueApproval({
  repoId,
  capsuleHash: capsule.capsuleHash,
  proposalHash,
  approverId: "owner:test",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  scope: ["commit"],
});
assert.equal(gov.validateApproval(approval, { capsuleHash: capsule.capsuleHash, proposalHash, requiredScope: "commit" }).ok, true);
assert.equal(gov.validateApproval(approval, { capsuleHash: capsule.capsuleHash, proposalHash: gov.sha256("tampered"), requiredScope: "commit" }).ok, false);

gov.recordDissent({ repoId, capsuleHash: capsule.capsuleHash, source: "reviewer:minority", claim: "retain the negative control", evidenceRefs: [evidence.digest] });
const r1 = gov.sealReceipt({ repoId, event: "proposal_approved", actorId: "owner:test", capsuleHash: capsule.capsuleHash, proposalHash, approvalHash: approval.approvalHash, artifactHashes: [evidence.digest] });
const r2 = gov.sealReceipt({ repoId, event: "validation_complete", actorId: "reviewer:test", capsuleHash: capsule.capsuleHash, proposalHash, approvalHash: approval.approvalHash, artifactHashes: [evidence.digest], dissent: [{ source: "reviewer:minority", claim: "retain the negative control", evidenceRefs: [evidence.digest] }] });
assert.equal(r2.previousHash, r1.receiptHash);
const chain = gov.verifyReceiptChain({ repoId });
assert.equal(chain.ok, true);
assert.equal(chain.count, 2);

console.log(JSON.stringify({ ok: true, repoId, capsuleHash: capsule.capsuleHash, proposalHash, approvalHash: approval.approvalHash, receiptHead: chain.head, evidenceDigest: evidence.digest }, null, 2));
