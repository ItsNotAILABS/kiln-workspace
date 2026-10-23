/**
 * Keccak-256 (the pre-NIST variant Ethereum uses), small correct implementation.
 *
 * Purpose: compute EVM function selectors — keccak256("name(type,...)")[0:4] —
 * for KilnOwnershipRegistry calldata without pulling in viem/ethers.
 * Verified against `cast keccak` and the empty-string reference vector.
 */

const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const MASK64 = 0xffffffffffffffffn;
const RHO = [
  0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18,
  2, 61, 56, 14,
];

function rotl64(x: bigint, n: number): bigint {
  n %= 64;
  if (n === 0) return x & MASK64;
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64;
}

function keccakF1600(state: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    // Theta
    const c = new Array<bigint>(5).fill(0n);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) c[x] ^= state[x + 5 * y];
    const d = new Array<bigint>(5);
    for (let x = 0; x < 5; x++) d[x] = (c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1)) & MASK64;
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) state[x + 5 * y] = (state[x + 5 * y] ^ d[x]) & MASK64;
    // Rho + Pi
    const b = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(state[x + 5 * y], RHO[x + 5 * y]);
    // Chi
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        state[x + 5 * y] = (b[x + 5 * y] ^ ((~b[(x + 1) % 5 + 5 * y] & MASK64) & b[(x + 2) % 5 + 5 * y])) & MASK64;
    // Iota
    state[0] = (state[0] ^ RC[round]) & MASK64;
  }
}

/** keccak-256 of bytes; returns 32 bytes. */
export function keccak256Bytes(input: Uint8Array): Uint8Array {
  const rate = 136; // bytes per block for keccak-256
  const state = new Array<bigint>(25).fill(0n);
  const padded = new Uint8Array(Math.ceil((input.length + 1) / rate) * rate);
  padded.set(input);
  padded[input.length] = 0x01; // keccak domain separation (NOT 0x06 like NIST SHA3)
  padded[padded.length - 1] |= 0x80;

  const view = new DataView(padded.buffer);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      state[i] ^= view.getBigUint64(off + i * 8, true);
    }
    keccakF1600(state);
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) outView.setBigUint64(i * 8, state[i], true);
  return out;
}

export function keccak256Hex(input: Uint8Array): string {
  return (
    "0x" +
    Array.from(keccak256Bytes(input))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function keccak256Utf8(text: string): string {
  return keccak256Hex(new TextEncoder().encode(text));
}

/** First 4 bytes of keccak256(signature) — the EVM function selector. */
export function functionSelector(signature: string): string {
  return keccak256Utf8(signature).slice(0, 10); // "0x" + 8 hex chars
}
