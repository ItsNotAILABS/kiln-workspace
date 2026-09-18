/**
 * KILN governed execution substrate.
 *
 * Implements the Capsulae Rationis invariants as runtime objects:
 * - one context owner; workers receive bounded capsules
 * - content-addressed evidence
 * - explicit budgets and postconditions
 * - disagreement preservation
 * - approval binding
 * - durable hash-linked receipts
 *
 * This module does not sign wallet transactions. Financial/on-chain signing remains
 * outside the agent runtime and must be performed by an authenticated wallet/custody lane.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STATE_ROOT = process.env.KILN_STATE_ROOT || path.join(os.homedir(), ".kiln", "governance");
const CAPSULE_VERSION = "kiln.capsule.v1";
const RECEIPT_VERSION = "kiln.receipt.v1";
const APPROVAL_VERSION = "kiln.approval.v1";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}

export function sha256(value) {
  const body = typeof value === "string" ? value : JSON.stringify(canonical(value));
  return createHash("sha256").update(body).digest("hex");
}

function safeId(value, fallback = "default") {
  const out = String(value || fallback).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return out || fallback;
}

function repoDir(repoId) {
  const dir = path.join(STATE_ROOT, safeId(repoId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function appendJsonl(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + "\n", { encoding: "utf8", mode: 0o600 });
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function putEvidence({ repoId, content, mediaType = "text/plain", source = "runtime", visibility = "private" }) {
  if (typeof content !== "string" || !content.length) throw new Error("evidence content required");
  if (!['private','shared','public'].includes(visibility)) throw new Error("invalid evidence visibility");
  const digest = sha256(content);
  const dir = path.join(repoDir(repoId), "evidence");
  fs.mkdirSync(dir, { recursive: true });
  const bodyPath = path.join(dir, `${digest}.blob`);
  const metaPath = path.join(dir, `${digest}.json`);
  if (!fs.existsSync(bodyPath)) fs.writeFileSync(bodyPath, content, { encoding: "utf8", mode: 0o600 });
  const meta = {
    schema: "kiln.evidence.v1",
    repoId,
    digest,
    bytes: Buffer.byteLength(content),
    mediaType,
    source,
    visibility,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), { encoding: "utf8", mode: 0o600 });
  return meta;
}

export function getEvidence({ repoId, digest }) {
  if (!/^[a-f0-9]{64}$/.test(String(digest || ""))) throw new Error("invalid evidence digest");
  const dir = path.join(repoDir(repoId), "evidence");
  const bodyPath = path.join(dir, `${digest}.blob`);
  const metaPath = path.join(dir, `${digest}.json`);
  if (!fs.existsSync(bodyPath) || !fs.existsSync(metaPath)) return null;
  return { ...JSON.parse(fs.readFileSync(metaPath, "utf8")), content: fs.readFileSync(bodyPath, "utf8") };
}

export function compileCapsule(input = {}) {
  const required = ["repoId", "objective", "role", "principalId", "modelId"];
  for (const key of required) if (!String(input[key] || "").trim()) throw new Error(`${key} required`);
  const budget = {
    maxInputTokens: Math.max(1, Math.min(Number(input.budget?.maxInputTokens || 8192), 1_000_000)),
    maxOutputTokens: Math.max(1, Math.min(Number(input.budget?.maxOutputTokens || 4096), 250_000)),
    timeoutMs: Math.max(100, Math.min(Number(input.budget?.timeoutMs || 60_000), 3_600_000)),
    maxToolCalls: Math.max(0, Math.min(Number(input.budget?.maxToolCalls ?? 24), 10_000)),
  };
  const evidenceRefs = [...new Set((input.evidenceRefs || []).map(String))].sort();
  for (const digest of evidenceRefs) {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`invalid evidence reference ${digest}`);
    if (!getEvidence({ repoId: input.repoId, digest })) throw new Error(`missing evidence ${digest}`);
  }
  const capsule = {
    schema: CAPSULE_VERSION,
    capsuleId: input.capsuleId || randomUUID(),
    repoId: String(input.repoId),
    parentTaskId: input.parentTaskId ? String(input.parentTaskId) : null,
    principalId: String(input.principalId),
    contextOwner: String(input.contextOwner || input.principalId),
    role: String(input.role),
    modelId: String(input.modelId),
    objective: String(input.objective),
    constraints: (input.constraints || []).map(String),
    evidenceRefs,
    outputSchema: input.outputSchema || { type: "object" },
    expectedPostconditions: (input.expectedPostconditions || []).map(String),
    budget,
    policyVersion: String(input.policyVersion || "kiln-policy-v1"),
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt || null,
  };
  capsule.capsuleHash = sha256(capsule);
  const file = path.join(repoDir(capsule.repoId), "capsules.jsonl");
  appendJsonl(file, capsule);
  return capsule;
}

export function validateCapsule(capsule, { now = Date.now() } = {}) {
  if (!capsule || capsule.schema !== CAPSULE_VERSION) return { ok: false, reason: "schema" };
  const claimed = capsule.capsuleHash;
  const copy = { ...capsule };
  delete copy.capsuleHash;
  if (sha256(copy) !== claimed) return { ok: false, reason: "hash_mismatch" };
  if (capsule.expiresAt && Date.parse(capsule.expiresAt) <= now) return { ok: false, reason: "expired" };
  for (const digest of capsule.evidenceRefs || []) {
    if (!getEvidence({ repoId: capsule.repoId, digest })) return { ok: false, reason: `missing_evidence:${digest}` };
  }
  return { ok: true, reason: "valid" };
}

export function issueApproval({ repoId, capsuleHash, proposalHash, approverId, expiresAt, scope = ["commit"] }) {
  for (const [name, value] of Object.entries({ repoId, capsuleHash, proposalHash, approverId, expiresAt })) {
    if (!String(value || "").trim()) throw new Error(`${name} required`);
  }
  if (!/^[a-f0-9]{64}$/.test(capsuleHash) || !/^[a-f0-9]{64}$/.test(proposalHash)) throw new Error("invalid bound hash");
  if (Date.parse(expiresAt) <= Date.now()) throw new Error("approval must expire in the future");
  const approval = {
    schema: APPROVAL_VERSION,
    approvalId: randomUUID(),
    repoId,
    capsuleHash,
    proposalHash,
    approverId,
    scope: [...new Set(scope.map(String))].sort(),
    issuedAt: new Date().toISOString(),
    expiresAt,
  };
  approval.approvalHash = sha256(approval);
  appendJsonl(path.join(repoDir(repoId), "approvals.jsonl"), approval);
  return approval;
}

export function validateApproval(approval, { capsuleHash, proposalHash, requiredScope, now = Date.now() } = {}) {
  if (!approval || approval.schema !== APPROVAL_VERSION) return { ok: false, reason: "schema" };
  const claimed = approval.approvalHash;
  const copy = { ...approval };
  delete copy.approvalHash;
  if (sha256(copy) !== claimed) return { ok: false, reason: "hash_mismatch" };
  if (approval.capsuleHash !== capsuleHash) return { ok: false, reason: "capsule_binding" };
  if (approval.proposalHash !== proposalHash) return { ok: false, reason: "proposal_binding" };
  if (Date.parse(approval.expiresAt) <= now) return { ok: false, reason: "expired" };
  if (requiredScope && !(approval.scope || []).includes(requiredScope)) return { ok: false, reason: "scope" };
  return { ok: true, reason: "valid" };
}

export function sealReceipt({ repoId, event, actorId, capsuleHash = null, proposalHash = null, approvalHash = null, artifactHashes = [], details = {}, dissent = [] }) {
  if (!repoId || !event || !actorId) throw new Error("repoId, event, actorId required");
  const file = path.join(repoDir(repoId), "receipts.jsonl");
  const existing = readJsonl(file);
  const previousHash = existing.length ? existing[existing.length - 1].receiptHash : "GENESIS";
  const receipt = {
    schema: RECEIPT_VERSION,
    receiptId: randomUUID(),
    repoId,
    sequence: existing.length + 1,
    event,
    actorId,
    capsuleHash,
    proposalHash,
    approvalHash,
    artifactHashes: [...new Set(artifactHashes.map(String))].sort(),
    dissent: (dissent || []).map((item) => ({ source: String(item.source || "unknown"), claim: String(item.claim || ""), evidenceRefs: (item.evidenceRefs || []).map(String) })),
    details,
    previousHash,
    createdAt: new Date().toISOString(),
  };
  receipt.receiptHash = sha256(receipt);
  appendJsonl(file, receipt);
  return receipt;
}

export function verifyReceiptChain({ repoId }) {
  const receipts = readJsonl(path.join(repoDir(repoId), "receipts.jsonl"));
  let previous = "GENESIS";
  for (let i = 0; i < receipts.length; i += 1) {
    const receipt = receipts[i];
    const claimed = receipt.receiptHash;
    const copy = { ...receipt };
    delete copy.receiptHash;
    if (receipt.previousHash !== previous) return { ok: false, index: i, reason: "previous_hash" };
    if (sha256(copy) !== claimed) return { ok: false, index: i, reason: "receipt_hash" };
    previous = claimed;
  }
  return { ok: true, count: receipts.length, head: previous };
}

export function recordDissent({ repoId, capsuleHash, source, claim, evidenceRefs = [] }) {
  if (!repoId || !capsuleHash || !source || !claim) throw new Error("repoId, capsuleHash, source, claim required");
  const item = {
    schema: "kiln.dissent.v1",
    dissentId: randomUUID(),
    repoId,
    capsuleHash,
    source,
    claim,
    evidenceRefs: evidenceRefs.map(String),
    createdAt: new Date().toISOString(),
  };
  item.dissentHash = sha256(item);
  appendJsonl(path.join(repoDir(repoId), "dissent.jsonl"), item);
  return item;
}

export const GOVERNANCE_TOOLS = [
  { name: "kiln_evidence_put", description: "Store evidence by SHA-256 and return a content-addressed reference.", inputSchema: { type: "object", properties: { repoId: { type: "string" }, content: { type: "string" }, mediaType: { type: "string" }, source: { type: "string" }, visibility: { type: "string" } }, required: ["repoId", "content"] } },
  { name: "kiln_capsule_compile", description: "Compile a bounded task capsule with objective, role, model, evidence references, schema, budget and policy hash.", inputSchema: { type: "object", properties: { repoId: { type: "string" }, objective: { type: "string" }, role: { type: "string" }, principalId: { type: "string" }, modelId: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, evidenceRefs: { type: "array", items: { type: "string" } }, budget: { type: "object" }, expectedPostconditions: { type: "array", items: { type: "string" } } }, required: ["repoId", "objective", "role", "principalId", "modelId"] } },
  { name: "kiln_approval_issue", description: "Create a local approval record cryptographically bound to capsule and proposal hashes. This is not a wallet signature.", inputSchema: { type: "object", properties: { repoId: { type: "string" }, capsuleHash: { type: "string" }, proposalHash: { type: "string" }, approverId: { type: "string" }, expiresAt: { type: "string" }, scope: { type: "array", items: { type: "string" } } }, required: ["repoId", "capsuleHash", "proposalHash", "approverId", "expiresAt"] } },
  { name: "kiln_receipt_seal", description: "Append a durable hash-linked execution receipt while preserving dissent and artifact hashes.", inputSchema: { type: "object", properties: { repoId: { type: "string" }, event: { type: "string" }, actorId: { type: "string" }, capsuleHash: { type: "string" }, proposalHash: { type: "string" }, approvalHash: { type: "string" }, artifactHashes: { type: "array", items: { type: "string" } }, details: { type: "object" }, dissent: { type: "array" } }, required: ["repoId", "event", "actorId"] } },
  { name: "kiln_receipt_verify", description: "Verify the local KILN receipt hash chain for one repository.", inputSchema: { type: "object", properties: { repoId: { type: "string" } }, required: ["repoId"] } },
  { name: "kiln_dissent_record", description: "Persist a minority or conflicting conclusion instead of silently averaging it away.", inputSchema: { type: "object", properties: { repoId: { type: "string" }, capsuleHash: { type: "string" }, source: { type: "string" }, claim: { type: "string" }, evidenceRefs: { type: "array", items: { type: "string" } } }, required: ["repoId", "capsuleHash", "source", "claim"] } },
];

export async function runGovernanceTool(name, args = {}) {
  switch (name) {
    case "kiln_evidence_put": return putEvidence(args);
    case "kiln_capsule_compile": return compileCapsule(args);
    case "kiln_approval_issue": return issueApproval(args);
    case "kiln_receipt_seal": return sealReceipt(args);
    case "kiln_receipt_verify": return verifyReceiptChain(args);
    case "kiln_dissent_record": return recordDissent(args);
    default: throw new Error(`unknown governance tool ${name}`);
  }
}
