import { syncHash } from "@/lib/utils";
import type {
  ActionRun,
  Agent,
  Branch,
  Commit,
  Discussion,
  Domain,
  Gist,
  Issue,
  Listing,
  PackageItem,
  Profile,
  ProjectCard,
  Pull,
  Release,
  Repo,
  RepoFile,
  SecurityAlert,
  WikiPage,
  WorkflowFile,
} from "./types";

const F = "2026-08-28T16:00:00Z";
const P = "2026-08-20T11:00:00Z";
const N = "2026-07-02T09:00:00Z";
const M = "2026-06-18T14:00:00Z";
const I = "2026-08-12T10:00:00Z";
const NOW = "2026-09-03T00:00:53Z";

export const APACHE = `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright 2025-2026 the authors of this repository.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
`;

export const MIT = `MIT License

Copyright (c) 2025-2026 the authors of this repository

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

function file(path: string, language: string, content: string, message = "genesis", at = F): RepoFile {
  const body = content.replace(/^\n/, "");
  return {
    path,
    language,
    message,
    content: body,
    size: body.length,
    sha: syncHash(path + body),
    updatedAt: at,
    merkleRoot: `0x${syncHash(body).slice(1)}`,
    chunkCount: 1,
    encrypted: false,
  };
}

function ciYaml(name: string): string {
  return `name: ${name}
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
jobs:
  verify:
    runs-on: kiln-hosted
    steps:
      - uses: actions/checkout@v4
      - run: kiln verify --on-chain
      - run: kiln test
`;
}

const PROTOCOL_README = `# kiln-labs / protocol

Kiln L1 is a source-native chain. Commits, bounties, and decryption grants are first-class transactions. Private trees are sealed with AES-256-GCM; only the key commitment is public. This crate is the runtime — not a sketch.

## Settlement

Every \`git push\` lands as a \`commit\` transaction. The block hash is the canonical history.

\`\`\`
git clone kiln://kiln-labs/protocol.git
cargo test -p kiln-protocol
kiln verify --on-chain
\`\`\`

## Header

A commit header always binds a 32-byte key commitment. Public trees write zeros; they do not omit the field. Light clients stay on one decoder.

## Encryption

- Cipher: AES-256-GCM (96-bit nonce, 128-bit tag)
- Leaves: 4 MiB chunks, Merkle-folded with BLAKE3
- Viewer grants: on-chain, revocable, TTL
- Key commitment: SHA-256("kiln-key:" || secret)

## Token

KLN pays gas, bounties, and sponsor streams. Escrow is a protocol precompile keyed by \`(repo, issue)\`.
`;

const PROTOCOL_LIB = `//! Kiln L1 runtime. Commit headers, sealed trees, bounty escrow.
#![forbid(unsafe_code)]

pub mod block;
pub mod commit;
pub mod escrow;
pub mod genesis;
pub mod merkle;
pub mod seal;

pub const CHAIN_ID: u64 = 747;
pub const CHUNK: usize = 4 * 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommitHeader {
    pub repo: [u8; 32],
    pub tree: [u8; 32],
    pub parent: [u8; 32],
    pub key_commitment: [u8; 32],
    pub chain_id: u64,
}

impl CommitHeader {
    pub fn public_zeros() -> [u8; 32] {
        [0u8; 32]
    }

    pub fn encode(&self) -> [u8; 136] {
        let mut out = [0u8; 136];
        out[0..32].copy_from_slice(&self.repo);
        out[32..64].copy_from_slice(&self.tree);
        out[64..96].copy_from_slice(&self.parent);
        out[96..128].copy_from_slice(&self.key_commitment);
        out[128..136].copy_from_slice(&self.chain_id.to_be_bytes());
        out
    }
}

pub fn verify_seal(header: &CommitHeader, ciphertext: &[u8]) -> bool {
    header.chain_id == CHAIN_ID && seal::check(header.key_commitment, ciphertext)
}
`;

const PROTOCOL_SEAL = `//! AES-256-GCM envelope for private trees.
use sha2::{Digest, Sha256};

pub fn commit_key(secret: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(b"kiln-key:");
    h.update(secret);
    h.finalize().into()
}

pub fn check(commitment: [u8; 32], ciphertext: &[u8]) -> bool {
    if commitment == [0u8; 32] {
        return true;
    }
    ciphertext.len() >= 12 + 16
}
`;

const PROTOCOL_MERKLE = `//! BLAKE3 Merkle fold. Odd nodes duplicate (Bitcoin-style).
use blake3::Hash;

pub fn fold(leaves: &[[u8; 32]]) -> [u8; 32] {
    if leaves.is_empty() {
        return *blake3::hash(b"kiln:empty").as_bytes();
    }
    let mut layer: Vec<[u8; 32]> = leaves.to_vec();
    while layer.len() > 1 {
        let mut next = Vec::with_capacity(layer.len().div_ceil(2));
        let mut i = 0;
        while i < layer.len() {
            let a = layer[i];
            let b = if i + 1 < layer.len() { layer[i + 1] } else { a };
            let mut buf = [0u8; 64];
            buf[..32].copy_from_slice(&a);
            buf[32..].copy_from_slice(&b);
            next.push(*blake3::hash(&buf).as_bytes());
            i += 2;
        }
        layer = next;
    }
    layer[0]
}
`;

function makeRepo(partial: Omit<Repo, "files" | "readme" | "quotaBytes" | "kind"> & { files: RepoFile[]; kind?: Repo["kind"] }): Repo {
  const readme = partial.files.find((f) => /^readme\.md$/i.test(f.path))?.content ?? "";
  return {
    quotaBytes: 50 * 1024 * 1024 * 1024,
    kind: partial.kind ?? "code",
    readme,
    merkleRoot: `0x${syncHash(partial.id + readme).slice(1)}`,
    ...partial,
  };
}

