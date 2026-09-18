/**
 * Agent capability grants for the KilnOwnershipRegistry.
 *
 * Sources of truth (never invented here):
 *  - Capability bitflags: the `CAP_*` constants in
 *    ItsNotAILABS/KILN → contracts/KilnOwnershipRegistry.sol
 *      CAP_COMMIT   = 1  (enforced: commitProject checks it for non-owner agents)
 *      CAP_RELEASE  = 2  (declared; no on-chain check consumes it in this build)
 *      CAP_PROPOSE  = 4  (declared; no on-chain check consumes it in this build)
 *      CAP_DELEGATE = 8  (enforced: delegateGrant requires it on the caller)
 *  - Function signatures: the synced ABI at ./abi/KilnOwnershipRegistry.json
 *    (vendored by `npm run sync:kiln` from the KILN checkout). Selectors are
 *    computed with the keccak-256 implementation in ./keccak.ts, verified
 *    against `cast sig` / `cast calldata`.
 *
 * Everything this module produces is "staged" calldata: correctly encoded,
 * but nothing is sent on-chain by the app.
 */
import { functionSelector } from "./keccak.ts";
import syncedAbiArtifact from "./abi/KilnOwnershipRegistry.json" with { type: "json" };

export type AbiEntry = {
  type: string;
  name: string;
  inputs: { name: string; type: string }[];
};

function abiFunctions(): AbiEntry[] {
  const artifact = syncedAbiArtifact as { abi?: unknown } | unknown[];
  const abi = (Array.isArray(artifact) ? artifact : (artifact as { abi?: unknown[] }).abi ?? []) as AbiEntry[];
  return abi.filter((e) => e && e.type === "function" && typeof e.name === "string");
}

export function registryFunction(name: string): AbiEntry {
  const entry = abiFunctions().find((e) => e.name === name);
  if (!entry) throw new Error(`KilnOwnershipRegistry ABI has no function "${name}" (synced ABI out of date?)`);
  return entry;
}

/** Canonical signature string, e.g. "authorizeAgent(bytes32,address,uint256,uint64)". */
export function canonicalSignature(entry: AbiEntry): string {
  return `${entry.name}(${entry.inputs.map((i) => i.type).join(",")})`;
}

/** EVM function selector from the real ABI entry. */
export function selectorOf(entry: AbiEntry): string {
  return functionSelector(canonicalSignature(entry));
}

// ---------------------------------------------------------------------------
// Capability bitflags (from the contract constants)
// ---------------------------------------------------------------------------

export type CapabilityFlag = {
  bit: bigint;
  name: string;
  description: string;
  enforced: boolean;
};

export const CAPABILITY_FLAGS: CapabilityFlag[] = [
  {
    bit: 1n,
    name: "CAP_COMMIT",
    description: "Anchor commits via commitProject (checked on-chain for non-owner agents)",
    enforced: true,
  },
  {
    bit: 2n,
    name: "CAP_RELEASE",
    description: "Declared in the contract; no on-chain check consumes it in this build",
    enforced: false,
  },
  {
    bit: 4n,
    name: "CAP_PROPOSE",
    description: "Declared in the contract; no on-chain check consumes it in this build",
    enforced: false,
  },
  {
    bit: 8n,
    name: "CAP_DELEGATE",
    description: "Spawn scoped child agents via delegateGrant (checked on-chain)",
    enforced: true,
  },
];

export type DecodedCapability = { bit: bigint; name: string; enforced: boolean } | { bit: bigint; name: "RESERVED"; enforced: false };

/** Decode a capability bitmask into named flags; unknown bits are RESERVED, never invented. */
export function decodeCapabilities(mask: bigint): DecodedCapability[] {
  if (mask < 0n) throw new Error("capability mask must be non-negative");
  const out: DecodedCapability[] = [];
  let remaining = mask;
  for (const flag of CAPABILITY_FLAGS) {
    if ((remaining & flag.bit) !== 0n) {
      out.push({ bit: flag.bit, name: flag.name, enforced: flag.enforced });
      remaining &= ~flag.bit;
    }
  }
  let bit = 1n;
  while (remaining > 0n) {
    if ((remaining & 1n) !== 0n) out.push({ bit, name: "RESERVED", enforced: false });
    remaining >>= 1n;
    bit <<= 1n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Calldata encoding (static ABI types only — exactly what the registry uses)
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]*$/.test(h) || h.length % 2 !== 0) throw new Error(`not hex: ${hex}`);
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function isAddress(v: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

export function isBytes32(v: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(v);
}

function encodeWord(type: string, value: string | bigint | number): Uint8Array {
  const word = new Uint8Array(32);
  if (type === "address") {
    if (typeof value !== "string" || !isAddress(value)) throw new Error(`invalid address: ${value}`);
    word.set(hexToBytes(value), 12);
    return word;
  }
  if (type === "bytes32") {
    if (typeof value !== "string" || !isBytes32(value)) throw new Error(`invalid bytes32: ${value}`);
    word.set(hexToBytes(value), 0);
    return word;
  }
  const m = /^uint(\d+)$/.exec(type);
  if (m) {
    const bits = Number(m[1]);
    if (bits % 8 !== 0 || bits < 8 || bits > 256) throw new Error(`unsupported uint size: ${type}`);
    const n = typeof value === "bigint" ? value : BigInt(value);
    if (n < 0n || n >= 1n << BigInt(bits)) throw new Error(`value out of range for ${type}: ${value}`);
    for (let i = 0; i < 32; i++) word[31 - i] = Number((n >> BigInt(8 * i)) & 0xffn);
    return word;
  }
  if (type === "bool") {
    const b = value === "true" || value === 1 || value === 1n;
    word[31] = b ? 1 : 0;
    return word;
  }
  throw new Error(`unsupported ABI type for encoding: ${type}`);
}

export function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Encode a registry call: 4-byte selector + ABI-encoded static args.
 * Throws on unknown function, wrong arg count, or bad values.
 */
export function encodeRegistryCall(functionName: string, args: (string | bigint | number)[]): string {
  const entry = registryFunction(functionName);
  if (args.length !== entry.inputs.length) {
    throw new Error(`${functionName} expects ${entry.inputs.length} args, got ${args.length}`);
  }
  const selector = hexToBytes(selectorOf(entry));
  const words = entry.inputs.map((input, i) => encodeWord(input.type, args[i]));
  const out = new Uint8Array(4 + 32 * words.length);
  out.set(selector, 0);
  words.forEach((w, i) => out.set(w, 4 + 32 * i));
  return bytesToHex(out);
}

// ---------------------------------------------------------------------------
// getAgentGrant return decoding
// ---------------------------------------------------------------------------

/**
 * Decode raw return data of getAgentGrant(bytes32,address).
 *
 * Current contract returns a 3-field struct: (uint256 capabilities,
 * uint64 expiresAt, address parent) — the parent address is where delegation
 * adds the extra trailing word. Returns null on malformed data rather than
 * inventing a grant.
 */
export function decodeAgentGrantReturn(data: string): {
  capabilities: bigint;
  expiresAt: bigint;
  parent: string;
} | null {
  let bytes: Uint8Array;
  try {
    bytes = hexToBytes(data);
  } catch {
    return null;
  }
  if (bytes.length < 96) return null;
  const word = (i: number) => {
    let n = 0n;
    for (let j = 0; j < 32; j++) n = (n << 8n) | BigInt(bytes[i * 32 + j]);
    return n;
  };
  const capabilities = word(0);
  const expiresAt = word(1);
  const parent = "0x" + Array.from(bytes.slice(2 * 32 + 12, 3 * 32)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { capabilities, expiresAt, parent };
}
