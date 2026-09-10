import { sha256Hex } from "./crypto.ts";

/** Binary Merkle over hex leaves. Odd nodes are duplicated (Bitcoin-style). */
export async function merkleRoot(leaves: string[]): Promise<string> {
  if (!leaves.length) return `0x${await sha256Hex("kiln:empty")}`;
  let layer = leaves.map((l) => l.replace(/^0x/, "").toLowerCase());
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const a = layer[i]!;
      const b = layer[i + 1] ?? a;
      next.push(await sha256Hex(a + b));
    }
    layer = next;
  }
  return `0x${layer[0]}`;
}

export async function merkleProof(leaves: string[], index: number): Promise<string[]> {
  const proof: string[] = [];
  let layer = leaves.map((l) => l.replace(/^0x/, "").toLowerCase());
  let i = index;
  while (layer.length > 1) {
    const sibling = i % 2 === 0 ? (layer[i + 1] ?? layer[i]!) : layer[i - 1]!;
    proof.push(`0x${sibling}`);
    const next: string[] = [];
    for (let k = 0; k < layer.length; k += 2) {
      const a = layer[k]!;
      const b = layer[k + 1] ?? a;
      next.push(await sha256Hex(a + b));
    }
    layer = next;
    i = Math.floor(i / 2);
  }
  return proof;
}

export async function fileLeaves(pathsAndHashes: Array<{ path: string; hash: string }>): Promise<string[]> {
  const sorted = [...pathsAndHashes].sort((a, b) => a.path.localeCompare(b.path));
  const out: string[] = [];
  for (const item of sorted) {
    out.push(await sha256Hex(`${item.path}:${item.hash.replace(/^0x/, "")}`));
  }
  return out;
}