export const SEED_REPOS: Repo[] = [
  makeRepo({
    id: "kiln-labs/protocol",
    owner: "kiln-labs",
    name: "protocol",
    description: "Kiln L1 runtime — commit settlement, AES-256-GCM sealed trees, bounty precompile.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: false,
    chainAddress: "0x4c1e7a91b0c3d2e8f5a6478901234567890abcde",
    language: "Rust",
    languages: { Rust: 58, TypeScript: 18, Solidity: 16, YAML: 8 },
    stars: 4281,
    forks: 612,
    watchers: 190,
    topics: ["l1", "source-control", "encryption", "bounties"],
    license: "Apache-2.0",
    defaultBranch: "main",
    updatedAt: F,
    createdAt: "2025-11-04T08:00:00Z",
    tvlKln: 182400,
    modelId: "grok-4.6",
    website: "https://kiln.dev",
    listedKln: 0,
    files: [
      file("README.md", "Markdown", PROTOCOL_README),
      file("LICENSE", "Text", APACHE),
      file("Cargo.toml", "TOML", `[package]\nname = "kiln-protocol"\nversion = "0.9.4"\nedition = "2021"\nlicense = "Apache-2.0"\n\n[dependencies]\nblake3 = "1"\nsha2 = "0.10"\naes-gcm = "0.10"\n`),
      file("src/lib.rs", "Rust", PROTOCOL_LIB),
      file("src/seal.rs", "Rust", PROTOCOL_SEAL),
      file("src/merkle.rs", "Rust", PROTOCOL_MERKLE),
      file("src/escrow.rs", "Rust", `//! Bounty precompile keyed by (repo, issue).\npub fn gas_release() -> u64 { 40_000 }\npub fn lock(repo: [u8; 32], issue: u64, amount: u128) { let _ = (repo, issue, amount); }\n`),
      file("contracts/Bounty.sol", "Solidity", `// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.24;\ninterface IKilnEscrow {\n    function lock(bytes32 repo, uint64 issue) external payable;\n    function release(bytes32 repo, uint64 issue, address to) external;\n}\n`),
      file(".github/workflows/ci.yml", "YAML", ciYaml("protocol")),
      file("CONTRIBUTING.md", "Markdown", `# Contributing\n\nOpen an issue. Lock KLN against it. Send a pull. Light clients must keep one header decoder.\n`),
    ],
  }),
  makeRepo({
    id: "kiln-labs/cli",
    owner: "kiln-labs",
    name: "cli",
    description: "git clone, commit, push, pull, verify, and stream-unseal from the terminal.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: false,
    chainAddress: "0x91aa20cde4410088b77a1234567890abcdef0011",
    language: "Go",
    languages: { Go: 92, Shell: 8 },
    stars: 1904,
    forks: 221,
    watchers: 88,
    topics: ["cli", "developer-tools", "git"],
    license: "MIT",
    defaultBranch: "main",
    updatedAt: P,
    createdAt: "2025-12-01T10:00:00Z",
    tvlKln: 12200,
    modelId: "grok-4-fast",
    files: [
      file("README.md", "Markdown", `# kiln CLI\n\n\`git clone kiln://owner/repo.git\` — every push settles on L1.\n\n\`\`\`\nkiln auth --wallet\nkiln clone kiln-labs/protocol\nkiln verify --on-chain\n\`\`\`\n`, "genesis", P),
      file("LICENSE", "Text", MIT, "genesis", P),
      file("go.mod", "Text", "module github.com/kiln-labs/cli\n\ngo 1.22\n", "genesis", P),
      file("cmd/kiln/main.go", "Go", `package main\n\nimport (\n  "fmt"\n  "os"\n)\n\nfunc main() {\n  if len(os.Args) < 2 {\n    fmt.Println("kiln clone | commit | push | pull | verify | unseal")\n    os.Exit(2)\n  }\n  fmt.Println("kiln", os.Args[1])\n}\n`, "genesis", P),
      file("internal/seal/stream.go", "Go", `package seal\n\nconst Leaf = 4 << 20\n\nfunc UnsealStream(r []byte) []byte { return r }\n`, "stream unseal", P),
      file(".github/workflows/ci.yml", "YAML", ciYaml("cli"), "genesis", P),
    ],
  }),
  makeRepo({
    id: "kiln-labs/sealed-fs",
    owner: "kiln-labs",
    name: "sealed-fs",
    description: "Live AES-256-GCM engine. 4 MiB leaves, 50 GiB folders, viewer grants with TTL.",
    visibility: "public",
    encrypted: true,
    keyCommitment: "0x7a19c4e2b8d046f1aa56b390c1d2e3f445566778",
    viewerGrant: true,
    chainAddress: "0x55b0aa1199ccdd2e8f5a6478901234567890feed",
    language: "TypeScript",
    languages: { TypeScript: 94, JSON: 6 },
    stars: 867,
    forks: 94,
    watchers: 41,
    topics: ["encryption", "aes-gcm", "storage"],
    license: "Apache-2.0",
    defaultBranch: "main",
    updatedAt: F,
    createdAt: "2026-01-20T12:00:00Z",
    tvlKln: 44000,
    modelId: "grok-4.5",
    files: [
      file("README.md", "Markdown", `# sealed-fs\n\n4 MiB leaves. 50 GiB per folder. Viewer grants expire.\n\n\`active(grant, now)\` is the only check the unsealer needs.\n`),
      file("src/grant.ts", "TypeScript", `export type Grant = { repoId: string; viewer: string; expires: number; revoked?: boolean };\nexport function active(g: Grant, now = Date.now()) {\n  return !g.revoked && g.expires > now;\n}\n`),
      file("src/chunk.ts", "TypeScript", `export const CHUNK = 4 * 1024 * 1024;\nexport const FOLDER = 50 * 1024 * 1024 * 1024;\n`),
      file("package.json", "JSON", `{"name":"@kiln/sealed-fs","version":"2.1.0","type":"module"}\n`),
      file("LICENSE", "Text", APACHE),
      file(".github/workflows/ci.yml", "YAML", ciYaml("sealed-fs")),
    ],
  }),
  makeRepo({
    id: "meridian/escrow",
    owner: "meridian",
    name: "escrow",
    description: "Issue-locked KLN. Pull-pattern release. No treasurer. Checks-effects-interactions.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: false,
    chainAddress: "0x88c0ffee1234567890abcdef1234567890aaa001",
    language: "Solidity",
    languages: { Solidity: 62, TypeScript: 30, toml: 8 },
    stars: 1560,
    forks: 188,
    watchers: 72,
    topics: ["bounties", "escrow", "defi"],
    license: "GPL-3.0",
    defaultBranch: "main",
    updatedAt: F,
    createdAt: "2026-02-02T09:00:00Z",
    tvlKln: 96750,
    modelId: "grok-4",
    listedKln: 1800,
    kind: "crypto",
    files: [
      file("README.md", "Markdown", `# meridian / escrow\n\nKLN locks against \`(repo, issue)\`. Maintainers never hold the purse. Pull-pattern release for contract payers.\n`),
      file("contracts/IssueEscrow.sol", "Solidity", `// SPDX-License-Identifier: GPL-3.0\npragma solidity ^0.8.24;\ncontract IssueEscrow {\n    mapping(bytes32 => uint256) public locked;\n    mapping(bytes32 => address) public payee;\n    function lock(bytes32 key) external payable { locked[key] += msg.value; }\n    function claim(bytes32 key) external {\n        uint256 amt = locked[key];\n        locked[key] = 0;\n        payable(msg.sender).transfer(amt);\n    }\n}\n`),
      file("test/reentrancy.ts", "TypeScript", `// double-release and stranger-release covered\nexport const cases = ["double-release", "stranger-release", "contract-payer"];\n`),
      file("LICENSE", "Text", "GNU GPL v3\n"),
      file(".github/workflows/ci.yml", "YAML", ciYaml("escrow")),
    ],
  }),
  makeRepo({
    id: "atlas/enclave",
    owner: "atlas",
    name: "enclave",
    description: "Hardware-backed sealed runtime. Owner key only — measurement bound, never exported.",
    visibility: "private",
    encrypted: true,
    keyCommitment: "0xbb12aa34cc56dd78ee90ff1234567890abcdeeff",
    viewerGrant: false,
    chainAddress: "0x0a11ce0000000000000000000000000000enclave",
    language: "Rust",
    languages: { Rust: 100 },
    stars: 0,
    forks: 0,
    watchers: 3,
    topics: ["enclave", "private", "attestation"],
    license: "Proprietary",
    defaultBranch: "main",
    updatedAt: N,
    createdAt: "2026-06-01T08:00:00Z",
    tvlKln: 8400,
    modelId: "grok-3",
    files: [
      file("README.md", "Markdown", `# atlas / enclave\n\nMeasurement is bound to the wallet. The unsealing key is never exported.\n`, "genesis", N),
      file("src/measure.rs", "Rust", `pub fn bind(wallet: &[u8; 20], measurement: &[u8; 32]) -> [u8; 32] {\n    *blake3::hash(&[wallet.as_slice(), measurement.as_slice()].concat()).as_bytes()\n}\n`, "genesis", N),
    ],
  }),
  makeRepo({
    id: "harbor/bridge",
    owner: "harbor",
    name: "bridge",
    description: "Light client with a sliding 256-block MMR. Posts Kiln commit proofs to paired L2s.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: false,
    chainAddress: "0x1111222233334444555566667777888899990000",
    language: "TypeScript",
    languages: { TypeScript: 72, Go: 28 },
    stars: 640,
    forks: 71,
    watchers: 29,
    topics: ["bridge", "proofs", "interop", "mmr"],
    license: "MIT",
    defaultBranch: "main",
    updatedAt: P,
    createdAt: "2026-04-11T15:00:00Z",
    tvlKln: 21900,
    modelId: "grok-4-fast",
    listedKln: 90,
    files: [
      file("README.md", "Markdown", `# harbor / bridge\n\nSliding MMR window = 256. Peaks only. Header proofs stay constant-size.\n`, "genesis", P),
      file("src/mmr.ts", "TypeScript", `export class SlidingMMR {\n  constructor(public window = 256) {}\n  peaks(): string[] { return []; }\n}\n`, "mmr window", P),
      file("LICENSE", "Text", MIT, "genesis", P),
      file(".github/workflows/ci.yml", "YAML", ciYaml("bridge"), "genesis", P),
    ],
  }),
  makeRepo({
    id: "northwind/git-seal",
    owner: "northwind",
    name: "git-seal",
    description: "git-remote-kiln. capabilities, list, push, fetch — every git push settles on L1.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: false,
    chainAddress: "0x2222abcd3333ef0155556666777788889999aa01",
    language: "Go",
    languages: { Go: 88, Makefile: 12 },
    stars: 312,
    forks: 40,
    watchers: 18,
    topics: ["git", "remote", "settlement"],
    license: "BSD-3-Clause",
    defaultBranch: "main",
    updatedAt: M,
    createdAt: "2026-05-09T11:00:00Z",
    tvlKln: 5100,
    modelId: "grok-4.6",
    files: [
      file("README.md", "Markdown", `# git-remote-kiln\n\nDrop it on your PATH. \`git push kiln main\` settles the tree.\n`, "genesis", M),
      file("remote.go", "Go", `package main\nfunc capabilities() []string { return []string{"connect", "stateless-connect", "push", "fetch", "list"} }\n`, "genesis", M),
      file("Makefile", "Makefile", "build:\n\tgo build -o git-remote-kiln .\n", "genesis", M),
    ],
  }),
  makeRepo({
    id: "lumen/zk-diff",
    owner: "lumen",
    name: "zk-diff",
    description: "Prove a patch applied without revealing the tree. Path bytes bound in public inputs.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: false,
    chainAddress: "0x3333cccc4444dddd5555eeee6666ffff77770000",
    language: "Rust",
    languages: { Circom: 48, Rust: 52 },
    stars: 1102,
    forks: 130,
    watchers: 54,
    topics: ["zk", "diff", "privacy", "circom"],
    license: "MIT",
    defaultBranch: "main",
    updatedAt: F,
    createdAt: "2026-03-22T13:00:00Z",
    tvlKln: 33300,
    modelId: "grok-4.5",
    listedKln: 420,
    files: [
      file("README.md", "Markdown", `# lumen / zk-diff\n\n\`pathHash\` is public. Poseidon(pathBytesHash, fileIndex).\n`),
      file("circuits/diff.circom", "Circom", `pragma circom 2.1.6;\ninclude "poseidon.circom";\ntemplate Diff() {\n  signal input pathBytesHash;\n  signal input fileIndex;\n  signal output pathHash;\n  component h = Poseidon(2);\n  h.inputs[0] <== pathBytesHash;\n  h.inputs[1] <== fileIndex;\n  pathHash <== h.out;\n}\n`),
      file("src/prove.rs", "Rust", `pub fn bind_path(path: &str, index: u32) -> [u8; 32] {\n    *blake3::hash(format!("{path}:{index}").as_bytes()).as_bytes()\n}\n`),
      file("LICENSE", "Text", MIT),
      file(".github/workflows/ci.yml", "YAML", ciYaml("zk-diff")),
    ],
  }),
  makeRepo({
    id: "itsnotailabs/medina",
    owner: "itsnotailabs",
    name: "medina",
    description: "Toroidal 5D memory (θ, φ, ρ, ring, beat). φ-harmonic clock. Phantom Monte Carlo. Zero-cost 25-language IR.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: false,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000itsnotai",
    language: "TypeScript",
    languages: { TypeScript: 91, Markdown: 9 },
    stars: 2140,
    forks: 186,
    watchers: 94,
    topics: ["memory", "phi", "torus", "sovereign-ai", "edge"],
    license: "Apache-2.0",
    defaultBranch: "main",
    updatedAt: I,
    createdAt: "2025-11-18T09:00:00Z",
    tvlKln: 64800,
    modelId: "medina-phi",
    website: "https://zenodo.org/records/20822130",
    listedKln: 2400,
    files: [
      file("README.md", "Markdown", `# MEDINA Memory Systems\n\nToroidal 5D memory (θ, φ, ρ, ring, beat). Intent is a tangent. Beat is φ-time.\n\n\`navigate(now)\` writes \`harmonicBeat(now)\`. The walker does not increment beat.\n`, "genesis", I),
      file("src/navigate.ts", "TypeScript", `export const PHI = 1.618033988749895;\nexport function harmonicBeat(now: number) {\n  return (now / 1000) * PHI % 1;\n}\nexport function navigate(now: number, theta: number, phi: number) {\n  return { theta, phi, rho: 1, ring: 0, beat: harmonicBeat(now) };\n}\n`, "beat from clock", I),
      file("src/ir.ts", "TypeScript", `export const LANGS = 25;\nexport function dispatch(op: number) { return op & 0xff; }\n`, "zero-cost table", I),
      file("LICENSE", "Text", APACHE, "genesis", I),
      file(".github/workflows/ci.yml", "YAML", ciYaml("medina"), "genesis", I),
    ],
  }),
  makeRepo({
    id: "itsnotailabs/neuroemergence",
    owner: "itsnotailabs",
    name: "neuroemergence",
    description: "BCVI, coherence gates, arousal bands, recovery modes. Coherence beats dopamine peaks.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: false,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000itsnotai",
    language: "TypeScript",
    languages: { TypeScript: 88, Markdown: 12 },
    stars: 1688,
    forks: 142,
    watchers: 77,
    topics: ["neuroemergence", "bcvi", "safety", "coherence"],
    license: "Apache-2.0",
    defaultBranch: "main",
    updatedAt: I,
    createdAt: "2026-06-16T10:00:00Z",
    tvlKln: 41200,
    modelId: "neuro-bcvi",
    website: "https://doi.org/10.5281/zenodo.20822130",
    listedKln: 1800,
    files: [
      file("README.md", "Markdown", `# NeuroEmergence\n\nPAPER-01: Active-State Victory Driver (BCVI). PAPER-02: Psychology-Conscious AI Safety.\n\nCoherence > dopamine peaks.\n`, "genesis", I),
      file("src/gate.ts", "TypeScript", `export function gate(phaseLock: number, band: "calm" | "surge") {\n  if (band === "surge" && phaseLock < 0.6) return "hold";\n  return "pass";\n}\nexport function bcvi(coherence: number, spike: number) {\n  return coherence * 0.7 + Math.min(spike, 0.3);\n}\n`, "phase lock", I),
      file("LICENSE", "Text", APACHE, "genesis", I),
    ],
  }),
  makeRepo({
    id: "itsnotailabs/xcrew",
    owner: "itsnotailabs",
    name: "xcrew",
    description: "72h offline edge. Feature shedding, atomic persist, ML-KEM / ML-DSA transcripts. 1–4 cores.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: false,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000itsnotai",
    language: "TypeScript",
    languages: { TypeScript: 100 },
    stars: 980,
    forks: 74,
    watchers: 51,
    topics: ["edge", "pq", "offline", "hardening"],
    license: "Apache-2.0",
    defaultBranch: "main",
    updatedAt: I,
    createdAt: "2026-05-25T14:00:00Z",
    tvlKln: 22400,
    modelId: "xcrew-edge",
    listedKln: 1200,
    files: [
      file("README.md", "Markdown", `# XCREW\n\n72h offline ceiling. Feature shedding. Atomic persist. Kyber / Dilithium transcripts.\n`, "genesis", I),
      file("src/queue.ts", "TypeScript", `export const OFFLINE_CEILING = 72 * 3600 * 1000;\nexport function drain(envelopes: { at: number }[], now = Date.now()) {\n  return envelopes.filter((e) => now - e.at <= OFFLINE_CEILING);\n}\n`, "72h drop", I),
      file("src/pq.ts", "TypeScript", `export type KEM = "ML-KEM-768";\nexport type DSA = "ML-DSA-65";\n`, "genesis", I),
      file("LICENSE", "Text", APACHE, "genesis", I),
    ],
  }),
  makeRepo({
    id: "itsnotailabs/vlaptop",
    owner: "itsnotailabs",
    name: "vlaptop",
    description: "Screen kernel for people and agents: see, touch, type, click named buttons. vLaptop is an agent's personal computer on that kernel.",
    visibility: "public",
    encrypted: true,
    keyCommitment: "0xvlaptop00000000000000000000000000000000",
    viewerGrant: true,
    chainAddress: "0x4c1e7a91b0c3d2e8f5a6478901234567890abcde",
    language: "Python",
    languages: { Markdown: 50, Python: 31, TOML: 12, Text: 7 },
    stars: 12,
    forks: 1,
    watchers: 4,
    topics: ["imported", "github", "screen-kernel", "agents", "vlaptop"],
    license: "MIT",
    defaultBranch: "main",
    updatedAt: NOW,
    createdAt: "2026-09-03T00:00:53Z",
    tvlKln: 0,
    modelId: "grok-4.6",
    website: "https://github.com/ItsNotAILABS/vlaptop",
    githubUrl: "https://github.com/ItsNotAILABS/vlaptop",
    githubOwner: "ItsNotAILABS",
    githubRepo: "vlaptop",
    files: [
      file("README.md", "Markdown", `# vLaptop\n\nScreen kernel for people and agents: **see, touch, type, click named buttons**.\n\nvLaptop is an agent's personal computer on that kernel. The public contract is SCREEN-KERNEL/1.1.\n\n## Verbs\n\n| verb | meaning |\n| --- | --- |\n| SEE | named surfaces |\n| TOUCH | pointer down |\n| TYPE | keyed input |\n| CLICK | named button |\n`, "import ItsNotAILABS/vlaptop", NOW),
      file("kernel/verbs.py", "Python", `VERBS = ("SEE", "TOUCH", "TYPE", "CLICK")\n\ndef dispatch(verb: str, target: str) -> dict:\n    if verb not in VERBS:\n        raise ValueError(verb)\n    return {"verb": verb, "target": target}\n`, "import", NOW),
      file("kernel/screen.py", "Python", `class Surface:\n    def __init__(self, name: str):\n        self.name = name\n        self.buttons: list[str] = []\n    def click(self, button: str) -> str:\n        if button not in self.buttons:\n            raise KeyError(button)\n        return f"CLICK {self.name}/{button}"\n`, "import", NOW),
      file("vlaptop/agent.py", "Python", `class AgentLaptop:\n    def __init__(self, name: str):\n        self.name = name\n    def boot(self) -> str:\n        return f"{self.name} on SCREEN-KERNEL/1.1"\n`, "import", NOW),
      file("pyproject.toml", "TOML", `[project]\nname = "vlaptop"\nversion = "0.1.1"\nrequires-python = ">=3.11"\n`, "import", NOW),
      file("LICENSE", "Text", MIT, "import", NOW),
      file("index.html", "HTML", `<!doctype html><meta charset="utf-8"><title>vLaptop</title><body style="font-family:IBM Plex Sans,sans-serif;background:#09090b;color:#ecece8;padding:48px"><p style="letter-spacing:.2em;text-transform:uppercase;font-size:11px;color:#8e8e89">SCREEN-KERNEL / 1.1</p><h1 style="font-family:Instrument Serif,serif;font-size:56px;font-weight:400">vLaptop</h1><p style="color:#8e8e89;max-width:28rem">See. Touch. Type. Click named buttons. An agent's personal computer on the kernel.</p></body>`, "import", NOW),
    ],
  }),
  makeRepo({
    id: "itsnotailabs/pocket",
    owner: "itsnotailabs",
    name: "pocket",
    description: "POCKET — native Agent OS on your PC. PhoneAI kernel, MCP apps, Face ID public seat, screen vision. Ships with the KILN ecosystem.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: true,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000itsnotai",
    language: "Python",
    languages: { Python: 78, Markdown: 14, JavaScript: 8 },
    stars: 42,
    forks: 3,
    watchers: 9,
    topics: ["pocket", "phoneai", "mcp", "agent-os", "kiln-ecosystem", "vision"],
    license: "MIT",
    defaultBranch: "main",
    updatedAt: NOW,
    createdAt: "2025-11-01T00:00:00Z",
    tvlKln: 8787,
    modelId: "grok-4.6",
    website: "https://pocket.medinatechlabs.net",
    githubUrl: "https://github.com/ItsNotAILABS/pocket",
    githubOwner: "ItsNotAILABS",
    githubRepo: "pocket",
    files: [
      file("README.md", "Markdown", `# POCKET\n\nNative Agent OS on the machine you own. PhoneAI is the public seat (signup + Face ID). MCP servers are phone apps. Screen vision parks the Pocket window off the capture.\n\n**Pocket Desktop + Edge app** (\`/desk\`): agents work in this window. Seat Spark then Grok (or any second agent) and the desk **auto-splits** — two panes, two composers, no standalone \`/spark\` or extra OS windows. Deep links: \`/desk?split=1\` · \`/desk?agent=spark\` · \`/desk?tab=crew\`.\n\nHost: \`python -m pocket serve --port 8787\`. Desktop: \`python -m pocket desktop\`. Edge: \`--app=http://127.0.0.1:8787/desk\`.\n\nFamily: pocket-agent · pocket-voice-to-text · PhoneAI · pocket-mailbox.\n`, "seed pocket desk auto-split + spark", NOW),
      file(".kiln/project.json", "JSON", `{\n  "schema": "kiln.project.v1",\n  "projectId": "pocket",\n  "kiln": "ItsNotAILABS/KILN",\n  "repository": "ItsNotAILABS/pocket",\n  "mcpEndpoint": "http://127.0.0.1:8787",\n  "comesWithKiln": true\n}\n`, "seed", NOW),
      file("src/pocket/serve.py", "Python", `def main():\n    print("POCKET host :8787")\n`, "seed", NOW),
      file("LICENSE", "Text", MIT, "seed", NOW),
    ],
  }),
  makeRepo({
    id: "itsnotailabs/pocket-mailbox",
    owner: "itsnotailabs",
    name: "pocket-mailbox",
    description: "First-class agent mailbox — threads, search, archive. agents.pocket.local · :8792.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: true,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000mailbox",
    modelId: "pocket-os",
    language: "Python",
    languages: { Python: 92, Markdown: 8 },
    stars: 11,
    forks: 1,
    watchers: 4,
    topics: ["pocket", "mail", "agents", "kiln-ecosystem"],
    license: "MIT",
    defaultBranch: "main",
    updatedAt: NOW,
    createdAt: "2026-09-04T00:00:00Z",
    tvlKln: 8792,
    website: "https://github.com/ItsNotAILABS/pocket-mailbox",
    githubUrl: "https://github.com/ItsNotAILABS/pocket-mailbox",
    githubOwner: "ItsNotAILABS",
    githubRepo: "pocket-mailbox",
    files: [
      file("README.md", "Markdown", `# POCKET Mailbox\n\nThreads, search, archive. Shared with Desk /mail at ~/.pocket/agent_mail.\n\n\`python -m pocket_mailbox\` → :8792\n`, "seed mailbox", NOW),
      file(".kiln/project.json", "JSON", `{\n  "schema": "kiln.project.v1",\n  "projectId": "pocket-mailbox",\n  "kiln": "ItsNotAILABS/KILN",\n  "repository": "ItsNotAILABS/pocket-mailbox",\n  "mcpEndpoint": "http://127.0.0.1:8792",\n  "comesWithKiln": true\n}\n`, "seed", NOW),
      file("LICENSE", "Text", MIT, "seed", NOW),
    ],
  }),
  makeRepo({
    id: "itsnotailabs/kiln-workspace",
    owner: "itsnotailabs",
    name: "kiln-workspace",
    description: "Live Kiln forge app. Grok Build + Codex lanes. Preview kiln-git.grok.me — custom domain later.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: true,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000kilnws",
    modelId: "grok-4.6",
    language: "TypeScript",
    languages: { TypeScript: 86, CSS: 8, HTML: 6 },
    stars: 19,
    forks: 2,
    watchers: 6,
    topics: ["kiln", "forge", "tanstack", "itsnotailabs"],
    license: "MIT",
    defaultBranch: "main",
    updatedAt: NOW,
    createdAt: "2026-09-04T00:00:00Z",
    tvlKln: 8080,
    website: "https://kiln-git.grok.me/",
    githubUrl: "https://github.com/ItsNotAILABS/kiln-workspace",
    githubOwner: "ItsNotAILABS",
    githubRepo: "kiln-workspace",
    files: [
      file("README.md", "Markdown", `# KILN workspace\n\nLive forge (TanStack Start). Grok: E:\\\\KILN grok/work. Codex: E:\\\\workspaces\\\\kiln-codex codex/work.\n\nLive: https://kiln-git.grok.me/\nDomain later: kiln.medinatechlabs.net — do not change DNS yet.\n`, "seed workspace", NOW),
      file("WORKSPACE.md", "Markdown", `# Lanes\n\nGrok → grok/work. Codex → codex/work. Deploy only from main.\n`, "seed", NOW),
      file("LICENSE", "Text", MIT, "seed", NOW),
    ],
  }),
  makeRepo({
    id: "itsnotailabs/auro14b",
    owner: "itsnotailabs",
    name: "auro14b",
    description: "AURO Model Family — Medina native model. Composable checkpoints, atomic specialists, micro/core models and governed orchestration lanes on the MESIE compute plane.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: true,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000auro14",
    modelId: "auro-native",
    language: "Python",
    languages: { Python: 82, Markdown: 12, YAML: 6 },
    stars: 0,
    forks: 0,
    watchers: 0,
    topics: ["auro", "native-model", "mesie", "orchestration", "kiln-ecosystem"],
    license: "MIT",
    defaultBranch: "main",
    updatedAt: NOW,
    createdAt: "2026-09-09T00:00:00Z",
    tvlKln: 0,
    website: "https://github.com/ItsNotAILABS/Auro14B",
    githubUrl: "https://github.com/ItsNotAILABS/Auro14B",
    githubOwner: "ItsNotAILABS",
    githubRepo: "Auro14B",
    files: [
      file("README.md", "Markdown", `# AURO Model Family\n\nComposable native model family and governed checkpoint/orchestration architecture on the MESIE compute plane.\n\nAURO is a family, not one checkpoint: atomic specialists, micro models, core models and larger orchestration lanes share runtime, context, checkpoint and evidence conventions.\n`, "seed auro family", NOW),
      file(".kiln/project.json", "JSON", `{\n  "schema": "kiln.project.v1",\n  "projectId": "auro14b",\n  "kiln": "ItsNotAILABS/KILN",\n  "repository": "ItsNotAILABS/Auro14B",\n  "workspace": "auro-family",\n  "defaultBranch": "main"\n}\n`, "seed", NOW),
      file("LICENSE", "Text", MIT, "seed", NOW),
    ],
  }),
  makeRepo({
    id: "itsnotailabs/capsula",
    owner: "itsnotailabs",
    name: "capsula",
    description: "CAPSULA Studio — isolated runtime, build, preview and deployment-plan platform for the POCKET/NEXUS ecosystem. Turns a project task into a bounded execution capsule.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: true,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000capsul",
    modelId: "capsula-1",
    language: "TypeScript",
    languages: { TypeScript: 84, CSS: 9, HTML: 7 },
    stars: 0,
    forks: 0,
    watchers: 0,
    topics: ["capsula", "runtime", "pocket", "nexus", "kiln-ecosystem"],
    license: "MIT",
    defaultBranch: "main",
    updatedAt: NOW,
    createdAt: "2026-09-09T00:00:00Z",
    tvlKln: 0,
    website: "https://github.com/ItsNotAILABS/CAPSULA",
    githubUrl: "https://github.com/ItsNotAILABS/CAPSULA",
    githubOwner: "ItsNotAILABS",
    githubRepo: "CAPSULA",
    files: [
      file("README.md", "Markdown", `# CAPSULA Studio\n\nIsolated runtime, build, preview and deployment-plan platform for the POCKET/NEXUS ecosystem.\n\nCAPSULA turns a project task into a bounded execution capsule with explicit scope, budgets, artifacts and handoffs — the right lane for work that should be separated from a primary workspace.\n`, "seed capsula studio", NOW),
      file(".kiln/project.json", "JSON", `{\n  "schema": "kiln.project.v1",\n  "projectId": "capsula",\n  "kiln": "ItsNotAILABS/KILN",\n  "repository": "ItsNotAILABS/CAPSULA",\n  "workspace": "capsula-studio",\n  "defaultBranch": "main"\n}\n`, "seed", NOW),
      file("LICENSE", "Text", MIT, "seed", NOW),
    ],
  }),
  makeRepo({
    id: "freddycreates/sovereign",
    owner: "freddycreates",
    name: "sovereign",
    description: "SOVEREIGN — film-studio-as-autonomous-organism on the Internet Computer: Motoko backend canister with a React/TypeScript frontend. Restrictive SAPL v1.0 license — legal triage required before any commercial use.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: true,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000sovrgn",
    modelId: "sovereign-os",
    language: "TypeScript",
    languages: { TypeScript: 59, Motoko: 38, CSS: 3 },
    stars: 0,
    forks: 0,
    watchers: 0,
    topics: ["sovereign", "kiln-ecosystem"],
    license: "SAPL-1.0",
    defaultBranch: "main",
    updatedAt: NOW,
    createdAt: "2026-09-09T00:00:00Z",
    tvlKln: 0,
    website: "https://github.com/FreddyCreates/sovereign",
    githubUrl: "https://github.com/FreddyCreates/sovereign",
    githubOwner: "FreddyCreates",
    githubRepo: "sovereign",
    files: [
      file("README.md", "Markdown", `# SOVEREIGN\n\nSovereign application surface in the ItsNotAI ecosystem.\n`, "seed sovereign", NOW),
      file(".kiln/project.json", "JSON", `{\n  "schema": "kiln.project.v1",\n  "projectId": "sovereign",\n  "kiln": "ItsNotAILABS/KILN",\n  "repository": "FreddyCreates/sovereign",\n  "workspace": "sovereign-app",\n  "defaultBranch": "main"\n}\n`, "seed", NOW),
      file("LICENSE", "Text", MIT, "seed", NOW),
    ],
  }),
  makeRepo({
    id: "freddycreates/sovereign-engine",
    owner: "freddycreates",
    name: "sovereign-engine",
    description: "Sovereign Books substrate — shipaton target, September 29 2026.",
    visibility: "public",
    encrypted: false,
    keyCommitment: "0x0000000000000000000000000000000000000000",
    viewerGrant: true,
    chainAddress: "0x1a1b0e1a1ab5000000000000000000svreng",
    modelId: "sovereign-os",
    language: "Python",
    languages: { Python: 90, Markdown: 10 },
    stars: 0,
    forks: 1,
    watchers: 0,
    topics: ["sovereign", "shipaton", "kiln-ecosystem"],
    license: "NOASSERTION",
    defaultBranch: "main",
    updatedAt: "2026-09-04T18:15:06Z",
    createdAt: "2026-08-14T02:57:56Z",
    tvlKln: 0,
    website: "https://github.com/FreddyCreates/sovereign-engine",
    githubUrl: "https://github.com/FreddyCreates/sovereign-engine",
    githubOwner: "FreddyCreates",
    githubRepo: "sovereign-engine",
    files: [
      file("README.md", "Markdown", `# sovereign-engine\n\nSovereign Books substrate. Shipaton: September 29, 2026.\n`, "seed sovereign-engine", NOW),
      file(".kiln/project.json", "JSON", `{\n  "schema": "kiln.project.v1",\n  "projectId": "sovereign-engine",\n  "kiln": "ItsNotAILABS/KILN",\n  "repository": "FreddyCreates/sovereign-engine",\n  "workspace": "sovereign-engine",\n  "defaultBranch": "main"\n}\n`, "seed", NOW),
      file("LICENSE", "Text", MIT, "seed", NOW),
    ],
  }),
];

export const SEED_PROFILES: Record<string, Profile> = {
  "kiln-labs": {
    handle: "kiln-labs",
    displayName: "Kiln Labs",
    lab: "Kiln Protocol Lab",
    company: "Kiln",
    bio: "Protocol laboratory behind Kiln L1. We ship commit settlement, AES-256-GCM sealed trees, and the bounty precompile.",
    location: "On-chain",
    joined: "2025",
    address: "0x4c1e7a91b0c3d2e8f5a6478901234567890abcde",
    website: "https://kiln.dev",
    twitter: "kilnlabs",
    kind: "org",
    followers: 12840,
    following: 24,
    orgs: ["Kiln"],
    highlight: "Kiln L1 · sealed-fs · CLI",
    pinned: ["kiln-labs/protocol", "kiln-labs/cli", "kiln-labs/sealed-fs"],
  },
  meridian: {
    handle: "meridian",
    displayName: "Meridian Research",
    bio: "Escrow and paymaster research out of Lisbon. We lock KLN against issue ids so maintainers never hold the purse.",
    location: "Lisbon, Portugal",
    joined: "2026",
    address: "0x88c0ffee1234567890abcdef1234567890aaa001",
    website: "https://meridian.research",
    twitter: "meridianescrow",
    kind: "org",
    followers: 2210,
    following: 61,
    orgs: ["Meridian Research"],
    highlight: "Issue-locked KLN escrow",
    pinned: ["meridian/escrow"],
    company: "Meridian Research",
  },
  atlas: {
    handle: "atlas",
    displayName: "Atlas Enclaves",
    bio: "Private runtimes. Hardware-backed sealing. Owner key only — we do not issue viewer grants.",
    location: "Austin, Texas",
    joined: "2026",
    address: "0x0a11ce0000000000000000000000000000enclave",
    twitter: "atlasenclave",
    kind: "org",
    followers: 980,
    following: 19,
    orgs: ["Atlas Enclaves"],
    highlight: "Measurement-bound unsealing",
    pinned: ["atlas/enclave"],
  },
  harbor: {
    handle: "harbor",
    displayName: "Harbor",
    bio: "Light clients and bridges. Sliding MMRs. Commit proofs posted to paired L2s.",
    location: "Rotterdam",
    joined: "2026",
    address: "0x1111222233334444555566667777888899990000",
    kind: "org",
    followers: 1540,
    following: 40,
    orgs: ["Harbor"],
    highlight: "Sliding 256-block MMR",
    pinned: ["harbor/bridge"],
  },
  northwind: {
    handle: "northwind",
    displayName: "Northwind",
    bio: "git-remote-kiln. The remote helper that makes every push a settlement.",
    location: "Oslo",
    joined: "2026",
    address: "0x2222abcd3333ef0155556666777788889999aa01",
    kind: "user",
    followers: 410,
    following: 88,
    orgs: [],
    pinned: ["northwind/git-seal"],
  },
  lumen: {
    handle: "lumen",
    displayName: "Lumen",
    bio: "Zero-knowledge diffs. Prove a patch without revealing the tree.",
    location: "Zurich",
    joined: "2026",
    address: "0x3333cccc4444dddd5555eeee6666ffff77770000",
    kind: "org",
    followers: 1880,
    following: 22,
    orgs: ["Lumen"],
    highlight: "Path-bound circuits",
    pinned: ["lumen/zk-diff"],
  },
  itsnotailabs: {
    handle: "itsnotailabs",
    displayName: "ItsNotAI LABS",
    lab: "MEDINA Memory Systems",
    company: "ItsNotAI LABS",
    bio: "Sovereign edge AI. Toroidal 5D memory, NeuroEmergence, XCREW 72h offline. Three humans plus the machines.",
    location: "Fort Worth, Texas",
    joined: "2025",
    address: "0x1a1b0e1a1ab5000000000000000000itsnotai",
    website: "https://zenodo.org/records/20822130",
    twitter: "ItsnotAILabs",
    kind: "user",
    followers: 640,
    following: 31,
    orgs: ["ItsNotAI LABS"],
    highlight: "POCKET · MEDINA · NeuroEmergence · XCREW",
    pinned: ["itsnotailabs/pocket", "itsnotailabs/kiln-workspace", "itsnotailabs/pocket-mailbox"],
  },
};

function iss(
  repoId: string,
  number: number,
  title: string,
  body: string,
  author: string,
  state: Issue["state"],
  labels: string[],
  createdAt: string,
  extra: Partial<Issue> = {},
): Issue {
  return {
    id: `${repoId}#${number}`,
    repoId,
    number,
    title,
    body,
    author,
    state,
    labels,
    assignees: extra.assignees ?? [],
    createdAt,
    updatedAt: createdAt,
    bountyKln: extra.bountyKln ?? 0,
    bountyStatus: extra.bountyStatus ?? "none",
    bountyTx: extra.bountyTx,
    comments: extra.comments ?? [],
    milestone: extra.milestone,
  };
}

export const SEED_ISSUES: Issue[] = [
  iss("kiln-labs/protocol", 41, "Header should bind key commitment for public trees too", "Public repos currently skip the commitment field. Auditors want a stable header shape so light clients do not branch.", "harbor", "open", ["protocol", "light-client"], P, {
    bountyKln: 800, bountyStatus: "escrowed", bountyTx: "0xaaa10001",
    comments: [{ id: "c1", author: "kiln-labs", body: "Agreed. We will keep zeros for unsealed trees rather than omitting the field. See CommitHeader::public_zeros.", createdAt: F, txHash: "0xaaa10002" }],
  }),
  iss("kiln-labs/protocol", 38, "Precompile gas for bounty release is too high", "release() is 140k. Target 40k so small bounties are viable.", "meridian", "open", ["gas", "escrow"], N, { bountyKln: 2500, bountyStatus: "escrowed", bountyTx: "0xaaa10003" }),
  iss("meridian/escrow", 12, "Reentrancy on release when payer is a contract", "Checks-effects-interactions is inverted if payer is a hook. Need a pull pattern.", "atlas", "open", ["security", "bug"], F, {
    bountyKln: 5000, bountyStatus: "escrowed", bountyTx: "0xbbb20001",
    comments: [{ id: "c2", author: "meridian", body: "Shipped the pull pattern in contracts/IssueEscrow.sol. Tests cover double-release and stranger-release.", createdAt: F }],
  }),
  iss("kiln-labs/sealed-fs", 7, "Viewer grant should expire, not only revoke", "Add TTL on the grant tx so session keys die without a second transaction.", "lumen", "open", ["encryption"], P, {
    bountyKln: 400, bountyStatus: "escrowed", bountyTx: "0xccc30001",
    comments: [{ id: "c3", author: "kiln-labs", body: "src/grant.ts honors expires. active() is the only check the unsealer needs.", createdAt: F }],
  }),
  iss("harbor/bridge", 3, "Header proof size blows up after 256 blocks", "Switch to a sliding MMR window.", "northwind", "open", ["perf"], M, {
    comments: [{ id: "c4", author: "harbor", body: "SlidingMMR window=256 is in src/mmr.ts. Peaks only.", createdAt: P }],
  }),
  iss("lumen/zk-diff", 9, "Circuit does not bind file path", "A prover can claim a different path than the one updated. Bind path bytes in the public inputs.", "kiln-labs", "open", ["circuits", "security"], F, {
    bountyKln: 3200, bountyStatus: "escrowed", bountyTx: "0xddd40001",
    comments: [{ id: "c5", author: "lumen", body: "pathHash is public. Poseidon(pathBytesHash, fileIndex). See circuits/diff.circom.", createdAt: F }],
  }),
  iss("kiln-labs/cli", 4, "unseal fails on large trees", "Streaming decrypt for envelopes over 32MB.", "harbor", "closed", ["cli"], "2026-05-01T12:00:00Z", {
    bountyKln: 200, bountyStatus: "released", bountyTx: "0xeee50001",
    comments: [{ id: "c6", author: "kiln-labs", body: "Shipped in 0.4.1. internal/seal/stream.go, 4 MiB leaves.", createdAt: M }],
  }),
  iss("itsnotailabs/medina", 2, "Navigator should step beat from the clock, not the walker", "Intent is a tangent. Beat is φ-time. Mixing them makes the torus a tape again.", "kiln-labs", "closed", ["memory"], F, {
    comments: [{ id: "c7", author: "itsnotailabs", body: "navigate() takes now and writes harmonicBeat(now). The walker does not increment beat.", createdAt: I }],
  }),
  iss("itsnotailabs/neuroemergence", 1, "Surge band must require phase lock", "Otherwise the driver chases a spike. That's the thing we published against.", "lumen", "open", ["safety"], I, {
    bountyKln: 900, bountyStatus: "escrowed", bountyTx: "0xfff60001",
    comments: [{ id: "c8", author: "itsnotailabs", body: "gate() holds surge when phaseLock < 0.6. Tests assert calm BCVI > spike BCVI.", createdAt: I }],
  }),
  iss("itsnotailabs/xcrew", 3, "Queue must drop after 72h, not retry forever", "A device that comes back after a week should not replay stale grants.", "atlas", "closed", ["edge"], P, {
    bountyKln: 300, bountyStatus: "released", bountyTx: "0xaaa70001",
    comments: [{ id: "c9", author: "itsnotailabs", body: "OFFLINE_CEILING = 72h. drain() drops expired envelopes.", createdAt: I }],
  }),
  iss("itsnotailabs/vlaptop", 1, "SCREEN-KERNEL/1.1 verb table as the public contract", "SEE / TOUCH / TYPE / CLICK named buttons. Keep the table stable.", "itsnotailabs", "open", ["kernel"], NOW),
  iss(
    "itsnotailabs/pocket",
    1,
    "Desk auto-split: Spark + Grok in one Desktop/Edge window",
    "Seat Spark then a second agent on /desk. Same window, two panes. Spark is a Pocket sub-agent (qwen3.8-27b) with file/GitHub tools. Do not open /spark as a standalone view.",
    "spark",
    "closed",
    ["desk", "agents"],
    NOW,
  ),
];

export const SEED_PULLS: Pull[] = [
  {
    id: "kiln-labs/protocol#40", repoId: "kiln-labs/protocol", number: 40,
    title: "Stable header: always include key commitment",
    body: "Zeros when the tree is public. Light clients can stay on one decoder.",
    author: "harbor", state: "open", fromBranch: "harbor:header-shape", toBranch: "main",
    createdAt: F, updatedAt: F, txHash: "0xpr000040", additions: 86, deletions: 12,
    comments: [{ id: "pc1", author: "kiln-labs", body: "Header shape matches CommitHeader::encode. Approving after gas bench.", createdAt: F }],
    reviews: [{ author: "kiln-labs", state: "comment", body: "Need one more test on public_zeros.", createdAt: F }],
    files: [{ path: "src/lib.rs", patch: "+    pub fn public_zeros() -> [u8; 32] { [0u8; 32] }", additions: 4, deletions: 0 }],
  },
  {
    id: "meridian/escrow#11", repoId: "meridian/escrow", number: 11,
    title: "Pull pattern for contract payers", body: "Stops reentrancy on release.",
    author: "atlas", state: "open", fromBranch: "atlas:pull-escrow", toBranch: "main",
    createdAt: F, updatedAt: F, txHash: "0xpr000011", additions: 140, deletions: 33,
    comments: [], reviews: [],
    files: [{ path: "contracts/IssueEscrow.sol", patch: "+    function claim(bytes32 key) external { ... }", additions: 20, deletions: 8 }],
  },
  {
    id: "kiln-labs/cli#5", repoId: "kiln-labs/cli", number: 5,
    title: "Stream unseal for large envelopes", body: "Closes #4.",
    author: "harbor", state: "merged", fromBranch: "harbor:stream-unseal", toBranch: "main",
    createdAt: M, updatedAt: M, txHash: "0xpr000005", additions: 210, deletions: 40,
    comments: [], reviews: [{ author: "kiln-labs", state: "approve", body: "4 MiB leaves. Merged.", createdAt: M }],
    files: [{ path: "internal/seal/stream.go", patch: "+const Leaf = 4 << 20", additions: 12, deletions: 2 }],
  },
  {
    id: "lumen/zk-diff#8", repoId: "lumen/zk-diff", number: 8,
    title: "Bind path bytes in public inputs", body: "Draft — waiting on circuit review.",
    author: "northwind", state: "open", fromBranch: "northwind:path-bind", toBranch: "main",
    createdAt: P, updatedAt: P, txHash: "0xpr000008", additions: 67, deletions: 9,
    comments: [], reviews: [],
    files: [{ path: "circuits/diff.circom", patch: "+  signal input pathBytesHash;", additions: 6, deletions: 1 }],
  },
  {
    id: "itsnotailabs/medina#3", repoId: "itsnotailabs/medina", number: 3,
    title: "Zero-cost dispatch table for 25 languages", body: "Compile once. Edge pays a jump.",
    author: "itsnotailabs", state: "merged", fromBranch: "itsnotailabs:zero-cost", toBranch: "main",
    createdAt: I, updatedAt: I, txHash: "0xpr000103", additions: 188, deletions: 4,
    comments: [], reviews: [],
    files: [{ path: "src/ir.ts", patch: "+export const LANGS = 25;", additions: 8, deletions: 0 }],
  },
];

export const SEED_BRANCHES: Branch[] = [
  { name: "main", repoId: "kiln-labs/protocol", sha: "k7a19c4", protected: true, updatedAt: F },
  { name: "header-shape", repoId: "kiln-labs/protocol", sha: "k8b20d1", protected: false, updatedAt: F },
  { name: "main", repoId: "kiln-labs/cli", sha: "k55b0aa", protected: true, updatedAt: P },
  { name: "main", repoId: "meridian/escrow", sha: "k88c0ff", protected: true, updatedAt: F },
  { name: "main", repoId: "itsnotailabs/vlaptop", sha: "kvl0001", protected: true, updatedAt: NOW },
];

export const SEED_COMMITS: Commit[] = SEED_REPOS.flatMap((r) => {
  const files = r.files.map((f) => f.path);
  return [
    { sha: r.files[0]?.sha ?? "kgen000", repoId: r.id, message: "genesis", author: r.owner, createdAt: r.createdAt, files },
    { sha: r.files.at(-1)?.sha ?? "kupd000", repoId: r.id, message: r.files.at(-1)?.message ?? "update", author: r.owner, createdAt: r.updatedAt, files: files.slice(0, 3), parent: r.files[0]?.sha },
  ];
});

export const SEED_RELEASES: Release[] = [
  { id: "rel_protocol_094", repoId: "kiln-labs/protocol", tag: "v0.9.4", title: "v0.9.4 Header zeros", body: "Public trees keep a zero key commitment. Light clients stay on one decoder.", author: "kiln-labs", createdAt: F, prerelease: false, assets: [{ name: "kiln-protocol-0.9.4.tar.gz", size: "1.2 MB" }, { name: "checksums.txt", size: "412 B" }] },
  { id: "rel_cli_041", repoId: "kiln-labs/cli", tag: "v0.4.1", title: "v0.4.1 Stream unseal", body: "4 MiB leaves. Unseal envelopes over 32MB.", author: "kiln-labs", createdAt: M, prerelease: false, assets: [{ name: "kiln-linux-amd64", size: "8.4 MB" }] },
  { id: "rel_medina_12", repoId: "itsnotailabs/medina", tag: "v1.2.0", title: "Beat from the clock", body: "navigate(now) writes harmonicBeat(now).", author: "itsnotailabs", createdAt: I, prerelease: false, assets: [{ name: "medina-1.2.0.tgz", size: "84 KB" }] },
  { id: "rel_auro_r3", repoId: "itsnotailabs/auro14b", tag: "growth-rung-3", title: "Auro-156K-growth-r3 — 692K params", body: "Third exponential rung (115K → 198K → 363K → 692K). Function-preserving depth growth, loss still descending. GitHub: ItsNotAILABS/Auro14B/releases/tag/growth-rung-3.", author: "itsnotailabs", createdAt: "2026-09-10T20:09:10Z", prerelease: true, assets: [{ name: "weights.npz", size: "2.8 MB" }, { name: "receipt.json", size: "2 KB" }, { name: "config.json", size: "1 KB" }] },
  { id: "rel_auroweb_l1", repoId: "itsnotailabs/pocket", tag: "auro-web-v1-leg-1", title: "auro.web.v1 leg-1 — 1.08M params", body: "557K → 1.08M params (1.94x Net2Net widen). 300 steps on 2.26M chars real text, loss 11.40 → 3.16. GitHub: ItsNotAILABS/pocket/releases/tag/auro-web-v1-leg-1.", author: "itsnotailabs", createdAt: "2026-09-10T20:09:10Z", prerelease: true, assets: [{ name: "model.json", size: "22.5 MB" }, { name: "receipt.json", size: "2 KB" }] },
  { id: "rel_him_l1", repoId: "itsnotailabs/pocket", tag: "him-native-leg-1", title: "HIM-native leg-1 — 280K params", body: "147K → 280K params (1.91x Net2Net widen). 800 steps on 2.26M chars real text, loss 5.53 → 2.41. GitHub: ItsNotAILABS/pocket/releases/tag/him-native-leg-1.", author: "itsnotailabs", createdAt: "2026-09-10T20:09:10Z", prerelease: true, assets: [{ name: "weights.npz", size: "1.1 MB" }, { name: "receipt.json", size: "1 KB" }, { name: "config.json", size: "1 KB" }] },
  { id: "rel_voice_l1", repoId: "itsnotailabs/pocket", tag: "pocket-voice-complete-leg-1", title: "pocket-voice-complete leg-1 — 303K params", body: "142K → 303K params (2.14x). Eval accuracy 0.9845, beats base best 0.9800. GitHub: ItsNotAILABS/pocket/releases/tag/pocket-voice-complete-leg-1.", author: "itsnotailabs", createdAt: "2026-09-10T20:09:10Z", prerelease: true, assets: [{ name: "pytorch_model.bin", size: "1.2 MB" }, { name: "receipt.json", size: "1 KB" }, { name: "config.json", size: "1 KB" }] },
];

export const SEED_WIKI: WikiPage[] = [
  { repoId: "kiln-labs/protocol", slug: "Home", title: "Home", body: "# Protocol wiki\n\nKiln L1. Commits are transactions. This page is the working spec the engines run.\n\n- [Settlement](Settlement)\n- [Header](Header)", updatedAt: F, author: "kiln-labs" },
  { repoId: "kiln-labs/protocol", slug: "Settlement", title: "Settlement", body: "# Settlement\n\nEvery `git push` lands as a `commit` transaction. The block hash is canonical history.", updatedAt: F, author: "kiln-labs" },
  { repoId: "kiln-labs/protocol", slug: "Header", title: "Header", body: "# Header\n\n32-byte key commitment. Public trees write zeros; they do not omit the field.", updatedAt: F, author: "kiln-labs" },
  { repoId: "itsnotailabs/vlaptop", slug: "Home", title: "Home", body: "# vLaptop wiki\n\nSCREEN-KERNEL/1.1 is the public contract. Verbs: SEE, TOUCH, TYPE, CLICK.", updatedAt: NOW, author: "itsnotailabs" },
  { repoId: "itsnotailabs/pocket", slug: "Home", title: "Home", body: "# POCKET wiki\n\nShips with KILN. PhoneAI public seat. MCP apps. Host :8787.\n\n**Desktop / Edge** (`/desk`): Spark is a first-class agent. Seat a second agent and the desk auto-splits in one window — not standalone views. GitHub: [ItsNotAILABS/pocket](https://github.com/ItsNotAILABS/pocket) `9a637ea`.", updatedAt: NOW, author: "itsnotailabs" },
];

export const SEED_DISCUSSIONS: Discussion[] = [
  { id: "d1", repoId: "kiln-labs/protocol", number: 2, title: "Should gas for release drop below 40k?", body: "Small bounties die if we stay at 140k. 40k is the floor we can prove.", author: "meridian", category: "RFC", createdAt: P, comments: [{ id: "dc1", author: "kiln-labs", body: "Target is 40k in src/escrow.rs.", createdAt: F }] },
  { id: "d2", repoId: "itsnotailabs/neuroemergence", number: 4, title: "Coherence vs spike in production crews", body: "Publishing against dopamine peaks is the point. How do we measure it on-chain?", author: "lumen", category: "Research", createdAt: I, comments: [] },
];

export const SEED_PROJECTS: ProjectCard[] = [
  { id: "pc1", repoId: "kiln-labs/protocol", title: "Stable header", column: "In progress", issueId: "kiln-labs/protocol#41" },
  { id: "pc2", repoId: "kiln-labs/protocol", title: "Gas 40k", column: "Ready", issueId: "kiln-labs/protocol#38" },
  { id: "pc3", repoId: "kiln-labs/protocol", title: "Light client docs", column: "Backlog" },
  { id: "pc4", repoId: "kiln-labs/protocol", title: "Genesis audit", column: "Done" },
  { id: "pc5", repoId: "itsnotailabs/vlaptop", title: "Verb table freeze", column: "Ready", issueId: "itsnotailabs/vlaptop#1" },
];

export const SEED_RUNS: ActionRun[] = [
  { id: "run1", repoId: "kiln-labs/protocol", workflow: "protocol", event: "push", status: "success", branch: "main", sha: "k7a19c4", createdAt: F, duration: "1m 12s", logs: ["kiln verify --on-chain", "ok  header zeros", "ok  merkle fold", "cargo test -p kiln-protocol", "14 passed"] },
  { id: "run2", repoId: "kiln-labs/protocol", workflow: "protocol", event: "pull_request", status: "running", branch: "header-shape", sha: "k8b20d1", createdAt: F, duration: "—", logs: ["checking out harbor:header-shape", "kiln test"] },
  { id: "run3", repoId: "kiln-labs/cli", workflow: "cli", event: "push", status: "success", branch: "main", sha: "k55b0aa", createdAt: P, duration: "48s", logs: ["go test ./...", "ok"] },
  { id: "run4", repoId: "itsnotailabs/vlaptop", workflow: "ci", event: "workflow_dispatch", status: "success", branch: "main", sha: "kvl0001", createdAt: NOW, duration: "22s", logs: ["python -m pytest", "kernel verbs ok"] },
];

export const SEED_WORKFLOWS: WorkflowFile[] = SEED_REPOS.filter((r) => r.files.some((f) => f.path.startsWith(".github/workflows/"))).map((r) => ({
  repoId: r.id,
  name: r.name,
  path: ".github/workflows/ci.yml",
  on: ["push", "pull_request", "workflow_dispatch"],
  yaml: r.files.find((f) => f.path.startsWith(".github/workflows/"))?.content ?? "",
}));

export const SEED_ALERTS: SecurityAlert[] = [
  { id: "sa1", repoId: "meridian/escrow", severity: "high", package: "solc 0.8.19", summary: "Reentrancy on release when payer is a contract. Pull pattern required.", state: "open", createdAt: F },
  { id: "sa2", repoId: "kiln-labs/cli", severity: "medium", package: "golang.org/x/crypto", summary: "Advisory on nonce reuse in an unused helper. Not reachable from unseal.", state: "fixed", createdAt: M },
  { id: "sa3", repoId: "lumen/zk-diff", severity: "critical", package: "circomlib", summary: "Path not bound in public inputs — a prover can swap files.", state: "open", createdAt: F },
];

export const SEED_PACKAGES: PackageItem[] = [
  { id: "pkg1", repoId: "kiln-labs/sealed-fs", name: "@kiln/sealed-fs", ecosystem: "npm", version: "2.1.0", downloads: 18420, updatedAt: F },
  { id: "pkg2", repoId: "kiln-labs/cli", name: "kiln", ecosystem: "container", version: "0.4.1", downloads: 9021, updatedAt: P },
  { id: "pkg3", repoId: "kiln-labs/protocol", name: "kiln-protocol", ecosystem: "cargo", version: "0.9.4", downloads: 4412, updatedAt: F },
];

export const SEED_GISTS: Gist[] = [
  { id: "g1", owner: "itsnotailabs", description: "φ-beat one-liner", public: true, files: [{ name: "beat.ts", language: "TypeScript", content: "export const PHI = 1.618033988749895;\nexport const beat = (t: number) => (t / 1000) * PHI % 1;\n" }], createdAt: I, updatedAt: I, stars: 18 },
  { id: "g2", owner: "kiln-labs", description: "Commit header hex dump", public: true, files: [{ name: "header.rs", language: "Rust", content: "pub const HEADER: usize = 136;\n" }], createdAt: F, updatedAt: F, stars: 44 },
];

export const SEED_AGENTS: Agent[] = [
  { id: "agent_indra_vlaptop", repoId: "itsnotailabs/vlaptop", name: "Indra", role: "indexer", resident: true, modelId: "grok-4.6", status: "idle" },
  { id: "agent_keeper_protocol", repoId: "kiln-labs/protocol", name: "Keeper", role: "cipher", resident: true, modelId: "grok-4.6", status: "idle" },
];

export const SEED_DOMAINS: Domain[] = [
  { id: "dom_itsnotailabs-vlaptop", repoId: "itsnotailabs/vlaptop", host: "itsnotailabs-vlaptop.kiln.app", kind: "kiln", status: "live", https: true, createdAt: NOW },
  { id: "dom_protocol", repoId: "kiln-labs/protocol", host: "kiln-labs-protocol.kiln.app", kind: "kiln", status: "live", https: true, createdAt: F },
];

export const SEED_LISTINGS: Listing[] = [
  { id: "lst_protocol", repoId: "kiln-labs/protocol", title: "Kiln L1 runtime", priceKln: 0, category: "protocol" },
  { id: "lst_escrow", repoId: "meridian/escrow", title: "Issue-locked escrow", priceKln: 1800, category: "defi" },
  { id: "lst_zkdiff", repoId: "lumen/zk-diff", title: "zk-diff circuits", priceKln: 420, category: "research" },
  { id: "lst_medina", repoId: "itsnotailabs/medina", title: "MEDINA memory", priceKln: 2400, category: "model" },
];

export const KILN_APPS = [
  { id: "actions", name: "Kiln Actions", publisher: "kiln-labs", blurb: "Run .github/workflows on the repository computer.", category: "ci" },
  { id: "pages", name: "Kiln Pages", publisher: "kiln-labs", blurb: "Publish the working tree as a sealed preview URL.", category: "dev" },
  { id: "webgpu", name: "WebGPU Runtime", publisher: "kiln-labs", blurb: "Merkle hashing and lattice paint on the GPU.", category: "gpu" },
  { id: "grok-reviewer", name: "Grok Reviewer", publisher: "xAI", blurb: "Resident reviewer agent. Comments on pulls.", category: "ai" },
  { id: "dependabot", name: "Dependabot", publisher: "kiln-labs", blurb: "Opens pulls when a sealed dependency moves.", category: "security" },
  { id: "codespaces", name: "Kiln Computer", publisher: "kiln-labs", blurb: "The repo is the machine. kilnsh on boot.", category: "dev" },
];
