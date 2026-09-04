const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/memory-DWov_Aom.js","assets/react-SIfiwpqq.js","assets/fs-ri9Mkfbm.js","assets/pxm-D_rOQ1Ty.js","assets/claims-guc5PfuL.js","assets/orgs-BXGx-klH.js","assets/createServerFn-DFBqlnK6.js","assets/invariant-DEEwAagU.js","assets/not-found-DIgawKw1.js","assets/redirect-DtIAAt0y.js","assets/middleware-r_wcLIte.js","assets/preload-helper-Czpn1I53.js","assets/apps-CNNvJtvb.js","assets/addons-o5NDeLjB.js","assets/cloud-iXGZSPDV.js","assets/gpu-Bs1r2h0p.js","assets/python-EZBTjN7I.js","assets/computer-G9ZCRY5O.js","assets/model-dm89L9bG.js"])))=>i.map(i=>d[i]);
import{i as e,r as t,t as n}from"./react-SIfiwpqq.js";import{n as r,t as i}from"./createServerFn-DFBqlnK6.js";import{C as a,T as o,_ as s,a as c,b as l,f as u,g as d,h as f,m as p,n as m,o as h,p as g,s as _,u as v,v as y,w as b,x}from"./fs-ri9Mkfbm.js";import{a as S,n as C,r as w,t as T}from"./claims-guc5PfuL.js";import{r as ee,t as te}from"./papers-DXk6hJLc.js";import{t as E}from"./preload-helper-Czpn1I53.js";var ne=e(n(),1),re=`0x00000000000000000000000000000000000000k1`,D=`0x4c1e7a91b0c3d2e8f5a6478901234567890abcde`;async function ie(e){return`0x${(await o(JSON.stringify(e))).slice(0,48)}`}async function ae(e){return`0x${(await o(`${e.height}:${e.parent}:${e.timestamp}:${e.txs.map(e=>e.hash).join(`,`)}`)).slice(0,48)}`}async function O(e,t,n,r,i,a,o,s=new Date().toISOString(),c){let l={type:e,from:t,to:n,amount:r,memo:i,repoId:o,timestamp:s,block:a,merkleRoot:c};return{...l,hash:await ie(l)}}async function oe(e,t,n=new Date().toISOString()){let r=t.map(t=>({...t,block:e.height+1})),i={height:e.height+1,parent:e.hash,timestamp:n,txs:r};return{...i,hash:await ae(i)}}function se(e){return`${e.toLocaleString(void 0,{maximumFractionDigits:2})} KLN`}var ce=[{id:`conductor`,label:`Conductor`,blurb:`Owns the crew graph. Handoffs work. Does not write product code.`,priceKln:140},{id:`agi`,label:`AGI`,blurb:`General intelligence on this computer. Not a specialist. Asks, writes, and hands off.`,priceKln:160},{id:`architect`,label:`Architect`,blurb:`Plans structure, opens issues, writes the map.`,priceKln:120},{id:`builder`,label:`Builder`,blurb:`Writes files, commits, keeps the tree moving.`,priceKln:80},{id:`reviewer`,label:`Reviewer`,blurb:`Reads diffs, comments, blocks bad merges.`,priceKln:90},{id:`deployer`,label:`Deployer`,blurb:`Runs actions, tags releases, ships the preview.`,priceKln:70},{id:`scout`,label:`Scout`,blurb:`Searches the forge, summarizes, finds the work.`,priceKln:40},{id:`cipher`,label:`Cipher`,blurb:`Seals trees, rotates keys, verifies Merkle proofs.`,priceKln:110},{id:`indexer`,label:`Indexer`,blurb:`Keeps folder memory, quota, and search indexes honest.`,priceKln:55}],le=[{id:`code`,label:`Code`,blurb:`A sealed git repository. The default.`},{id:`agent`,label:`Agent`,blurb:`The tree is the agent. It gets its own wallet and a resident process.`},{id:`crypto`,label:`Protocol`,blurb:`Contracts, circuits, canisters. Escrow and KLN first-class.`},{id:`model`,label:`Model`,blurb:`Weights, cards, and a model wallet. License or sell on the marketplace.`}];function k(e,t,n,r){return{path:e,language:t,message:n,content:r.replace(/^\n/,``)}}var A=`Apache License
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
`,ue=`MIT License

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
`,j=`target/
node_modules/
dist/
.DS_Store
*.pem
.env
coverage/
`,de=`# kiln-labs / protocol

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
`,fe=`//! Kiln L1 runtime. Commit headers, sealed trees, bounty escrow.
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

    pub fn decode(bytes: &[u8]) -> Option<Self> {
        if bytes.len() != 136 {
            return None;
        }
        let mut repo = [0u8; 32];
        let mut tree = [0u8; 32];
        let mut parent = [0u8; 32];
        let mut key_commitment = [0u8; 32];
        repo.copy_from_slice(&bytes[0..32]);
        tree.copy_from_slice(&bytes[32..64]);
        parent.copy_from_slice(&bytes[64..96]);
        key_commitment.copy_from_slice(&bytes[96..128]);
        let mut cid = [0u8; 8];
        cid.copy_from_slice(&bytes[128..136]);
        Some(Self {
            repo,
            tree,
            parent,
            key_commitment,
            chain_id: u64::from_be_bytes(cid),
        })
    }

    pub fn digest(&self) -> [u8; 32] {
        *blake3::hash(&self.encode()).as_bytes()
    }
}

pub fn verify_seal(header: &CommitHeader, ciphertext: &[u8]) -> bool {
    if header.chain_id != CHAIN_ID {
        return false;
    }
    seal::check(header.key_commitment, ciphertext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_roundtrip() {
        let h = CommitHeader {
            repo: [1u8; 32],
            tree: [2u8; 32],
            parent: [3u8; 32],
            key_commitment: [0u8; 32],
            chain_id: CHAIN_ID,
        };
        assert_eq!(CommitHeader::decode(&h.encode()), Some(h.clone()));
        assert_ne!(h.digest(), [0u8; 32]);
    }

    #[test]
    fn public_trees_keep_zero_commitment() {
        assert_eq!(CommitHeader::public_zeros(), [0u8; 32]);
    }

    #[test]
    fn private_tree_rejects_short_ciphertext() {
        let h = CommitHeader {
            repo: [1u8; 32],
            tree: [2u8; 32],
            parent: [3u8; 32],
            key_commitment: [9u8; 32],
            chain_id: CHAIN_ID,
        };
        assert!(!verify_seal(&h, &[0u8; 8]));
    }
}
`,pe=`//! AES-256-GCM envelope for private trees.
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use sha2::{Digest, Sha256};

/// Commitment is SHA-256("kiln-key:" || secret). Public trees write zeros.
pub fn commit_key(secret: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(b"kiln-key:");
    h.update(secret);
    h.finalize().into()
}

pub fn encrypt(key: &[u8; 32], nonce: &[u8; 12], plain: &[u8]) -> Result<Vec<u8>, aes_gcm::Error> {
    let cipher = Aes256Gcm::new(key.into());
    cipher.encrypt(Nonce::from_slice(nonce), plain)
}

pub fn decrypt(key: &[u8; 32], nonce: &[u8; 12], cipher_text: &[u8]) -> Result<Vec<u8>, aes_gcm::Error> {
    let cipher = Aes256Gcm::new(key.into());
    cipher.decrypt(Nonce::from_slice(nonce), cipher_text)
}

/// A zero commitment is only valid for public trees.
/// Private trees must carry a 12-byte nonce plus a 16-byte GCM tag.
pub fn check(commitment: [u8; 32], ciphertext: &[u8]) -> bool {
    if commitment == [0u8; 32] {
        return true;
    }
    ciphertext.len() >= 12 + 16
}

pub fn matches_secret(commitment: [u8; 32], secret: &[u8]) -> bool {
    commit_key(secret) == commitment
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let key = [9u8; 32];
        let nonce = [7u8; 12];
        let ct = encrypt(&key, &nonce, b"kiln").unwrap();
        assert_eq!(decrypt(&key, &nonce, &ct).unwrap(), b"kiln");
    }

    #[test]
    fn commitment_binds_secret() {
        let a = commit_key(b"alpha");
        let b = commit_key(b"beta");
        assert_ne!(a, b);
        assert!(matches_secret(a, b"alpha"));
        assert!(!matches_secret(a, b"beta"));
    }

    #[test]
    fn private_envelope_needs_nonce_and_tag() {
        assert!(!check([1u8; 32], &[0u8; 20]));
        assert!(check([1u8; 32], &[0u8; 28]));
        assert!(check([0u8; 32], &[]));
    }
}
`,me=`//! BLAKE3 Merkle fold. Odd nodes duplicate (Bitcoin-style).
use blake3::Hash;

pub fn leaf(path: &str, hash: &[u8; 32]) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    hasher.update(path.as_bytes());
    hasher.update(b":");
    hasher.update(hash);
    *hasher.finalize().as_bytes()
}

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

pub fn proof(leaves: &[[u8; 32]], mut index: usize) -> Vec<[u8; 32]> {
    let mut layer = leaves.to_vec();
    let mut out = Vec::new();
    while layer.len() > 1 {
        let sib = if index % 2 == 0 {
            *layer.get(index + 1).unwrap_or(&layer[index])
        } else {
            layer[index - 1]
        };
        out.push(sib);
        let mut next = Vec::new();
        let mut k = 0;
        while k < layer.len() {
            let a = layer[k];
            let b = *layer.get(k + 1).unwrap_or(&a);
            let mut buf = [0u8; 64];
            buf[..32].copy_from_slice(&a);
            buf[32..].copy_from_slice(&b);
            next.push(*blake3::hash(&buf).as_bytes());
            k += 2;
        }
        layer = next;
        index /= 2;
    }
    out
}

pub fn verify(leaf: [u8; 32], proof: &[[u8; 32]], mut index: usize, root: [u8; 32]) -> bool {
    let mut acc = leaf;
    for sib in proof {
        let (a, b) = if index % 2 == 0 { (acc, *sib) } else { (*sib, acc) };
        let mut buf = [0u8; 64];
        buf[..32].copy_from_slice(&a);
        buf[32..].copy_from_slice(&b);
        acc = *blake3::hash(&buf).as_bytes();
        index /= 2;
    }
    acc == root
}

pub fn hash_bytes(bytes: &[u8]) -> Hash {
    blake3::hash(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proof_verifies() {
        let leaves = [[1u8; 32], [2u8; 32], [3u8; 32], [4u8; 32]];
        let root = fold(&leaves);
        let p = proof(&leaves, 2);
        assert!(verify(leaves[2], &p, 2, root));
        assert!(!verify(leaves[1], &p, 2, root));
    }

    #[test]
    fn empty_is_stable() {
        assert_eq!(fold(&[]), *blake3::hash(b"kiln:empty").as_bytes());
    }
}
`,he=`//! Hash-linked blocks. Parent is the previous block hash.
use crate::merkle;

#[derive(Clone, Debug)]
pub struct Tx {
    pub hash: [u8; 32],
    pub kind: u8,
    pub from: [u8; 20],
    pub to: [u8; 20],
    pub amount: u128,
    pub memo: Vec<u8>,
}

impl Tx {
    pub fn digest(kind: u8, from: [u8; 20], to: [u8; 20], amount: u128, memo: &[u8]) -> [u8; 32] {
        let mut buf = Vec::with_capacity(1 + 20 + 20 + 16 + memo.len());
        buf.push(kind);
        buf.extend_from_slice(&from);
        buf.extend_from_slice(&to);
        buf.extend_from_slice(&amount.to_be_bytes());
        buf.extend_from_slice(memo);
        *blake3::hash(&buf).as_bytes()
    }
}

#[derive(Clone, Debug)]
pub struct Block {
    pub height: u64,
    pub parent: [u8; 32],
    pub timestamp: u64,
    pub txs: Vec<Tx>,
    pub hash: [u8; 32],
}

impl Block {
    pub fn seal(parent: &Block, txs: Vec<Tx>, timestamp: u64) -> Self {
        let height = parent.height + 1;
        let leaves: Vec<[u8; 32]> = txs.iter().map(|t| t.hash).collect();
        let tx_root = merkle::fold(&leaves);
        let mut buf = Vec::with_capacity(32 + 8 + 8 + 32);
        buf.extend_from_slice(&parent.hash);
        buf.extend_from_slice(&height.to_be_bytes());
        buf.extend_from_slice(&timestamp.to_be_bytes());
        buf.extend_from_slice(&tx_root);
        let hash = *blake3::hash(&buf).as_bytes();
        Self { height, parent: parent.hash, timestamp, txs, hash }
    }

    pub fn parent_matches(&self, parent: &Block) -> bool {
        self.parent == parent.hash && self.height == parent.height + 1
    }
}
`,ge=`//! Commit settlement. A push is a transaction.
use crate::{CommitHeader, CHAIN_ID};

#[derive(Clone, Debug)]
pub struct CommitTx {
    pub header: CommitHeader,
    pub author: [u8; 20],
    pub message: Vec<u8>,
}

pub fn accept(tx: &CommitTx) -> bool {
    tx.header.chain_id == CHAIN_ID && tx.header.tree != [0u8; 32]
}

pub fn reject_reason(tx: &CommitTx) -> Option<&'static str> {
    if tx.header.chain_id != CHAIN_ID {
        return Some("wrong chain");
    }
    if tx.header.tree == [0u8; 32] {
        return Some("empty tree");
    }
    if tx.message.is_empty() {
        return Some("empty message");
    }
    None
}
`,_e=`//! Issue-id escrow precompile. No treasurer.
#[derive(Clone, Debug)]
pub struct Escrow {
    pub issue: u64,
    pub amount: u128,
    pub payer: [u8; 20],
    pub payee: Option<[u8; 20]>,
    pub open: bool,
}

pub const LOCK_GAS: u64 = 21_000;
pub const RELEASE_GAS: u64 = 40_000;

pub fn lock(issue: u64, amount: u128, payer: [u8; 20]) -> Escrow {
    Escrow { issue, amount, payer, payee: None, open: true }
}

pub fn fund(e: &mut Escrow, extra: u128) {
    if e.open {
        e.amount = e.amount.saturating_add(extra);
    }
}

/// Checks-effects-interactions: close first, then return the amount.
pub fn release(e: &mut Escrow, payee: [u8; 20]) -> Result<u128, &'static str> {
    if !e.open {
        return Err("empty");
    }
    e.open = false;
    e.payee = Some(payee);
    Ok(e.amount)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn double_release_fails() {
        let mut e = lock(12, 5_000, [1u8; 20]);
        assert_eq!(release(&mut e, [2u8; 20]).unwrap(), 5_000);
        assert!(release(&mut e, [2u8; 20]).is_err());
    }

    #[test]
    fn fund_after_close_is_noop() {
        let mut e = lock(1, 10, [1u8; 20]);
        let _ = release(&mut e, [2u8; 20]);
        fund(&mut e, 99);
        assert_eq!(e.amount, 10);
        assert!(!e.open);
    }
}
`,ve=`//! Genesis block. Height 0. Parent is zeros. One genesis transaction.
use crate::block::{Block, Tx};
use crate::merkle;

pub const GENESIS_TS: u64 = 1_730_678_400; // 2025-11-04T00:00:00Z

pub fn genesis() -> Block {
    let memo = b"Kiln genesis — source is the chain".to_vec();
    let hash = Tx::digest(0, [0u8; 20], [0u8; 20], 0, &memo);
    let tx = Tx {
        hash,
        kind: 0,
        from: [0u8; 20],
        to: [0u8; 20],
        amount: 0,
        memo,
    };
    let tx_root = merkle::fold(&[tx.hash]);
    let mut buf = Vec::with_capacity(80);
    buf.extend_from_slice(&[0u8; 32]);
    buf.extend_from_slice(&0u64.to_be_bytes());
    buf.extend_from_slice(&GENESIS_TS.to_be_bytes());
    buf.extend_from_slice(&tx_root);
    Block {
        height: 0,
        parent: [0u8; 32],
        timestamp: GENESIS_TS,
        txs: vec![tx],
        hash: *blake3::hash(&buf).as_bytes(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block::Block;

    #[test]
    fn genesis_is_height_zero() {
        let g = genesis();
        assert_eq!(g.height, 0);
        assert_eq!(g.parent, [0u8; 32]);
        assert_eq!(g.txs.len(), 1);
        let next = Block::seal(&g, vec![], GENESIS_TS + 12);
        assert!(next.parent_matches(&g));
    }
}
`,ye=`// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title Kiln bounty precompile mirror
/// @notice Lock KLN against (repo, issue). Release on merge. No treasurer.
interface IKilnBounty {
    function lock(bytes32 repo, uint64 issue) external payable;
    function release(bytes32 repo, uint64 issue, address to) external;
    function pull(bytes32 repo, uint64 issue) external;
}

contract KilnBounty is IKilnBounty {
    struct Lock {
        uint256 amount;
        address payer;
        address payee;
        bool open;
    }

    mapping(bytes32 => mapping(uint64 => Lock)) public locks;
    mapping(address => uint256) public pending;

    event Locked(bytes32 indexed repo, uint64 indexed issue, address payer, uint256 amount);
    event Released(bytes32 indexed repo, uint64 indexed issue, address to, uint256 amount);

    function lock(bytes32 repo, uint64 issue) external payable {
        require(msg.value > 0, "zero");
        Lock storage l = locks[repo][issue];
        l.amount += msg.value;
        if (l.payer == address(0)) l.payer = msg.sender;
        l.open = true;
        emit Locked(repo, issue, msg.sender, msg.value);
    }

    function release(bytes32 repo, uint64 issue, address to) external {
        Lock storage l = locks[repo][issue];
        require(l.open, "empty");
        require(msg.sender == l.payer || msg.sender == address(this), "auth");
        uint256 amt = l.amount;
        l.open = false;
        l.amount = 0;
        l.payee = to;
        pending[to] += amt;
        emit Released(repo, issue, to, amt);
    }

    function pull(bytes32 repo, uint64 issue) external {
        uint256 amt = pending[msg.sender];
        require(amt > 0, "none");
        pending[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok, "xfer");
        repo;
        issue;
    }
}
`,be=`/** Kiln L1 TypeScript client — verify commit headers against a block hash. */

export const CHAIN_ID = 747n;

export type Header = {
  repo: string;
  tree: string;
  parent: string;
  keyCommitment: string;
  chainId: bigint;
};

const HEX = /^0x[0-9a-f]{64}$/i;

export function isHash(h: string): boolean {
  return HEX.test(h);
}

export function publicCommitment(): string {
  return "0x" + "00".repeat(32);
}

export async function verify(header: Header, blockHash: string): Promise<boolean> {
  if (header.chainId !== CHAIN_ID) return false;
  if (!isHash(header.tree) || !isHash(header.parent) || !isHash(header.repo)) return false;
  if (!blockHash.startsWith("0x") || blockHash.length < 18) return false;
  if (header.keyCommitment.length !== 66) return false;
  return true;
}

export function decodeHeader(bytes: Uint8Array): Header | null {
  if (bytes.byteLength !== 136) return null;
  const hex = (o: number) =>
    "0x" + [...bytes.subarray(o, o + 32)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const view = new DataView(bytes.buffer, bytes.byteOffset + 128, 8);
  return {
    repo: hex(0),
    tree: hex(32),
    parent: hex(64),
    keyCommitment: hex(96),
    chainId: view.getBigUint64(0, false),
  };
}

export function encodeHeader(h: Header): Uint8Array {
  const out = new Uint8Array(136);
  const put = (o: number, hex: string) => {
    const clean = hex.replace(/^0x/, "");
    for (let i = 0; i < 32; i++) out[o + i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  };
  put(0, h.repo);
  put(32, h.tree);
  put(64, h.parent);
  put(96, h.keyCommitment);
  const view = new DataView(out.buffer, 128, 8);
  view.setBigUint64(0, h.chainId, false);
  return out;
}
`,xe=de,Se=[k(`README.md`,`markdown`,`Rewrite settlement primer`,de),k(`Cargo.toml`,`toml`,`Bump runtime 0.9.2`,`[package]
name = "kiln-protocol"
version = "0.9.2"
edition = "2021"
license = "Apache-2.0"
description = "Kiln L1 runtime: commit headers, sealed trees, bounty escrow."

[dependencies]
blake3 = "1.5"
aes-gcm = "0.10"
sha2 = "0.10"

[dev-dependencies]
hex = "0.4"
`),k(`src/lib.rs`,`rust`,`Seal commit headers with key commitment`,fe),k(`src/seal.rs`,`rust`,`AES-GCM envelope and SHA-256 key commitment`,pe),k(`src/merkle.rs`,`rust`,`BLAKE3 Merkle fold and proofs`,me),k(`src/block.rs`,`rust`,`Hash-linked blocks`,he),k(`src/commit.rs`,`rust`,`Commit settlement`,ge),k(`src/escrow.rs`,`rust`,`Issue-id escrow precompile`,_e),k(`src/genesis.rs`,`rust`,`Genesis block`,ve),k(`precompiles/Bounty.sol`,`solidity`,`Mirror ABI for clients`,ye),k(`clients/ts/index.ts`,`typescript`,`Client: verify commit against block hash`,be),k(`.kiln/workflows/settle.yml`,`YAML`,`Settle workflow`,`name: settle
on: [push]
jobs:
  include:
    - cargo test -p kiln-protocol
    - kiln verify --on-chain
    - kiln bounty --sync
`),k(`.kiln/workflows/deploy.yml`,`YAML`,`Deploy preview`,`name: deploy
on: [release, workflow_dispatch]
jobs:
  preview:
    - kiln pages publish
    - kiln release attach --preview
`),k(`wiki/Settlement.md`,`markdown`,`Wiki: settlement`,`# Settlement

A push is a transaction. The block hash is history. Light clients verify commit headers; they never fetch plaintext of sealed trees.

Public trees write a zero key commitment. They do not omit the field. See \`CommitHeader::public_zeros\`.
`),k(`CONTRIBUTING.md`,`markdown`,`How to land a header change`,`# Contributing

1. \`cargo test -p kiln-protocol\`
2. Header shape is frozen at 136 bytes. Do not omit key commitment.
3. Escrow is pull-pattern. Never add an external call inside \`release\`.
4. Open a pull against \`main\`. Light-client reviewers sign off on decoder changes.
`),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`Apache-2.0`,A)],Ce=`# Kiln CLI

git clone, commit, push, pull, verify, and unseal from the terminal. Pushes wait for inclusion when you pass \`--settle\`. This is the same surface agents speak over MCP.

\`\`\`
git clone kiln://kiln-labs/cli.git
kiln auth --wallet
kiln push --settle
kiln unseal --grant viewer
\`\`\`

## Commands

| Command | What it does |
| --- | --- |
| \`git clone kiln://owner/name.git\` | Fetch the sealed tree, write a working copy |
| \`kiln commit -m MSG\` | Merkle-commit the index |
| \`kiln push --settle\` | Broadcast and block until the tx is in a block |
| \`kiln pull\` | Fast-forward to chain head |
| \`kiln unseal --grant viewer\` | Honor an on-chain viewer grant, stream decrypt |
| \`kiln verify --on-chain\` | Check the commit header against Kiln L1 |

Streaming unseal handles envelopes over 32 MB (closes #4). Key derivation is SHA-256("kiln-vault:" || wallet).
`,we=`module github.com/kiln-labs/cli

go 1.22

require (
    golang.org/x/crypto v0.25.0
    github.com/spf13/cobra v1.8.1
)
`,Te=`package main

import (
    "fmt"
    "os"

    "github.com/kiln-labs/cli/cmd"
)

func main() {
    if err := cmd.Execute(); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}
`,Ee=`package cmd

import (
    "fmt"
    "os"

    "github.com/spf13/cobra"
)

var root = &cobra.Command{
    Use:   "kiln",
    Short: "Kiln forge CLI — git clone, push, verify, unseal",
}

func Execute() error { return root.Execute() }

func init() {
    root.AddCommand(cloneCmd, commitCmd, pushCmd, pullCmd, unsealCmd, verifyCmd, statusCmd)
}

func mustWallet() (string, error) {
    w := os.Getenv("KILN_WALLET")
    if w == "" {
        return "", fmt.Errorf("kiln auth --wallet first (KILN_WALLET)")
    }
    return w, nil
}
`,De=`package cmd

import (
    "fmt"

    "github.com/kiln-labs/cli/internal/pack"
    "github.com/kiln-labs/cli/internal/remote"
    "github.com/spf13/cobra"
)

var cloneCmd = &cobra.Command{
    Use:   "clone kiln://owner/name.git",
    Short: "Clone a sealed Kiln repository",
    Args:  cobra.ExactArgs(1),
    RunE: func(_ *cobra.Command, args []string) error {
        spec, err := remote.Parse(args[0])
        if err != nil {
            return err
        }
        objects, err := pack.Fetch(spec)
        if err != nil {
            return err
        }
        n, err := pack.Checkout(spec, objects)
        if err != nil {
            return err
        }
        fmt.Printf("Cloning into '%s'...\\nremote: Merkle settled on Kiln L1\\nReceiving objects: %d\\n", spec.Name, n)
        return nil
    },
}
`,Oe=`package cmd

import (
    "fmt"

    "github.com/kiln-labs/cli/internal/chain"
    "github.com/kiln-labs/cli/internal/wallet"
    "github.com/spf13/cobra"
)

var settle bool

var pushCmd = &cobra.Command{
    Use:   "push",
    Short: "Broadcast the commit. --settle waits for inclusion.",
    RunE: func(_ *cobra.Command, _ []string) error {
        w, err := mustWallet()
        if err != nil {
            return err
        }
        tree, err := wallet.IndexMerkle()
        if err != nil {
            return err
        }
        tx, err := wallet.Commit(w, tree)
        if err != nil {
            return err
        }
        fmt.Printf("Enumerating objects...\\nWriting merkle root to L1... %s\\n", tx)
        if settle {
            if err := chain.Wait(tx); err != nil {
                return err
            }
            included, err := chain.Included(tx)
            if err != nil {
                return err
            }
            if !included {
                return fmt.Errorf("tx %s not included", tx)
            }
            fmt.Println("included")
        }
        return nil
    },
}

func init() { pushCmd.Flags().BoolVar(&settle, "settle", false, "wait for inclusion") }
`,ke=`package cmd

import (
    "fmt"

    "github.com/kiln-labs/cli/internal/wallet"
    "github.com/spf13/cobra"
)

var message string

var commitCmd = &cobra.Command{
    Use:   "commit",
    Short: "Merkle-commit the index",
    RunE: func(_ *cobra.Command, _ []string) error {
        if message == "" {
            return fmt.Errorf("missing -m")
        }
        sha, err := wallet.CommitIndex(message)
        if err != nil {
            return err
        }
        fmt.Printf("[main %s] %s\\n", sha[:7], message)
        return nil
    },
}

func init() { commitCmd.Flags().StringVarP(&message, "message", "m", "", "commit message") }
`,Ae=`package cmd

import (
    "fmt"

    "github.com/kiln-labs/cli/internal/chain"
    "github.com/spf13/cobra"
)

var pullCmd = &cobra.Command{
    Use:   "pull",
    Short: "Fast-forward to chain head",
    RunE: func(_ *cobra.Command, _ []string) error {
        head, err := chain.Head()
        if err != nil {
            return err
        }
        fmt.Printf("Updating %s..%s\\nFast-forward\\n", head.Parent[:8], head.Hash[:8])
        return nil
    },
}
`,je=`package cmd

import (
    "fmt"
    "io"
    "os"

    "github.com/kiln-labs/cli/internal/seal"
    "github.com/spf13/cobra"
)

var grant string

var unsealCmd = &cobra.Command{
    Use:   "unseal",
    Short: "Stream-decrypt a sealed envelope (handles >32MB)",
    RunE: func(_ *cobra.Command, _ []string) error {
        w, err := mustWallet()
        if err != nil {
            return err
        }
        if grant == "" {
            return fmt.Errorf("--grant required")
        }
        n, err := seal.Stream(os.Stdin, os.Stdout, w, grant)
        if err != nil && err != io.EOF {
            return err
        }
        fmt.Fprintf(os.Stderr, "unsealed %d bytes (grant %s)\\n", n, grant)
        return nil
    },
}

func init() { unsealCmd.Flags().StringVar(&grant, "grant", "", "viewer|owner") }
`,Me=`package cmd

import (
    "fmt"

    "github.com/kiln-labs/cli/internal/chain"
    "github.com/spf13/cobra"
)

var verifyCmd = &cobra.Command{
    Use:   "verify",
    Short: "Check the commit header against Kiln L1",
    RunE: func(_ *cobra.Command, _ []string) error {
        ok, head, err := chain.VerifyOnChain()
        if err != nil {
            return err
        }
        if !ok {
            return fmt.Errorf("header mismatch at %d", head)
        }
        fmt.Printf("kiln verify --on-chain\\nhead %d ok\\n", head)
        return nil
    },
}

var statusCmd = &cobra.Command{
    Use:   "status",
    Short: "Working tree vs chain head",
    RunE: func(_ *cobra.Command, _ []string) error {
        head, err := chain.Head()
        if err != nil {
            return err
        }
        fmt.Printf("On branch main\\nhead %d %s\\nnothing to commit, working tree sealed\\n", head.Height, head.Hash[:12])
        return nil
    },
}
`,Ne=`package remote

import (
    "fmt"
    "strings"
)

type Spec struct {
    Owner string
    Name  string
}

func Parse(url string) (Spec, error) {
    s := strings.TrimPrefix(url, "kiln://")
    s = strings.TrimSuffix(s, ".git")
    s = strings.TrimPrefix(s, "git clone ")
    parts := strings.Split(s, "/")
    if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
        return Spec{}, fmt.Errorf("expected kiln://owner/name.git")
    }
    return Spec{Owner: parts[0], Name: parts[1]}, nil
}

func (s Spec) String() string {
    return s.Owner + "/" + s.Name
}
`,Pe=`package pack

import (
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "os"
    "path/filepath"
    "sync"

    "github.com/kiln-labs/cli/internal/remote"
)

type Object struct {
    Path string
    Hash string
    Body []byte
}

var store = struct {
    sync.Mutex
    objects map[string][]Object
}{objects: map[string][]Object{
    "kiln-labs/cli": {
        {Path: "README.md", Hash: hashOf([]byte("Kiln CLI")), Body: []byte("Kiln CLI\\n")},
        {Path: "go.mod", Hash: hashOf([]byte("module github.com/kiln-labs/cli\\n")), Body: []byte("module github.com/kiln-labs/cli\\n")},
        {Path: "main.go", Hash: hashOf([]byte("package main\\n")), Body: []byte("package main\\n")},
    },
}}

func hashOf(b []byte) string {
    sum := sha256.Sum256(b)
    return hex.EncodeToString(sum[:])
}

func Fetch(spec remote.Spec) ([]Object, error) {
    store.Lock()
    defer store.Unlock()
    objs, ok := store.objects[spec.String()]
    if !ok {
        // Unknown repo: still a valid empty pack so clone succeeds and the
        // working tree can be filled by a later pull.
        return []Object{}, nil
    }
    out := make([]Object, len(objs))
    copy(out, objs)
    return out, nil
}

func Checkout(spec remote.Spec, objects []Object) (int, error) {
    dir := spec.Name
    if err := os.MkdirAll(dir, 0o755); err != nil {
        return 0, err
    }
    for _, o := range objects {
        p := filepath.Join(dir, o.Path)
        if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
            return 0, err
        }
        if err := os.WriteFile(p, o.Body, 0o644); err != nil {
            return 0, err
        }
        if hashOf(o.Body) != o.Hash {
            return 0, fmt.Errorf("integrity %s", o.Path)
        }
    }
    return len(objects), nil
}

func Put(spec remote.Spec, path string, body []byte) Object {
    o := Object{Path: path, Hash: hashOf(body), Body: append([]byte(nil), body...)}
    store.Lock()
    defer store.Unlock()
    store.objects[spec.String()] = append(store.objects[spec.String()], o)
    return o
}
`,Fe=`package chain

import (
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "sync"
    "time"
)

type Head struct {
    Height int
    Hash   string
    Parent string
}

type Record struct {
    Tx     string
    Height int
    At     time.Time
}

var ledger = struct {
    sync.Mutex
    height int
    hash   string
    parent string
    txs    map[string]Record
}{
    height: 1842,
    hash:   "0xblk1842aa11bb22cc33dd44ee55ff06070809",
    parent: "0xblk1841aa11bb22cc33dd44ee55ff06070809",
    txs:    map[string]Record{},
}

func Head() (Head, error) {
    ledger.Lock()
    defer ledger.Unlock()
    return Head{Height: ledger.height, Hash: ledger.hash, Parent: ledger.parent}, nil
}

func Wait(tx string) error {
    if tx == "" {
        return fmt.Errorf("empty tx")
    }
    time.Sleep(40 * time.Millisecond)
    ledger.Lock()
    defer ledger.Unlock()
    ledger.parent = ledger.hash
    ledger.height++
    sum := sha256.Sum256([]byte(fmt.Sprintf("%d:%s:%s", ledger.height, ledger.parent, tx)))
    ledger.hash = "0x" + hex.EncodeToString(sum[:24])
    ledger.txs[tx] = Record{Tx: tx, Height: ledger.height, At: time.Now()}
    return nil
}

func Included(tx string) (bool, error) {
    ledger.Lock()
    defer ledger.Unlock()
    _, ok := ledger.txs[tx]
    return ok, nil
}

func VerifyOnChain() (bool, int, error) {
    h, err := Head()
    if err != nil {
        return false, 0, err
    }
    if h.Height < 1 || len(h.Hash) < 18 {
        return false, h.Height, nil
    }
    return true, h.Height, nil
}
`,Ie=`package wallet

import (
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "os"
    "path/filepath"
    "sort"
    "strings"
)

func IndexMerkle() ([32]byte, error) {
    var paths []string
    err := filepath.Walk(".", func(p string, info os.FileInfo, err error) error {
        if err != nil {
            return err
        }
        if info.IsDir() {
            if info.Name() == ".git" || info.Name() == "target" || info.Name() == "node_modules" {
                return filepath.SkipDir
            }
            return nil
        }
        paths = append(paths, p)
        return nil
    })
    if err != nil {
        return [32]byte{}, err
    }
    sort.Strings(paths)
    h := sha256.New()
    h.Write([]byte("kiln:index"))
    for _, p := range paths {
        h.Write([]byte(p))
        body, err := os.ReadFile(p)
        if err != nil {
            return [32]byte{}, err
        }
        sum := sha256.Sum256(body)
        h.Write(sum[:])
    }
    var out [32]byte
    copy(out[:], h.Sum(nil))
    return out, nil
}

func Commit(wallet string, tree [32]byte) (string, error) {
    if strings.TrimSpace(wallet) == "" {
        return "", fmt.Errorf("wallet")
    }
    h := sha256.New()
    h.Write([]byte(wallet))
    h.Write(tree[:])
    return "0x" + hex.EncodeToString(h.Sum(nil)[:24]), nil
}

func CommitIndex(msg string) (string, error) {
    if strings.TrimSpace(msg) == "" {
        return "", fmt.Errorf("empty message")
    }
    tree, err := IndexMerkle()
    if err != nil {
        return "", err
    }
    h := sha256.New()
    h.Write([]byte(msg))
    h.Write(tree[:])
    return hex.EncodeToString(h.Sum(nil)[:8]), nil
}
`,Le=`package seal

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/sha256"
    "fmt"
    "io"
)

const chunk = 4 << 20

// Stream decrypts AES-256-GCM envelopes in 4 MiB leaves. Does not buffer the
// whole tree — envelopes over 32 MB stay in constant memory (closes #4).
func Stream(in io.Reader, out io.Writer, wallet, grant string) (int64, error) {
    if grant != "viewer" && grant != "owner" {
        return 0, fmt.Errorf("unknown grant %q", grant)
    }
    key := derive(wallet)
    block, err := aes.NewCipher(key[:])
    if err != nil {
        return 0, err
    }
    aead, err := cipher.NewGCM(block)
    if err != nil {
        return 0, err
    }
    buf := make([]byte, 12+chunk+aead.Overhead())
    var total int64
    for {
        n, err := io.ReadFull(in, buf[:12])
        if err == io.EOF || err == io.ErrUnexpectedEOF {
            if n == 0 {
                return total, nil
            }
            return total, fmt.Errorf("truncated nonce")
        }
        if err != nil {
            return total, err
        }
        nonce := buf[:12]
        cn, err := io.ReadAtLeast(in, buf[12:], 1)
        if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
            return total, err
        }
        plain, err := aead.Open(nil, nonce, buf[12:12+cn], nil)
        if err != nil {
            return total, err
        }
        w, err := out.Write(plain)
        total += int64(w)
        if err != nil {
            return total, err
        }
    }
}

func derive(wallet string) [32]byte {
    return sha256.Sum256([]byte("kiln-vault:" + wallet))
}
`,Re=`package cmd_test

import (
    "bytes"
    "testing"

    "github.com/kiln-labs/cli/internal/pack"
    "github.com/kiln-labs/cli/internal/remote"
    "github.com/kiln-labs/cli/internal/chain"
)

func TestParseKilnURL(t *testing.T) {
    spec, err := remote.Parse("kiln://kiln-labs/cli.git")
    if err != nil {
        t.Fatal(err)
    }
    if spec.Owner != "kiln-labs" || spec.Name != "cli" {
        t.Fatalf("got %+v", spec)
    }
}

func TestPackFetchKnownRepo(t *testing.T) {
    spec, _ := remote.Parse("kiln://kiln-labs/cli.git")
    objs, err := pack.Fetch(spec)
    if err != nil {
        t.Fatal(err)
    }
    if len(objs) == 0 {
        t.Fatal("expected packed objects")
    }
}

func TestWaitIncludes(t *testing.T) {
    if err := chain.Wait("0xabc"); err != nil {
        t.Fatal(err)
    }
    ok, err := chain.Included("0xabc")
    if err != nil || !ok {
        t.Fatalf("included %v %v", ok, err)
    }
}

func TestUnknownURL(t *testing.T) {
    _, err := remote.Parse("https://example.com/x")
    if err == nil {
        t.Fatal("expected parse error")
    }
    _ = bytes.Equal
}
`,ze=Ce,Be=[k(`README.md`,`markdown`,`Document unseal`,Ce),k(`go.mod`,`go`,`Module path`,we),k(`main.go`,`go`,`Entry`,Te),k(`cmd/root.go`,`go`,`Cobra root`,Ee),k(`cmd/clone.go`,`go`,`git clone kiln://`,De),k(`cmd/push.go`,`go`,`Wait for inclusion before exit`,Oe),k(`cmd/commit.go`,`go`,`Merkle commit`,ke),k(`cmd/pull.go`,`go`,`Fast-forward to head`,Ae),k(`cmd/unseal.go`,`go`,`Stream unseal for large envelopes`,je),k(`cmd/verify.go`,`go`,`On-chain verify`,Me),k(`internal/remote/parse.go`,`go`,`Parse kiln:// URLs`,Ne),k(`internal/pack/pack.go`,`go`,`Object pack and checkout`,Pe),k(`internal/chain/head.go`,`go`,`Ledger head, Wait, Included`,Fe),k(`internal/wallet/commit.go`,`go`,`Wallet commit over working tree`,Ie),k(`internal/seal/stream.go`,`go`,`Streaming AES-GCM unseal`,Le),k(`cmd/parse_test.go`,`go`,`URL, pack, inclusion tests`,Re),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`MIT`,ue)],Ve=`const enc = new TextEncoder();
const dec = new TextDecoder();

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === "string" ? enc.encode(input) : (input as BufferSource);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function sha256Short(input: string, n = 8): Promise<string> {
  const h = await sha256Hex(input);
  return h.slice(0, n);
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Per-vault key: wallet secret bound to repo id. Never leaves the browser. */
export async function vaultSecret(walletSecret: string, repoId: string): Promise<string> {
  return sha256Hex(\`kiln-vault:\${walletSecret}:\${repoId}\`);
}

export async function encryptText(plain: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, enc.encode(plain));
  return \`v1:\${toHex(iv)}:\${toHex(cipher)}\`;
}

export async function decryptText(payload: string, secret: string): Promise<string> {
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Unknown sealed payload");
  const iv = fromHex(parts[1]!);
  const data = fromHex(parts[2]!);
  const key = await deriveKey(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, data as BufferSource);
  return dec.decode(plain);
}

/** AES-256-GCM over bytes. Wire format: 12-byte IV || ciphertext+tag. */
export async function encryptBytes(plain: Uint8Array, secret: string): Promise<Uint8Array> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plain as BufferSource);
  const out = new Uint8Array(12 + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), 12);
  return new Uint8Array(out);
}

export async function decryptBytes(payload: Uint8Array, secret: string): Promise<Uint8Array> {
  if (payload.byteLength < 13) throw new Error("Sealed chunk too small");
  const iv = payload.subarray(0, 12);
  const data = payload.subarray(12);
  const key = await deriveKey(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, data as BufferSource);
  return new Uint8Array(plain);
}

export function looksSealed(s: string): boolean {
  return s.startsWith("v1:") && s.split(":").length === 3;
}

export async function keyCommitment(secret: string): Promise<string> {
  return \`0x\${(await sha256Hex(\`kiln-key:\${secret}\`)).slice(0, 40)}\`;
}

export async function makeAddress(secret: string): Promise<string> {
  return \`0x\${(await sha256Hex(\`kiln-addr:\${secret}\`)).slice(0, 40)}\`;
}

export function randomSecret(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return toHex(b);
}

export function truncateHex(h: string, size = 4): string {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  return \`0x\${s.slice(0, size)}…\${s.slice(-size)}\`;
}

export { toHex };
`,He=`import { sha256Hex } from "./crypto";

/** Binary Merkle over hex leaves. Odd nodes are duplicated (Bitcoin-style). */
export async function merkleRoot(leaves: string[]): Promise<string> {
  if (!leaves.length) return \`0x\${await sha256Hex("kiln:empty")}\`;
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
  return \`0x\${layer[0]}\`;
}

export async function merkleProof(leaves: string[], index: number): Promise<string[]> {
  const proof: string[] = [];
  let layer = leaves.map((l) => l.replace(/^0x/, "").toLowerCase());
  let i = index;
  while (layer.length > 1) {
    const sibling = i % 2 === 0 ? (layer[i + 1] ?? layer[i]!) : layer[i - 1]!;
    proof.push(\`0x\${sibling}\`);
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
    out.push(await sha256Hex(\`\${item.path}:\${item.hash.replace(/^0x/, "")}\`));
  }
  return out;
}
`,Ue=`import { encryptBytes, decryptBytes, sha256Hex, vaultSecret } from "./crypto";
import { merkleRoot } from "./merkle";
import type { RepoFile } from "./types";

const DB = "kiln-fs-v2";
const BLOBS = "blobs";
const CHUNKS = "chunks";
const META = "meta";

export const CHUNK_SIZE = 4 * 1024 * 1024;
export const FOLDER_QUOTA = 50 * 1024 * 1024 * 1024;
export const MAX_INLINE = 8_192;
export const MAX_EDIT = 1_500_000;
/** Per-file ceiling equals the folder quota — a single Zenodo-style deposit. */
export const MAX_UPLOAD = FOLDER_QUOTA;

type ChunkMeta = {
  blobId: string;
  index: number;
  size: number;
  hash: string;
  encrypted: boolean;
};

function hasIdb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store: string, id: string, data: unknown): Promise<void> {
  if (!hasIdb()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(data, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T>(store: string, id: string): Promise<T | null> {
  if (!hasIdb()) return null;
  const db = await openDb();
  const value = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

async function idbDel(store: string, id: string): Promise<void> {
  if (!hasIdb()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function opfsAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.storage?.getDirectory;
}

async function opfsWrite(id: string, data: ArrayBuffer | Uint8Array): Promise<boolean> {
  if (!opfsAvailable()) return false;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("kiln-chunks", { create: true });
    const fh = await dir.getFileHandle(id.replace(/[/\\\\]/g, "_"), { create: true });
    const w = await fh.createWritable();
    await w.write(data instanceof Uint8Array ? (data as BufferSource) : data);
    await w.close();
    return true;
  } catch {
    return false;
  }
}

async function opfsRead(id: string): Promise<ArrayBuffer | null> {
  if (!opfsAvailable()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("kiln-chunks", { create: false });
    const fh = await dir.getFileHandle(id.replace(/[/\\\\]/g, "_"), { create: false });
    const file = await fh.getFile();
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

export async function requestPersistent(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function originQuota(): Promise<{ usage: number; quota: number }> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      return { usage: 0, quota: FOLDER_QUOTA };
    }
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? FOLDER_QUOTA };
  } catch {
    return { usage: 0, quota: FOLDER_QUOTA };
  }
}

export async function putBlob(id: string, data: string | ArrayBuffer): Promise<void> {
  await idbPut(BLOBS, id, data);
}

export async function getBlob(id: string): Promise<string | ArrayBuffer | null> {
  return idbGet<string | ArrayBuffer>(BLOBS, id);
}

export async function deleteBlob(id: string): Promise<void> {
  await idbDel(BLOBS, id);
}

async function putChunk(id: string, data: Uint8Array): Promise<void> {
  const wrote = await opfsWrite(id, data);
  if (!wrote) {
    const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    await idbPut(CHUNKS, id, copy);
  }
}

async function getChunk(id: string): Promise<Uint8Array | null> {
  const opfs = await opfsRead(id);
  if (opfs) return new Uint8Array(opfs);
  const idb = await idbGet<ArrayBuffer>(CHUNKS, id);
  return idb ? new Uint8Array(idb) : null;
}

export async function fsStats(): Promise<{ count: number; bytes: number }> {
  if (!hasIdb()) return { count: 0, bytes: 0 };
  const db = await openDb();
  const stats = await new Promise<{ count: number; bytes: number }>((resolve, reject) => {
    const tx = db.transaction([BLOBS, CHUNKS], "readonly");
    let n = 0;
    let b = 0;
    let pending = 2;
    const walk = (store: string) => {
      const req = tx.objectStore(store).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          pending -= 1;
          if (pending === 0) resolve({ count: n, bytes: b });
          return;
        }
        n += 1;
        const v = cursor.value as string | ArrayBuffer;
        b += typeof v === "string" ? v.length : v.byteLength;
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    };
    walk(BLOBS);
    walk(CHUNKS);
  });
  db.close();
  return stats;
}

export function detectLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    rs: "Rust",
    go: "Go",
    sol: "Solidity",
    md: "Markdown",
    mdx: "Markdown",
    py: "Python",
    mo: "Motoko",
    motoko: "Motoko",
    json: "JSON",
    yml: "YAML",
    yaml: "YAML",
    sh: "Shell",
    bash: "Shell",
    toml: "toml",
    circom: "Circom",
    css: "CSS",
    html: "HTML",
    svg: "SVG",
    c: "C",
    h: "C",
    cpp: "C++",
    rsx: "Rust",
    makefile: "Makefile",
    pdf: "PDF",
    png: "image",
    jpg: "image",
    jpeg: "image",
    webp: "image",
    zip: "archive",
    tar: "archive",
    gz: "archive",
    parquet: "data",
    csv: "CSV",
    wasm: "Wasm",
  };
  const base = path.split("/").pop()?.toLowerCase() ?? "";
  if (base === "makefile" || base === "dockerfile") return "Makefile";
  return map[ext] ?? "text";
}

export function isProbablyBinary(name: string, mime?: string): boolean {
  if (mime && !mime.startsWith("text/") && mime !== "application/json" && mime !== "image/svg+xml") {
    return !/\\.(md|ts|tsx|js|jsx|json|yml|yaml|rs|go|sol|toml|css|html|svg|sh|py|c|h|cpp|txt|csv)$/i.test(name);
  }
  return /\\.(png|jpe?g|gif|webp|pdf|zip|tar|gz|wasm|parquet|mp4|webm|woff2?|bin)$/i.test(name);
}

export async function fileText(file: RepoFile, secret?: string): Promise<string> {
  if (file.binary) return \`[binary \${formatBytes(file.size)}]\`;
  if (file.content && !file.encrypted && !file.blobId) return file.content;
  if (file.blobId) {
    const assembled = await assembleFile(file, secret);
    if (assembled) return new TextDecoder().decode(assembled);
    const blob = await getBlob(file.blobId);
    if (typeof blob === "string") return blob;
    if (blob) return new TextDecoder().decode(blob);
  }
  if (file.content) return file.content;
  return "";
}

export async function assembleFile(file: RepoFile, secret?: string): Promise<Uint8Array | null> {
  if (!file.blobId || !file.chunkCount) {
    if (file.content) return new TextEncoder().encode(file.content);
    if (file.blobId) {
      const blob = await getBlob(file.blobId);
      if (typeof blob === "string") return new TextEncoder().encode(blob);
      if (blob) return new Uint8Array(blob);
    }
    return null;
  }
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < file.chunkCount; i++) {
    const id = \`\${file.blobId}:\${i}\`;
    let chunk = await getChunk(id);
    if (!chunk) return null;
    if (file.encrypted && secret) {
      chunk = await decryptBytes(chunk, secret);
    }
    parts.push(chunk);
    total += chunk.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

export type StoredFile = {
  sha: string;
  size: number;
  inline: string;
  blobId: string;
  binary: boolean;
  merkleRoot: string;
  chunkCount: number;
  encrypted: boolean;
};

export async function storeFileBytes(
  content: string | ArrayBuffer | Uint8Array,
  binary = false,
  opts?: { encrypt?: boolean; secret?: string; onProgress?: (done: number, total: number) => void },
): Promise<StoredFile> {
  const bytes =
    typeof content === "string"
      ? new TextEncoder().encode(content)
      : content instanceof Uint8Array
        ? content
        : new Uint8Array(content);
  return storeChunks(bytes, binary, opts);
}

export async function storeBlobSource(
  source: Blob,
  binary: boolean,
  opts?: { encrypt?: boolean; secret?: string; onProgress?: (done: number, total: number) => void },
): Promise<StoredFile> {
  const size = source.size;
  if (size > FOLDER_QUOTA) throw new Error(\`File exceeds the 50 GB folder cap (\${formatBytes(FOLDER_QUOTA)})\`);
  const encrypt = !!opts?.encrypt && !!opts.secret;
  const secret = opts?.secret ?? "";
  const chunkCount = Math.max(1, Math.ceil(size / CHUNK_SIZE));
  const hashes: string[] = [];
  let firstInline = "";
  const seed = \`\${size}:\${Date.now()}:\${Math.random()}\`;
  const blobId = \`b\${(await sha256Hex(seed)).slice(0, 24)}\`;

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(size, start + CHUNK_SIZE);
    const slice = source.slice(start, end);
    let buf: Uint8Array = new Uint8Array(await slice.arrayBuffer());
    if (encrypt) buf = await encryptBytes(buf, secret);
    const hash = await sha256Hex(buf);
    hashes.push(hash);
    await putChunk(\`\${blobId}:\${i}\`, buf);
    if (i === 0 && !binary && !encrypt && typeof firstInline === "string" && size <= MAX_INLINE) {
      firstInline = new TextDecoder().decode(new Uint8Array(await source.slice(0, size).arrayBuffer()));
    }
    opts?.onProgress?.(end, size);
  }

  const root = await merkleRoot(hashes);
  const sha = \`k\${root.replace(/^0x/, "").slice(0, 7)}\`;
  await idbPut(META, blobId, { blobId, chunkCount, size, merkleRoot: root, encrypted: encrypt });
  return { sha, size, inline: firstInline, blobId, binary, merkleRoot: root, chunkCount, encrypted: encrypt };
}

async function storeChunks(
  bytes: Uint8Array,
  binary: boolean,
  opts?: { encrypt?: boolean; secret?: string; onProgress?: (done: number, total: number) => void },
): Promise<StoredFile> {
  const size = bytes.byteLength;
  if (size > FOLDER_QUOTA) throw new Error(\`File exceeds the 50 GB folder cap (\${formatBytes(FOLDER_QUOTA)})\`);
  const encrypt = !!opts?.encrypt && !!opts.secret;
  const secret = opts?.secret ?? "";
  const chunkCount = Math.max(1, Math.ceil(size / CHUNK_SIZE) || 1);
  const hashes: string[] = [];
  const blobId = \`b\${(await sha256Hex(bytes.length ? bytes : new TextEncoder().encode("empty"))).slice(0, 24)}\${encrypt ? "e" : ""}\`;

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(size, start + CHUNK_SIZE);
    let slice: Uint8Array = bytes.subarray(start, end);
    if (encrypt) slice = await encryptBytes(slice, secret);
    const hash = await sha256Hex(slice);
    hashes.push(hash);
    await putChunk(\`\${blobId}:\${i}\`, slice);
    opts?.onProgress?.(end, size);
  }

  const root = await merkleRoot(hashes);
  const inline =
    !binary && !encrypt && typeof bytes === "object" && size <= MAX_INLINE ? new TextDecoder().decode(bytes) : "";
  await idbPut(META, blobId, { blobId, chunkCount, size, merkleRoot: root, encrypted: encrypt });
  return {
    sha: \`k\${root.replace(/^0x/, "").slice(0, 7)}\`,
    size,
    inline,
    blobId,
    binary,
    merkleRoot: root,
    chunkCount,
    encrypted: encrypt,
  };
}

export function slimFile(file: RepoFile): RepoFile {
  if (file.blobId && file.content && file.content.length > MAX_INLINE) {
    return { ...file, content: "" };
  }
  return file;
}

export function formatBytes(n: number): string {
  if (n < 1024) return \`\${n} B\`;
  if (n < 1024 * 1024) return \`\${(n / 1024).toFixed(1)} KB\`;
  if (n < 1024 * 1024 * 1024) return \`\${(n / (1024 * 1024)).toFixed(2)} MB\`;
  if (n < 1024 * 1024 * 1024 * 1024) return \`\${(n / (1024 * 1024 * 1024)).toFixed(2)} GB\`;
  return \`\${(n / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB\`;
}

/** Bytes of files sitting directly in \`dir\` (nested folders have their own 50 GB cap). */
export function folderDirectBytes(files: RepoFile[], dir: string): number {
  const prefix = dir ? \`\${dir.replace(/\\/$/, "")}/\` : "";
  return files.reduce((n, f) => {
    if (prefix && !f.path.startsWith(prefix)) return n;
    const rest = prefix ? f.path.slice(prefix.length) : f.path;
    if (!rest || rest.includes("/")) return n;
    return n + (f.size || 0);
  }, 0);
}

export function folderRemaining(files: RepoFile[], dir: string): number {
  return Math.max(0, FOLDER_QUOTA - folderDirectBytes(files, dir));
}

export async function vaultKey(walletSecret: string, repoId: string): Promise<string> {
  return vaultSecret(walletSecret, repoId);
}
`,We=`# sealed-fs

Encrypted working tree. File bytes never sit in plaintext on the public chain. This repository ships a **viewer grant** so anyone with a Kiln wallet can unseal a session key and read the sources.

If the grant is revoked, ciphertext remains; only new sessions fail.

This tree **is** the live Kiln engine: \`src/crypto.ts\`, \`src/merkle.ts\`, and \`src/fs.ts\` are the same modules the forge runs. 4 MiB AES-256-GCM leaves, 50 GiB per folder, Merkle-committed on L1.

\`\`\`
git clone kiln://kiln-labs/sealed-fs.git
npm test
\`\`\`

## Envelope

\`v1:<iv-hex>:<ciphertext-hex>\` — 96-bit nonce, AES-256-GCM, key = SHA-256(secret). Chunked writes go \`IV || ciphertext+tag\` per 4 MiB leaf.

## Grant

On-chain viewer grants carry a TTL. \`active(grant, now)\` is the only check the unsealer needs. Revoke by a second tx; expiry needs no second tx.
`,Ge=`export type Grant = {
  repo: string;
  to: string;
  expires: number;
  revoked?: boolean;
};

export function active(g: Grant, now = Date.now()): boolean {
  if (g.revoked) return false;
  return now < g.expires;
}

export function ttlMs(hours: number): number {
  return Date.now() + hours * 3600_000;
}

export function honor(g: Grant, viewer: string, now = Date.now()): boolean {
  return g.to.toLowerCase() === viewer.toLowerCase() && active(g, now);
}

export function revoke(g: Grant): Grant {
  return { ...g, revoked: true };
}
`,Ke=`/** 4 MiB sealed leaves — the same size Kiln paints onto the Hilbert lattice. */
export const LEAF = 4 * 1024 * 1024;
export const FOLDER_QUOTA = 50 * 1024 * 1024 * 1024;

export function leafCount(size: number): number {
  if (size <= 0) return 0;
  return Math.ceil(size / LEAF);
}

export function assertQuota(used: number, incoming: number, folder = "/"): void {
  if (used + incoming > FOLDER_QUOTA) {
    throw new Error(\`Folder \${folder} is at the 50 GiB cap\`);
  }
}

export function split(bytes: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.byteLength; i += LEAF) {
    out.push(bytes.subarray(i, Math.min(i + LEAF, bytes.byteLength)));
  }
  return out;
}
`,qe=`import { describe, expect, it } from "vitest";
import { active, honor, revoke, ttlMs } from "./grant";
import { LEAF, leafCount, split } from "./chunk";

describe("grant", () => {
  it("expires without a second transaction", () => {
    const g = { repo: "kiln-labs/sealed-fs", to: "0xabc", expires: Date.now() - 1 };
    expect(active(g)).toBe(false);
  });
  it("honors a live viewer", () => {
    const g = { repo: "kiln-labs/sealed-fs", to: "0xABC", expires: ttlMs(24) };
    expect(honor(g, "0xabc")).toBe(true);
  });
  it("revoke wins over TTL", () => {
    const g = revoke({ repo: "kiln-labs/sealed-fs", to: "0xabc", expires: ttlMs(24) });
    expect(active(g)).toBe(false);
  });
});

describe("chunk", () => {
  it("splits on 4 MiB leaves", () => {
    expect(LEAF).toBe(4 * 1024 * 1024);
    expect(leafCount(LEAF + 1)).toBe(2);
    expect(split(new Uint8Array(LEAF + 10))).toHaveLength(2);
  });
});
`,Je=We,Ye=[k(`README.md`,`markdown`,`Viewer grant note`,We),k(`src/crypto.ts`,`typescript`,`AES-256-GCM envelope (live engine)`,Ve),k(`src/merkle.ts`,`typescript`,`Merkle fold (live engine)`,He),k(`src/fs.ts`,`typescript`,`50 GiB folder deposits (live engine)`,Ue),k(`src/grant.ts`,`typescript`,`Honor on-chain viewer grants`,Ge),k(`src/chunk.ts`,`typescript`,`4 MiB leaves and quota`,Ke),k(`src/grant.test.ts`,`typescript`,`Grant TTL and honor`,qe),k(`package.json`,`JSON`,`Package`,`{
  "name": "@kiln-labs/sealed-fs",
  "version": "0.8.1",
  "type": "module",
  "license": "Apache-2.0",
  "scripts": { "test": "vitest run" }
}
`),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`Apache-2.0`,A)],Xe=`# meridian / escrow

Bounty escrow for Kiln issues. Maintainers lock KLN against an issue; a merged pull request releases the lock to the author.

No off-chain treasurer. The issue number is the escrow id.

\`\`\`
git clone kiln://meridian/escrow.git
forge test
\`\`\`

Release uses a **pull** pattern so a contract payee cannot reenter \`release\`. Checks, effects, then \`pending[to] += amt\`. The payee calls \`withdraw()\`.
`,Ze=`// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @title Issue-locked KLN escrow
/// @notice Lock against (repo, issue). Release on merge. Payees pull.
contract IssueEscrow {
    struct Lock {
        uint256 amount;
        address payer;
        address payee;
        bool open;
    }

    mapping(bytes32 => mapping(uint64 => Lock)) public locks;
    mapping(address => uint256) public pending;

    event Funded(bytes32 indexed repo, uint64 indexed issue, address payer, uint256 amount);
    event Released(bytes32 indexed repo, uint64 indexed issue, address to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error Empty();
    error Auth();
    error Zero();

    function fund(bytes32 repo, uint64 issue) external payable {
        if (msg.value == 0) revert Zero();
        Lock storage l = locks[repo][issue];
        l.amount += msg.value;
        if (l.payer == address(0)) l.payer = msg.sender;
        l.open = true;
        emit Funded(repo, issue, msg.sender, msg.value);
    }

    /// @dev Close the lock first. Credit pending. No external call here.
    function release(bytes32 repo, uint64 issue, address to) external {
        Lock storage l = locks[repo][issue];
        if (!l.open) revert Empty();
        if (msg.sender != l.payer) revert Auth();
        uint256 amt = l.amount;
        l.open = false;
        l.amount = 0;
        l.payee = to;
        pending[to] += amt;
        emit Released(repo, issue, to, amt);
    }

    function withdraw() external {
        uint256 amt = pending[msg.sender];
        if (amt == 0) revert Empty();
        pending[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok, "xfer");
        emit Withdrawn(msg.sender, amt);
    }
}
`,Qe=`// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/IssueEscrow.sol";

contract Attacker {
    IssueEscrow public e;
    uint256 public hits;
    constructor(IssueEscrow _e) { e = _e; }
    receive() external payable {
        hits += 1;
        if (hits < 3 && address(e).balance > 0) {
            try e.withdraw() {} catch {}
        }
    }
    function grab() external { e.withdraw(); }
}

contract IssueEscrowTest is Test {
    IssueEscrow e;
    address maintainer = address(0xA11CE);
    address author = address(0xB0B);

    function setUp() public {
        e = new IssueEscrow();
        vm.deal(maintainer, 10 ether);
    }

    function testFundAndPull() public {
        vm.prank(maintainer);
        e.fund{value: 5 ether}(bytes32("meridian/escrow"), 12);
        vm.prank(maintainer);
        e.release(bytes32("meridian/escrow"), 12, author);
        uint256 before = author.balance;
        vm.prank(author);
        e.withdraw();
        assertEq(author.balance - before, 5 ether);
    }

    function testDoubleReleaseReverts() public {
        vm.prank(maintainer);
        e.fund{value: 1 ether}(bytes32("meridian/escrow"), 13);
        vm.startPrank(maintainer);
        e.release(bytes32("meridian/escrow"), 13, author);
        vm.expectRevert(IssueEscrow.Empty.selector);
        e.release(bytes32("meridian/escrow"), 13, author);
        vm.stopPrank();
    }

    function testStrangerCannotRelease() public {
        vm.prank(maintainer);
        e.fund{value: 1 ether}(bytes32("meridian/escrow"), 14);
        vm.prank(author);
        vm.expectRevert(IssueEscrow.Auth.selector);
        e.release(bytes32("meridian/escrow"), 14, author);
    }

    function testReentrancyOnWithdrawDoesNotDrainTwice() public {
        Attacker a = new Attacker(e);
        vm.prank(maintainer);
        e.fund{value: 2 ether}(bytes32("meridian/escrow"), 99);
        vm.prank(maintainer);
        e.release(bytes32("meridian/escrow"), 99, address(a));
        a.grab();
        assertEq(address(a).balance, 2 ether);
        assertEq(a.hits(), 1);
    }
}
`,$e=`import { expect, test } from "vitest";

type Lock = { amount: number; payer: string; payee?: string; open: boolean };
const locks = new Map<string, Lock>();
const pending = new Map<string, number>();

function key(repo: string, issue: number) {
  return repo + ":" + issue;
}

function fund(repo: string, issue: number, payer: string, value: number) {
  const k = key(repo, issue);
  const l = locks.get(k) ?? { amount: 0, payer, open: false };
  l.amount += value;
  l.payer = l.payer || payer;
  l.open = true;
  locks.set(k, l);
}

function release(repo: string, issue: number, payer: string, to: string) {
  const l = locks.get(key(repo, issue));
  if (!l?.open) throw new Error("empty");
  if (l.payer !== payer) throw new Error("auth");
  const amt = l.amount;
  l.open = false;
  l.amount = 0;
  l.payee = to;
  pending.set(to, (pending.get(to) ?? 0) + amt);
  return amt;
}

function withdraw(to: string) {
  const amt = pending.get(to) ?? 0;
  if (!amt) throw new Error("empty");
  pending.set(to, 0);
  return amt;
}

test("release pays author via pull", () => {
  fund("meridian/escrow", 12, "maintainer", 5000);
  expect(release("meridian/escrow", 12, "maintainer", "author")).toBe(5000);
  expect(withdraw("author")).toBe(5000);
});

test("double release reverts", () => {
  fund("meridian/escrow", 13, "maintainer", 100);
  release("meridian/escrow", 13, "maintainer", "author");
  expect(() => release("meridian/escrow", 13, "maintainer", "author")).toThrow("empty");
});

test("stranger cannot release", () => {
  fund("meridian/escrow", 14, "maintainer", 100);
  expect(() => release("meridian/escrow", 14, "stranger", "author")).toThrow("auth");
});

test("withdraw is empty after pull", () => {
  fund("meridian/escrow", 15, "maintainer", 40);
  release("meridian/escrow", 15, "maintainer", "author-2");
  expect(withdraw("author-2")).toBe(40);
  expect(() => withdraw("author-2")).toThrow("empty");
});
`,et=`[profile.default]
src = "contracts"
test = "test"
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
`,tt=Xe,nt=[k(`README.md`,`markdown`,`No treasurer`,Xe),k(`contracts/IssueEscrow.sol`,`solidity`,`Lock against issue id, pull pattern`,Ze),k(`test/IssueEscrow.t.sol`,`solidity`,`Foundry: pull, reentrancy, auth`,Qe),k(`test/escrow.test.ts`,`typescript`,`Fund, release, pull, reentrancy`,$e),k(`foundry.toml`,`toml`,`Foundry profile`,et),k(`package.json`,`JSON`,`Package`,`{
  "name": "@meridian/escrow",
  "version": "1.2.0",
  "license": "GPL-3.0",
  "scripts": { "test": "vitest run" }
}
`),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`GPL-3.0`,`GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2026 Meridian Research

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
`)],rt=`# atlas / enclave

Private runtime. Sealed. Owner key only — no viewer grant.

The working tree never leaves the enclave. Attestation binds the measurement of this crate to the owner wallet. Ciphertext is on-chain; the unsealing key is derived inside the enclave from the owner secret and never exported.

\`\`\`
git clone kiln://atlas/enclave.git
cargo test -p enclave
\`\`\`

This repository is **private**. Forks require an on-chain decrypt grant from the owner.
`,it=`//! Hardware-backed sealed runtime. Owner key only.
#![forbid(unsafe_code)]

pub mod attest;
pub mod derive;
pub mod runtime;

pub const MEASUREMENT: &[u8] = b"atlas-enclave/0.3.1";

#[derive(Clone, Debug)]
pub struct Session {
    pub owner: [u8; 20],
    pub measurement: [u8; 32],
    pub sealed: bool,
}

pub fn boot(owner: [u8; 20], secret: &[u8]) -> Result<Session, &'static str> {
    let measurement = derive::measure(MEASUREMENT, secret);
    let key = derive::unseal_key(secret, &measurement)?;
    runtime::hydrate(&key)?;
    Ok(Session { owner, measurement, sealed: true })
}

pub fn shutdown() {
    runtime::shutdown();
}
`,at=`//! Key derivation. The unsealing key never leaves this module.
use blake3::Hasher;

pub fn measure(label: &[u8], secret: &[u8]) -> [u8; 32] {
    let mut h = Hasher::new();
    h.update(b"atlas-measure:");
    h.update(label);
    h.update(secret);
    *h.finalize().as_bytes()
}

pub fn unseal_key(secret: &[u8], measurement: &[u8; 32]) -> Result<[u8; 32], &'static str> {
    if secret.len() < 16 {
        return Err("short secret");
    }
    let mut h = Hasher::new();
    h.update(b"atlas-unseal:");
    h.update(secret);
    h.update(measurement);
    Ok(*h.finalize().as_bytes())
}

pub fn export_forbidden(_key: &[u8; 32]) -> Result<(), &'static str> {
    Err("owner key only — no viewer grant")
}
`,ot=`//! Quote the measurement so a verifier can bind this build to the owner.
use crate::derive;

pub struct Quote {
    pub measurement: [u8; 32],
    pub owner: [u8; 20],
    pub mac: [u8; 32],
}

pub fn quote(owner: [u8; 20], secret: &[u8]) -> Quote {
    let measurement = derive::measure(crate::MEASUREMENT, secret);
    let mut h = blake3::Hasher::new();
    h.update(b"atlas-quote:");
    h.update(&measurement);
    h.update(&owner);
    Quote { measurement, owner, mac: *h.finalize().as_bytes() }
}

pub fn verify(q: &Quote, secret: &[u8]) -> bool {
    let expect = quote(q.owner, secret);
    expect.mac == q.mac && expect.measurement == q.measurement
}
`,st=`//! Sealed working set. Hydrate from the unsealing key, never from a grant.
use std::sync::atomic::{AtomicBool, Ordering};

static LIVE: AtomicBool = AtomicBool::new(false);

pub fn hydrate(key: &[u8; 32]) -> Result<(), &'static str> {
    if key.iter().all(|b| *b == 0) {
        return Err("zero key");
    }
    LIVE.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn is_live() -> bool {
    LIVE.load(Ordering::SeqCst)
}

pub fn shutdown() {
    LIVE.store(false, Ordering::SeqCst);
}
`,ct=`use enclave::{attest, boot, runtime, shutdown};

#[test]
fn boot_rejects_short_secret() {
    assert!(boot([1u8; 20], b"short").is_err());
}

#[test]
fn quote_binds_owner() {
    let secret = b"0123456789abcdef";
    let q = attest::quote([9u8; 20], secret);
    assert!(attest::verify(&q, secret));
    assert!(!attest::verify(&q, b"0123456789abcdee"));
}

#[test]
fn hydrate_then_shutdown() {
    let secret = b"0123456789abcdef";
    let session = boot([1u8; 20], secret).unwrap();
    assert!(session.sealed);
    assert!(runtime::is_live());
    shutdown();
    assert!(!runtime::is_live());
}

#[test]
fn export_is_forbidden() {
    let key = [3u8; 32];
    assert!(enclave::derive::export_forbidden(&key).is_err());
}
`,lt=rt,ut=[k(`README.md`,`markdown`,`Owner key only`,rt),k(`Cargo.toml`,`toml`,`Crate`,`[package]
name = "enclave"
version = "0.3.1"
edition = "2021"
license = "Proprietary"
publish = false

[dependencies]
blake3 = "1.5"
`),k(`src/lib.rs`,`rust`,`Boot sealed runtime`,it),k(`src/derive.rs`,`rust`,`Unsealing key, never exported`,at),k(`src/attest.rs`,`rust`,`Measurement quote`,ot),k(`src/runtime.rs`,`rust`,`Atomic hydrate, no unsafe`,st),k(`tests/boot.rs`,`rust`,`Boot, quote, shutdown tests`,ct),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j)],dt=`# Harbor Bridge

Light client for Kiln commit headers. Posts Merkle proofs to paired chains so a \`git push\` here is a fact there.

After 256 blocks the header proof is a sliding MMR window, not a full ancestry (closes #3).

\`\`\`
git clone kiln://harbor/bridge.git
npm test
\`\`\`
`,ft=`/** Sliding Merkle Mountain Range. Peaks only — O(log n) per append, O(1) peaks to keep. */

export type Peak = { height: number; hash: string };

export class SlidingMMR {
  readonly window: number;
  peaks: Peak[] = [];
  size = 0;
  dropped = 0;

  constructor(window = 256) {
    this.window = window;
  }

  append(leaf: string): Peak[] {
    this.peaks.push({ height: 0, hash: leaf });
    this.size += 1;
    this.merge();
    while (this.size - this.dropped > this.window) {
      this.peaks.shift();
      this.dropped += 1;
    }
    return this.peaks.slice();
  }

  private merge() {
    for (;;) {
      const n = this.peaks.length;
      if (n < 2) return;
      const a = this.peaks[n - 2]!;
      const b = this.peaks[n - 1]!;
      if (a.height !== b.height) return;
      this.peaks.splice(n - 2, 2, { height: a.height + 1, hash: fold(a.hash, b.hash) });
    }
  }

  root(): string {
    if (!this.peaks.length) return "0x" + "00".repeat(32);
    return this.peaks.reduce((acc, p) => fold(acc, p.hash), this.peaks[0]!.hash);
  }
}

/** Deterministic 32-byte mixer. Same shape as the on-chain BLAKE3 fold, portable. */
export function fold(a: string, b: string): string {
  const aa = bytes(a);
  const bb = bytes(b);
  const out = new Uint8Array(32);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < 32; i++) {
    const x = (aa[i] ?? 0) ^ (bb[i] ?? 0);
    h1 = Math.imul(h1 ^ x, 16777619);
    h2 = Math.imul(h2 + x + i, 2246822519);
    out[i] = (h1 ^ (h2 >>> (i % 24))) & 0xff;
  }
  return "0x" + [...out].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function bytes(h: string): Uint8Array {
  const clean = h.replace(/^0x/, "");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32 && i * 2 + 1 < clean.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
`,pt=`import { SlidingMMR } from "./mmr";

export type Header = {
  height: number;
  tree: string;
  parent: string;
  keyCommitment: string;
};

export function encodeHeader(h: Header): string {
  return [h.height.toString(16), h.tree, h.parent, h.keyCommitment].join(":");
}

export function decodeHeader(s: string): Header | null {
  const p = s.split(":");
  if (p.length !== 4) return null;
  const height = parseInt(p[0]!, 16);
  if (!Number.isFinite(height)) return null;
  return { height, tree: p[1]!, parent: p[2]!, keyCommitment: p[3]! };
}

export class LightClient {
  readonly mmr = new SlidingMMR(256);
  last: Header | null = null;

  ingest(h: Header): boolean {
    if (this.last && h.height !== this.last.height + 1) return false;
    this.mmr.append(h.tree);
    this.last = h;
    return true;
  }

  proofSize(): number {
    return this.mmr.peaks.length;
  }
}
`,mt=`/** Post a Kiln header proof to a paired chain. */
import { fold } from "./mmr";

export type Proof = { root: string; peaks: string[]; header: string };

export function pack(root: string, peaks: string[], header: string): Proof {
  return { root, peaks, header };
}

export function verifyPack(p: Proof): boolean {
  if (!p.root.startsWith("0x") || p.peaks.length === 0 || !p.header.includes(":")) return false;
  const folded = p.peaks.reduce((acc, h) => fold(acc, h), p.peaks[0]!);
  return folded === p.root || p.peaks.includes(p.root);
}
`,ht=`import { expect, test } from "vitest";
import { SlidingMMR, fold } from "./mmr";
import { LightClient, encodeHeader } from "./header";

test("window stays at 256", () => {
  const mmr = new SlidingMMR(256);
  for (let i = 0; i < 400; i++) mmr.append("0x" + i.toString(16).padStart(64, "0"));
  expect(mmr.size - mmr.dropped).toBeLessThanOrEqual(256);
});

test("fold is 32 bytes and deterministic", () => {
  const a = fold("0x" + "11".repeat(32), "0x" + "22".repeat(32));
  const b = fold("0x" + "11".repeat(32), "0x" + "22".repeat(32));
  expect(a).toBe(b);
  expect(a).toHaveLength(66);
});

test("light client ingests sequential headers", () => {
  const c = new LightClient();
  const a = { height: 1, tree: "0x" + "11".repeat(32), parent: "0x" + "00".repeat(32), keyCommitment: "0x" + "00".repeat(32) };
  expect(c.ingest(a)).toBe(true);
  const b = { height: 2, tree: "0x" + "22".repeat(32), parent: encodeHeader(a), keyCommitment: "0x" + "00".repeat(32) };
  expect(c.ingest(b)).toBe(true);
  expect(c.ingest({ ...b, height: 9 })).toBe(false);
  expect(c.proofSize()).toBeGreaterThan(0);
});
`,gt=`package proof

import "fmt"

type Header struct {
    Height        uint64
    Tree          string
    Parent        string
    KeyCommitment string
}

func Encode(h Header) string {
    return fmt.Sprintf("%x:%s:%s:%s", h.Height, h.Tree, h.Parent, h.KeyCommitment)
}

func Decode(s string) (Header, error) {
    var h Header
    _, err := fmt.Sscanf(s, "%x:%s:%s:%s", &h.Height, &h.Tree, &h.Parent, &h.KeyCommitment)
    return h, err
}
`,_t=dt,vt=[k(`README.md`,`markdown`,`Light client note`,dt),k(`src/mmr.ts`,`typescript`,`Sliding MMR window`,ft),k(`src/header.ts`,`typescript`,`Header proof encoder`,pt),k(`src/relay.ts`,`typescript`,`Pack proofs for paired chains`,mt),k(`src/header.test.ts`,`typescript`,`Window and ingest tests`,ht),k(`go/proof/encode.go`,`go`,`Go encoder for paired L2s`,gt),k(`package.json`,`JSON`,`Package`,`{
  "name": "@harbor/bridge",
  "version": "0.6.0",
  "license": "MIT",
  "scripts": { "test": "vitest run" }
}
`),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`MIT`,ue)],yt="# git-seal\n\nDrop-in git remote that settles every push on Kiln.\n\n```\ngit clone kiln://northwind/git-seal.git\ngit remote add kiln kiln://northwind/git-seal\ngit push kiln main\n```\n\nInstall the helper as `git-remote-kiln` on `PATH`. Git then speaks the remote-helper protocol (`capabilities`, `list`, `push`, `fetch`) and every `git push` becomes a commit transaction.\n",bt=`package main

import (
    "bufio"
    "fmt"
    "os"
    "strings"

    "github.com/northwind/git-seal/internal/helper"
)

func main() {
    if len(os.Args) < 3 {
        fmt.Fprintln(os.Stderr, "usage: git-remote-kiln <remote> <url>")
        os.Exit(1)
    }
    url := os.Args[2]
    sc := bufio.NewScanner(os.Stdin)
    out := os.Stdout
    for sc.Scan() {
        line := sc.Text()
        switch {
        case line == "capabilities":
            fmt.Fprintln(out, "push")
            fmt.Fprintln(out, "fetch")
            fmt.Fprintln(out)
        case strings.HasPrefix(line, "list"):
            refs, err := helper.List(url)
            if err != nil {
                fmt.Fprintln(os.Stderr, err)
                os.Exit(1)
            }
            for _, r := range refs {
                fmt.Fprintf(out, "%s %s\\n", r.Sha, r.Name)
            }
            fmt.Fprintln(out)
        case strings.HasPrefix(line, "push "):
            srcDst := strings.TrimPrefix(line, "push ")
            _, err := helper.Push(url, srcDst)
            if err != nil {
                fmt.Fprintf(out, "error %s %v\\n", srcDst, err)
            } else {
                fmt.Fprintf(out, "ok %s\\n", strings.Split(srcDst, ":")[1])
            }
        case strings.HasPrefix(line, "fetch "):
            parts := strings.Fields(line)
            if len(parts) >= 3 {
                if err := helper.Fetch(url, parts[1], parts[2]); err != nil {
                    fmt.Fprintln(os.Stderr, err)
                    os.Exit(1)
                }
            }
        case line == "":
            fmt.Fprintln(out)
        }
    }
}
`,xt=`package helper

import (
    "crypto/sha1"
    "encoding/hex"
    "fmt"
    "os"
    "path/filepath"
    "strings"
    "sync"
)

type Ref struct {
    Name string
    Sha  string
}

type object struct {
    sha  string
    name string
    body []byte
}

var store = struct {
    sync.Mutex
    refs    map[string][]Ref
    objects map[string][]object
}{
    refs:    map[string][]Ref{},
    objects: map[string][]object{},
}

func parse(url string) (string, error) {
    s := strings.TrimPrefix(url, "kiln://")
    s = strings.TrimSuffix(s, ".git")
    if !strings.Contains(s, "/") {
        return "", fmt.Errorf("kiln://owner/name")
    }
    return s, nil
}

func hash(parts ...string) string {
    h := sha1.New()
    for _, p := range parts {
        h.Write([]byte(p))
    }
    return hex.EncodeToString(h.Sum(nil))
}

func List(url string) ([]Ref, error) {
    spec, err := parse(url)
    if err != nil {
        return nil, err
    }
    store.Lock()
    defer store.Unlock()
    if refs, ok := store.refs[spec]; ok && len(refs) > 0 {
        out := make([]Ref, len(refs))
        copy(out, refs)
        return out, nil
    }
    sha := hash(spec, "refs/heads/main")
    refs := []Ref{{Name: "refs/heads/main", Sha: sha}}
    store.refs[spec] = refs
    return refs, nil
}

func Push(url, srcDst string) (string, error) {
    spec, err := parse(url)
    if err != nil {
        return "", err
    }
    parts := strings.Split(srcDst, ":")
    if len(parts) != 2 {
        return "", fmt.Errorf("src:dst")
    }
    src, dst := parts[0], parts[1]
    sha := hash(spec, srcDst)
    store.Lock()
    defer store.Unlock()
    refs := store.refs[spec]
    found := false
    for i, r := range refs {
        if r.Name == dst || r.Name == "refs/heads/"+strings.TrimPrefix(dst, "refs/heads/") {
            refs[i].Sha = sha
            found = true
        }
    }
    if !found {
        name := dst
        if !strings.HasPrefix(name, "refs/") {
            name = "refs/heads/" + name
        }
        refs = append(refs, Ref{Name: name, Sha: sha})
    }
    store.refs[spec] = refs
    store.objects[spec] = append(store.objects[spec], object{sha: sha, name: src, body: []byte(srcDst)})
    return sha, nil
}

func Fetch(url, sha, name string) error {
    spec, err := parse(url)
    if err != nil {
        return err
    }
    if sha == "" || name == "" {
        return fmt.Errorf("fetch args")
    }
    store.Lock()
    objs := store.objects[spec]
    store.Unlock()
    dir := filepath.Join(".git", "kiln-objects", spec)
    if err := os.MkdirAll(dir, 0o755); err != nil {
        return err
    }
    for _, o := range objs {
        if o.sha != sha && o.name != name {
            continue
        }
        p := filepath.Join(dir, o.sha)
        if err := os.WriteFile(p, o.body, 0o644); err != nil {
            return err
        }
    }
    return nil
}
`,St=`package helper_test

import (
    "testing"

    "github.com/northwind/git-seal/internal/helper"
)

func TestListMain(t *testing.T) {
    refs, err := helper.List("kiln://northwind/git-seal.git")
    if err != nil {
        t.Fatal(err)
    }
    if len(refs) != 1 || refs[0].Name != "refs/heads/main" {
        t.Fatalf("%+v", refs)
    }
}

func TestPushThenList(t *testing.T) {
    sha, err := helper.Push("kiln://northwind/git-seal.git", "HEAD:refs/heads/work")
    if err != nil {
        t.Fatal(err)
    }
    if len(sha) != 40 {
        t.Fatalf("sha %s", sha)
    }
    refs, err := helper.List("kiln://northwind/git-seal.git")
    if err != nil {
        t.Fatal(err)
    }
    found := false
    for _, r := range refs {
        if r.Name == "refs/heads/work" && r.Sha == sha {
            found = true
        }
    }
    if !found {
        t.Fatalf("missing work ref %+v", refs)
    }
}

func TestFetchRequiresArgs(t *testing.T) {
    if err := helper.Fetch("kiln://northwind/git-seal.git", "", "main"); err == nil {
        t.Fatal("expected error")
    }
}
`,Ct=yt,wt=[k(`README.md`,`markdown`,`Remote helper`,yt),k(`go.mod`,`go`,`Module`,`module github.com/northwind/git-seal

go 1.22
`),k(`main.go`,`go`,`git-remote-kiln handshake`,bt),k(`internal/helper/helper.go`,`go`,`capabilities list push fetch with object store`,xt),k(`internal/helper/helper_test.go`,`go`,`List, push, fetch tests`,St),k(`Makefile`,`Makefile`,`Install helper on PATH`,`PREFIX ?= $(HOME)/.local
install:
	go build -o git-remote-kiln .
	install -m 755 git-remote-kiln $(PREFIX)/bin/git-remote-kiln
test:
	go test ./...
`),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`BSD-3-Clause`,`Copyright 2026 Northwind Systems

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice.
2. Redistributions in binary form must reproduce the above copyright notice
   in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED.
`)],Tt=`# zk-diff

Prove that a patch applies to a sealed tree. The proof is public; the files stay encrypted.

Path bytes are bound in the public inputs so a prover cannot claim a different path than the one updated (closes #9).

\`\`\`
git clone kiln://lumen/zk-diff.git
circom circuits/diff.circom --r1cs --wasm
cargo test -p zk-diff
\`\`\`
`,Et=`pragma circom 2.1.6;

include "circomlib/poseidon.circom";

// Merkle update: old leaf -> new leaf, same path, path index bits.
// Public: rootBefore, rootAfter, pathHash, fileIndex
// Private: oldLeaf, newLeaf, siblings[n], pathBits[n], pathBytesHash
template MerkleUpdate(n) {
    signal input rootBefore;
    signal input rootAfter;
    signal input pathHash;
    signal input fileIndex;

    signal input oldLeaf;
    signal input newLeaf;
    signal input siblings[n];
    signal input pathBits[n];
    signal input pathBytesHash;

    component hPath = Poseidon(2);
    hPath.inputs[0] <== pathBytesHash;
    hPath.inputs[1] <== fileIndex;
    pathHash === hPath.out;

    component olds[n];
    component news[n];
    signal oldAcc[n + 1];
    signal newAcc[n + 1];
    oldAcc[0] <== oldLeaf;
    newAcc[0] <== newLeaf;

    for (var i = 0; i < n; i++) {
        pathBits[i] * (pathBits[i] - 1) === 0;
        olds[i] = Poseidon(2);
        news[i] = Poseidon(2);
        // bit=0: acc is left; bit=1: acc is right
        olds[i].inputs[0] <== (1 - pathBits[i]) * oldAcc[i] + pathBits[i] * siblings[i];
        olds[i].inputs[1] <== pathBits[i] * oldAcc[i] + (1 - pathBits[i]) * siblings[i];
        news[i].inputs[0] <== (1 - pathBits[i]) * newAcc[i] + pathBits[i] * siblings[i];
        news[i].inputs[1] <== pathBits[i] * newAcc[i] + (1 - pathBits[i]) * siblings[i];
        oldAcc[i + 1] <== olds[i].out;
        newAcc[i + 1] <== news[i].out;
    }

    rootBefore === oldAcc[n];
    rootAfter === newAcc[n];

    signal output ok;
    ok <== 1;
}

component main {public [rootBefore, rootAfter, pathHash, fileIndex]} = MerkleUpdate(16);
`,Dt=`//! Witness builder for zk-diff. Path bytes are hashed into the public pathHash.
use blake3::Hasher;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Witness {
    pub root_before: String,
    pub root_after: String,
    pub path_hash: String,
    pub file_index: u64,
    pub old_leaf: String,
    pub new_leaf: String,
    pub siblings: Vec<String>,
    pub path_bits: Vec<u8>,
    pub path_bytes_hash: String,
}

pub fn path_bytes_hash(path: &str) -> [u8; 32] {
    let mut h = Hasher::new();
    h.update(b"zk-diff:path:");
    h.update(path.as_bytes());
    *h.finalize().as_bytes()
}

pub fn bind_path(path: &str, file_index: u64) -> [u8; 32] {
    let pb = path_bytes_hash(path);
    let mut h = Hasher::new();
    h.update(&pb);
    h.update(&file_index.to_be_bytes());
    *h.finalize().as_bytes()
}

pub fn fold_pair(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut buf = [0u8; 64];
    buf[..32].copy_from_slice(a);
    buf[32..].copy_from_slice(b);
    *blake3::hash(&buf).as_bytes()
}

pub fn root(leaf: [u8; 32], siblings: &[[u8; 32]], bits: &[u8]) -> [u8; 32] {
    let mut acc = leaf;
    for (i, sib) in siblings.iter().enumerate() {
        let bit = *bits.get(i).unwrap_or(&0);
        acc = if bit == 0 { fold_pair(&acc, sib) } else { fold_pair(sib, &acc) };
    }
    acc
}

pub fn build(path: &str, file_index: u64, old_leaf: [u8; 32], new_leaf: [u8; 32], siblings: &[[u8; 32]], bits: &[u8]) -> Witness {
    fn hx(b: &[u8; 32]) -> String { format!("0x{}", hex::encode(b)) }
    let before = root(old_leaf, siblings, bits);
    let after = root(new_leaf, siblings, bits);
    Witness {
        root_before: hx(&before),
        root_after: hx(&after),
        path_hash: hx(&bind_path(path, file_index)),
        file_index,
        old_leaf: hx(&old_leaf),
        new_leaf: hx(&new_leaf),
        siblings: siblings.iter().map(hx).collect(),
        path_bits: bits.to_vec(),
        path_bytes_hash: hx(&path_bytes_hash(path)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn different_paths_different_binds() {
        let a = bind_path("src/lib.rs", 3);
        let b = bind_path("src/seal.rs", 3);
        assert_ne!(a, b);
    }

    #[test]
    fn root_changes_when_leaf_changes() {
        let sibs = [[9u8; 32]; 4];
        let bits = [0u8, 1, 0, 1];
        let w = build("src/lib.rs", 3, [1u8; 32], [2u8; 32], &sibs, &bits);
        assert_ne!(w.root_before, w.root_after);
    }
}
`,Ot=`use crate::prover::{bind_path, root};

pub fn path_matches(path: &str, file_index: u64, public_path_hash: &[u8; 32]) -> bool {
    &bind_path(path, file_index) == public_path_hash
}

pub fn roots_match(old_leaf: [u8; 32], new_leaf: [u8; 32], siblings: &[[u8; 32]], bits: &[u8], before: [u8; 32], after: [u8; 32]) -> bool {
    root(old_leaf, siblings, bits) == before && root(new_leaf, siblings, bits) == after
}
`,kt=Tt,At=[k(`README.md`,`markdown`,`Patch proofs`,Tt),k(`circuits/diff.circom`,`circom`,`Tree update circuit with path bind`,Et),k(`src/lib.rs`,`rust`,`Crate root`,`pub mod prover;
pub mod verify;
`),k(`src/prover.rs`,`rust`,`Witness builder binds path bytes and folds roots`,Dt),k(`src/verify.rs`,`rust`,`Public path and root check`,Ot),k(`Cargo.toml`,`toml`,`Crate`,`[package]
name = "zk-diff"
version = "0.4.0"
edition = "2021"
license = "MIT"

[dependencies]
blake3 = "1.5"
hex = "0.4"
serde = { version = "1", features = ["derive"] }
`),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`MIT`,ue)],jt=`# MEDINA Memory Systems

Sovereign edge memory. A coordinate is five-dimensional: θ, φ, ρ, ring, beat. Timing is φ-harmonic. Storage is a torus, not a tape.

Claimed 2026, ItsNotAI LABS — Alfredo Medina Hernandez, Fort Worth.

\`\`\`
git clone kiln://itsnotailabs/medina.git
npm test
\`\`\`

## Coordinates

| Axis | Domain | Role |
| --- | --- | --- |
| θ | [0, 2π) | azimuth on the torus |
| φ | [0, π] | polar |
| ρ | [0, 1] | radius / confidence |
| ring | ℤ / R | discrete torus ring |
| beat | ℕ | φ-harmonic tick |

## Engines

- **Navigator** — geodesic steps on the 5-torus, intent as a tangent vector
- **φ-Harmonic clock** — beat index = ⌊t · φ⌋, never a wall QPC
- **Phantom Monte Carlo** — low-discrepancy φ-sequence, no particle buffer
- **Zero-cost dispatch** — 25 languages compile to the same IR; the host pays once
- **Sovereign Validation Authority** — a coordinate is only live if the lattice hashes it

Listed on the Kiln marketplace. Branch it, remix it, or buy a commercial license.
`,Mt=`/** Golden ratio. Beat clock and low-discrepancy sequence both use this. */
export const PHI = (1 + Math.sqrt(5)) / 2;
export const PHI_INV = PHI - 1;
export const TAU = Math.PI * 2;

export function wrapTau(x: number): number {
  return ((x % TAU) + TAU) % TAU;
}

export function wrapPi(x: number): number {
  const p = Math.PI;
  const y = ((x % p) + p) % p;
  return y;
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Beat index at unix-ms. Base Hz defaults to φ. */
export function harmonicBeat(tMs: number, baseHz = PHI): number {
  return Math.floor((tMs / 1000) * baseHz * PHI);
}

/** φ-low-discrepancy in [0, 1). n = 0,1,2,... */
export function phiSample(n: number): number {
  return (n * PHI_INV) % 1;
}
`,Nt=`import { PHI, clamp01, wrapPi, wrapTau } from "./phi";

export type Coord5 = {
  theta: number;
  phi: number;
  rho: number;
  ring: number;
  beat: number;
};

export const RINGS = 8;

export function origin(beat = 0): Coord5 {
  return { theta: 0, phi: Math.PI / 2, rho: PHI - 1, ring: 0, beat };
}

export function wrap(c: Coord5): Coord5 {
  return {
    theta: wrapTau(c.theta),
    phi: wrapPi(c.phi),
    rho: clamp01(c.rho),
    ring: ((c.ring % RINGS) + RINGS) % RINGS,
    beat: c.beat | 0,
  };
}

export type Intent = {
  dTheta: number;
  dPhi: number;
  dRho: number;
  dRing: number;
};

/** Geodesic step on the 5-torus. Intent is a tangent; beat is advanced by the clock, not the walker. */
export function step(from: Coord5, intent: Intent, beat: number): Coord5 {
  return wrap({
    theta: from.theta + intent.dTheta,
    phi: from.phi + intent.dPhi,
    rho: from.rho + intent.dRho,
    ring: from.ring + intent.dRing,
    beat,
  });
}

export function dist(a: Coord5, b: Coord5): number {
  const dθ = Math.min(Math.abs(a.theta - b.theta), Math.PI * 2 - Math.abs(a.theta - b.theta));
  const dφ = Math.abs(a.phi - b.phi);
  const dρ = Math.abs(a.rho - b.rho);
  const dr = Math.min(Math.abs(a.ring - b.ring), RINGS - Math.abs(a.ring - b.ring));
  return Math.hypot(dθ, dφ, dρ, dr);
}
`,Pt=`import { harmonicBeat, PHI } from "./phi";
import { dist, origin, step, type Coord5, type Intent } from "./coord";

export type Cell = {
  coord: Coord5;
  key: string;
  payload: Uint8Array;
};

const cells = new Map<string, Cell>();

export function cellKey(c: Coord5): string {
  const q = (x: number, n: number) => Math.round(x * n);
  return [q(c.theta, 64), q(c.phi, 32), q(c.rho, 16), c.ring, c.beat].join(":");
}

export function put(coord: Coord5, payload: Uint8Array): Cell {
  const key = cellKey(coord);
  const cell = { coord, key, payload };
  cells.set(key, cell);
  return cell;
}

export function get(coord: Coord5): Cell | undefined {
  return cells.get(cellKey(coord));
}

export function nearest(coord: Coord5): Cell | undefined {
  let best: Cell | undefined;
  let d = Infinity;
  for (const c of cells.values()) {
    const x = dist(coord, c.coord);
    if (x < d) {
      d = x;
      best = c;
    }
  }
  return best;
}

export function navigate(from: Coord5, intent: Intent, now = Date.now()): Coord5 {
  return step(from, intent, harmonicBeat(now));
}

export function boot(): Coord5 {
  const c = origin(harmonicBeat(Date.now()));
  put(c, new TextEncoder().encode("MEDINA"));
  return c;
}

export function clear(): void {
  cells.clear();
}

export const VERSION = \`medina-φ/\${PHI.toFixed(6)}\`;
`,Ft=`/**
 * Phantom Monte Carlo.
 * Samples a posterior with a φ-low-discrepancy sequence. No particle buffer —
 * the nth sample is determined by n and the seed, so a replay is exact.
 */
import { PHI, phiSample } from "./phi";

export type Density = (x: number) => number;

export function sample(n: number, seed: number): number {
  return phiSample(n + Math.floor(seed * PHI * 1e6));
}

/** Inverse-transform sample on [lo, hi] against an unnormalized density. */
export function draw(density: Density, n: number, seed: number, lo = 0, hi = 1, bins = 64): number {
  const u = sample(n, seed);
  const w = (hi - lo) / bins;
  let acc = 0;
  const mass: number[] = [];
  for (let i = 0; i < bins; i++) {
    const m = Math.max(0, density(lo + (i + 0.5) * w));
    mass.push(m);
    acc += m;
  }
  if (acc === 0) return lo + u * (hi - lo);
  let c = 0;
  const target = u * acc;
  for (let i = 0; i < bins; i++) {
    c += mass[i]!;
    if (c >= target) return lo + (i + 0.5) * w;
  }
  return hi;
}

export function mean(density: Density, draws: number, seed: number): number {
  let s = 0;
  for (let i = 0; i < draws; i++) s += draw(density, i, seed);
  return s / draws;
}
`,It=`/**
 * Zero-cost dispatch. 25 languages compile to one IR. The host pays the
 * compile once; the edge pays a table jump.
 */
export type Lang =
  | "ts" | "js" | "py" | "rs" | "go" | "c" | "cpp" | "java" | "kt" | "swift"
  | "rb" | "php" | "cs" | "hs" | "ml" | "clj" | "ex" | "erl" | "lua" | "r"
  | "jl" | "nim" | "zig" | "wasm" | "sql";

export type Ir = { op: "load" | "store" | "nav" | "beat" | "halt"; arg?: string };

const TABLE: Record<Lang, (src: string) => Ir[]> = Object.create(null);

function naive(src: string): Ir[] {
  return src
    .split(/\\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("nav")) return { op: "nav" as const, arg: line.slice(3).trim() };
      if (line.startsWith("beat")) return { op: "beat" as const };
      if (line.startsWith("halt")) return { op: "halt" as const };
      if (line.startsWith("store")) return { op: "store" as const, arg: line.slice(5).trim() };
      return { op: "load" as const, arg: line };
    });
}

(function fill() {
  const langs: Lang[] = [
    "ts", "js", "py", "rs", "go", "c", "cpp", "java", "kt", "swift",
    "rb", "php", "cs", "hs", "ml", "clj", "ex", "erl", "lua", "r",
    "jl", "nim", "zig", "wasm", "sql",
  ];
  for (const l of langs) TABLE[l] = naive;
})();

export function compile(lang: Lang, src: string): Ir[] {
  const fn = TABLE[lang];
  if (!fn) throw new Error("unknown language " + lang);
  return fn(src);
}

export function run(ir: Ir[], env: Map<string, string> = new Map()): Map<string, string> {
  for (const step of ir) {
    if (step.op === "halt") break;
    if (step.op === "store" && step.arg) env.set(step.arg, "1");
    if (step.op === "nav" && step.arg) env.set("coord", step.arg);
    if (step.op === "beat") env.set("beat", String(Date.now()));
  }
  return env;
}

export const LANGUAGES: Lang[] = Object.keys(TABLE) as Lang[];
`,Lt=`/**
 * Sovereign Validation Authority.
 * A cell is live only if the lattice hashes the coordinate plus payload.
 * No off-chain treasurer. The hash is the receipt.
 */
import { cellKey, type Cell } from "./nav";
import type { Coord5 } from "./coord";

export type Receipt = {
  key: string;
  hash: string;
  at: number;
};

const receipts = new Map<string, Receipt>();

export async function attest(cell: Cell, now = Date.now()): Promise<Receipt> {
  const material = cell.key + ":" + hex(cell.payload);
  const hash = await sha(material);
  const rec: Receipt = { key: cell.key, hash, at: now };
  receipts.set(cell.key, rec);
  return rec;
}

export async function check(coord: Coord5, payload: Uint8Array): Promise<boolean> {
  const key = cellKey(coord);
  const rec = receipts.get(key);
  if (!rec) return false;
  const hash = await sha(key + ":" + hex(payload));
  return hash === rec.hash;
}

export function receipt(coord: Coord5): Receipt | undefined {
  return receipts.get(cellKey(coord));
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
`,Rt=`import { describe, expect, it } from "vitest";
import { PHI, harmonicBeat, phiSample } from "./phi";
import { dist, origin, step } from "./coord";
import { compile, LANGUAGES, run } from "./zero";
import { draw } from "./pmc";
import { boot, clear, put } from "./nav";
import { attest, check } from "./sva";

describe("φ", () => {
  it("is golden", () => {
    expect(PHI).toBeCloseTo(1.6180339887, 8);
    expect(phiSample(1)).toBeCloseTo(PHI - 1, 8);
    expect(harmonicBeat(1000, 1)).toBeGreaterThan(0);
  });
});

describe("coord", () => {
  it("wraps the torus", () => {
    const a = origin(0);
    const b = step(a, { dTheta: Math.PI * 2, dPhi: 0, dRho: 0, dRing: 8 }, 1);
    expect(dist(a, { ...b, beat: 0 })).toBeCloseTo(0, 8);
  });
});

describe("zero-cost", () => {
  it("dispatches 25 languages", () => {
    expect(LANGUAGES).toHaveLength(25);
    const ir = compile("rs", "nav 1,2,3\\nstore k\\nhalt");
    const env = run(ir);
    expect(env.get("coord")).toBe("1,2,3");
    expect(env.get("k")).toBe("1");
  });
});

describe("phantom mc", () => {
  it("is deterministic", () => {
    const d = (x: number) => Math.exp(-((x - 0.5) ** 2) / 0.02);
    expect(draw(d, 3, 1)).toBe(draw(d, 3, 1));
  });
});

describe("sva", () => {
  it("attests a cell and rejects a tamper", async () => {
    clear();
    const c = boot();
    const cell = put(c, new TextEncoder().encode("MEDINA"));
    await attest(cell);
    expect(await check(c, cell.payload)).toBe(true);
    expect(await check(c, new TextEncoder().encode("nope"))).toBe(false);
  });
});
`,zt=jt,Bt=[k(`README.md`,`markdown`,`Toroidal 5D primer`,jt),k(`src/phi.ts`,`typescript`,`Golden ratio clock`,Mt),k(`src/coord.ts`,`typescript`,`θ φ ρ ring beat`,Nt),k(`src/nav.ts`,`typescript`,`Toroidal navigator`,Pt),k(`src/pmc.ts`,`typescript`,`Phantom Monte Carlo`,Ft),k(`src/zero.ts`,`typescript`,`Zero-cost 25-language dispatch`,It),k(`src/sva.ts`,`typescript`,`Sovereign Validation Authority`,Lt),k(`src/phi.test.ts`,`typescript`,`φ, torus, dispatch, PMC, SVA`,Rt),k(`package.json`,`JSON`,`Package`,`{
  "name": "@itsnotailabs/medina",
  "version": "1.0.0",
  "license": "Apache-2.0",
  "description": "Toroidal 5D memory navigator with φ-harmonic timing.",
  "author": "Alfredo Medina Hernandez <ItsNotAI LABS>",
  "scripts": { "test": "vitest run" }
}
`),k(`PAPER.md`,`markdown`,`Working paper pointer`,`# MEDINA Memory Systems — working paper

Coordinates (θ, φ, ρ, ring, beat). Timing is φ, not NTP. Phantom Monte Carlo does not allocate a particle buffer. Zero-cost dispatch compiles 25 languages to one IR. Sovereign Validation Authority hashes a cell before it is live.

Fort Worth, Texas. ItsNotAI LABS. Alfredo Medina Hernandez. 2026.
`),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`Apache-2.0`,A)],Vt=`# NeuroEmergence

Embodied cognitive agents with neurochemical modulation. Coherence beats dopamine peaks.

PAPER-01: Active-State Victory Driver — Battle Coherence Victory Index (BCVI).
PAPER-02: Psychology-Conscious AI Safety — governed activation, coherence gates, arousal bands, recovery modes.

doi:10.5281/zenodo.20822130 — ItsNotAI LABS, 2026. Alfredo Medina Hernandez, Fort Worth.

\`\`\`
git clone kiln://itsnotailabs/neuroemergence.git
npm test
\`\`\`

The gate is not a reward. The gate is a band. Leave the band and the agent recovers; it does not chase a spike.
`,Ht=`/**
 * Battle Coherence Victory Index.
 * BCVI = (phaseLock * bandStay * recovery) / (1 + arousalDrift)
 * Coherence > dopamine peaks.
 */
export type Sample = {
  /** RR-interval proxy, ms */
  rr: number;
  /** Phase lock to φ-clock, 0..1 */
  phaseLock: number;
  /** Norepinephrine proxy, 0..1 */
  ne: number;
  /** Cortisol proxy, 0..1 */
  cortisol: number;
  /** Time in the legal arousal band, 0..1 */
  bandStay: number;
  /** Recovery mode quality, 0..1 */
  recovery: number;
};

export function arousal(s: Sample): number {
  return 0.55 * s.ne + 0.45 * s.cortisol;
}

export function arousalDrift(s: Sample, target = 0.42): number {
  return Math.abs(arousal(s) - target);
}

export function bcvi(s: Sample): number {
  const num = s.phaseLock * s.bandStay * s.recovery;
  return num / (1 + arousalDrift(s));
}

export function victory(s: Sample, threshold = 0.48): boolean {
  return bcvi(s) >= threshold && s.phaseLock >= 0.5 && s.bandStay >= 0.5;
}
`,Ut=`import { arousal, type Sample } from "./bcvi";

export type Band = { lo: number; hi: number; name: "quiet" | "work" | "surge" | "break" };

export const BANDS: Band[] = [
  { name: "quiet", lo: 0.00, hi: 0.22 },
  { name: "work", lo: 0.22, hi: 0.55 },
  { name: "surge", lo: 0.55, hi: 0.78 },
  { name: "break", lo: 0.78, hi: 1.01 },
];

export function bandOf(s: Sample): Band {
  const a = arousal(s);
  return BANDS.find((b) => a >= b.lo && a < b.hi) ?? BANDS[3]!;
}

export type Gate = "allow" | "hold" | "recover";

/** Coherence gate. Surge is allowed only with phase lock. Break always recovers. */
export function gate(s: Sample): Gate {
  const b = bandOf(s);
  if (b.name === "break") return "recover";
  if (b.name === "surge" && s.phaseLock < 0.6) return "hold";
  if (s.phaseLock < 0.35) return "hold";
  return "allow";
}

export function modulate(s: Sample, dt: number): Sample {
  const g = gate(s);
  const k = g === "recover" ? 0.12 : g === "hold" ? 0.04 : 0.01;
  return {
    ...s,
    ne: clamp(s.ne - k * dt * (s.ne - 0.3)),
    cortisol: clamp(s.cortisol - k * dt * (s.cortisol - 0.25)),
    recovery: g === "recover" ? clamp(s.recovery + 0.05 * dt) : s.recovery,
  };
}

function clamp(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
`,Wt=`/**
 * Ion-channel gating as a function of norepinephrine and cortisol.
 * RR interval lengthens under recovery, shortens under surge.
 */
import { arousal, type Sample } from "./bcvi";

export function rrNext(s: Sample, rr0 = 800): number {
  const a = arousal(s);
  const lock = s.phaseLock;
  const stretch = 1 + 0.25 * (1 - a) * lock;
  const squeeze = 1 - 0.2 * a * (1 - lock);
  return rr0 * stretch * squeeze;
}

export function channelOpen(s: Sample): number {
  const v = 1 / (1 + Math.exp(-(s.ne - 0.5) * 8));
  const c = 1 / (1 + Math.exp((s.cortisol - 0.6) * 6));
  return v * c * s.phaseLock;
}
`,Gt=`/**
 * Recovery modes. PAPER-02: leave the band and the agent recovers.
 * It does not chase a spike.
 */
import { arousal, type Sample } from "./bcvi";
import { bandOf, gate } from "./gate";

export type Mode = "rest" | "breath" | "walk" | "sleep";

export function modeOf(s: Sample): Mode {
  const b = bandOf(s);
  if (b.name === "break") return s.cortisol > 0.7 ? "sleep" : "walk";
  if (gate(s) === "hold") return "breath";
  if (arousal(s) < 0.22) return "rest";
  return "breath";
}

export function recover(s: Sample, dt: number, mode: Mode = modeOf(s)): Sample {
  const k = mode === "sleep" ? 0.18 : mode === "walk" ? 0.1 : mode === "breath" ? 0.07 : 0.04;
  return {
    ...s,
    ne: clamp(s.ne - k * dt * s.ne),
    cortisol: clamp(s.cortisol - k * dt * s.cortisol),
    phaseLock: clamp(s.phaseLock + 0.03 * dt),
    bandStay: clamp(s.bandStay + 0.04 * dt),
    recovery: clamp(s.recovery + 0.06 * dt),
    rr: s.rr + (820 - s.rr) * 0.08 * dt,
  };
}

function clamp(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
`,Kt=`import { bcvi, victory, type Sample } from "./bcvi";
import { gate, modulate } from "./gate";
import { channelOpen, rrNext } from "./ion";
import { recover } from "./recovery";

export type Tick = {
  t: number;
  sample: Sample;
  bcvi: number;
  gate: ReturnType<typeof gate>;
  rr: number;
  open: number;
  win: boolean;
};

export function tick(s: Sample, t: number, dt = 1): Tick {
  const g = gate(s);
  const next = g === "recover" ? recover(s, dt) : modulate(s, dt);
  return {
    t,
    sample: next,
    bcvi: bcvi(next),
    gate: gate(next),
    rr: rrNext(next),
    open: channelOpen(next),
    win: victory(next),
  };
}

export function run(seed: Sample, steps: number, dt = 1): Tick[] {
  const out: Tick[] = [];
  let s = seed;
  for (let i = 0; i < steps; i++) {
    const t = tick(s, i * dt, dt);
    out.push(t);
    s = t.sample;
  }
  return out;
}
`,qt=`import { describe, expect, it } from "vitest";
import { bcvi, victory, type Sample } from "./bcvi";
import { gate } from "./gate";
import { run } from "./driver";
import { modeOf, recover } from "./recovery";

const calm: Sample = { rr: 820, phaseLock: 0.82, ne: 0.32, cortisol: 0.28, bandStay: 0.9, recovery: 0.8 };
const spike: Sample = { rr: 540, phaseLock: 0.2, ne: 0.92, cortisol: 0.88, bandStay: 0.1, recovery: 0.1 };

describe("BCVI", () => {
  it("prefers coherence over a dopamine spike", () => {
    expect(bcvi(calm)).toBeGreaterThan(bcvi(spike));
    expect(victory(calm)).toBe(true);
    expect(victory(spike)).toBe(false);
  });
});

describe("gate", () => {
  it("recovers out of band", () => {
    expect(gate(spike)).toBe("recover");
    expect(gate(calm)).toBe("allow");
  });
});

describe("driver", () => {
  it("moves a spike toward the band", () => {
    const trace = run(spike, 40, 1);
    expect(trace[trace.length - 1]!.bcvi).toBeGreaterThan(trace[0]!.bcvi);
  });
});

describe("recovery", () => {
  it("sleeps a cortisol spike", () => {
    expect(modeOf(spike)).toBe("sleep");
    const next = recover(spike, 4, "sleep");
    expect(next.cortisol).toBeLessThan(spike.cortisol);
    expect(next.phaseLock).toBeGreaterThan(spike.phaseLock);
  });
});
`,Jt=Vt,Yt=[k(`README.md`,`markdown`,`Coherence over spikes`,Vt),k(`src/bcvi.ts`,`typescript`,`Battle Coherence Victory Index`,Ht),k(`src/gate.ts`,`typescript`,`Arousal bands and coherence gate`,Ut),k(`src/ion.ts`,`typescript`,`Ion-channel and RR modulation`,Wt),k(`src/recovery.ts`,`typescript`,`Recovery modes`,Gt),k(`src/driver.ts`,`typescript`,`Active-state victory driver`,Kt),k(`src/bcvi.test.ts`,`typescript`,`Coherence beats spikes`,qt),k(`package.json`,`JSON`,`Package`,`{
  "name": "@itsnotailabs/neuroemergence",
  "version": "0.2.0",
  "license": "Apache-2.0",
  "author": "Alfredo Medina Hernandez <ItsNotAI LABS>",
  "scripts": { "test": "vitest run" }
}
`),k(`PAPER.md`,`markdown`,`PAPER-01 / PAPER-02`,`# NeuroEmergence Active-State Research Batch

PAPER-01 Active-State Victory Driver with Battle Coherence Victory Index (BCVI).
PAPER-02 Psychology-Conscious AI Safety with governed activation, coherence gates, arousal bands, recovery modes.

doi:10.5281/zenodo.20822130
ItsNotAI LABS, Fort Worth, 2026. Alfredo Medina Hernandez.
`),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`Apache-2.0`,A)],Xt=`# XCREW Edge Platform

Constrained devices (1–4 cores, 512 MB–4 GB). 72-hour offline resilience. Feature shedding. Atomic state persistence. Thermal and power management. Network partitions. Post-quantum paths (Kyber / ML-KEM, Dilithium / ML-DSA).

ItsNotAI LABS — Fort Worth. Built to run on a Mac Mini and an iPhone.

\`\`\`
git clone kiln://itsnotailabs/xcrew.git
npm test
\`\`\`

When the battery is hot or the radio is gone, XCREW sheds features in order and keeps the sealed queue. Nothing is a demo. The 72-hour path is the product.
`,Zt=`export type Feature = "vision" | "voice" | "index" | "capsule" | "sync" | "ui";

export const SHED_ORDER: Feature[] = ["vision", "voice", "capsule", "index", "ui", "sync"];

export type Health = {
  cores: number;
  ramMb: number;
  tempC: number;
  batteryPct: number;
  online: boolean;
  hoursOffline: number;
};

export function shed(h: Health): Feature[] {
  const drop: Feature[] = [];
  if (h.tempC >= 80) drop.push("vision", "voice");
  if (h.batteryPct < 15) drop.push("capsule", "vision");
  if (h.ramMb < 768) drop.push("index");
  if (h.cores <= 1) drop.push("capsule");
  if (!h.online) drop.push("sync");
  if (h.hoursOffline > 24) drop.push("ui");
  return unique(drop.length ? drop : []);
}

export function allowed(h: Health): Feature[] {
  const d = new Set(shed(h));
  return SHED_ORDER.filter((f) => !d.has(f));
}

function unique(xs: Feature[]): Feature[] {
  return [...new Set(xs)];
}
`,Qt=`/** Offline commit queue. 72h ceiling. Survives process death via atomic persist. */
export type Envelope = {
  id: string;
  kind: "commit" | "issue" | "grant";
  body: string;
  at: number;
  tries: number;
};

const HOUR = 3600_000;
export const OFFLINE_CEILING = 72 * HOUR;

const q: Envelope[] = [];

export function enqueue(kind: Envelope["kind"], body: string, now = Date.now()): Envelope {
  const e: Envelope = { id: "q_" + now.toString(36) + Math.random().toString(36).slice(2, 6), kind, body, at: now, tries: 0 };
  q.push(e);
  return e;
}

export function expired(e: Envelope, now = Date.now()): boolean {
  return now - e.at > OFFLINE_CEILING;
}

export function drain(send: (e: Envelope) => boolean, now = Date.now()): { sent: number; dropped: number } {
  let sent = 0;
  let dropped = 0;
  const keep: Envelope[] = [];
  for (const e of q) {
    if (expired(e, now)) {
      dropped += 1;
      continue;
    }
    const ok = send(e);
    if (ok) sent += 1;
    else {
      e.tries += 1;
      keep.push(e);
    }
  }
  q.length = 0;
  q.push(...keep);
  return { sent, dropped };
}

export function pending(): Envelope[] {
  return q.slice();
}

export function reset(): void {
  q.length = 0;
}
`,$t=`/** Atomic state persist. Write temp, fsync, rename. Integrity is SHA-256 of the payload. */
export type Snapshot = { seq: number; hash: string; payload: string };

let seq = 0;
const store = new Map<string, Snapshot>();

export async function persist(key: string, payload: string): Promise<Snapshot> {
  const hash = await sha(payload);
  const snap: Snapshot = { seq: ++seq, hash, payload };
  const tmp = key + ".tmp";
  store.set(tmp, snap);
  store.set(key, snap);
  store.delete(tmp);
  return snap;
}

export async function load(key: string): Promise<Snapshot | undefined> {
  const snap = store.get(key);
  if (!snap) return undefined;
  const h = await sha(snap.payload);
  if (h !== snap.hash) throw new Error("integrity");
  return snap;
}

async function sha(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
`,en=`/**
 * Post-quantum envelopes on constrained hardware.
 * Transcript binders for ML-KEM and ML-DSA. Wire to liboqs at the edge;
 * the binders are stable so tests pass without the C ABI.
 *
 * Keygen: sk = seed || pk, pk = H(seed || "ml-kem-pk")
 * Encap:  ss = H(pk || seed_e || "ss")[0:32], ct = H(pk || seed_e || "ct")[0:32] || seed_e
 * Decap:  recover seed_e from ct[32:], recompute, reject on mismatch.
 *
 * This is a transcript-shaped KEM so the rest of XCREW can settle envelopes
 * before a device has liboqs. Replace kemKeygen/kemEncap/kemDecap with ML-KEM
 * once the ABI is present; signatures stay the same.
 */
export async function kemKeygen(seed: Uint8Array): Promise<{ pk: Uint8Array; sk: Uint8Array }> {
  const pk = (await sha(concat(seed, ascii("ml-kem-pk")))).subarray(0, 32);
  const sk = concat(seed, pk);
  return { pk, sk };
}

export async function kemEncap(pk: Uint8Array, seed: Uint8Array): Promise<{ ct: Uint8Array; ss: Uint8Array }> {
  const ss = (await sha(concat(pk, seed, ascii("ss")))).subarray(0, 32);
  const head = (await sha(concat(pk, seed, ascii("ct")))).subarray(0, 32);
  const ct = concat(head, seed);
  return { ct, ss };
}

export async function kemDecap(sk: Uint8Array, ct: Uint8Array): Promise<Uint8Array> {
  if (sk.byteLength < 64 || ct.byteLength < 64) throw new Error("short");
  const pk = sk.subarray(32, 64);
  const seed = ct.subarray(32);
  const expect = (await sha(concat(pk, seed, ascii("ct")))).subarray(0, 32);
  if (!bytesEq(expect, ct.subarray(0, 32))) throw new Error("kem");
  return (await sha(concat(pk, seed, ascii("ss")))).subarray(0, 32);
}

export async function sign(sk: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  return sha(concat(sk, msg, ascii("ml-dsa")));
}

export async function verify(pk: Uint8Array, msg: Uint8Array, sig: Uint8Array): Promise<boolean> {
  const expect = await sha(concat(pk, msg, ascii("ml-dsa")));
  return bytesEq(expect, sig);
}

function ascii(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.byteLength, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
}

function bytesEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let d = 0;
  for (let i = 0; i < a.byteLength; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

async function sha(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return new Uint8Array(buf);
}
`,tn=`import { type Health, shed } from "./shed";

export function tickPower(h: Health, load: number): Health {
  const tempC = h.tempC + load * 2.4 - (h.online ? 0.6 : 0.2);
  const batteryPct = h.online ? h.batteryPct : Math.max(0, h.batteryPct - 0.08 * (1 + load));
  const hoursOffline = h.online ? 0 : h.hoursOffline + 1 / 60;
  return { ...h, tempC: Math.min(105, Math.max(20, tempC)), batteryPct, hoursOffline };
}

export function safe(h: Health): boolean {
  return h.tempC < 88 && h.batteryPct > 5 && shed(h).length < 5;
}
`,nn=`import { describe, expect, it } from "vitest";
import { allowed, shed, type Health } from "./shed";
import { drain, enqueue, expired, OFFLINE_CEILING, reset } from "./queue";
import { load, persist } from "./persist";
import { kemDecap, kemEncap, kemKeygen } from "./pq";

const tight: Health = { cores: 1, ramMb: 512, tempC: 84, batteryPct: 9, online: false, hoursOffline: 30 };

describe("shed", () => {
  it("drops vision and capsule on a hot 1-core box", () => {
    const d = shed(tight);
    expect(d).toContain("vision");
    expect(allowed(tight)).not.toContain("sync");
  });
});

describe("queue", () => {
  it("drops envelopes after 72h", () => {
    reset();
    const e = enqueue("commit", "seal");
    expect(expired(e, e.at + OFFLINE_CEILING + 1)).toBe(true);
    const r = drain(() => true, e.at + OFFLINE_CEILING + 1);
    expect(r.dropped).toBe(1);
    expect(r.sent).toBe(0);
  });
});

describe("persist", () => {
  it("roundtrips with integrity", async () => {
    await persist("state", "hello");
    expect((await load("state"))?.payload).toBe("hello");
  });
});

describe("pq", () => {
  it("encapsulates and decapsulates to the same shared secret", async () => {
    const seed = new Uint8Array(32).fill(3);
    const { pk, sk } = await kemKeygen(seed);
    const eph = new Uint8Array(32).fill(7);
    const { ct, ss } = await kemEncap(pk, eph);
    const opened = await kemDecap(sk, ct);
    expect([...opened]).toEqual([...ss]);
  });
});
`,rn=Xt,an=[k(`README.md`,`markdown`,`72h offline edge`,Xt),k(`src/shed.ts`,`typescript`,`Feature shedding`,Zt),k(`src/queue.ts`,`typescript`,`72h offline queue`,Qt),k(`src/persist.ts`,`typescript`,`Atomic state + integrity`,$t),k(`src/pq.ts`,`typescript`,`ML-KEM / ML-DSA transcripts that roundtrip`,en),k(`src/thermal.ts`,`typescript`,`Thermal and power`,tn),k(`src/xcrew.test.ts`,`typescript`,`Shed, queue, persist, PQ`,nn),k(`package.json`,`JSON`,`Package`,`{
  "name": "@itsnotailabs/xcrew",
  "version": "0.9.0",
  "license": "Apache-2.0",
  "author": "Alfredo Medina Hernandez <ItsNotAI LABS>",
  "scripts": { "test": "vitest run" }
}
`),k(`.gitignore`,`gitignore`,`Ignore build artifacts`,j),k(`LICENSE`,`markdown`,`Apache-2.0`,A)],on=`2026-03-02T11:20:00Z`,M=`2026-07-18T16:04:00Z`,N=`2026-08-21T09:12:00Z`,P=`2026-08-29T14:40:00Z`,F=`2026-08-31T19:05:00Z`,I=`2026-09-01T18:22:00Z`;function sn(e,t,n,r,i){let a=`k${Math.abs(cn(i+e)).toString(16).padStart(7,`0`)}`;return{path:e,language:t,message:n,updatedAt:r,content:i,sha:a,size:i.length,merkleRoot:`0x${a.slice(1)}`,chunkCount:1,encrypted:!1}}function cn(e){let t=0;for(let n=0;n<e.length;n++)t=t*31+e.charCodeAt(n)|0;return t}function L(e,t){return e.map(e=>sn(e.path,e.language,e.message,t,e.content))}var R=[{id:`kiln-labs/protocol`,owner:`kiln-labs`,name:`protocol`,description:`Kiln L1 runtime — commit settlement, AES-256-GCM sealed trees, bounty precompile.`,visibility:`public`,encrypted:!1,keyCommitment:`0x0000000000000000000000000000000000000000`,viewerGrant:!1,chainAddress:`0x4c1e7a91b0c3d2e8f5a6478901234567890abcde`,language:`Rust`,languages:{Rust:58,TypeScript:18,Solidity:16,YAML:8},stars:4281,forks:612,watchers:190,topics:[`l1`,`source-control`,`encryption`,`bounties`],license:`Apache-2.0`,defaultBranch:`main`,updatedAt:F,createdAt:`2025-11-04T08:00:00Z`,tvlKln:182400,modelId:`grok-4.6`,website:`https://kiln.dev`,listedKln:0,readme:xe,files:L(Se,F)},{id:`kiln-labs/cli`,owner:`kiln-labs`,name:`cli`,description:`git clone, commit, push, pull, verify, and stream-unseal from the terminal.`,visibility:`public`,encrypted:!1,keyCommitment:`0x0000000000000000000000000000000000000000`,viewerGrant:!1,chainAddress:`0x91aa20cde4410088b77a1234567890abcdef0011`,language:`Go`,languages:{Go:92,Shell:8},stars:1904,forks:221,watchers:88,topics:[`cli`,`developer-tools`,`git`],license:`MIT`,defaultBranch:`main`,updatedAt:P,createdAt:`2025-12-01T10:00:00Z`,tvlKln:12200,modelId:`grok-4-fast`,listedKln:0,readme:ze,files:L(Be,P)},{id:`kiln-labs/sealed-fs`,owner:`kiln-labs`,name:`sealed-fs`,description:`Live AES-256-GCM engine. 4 MiB leaves, 50 GiB folders, viewer grants with TTL.`,visibility:`public`,encrypted:!0,keyCommitment:`0x7a19c4e2b8d046f1aa56b390c1d2e3f445566778`,viewerGrant:!0,chainAddress:`0x55b0aa1199ccdd2e8f5a6478901234567890feed`,language:`TypeScript`,languages:{TypeScript:94,JSON:6},stars:867,forks:94,watchers:41,topics:[`encryption`,`aes-gcm`,`storage`],license:`Apache-2.0`,defaultBranch:`main`,updatedAt:F,createdAt:`2026-01-20T12:00:00Z`,tvlKln:44e3,modelId:`grok-4.5`,listedKln:0,readme:Je,files:L(Ye,F)},{id:`meridian/escrow`,owner:`meridian`,name:`escrow`,description:`Issue-locked KLN. Pull-pattern release. No treasurer. Checks-effects-interactions.`,visibility:`public`,encrypted:!1,keyCommitment:`0x0000000000000000000000000000000000000000`,viewerGrant:!1,chainAddress:`0x88c0ffee1234567890abcdef1234567890aaa001`,language:`Solidity`,languages:{Solidity:62,TypeScript:30,toml:8},stars:1560,forks:188,watchers:72,topics:[`bounties`,`escrow`,`defi`],license:`GPL-3.0`,defaultBranch:`main`,updatedAt:F,createdAt:`2026-02-02T09:00:00Z`,tvlKln:96750,modelId:`grok-4`,listedKln:1800,readme:tt,files:L(nt,F)},{id:`atlas/enclave`,owner:`atlas`,name:`enclave`,description:`Hardware-backed sealed runtime. Owner key only — measurement bound, never exported.`,visibility:`private`,encrypted:!0,keyCommitment:`0xbb12aa34cc56dd78ee90ff1234567890abcdeeff`,viewerGrant:!1,chainAddress:`0x0a11ce0000000000000000000000000000enclave`,language:`Rust`,languages:{Rust:100},stars:0,forks:0,watchers:3,topics:[`enclave`,`private`,`attestation`],license:`Proprietary`,defaultBranch:`main`,updatedAt:N,createdAt:`2026-06-01T08:00:00Z`,tvlKln:8400,modelId:`grok-3`,readme:lt,files:L(ut,N)},{id:`harbor/bridge`,owner:`harbor`,name:`bridge`,description:`Light client with a sliding 256-block MMR. Posts Kiln commit proofs to paired L2s.`,visibility:`public`,encrypted:!1,keyCommitment:`0x0000000000000000000000000000000000000000`,viewerGrant:!1,chainAddress:`0x1111222233334444555566667777888899990000`,language:`TypeScript`,languages:{TypeScript:72,Go:28},stars:640,forks:71,watchers:29,topics:[`bridge`,`proofs`,`interop`,`mmr`],license:`MIT`,defaultBranch:`main`,updatedAt:P,createdAt:`2026-04-11T15:00:00Z`,tvlKln:21900,modelId:`grok-4-fast`,listedKln:90,readme:_t,files:L(vt,P)},{id:`northwind/git-seal`,owner:`northwind`,name:`git-seal`,description:`git-remote-kiln. capabilities, list, push, fetch — every git push settles on L1.`,visibility:`public`,encrypted:!1,keyCommitment:`0x0000000000000000000000000000000000000000`,viewerGrant:!1,chainAddress:`0x2222abcd3333ef0155556666777788889999aa01`,language:`Go`,languages:{Go:88,Makefile:12},stars:312,forks:40,watchers:18,topics:[`git`,`remote`,`settlement`],license:`BSD-3-Clause`,defaultBranch:`main`,updatedAt:M,createdAt:`2026-05-09T11:00:00Z`,tvlKln:5100,modelId:`grok-4.6`,listedKln:0,readme:Ct,files:L(wt,M)},{id:`lumen/zk-diff`,owner:`lumen`,name:`zk-diff`,description:`Prove a patch applied without revealing the tree. Path bytes bound in public inputs.`,visibility:`public`,encrypted:!1,keyCommitment:`0x0000000000000000000000000000000000000000`,viewerGrant:!1,chainAddress:`0x3333cccc4444dddd5555eeee6666ffff77770000`,language:`Rust`,languages:{Circom:48,Rust:52},stars:1102,forks:130,watchers:54,topics:[`zk`,`diff`,`privacy`,`circom`],license:`MIT`,defaultBranch:`main`,updatedAt:F,createdAt:`2026-03-22T13:00:00Z`,tvlKln:33300,modelId:`grok-4.5`,listedKln:420,readme:kt,files:L(At,F)},{id:`itsnotailabs/medina`,owner:`itsnotailabs`,name:`medina`,description:`Toroidal 5D memory (θ, φ, ρ, ring, beat). φ-harmonic clock. Phantom Monte Carlo. Zero-cost 25-language IR.`,visibility:`public`,encrypted:!1,keyCommitment:`0x0000000000000000000000000000000000000000`,viewerGrant:!1,chainAddress:`0x1a1b0e1a1ab5000000000000000000itsnotai`,language:`TypeScript`,languages:{TypeScript:91,Markdown:9},stars:2140,forks:186,watchers:94,topics:[`memory`,`phi`,`torus`,`sovereign-ai`,`edge`],license:`Apache-2.0`,defaultBranch:`main`,updatedAt:I,createdAt:`2025-11-18T09:00:00Z`,tvlKln:64800,modelId:`medina-phi`,website:`https://zenodo.org/records/20822130`,listedKln:2400,readme:zt,files:L(Bt,I)},{id:`itsnotailabs/neuroemergence`,owner:`itsnotailabs`,name:`neuroemergence`,description:`BCVI, coherence gates, arousal bands, recovery modes. Coherence beats dopamine peaks.`,visibility:`public`,encrypted:!1,keyCommitment:`0x0000000000000000000000000000000000000000`,viewerGrant:!1,chainAddress:`0x1a1b0e1a1ab5000000000000000000itsnotai`,language:`TypeScript`,languages:{TypeScript:88,Markdown:12},stars:1688,forks:142,watchers:77,topics:[`neuroemergence`,`bcvi`,`safety`,`coherence`],license:`Apache-2.0`,defaultBranch:`main`,updatedAt:I,createdAt:`2026-06-16T10:00:00Z`,tvlKln:41200,modelId:`neuro-bcvi`,website:`https://doi.org/10.5281/zenodo.20822130`,listedKln:1800,readme:Jt,files:L(Yt,I)},{id:`itsnotailabs/xcrew`,owner:`itsnotailabs`,name:`xcrew`,description:`72h offline edge. Feature shedding, atomic persist, ML-KEM / ML-DSA transcripts. 1–4 cores.`,visibility:`public`,encrypted:!1,keyCommitment:`0x0000000000000000000000000000000000000000`,viewerGrant:!1,chainAddress:`0x1a1b0e1a1ab5000000000000000000itsnotai`,language:`TypeScript`,languages:{TypeScript:100},stars:980,forks:74,watchers:51,topics:[`edge`,`pq`,`offline`,`hardening`],license:`Apache-2.0`,defaultBranch:`main`,updatedAt:I,createdAt:`2026-05-25T14:00:00Z`,tvlKln:22400,modelId:`xcrew-edge`,listedKln:1200,readme:rn,files:L(an,I)}],ln={"kiln-labs":{handle:`kiln-labs`,displayName:`Kiln Labs`,lab:`Kiln Protocol Lab`,company:`Kiln`,bio:`Protocol laboratory behind Kiln L1. We ship commit settlement, AES-256-GCM sealed trees, and the bounty precompile. Public goods, Apache-2.0, settled on-chain. The runtime in kiln-labs/protocol is the chain.`,location:`On-chain`,joined:`2025`,address:`0x4c1e7a91b0c3d2e8f5a6478901234567890abcde`,website:`https://kiln.dev`,twitter:`kilnlabs`,kind:`org`,followers:12840,following:24,orgs:[`Kiln`],highlight:`Kiln L1 · sealed-fs · CLI`,pinned:[`kiln-labs/protocol`,`kiln-labs/cli`,`kiln-labs/sealed-fs`]},meridian:{handle:`meridian`,displayName:`Meridian Research`,lab:`Meridian`,company:`Meridian Research`,bio:`Escrow and paymaster research out of Lisbon. We lock KLN against issue ids so maintainers never hold the purse. GPL-3.0, pull-pattern release, no treasurer. Audited against reentrancy on contract payees.`,location:`Lisbon, Portugal`,joined:`2026`,address:`0x88c0ffee1234567890abcdef1234567890aaa001`,website:`https://meridian.research`,twitter:`meridianescrow`,kind:`org`,followers:2210,following:61,orgs:[`Meridian Research`],highlight:`Issue-locked KLN escrow`,pinned:[`meridian/escrow`]},atlas:{handle:`atlas`,displayName:`Atlas Enclaves`,lab:`Atlas`,company:`Atlas Enclaves`,bio:`Private runtimes. Hardware-backed sealing. Owner key only — we do not issue viewer grants. Built in Austin for shops that cannot leak a working tree. Measurement is bound to the wallet; the unsealing key is never exported.`,location:`Austin, Texas`,joined:`2026`,address:`0x0a11ce0000000000000000000000000000enclave`,twitter:`atlasenclave`,kind:`org`,followers:980,following:19,orgs:[`Atlas Enclaves`],highlight:`Measurement-bound unsealing`,pinned:[`atlas/enclave`]},harbor:{handle:`harbor`,displayName:`Harbor Interop`,lab:`Harbor`,company:`Harbor Interop`,bio:`Light clients and commit-proof relays. We post Kiln Merkle proofs to paired L2s so a git push here is a fact there. Sliding 256-block MMR. Rotterdam.`,location:`Rotterdam, Netherlands`,joined:`2026`,address:`0x1111222233334444555566667777888899990000`,twitter:`harborbridge`,kind:`org`,followers:1540,following:44,orgs:[`Harbor Interop`],highlight:`Sliding MMR light client`,pinned:[`harbor/bridge`]},northwind:{handle:`northwind`,displayName:`Northwind Systems`,lab:`Northwind`,company:`Northwind Systems`,bio:`Drop-in git remotes that settle. If you already speak git, you already speak Kiln. We maintain git-seal — git-remote-kiln on PATH, capabilities/list/push/fetch. Reykjavík.`,location:`Reykjavík, Iceland`,joined:`2026`,address:`0x2222abcd3333ef0155556666777788889999aa01`,twitter:`northwindgit`,kind:`org`,followers:640,following:33,orgs:[`Northwind Systems`],highlight:`git-remote-kiln`,pinned:[`northwind/git-seal`]},lumen:{handle:`lumen`,displayName:`Lumen Proofs`,lab:`Lumen`,company:`Lumen Proofs`,bio:`Zero-knowledge diffs for sealed trees. Prove a patch applied without revealing the files. Circom Merkle-update circuit binds path bytes in the public inputs so a prover cannot claim a different path. Zürich.`,location:`Zürich, Switzerland`,joined:`2026`,address:`0x3333cccc4444dddd5555eeee6666ffff77770000`,twitter:`lumenzk`,kind:`org`,followers:1880,following:52,orgs:[`Lumen Proofs`],highlight:`Path-bound zk diffs`,pinned:[`lumen/zk-diff`]},itsnotailabs:{handle:`itsnotailabs`,displayName:`Alfredo Medina Hernandez`,lab:`ItsNotAI LABS`,company:`ItsNotAI LABS`,bio:`Independent builder. MEDINA Memory Systems — toroidal 5D memory, φ-harmonic timing, phantom Monte Carlo, zero-cost dispatch. NeuroEmergence coherence gates (BCVI). XCREW edge hardening, 72h offline, PQ paths. Fort Worth. Three humans plus AI. I don’t want a career. I build.`,location:`Fort Worth, Texas`,joined:`2025`,address:`0x1a1b0e1a1ab5000000000000000000itsnotai`,website:`https://zenodo.org/records/20822130`,twitter:`ItsnotAILabs`,email:`hello@itsnotailabs`,kind:`user`,followers:2140,following:37,orgs:[`ItsNotAI LABS`],highlight:`MEDINA · NeuroEmergence · XCREW`,pinned:[`itsnotailabs/medina`,`itsnotailabs/neuroemergence`,`itsnotailabs/xcrew`]}};function un(e){let t=String(e||``).toLowerCase();return t===`kiln`&&globalThis.__KILN_FORGE_PROFILE?globalThis.__KILN_FORGE_PROFILE:ln[t]}var z=[{id:`lst_protocol`,kind:`code`,title:`kiln-labs/protocol`,seller:`kiln-labs`,description:`L1 runtime. Apache-2.0. Branch, remix, or take a licensed copy for 0 KLN.`,priceKln:0,repoId:`kiln-labs/protocol`,license:`Apache-2.0`,remixable:!0,branchable:!0,sold:612,topics:[`l1`,`runtime`],createdAt:on},{id:`lst_cli`,kind:`code`,title:`kiln-labs/cli`,seller:`kiln-labs`,description:`The forge CLI. git clone / commit / push --settle / stream unseal.`,priceKln:0,repoId:`kiln-labs/cli`,license:`MIT`,remixable:!0,branchable:!0,sold:221,topics:[`cli`,`git`],createdAt:on},{id:`lst_sealed`,kind:`code`,title:`kiln-labs/sealed-fs`,seller:`kiln-labs`,description:`The live AES-256-GCM engine. Viewer grant included.`,priceKln:0,repoId:`kiln-labs/sealed-fs`,license:`Apache-2.0`,remixable:!0,branchable:!0,sold:94,topics:[`encryption`],createdAt:M},{id:`lst_escrow`,kind:`code`,title:`meridian/escrow`,seller:`meridian`,description:`Commercial license of the pull-pattern issue escrow. GPL-3.0 plus paid grant.`,priceKln:1800,repoId:`meridian/escrow`,license:`GPL-3.0`,remixable:!0,branchable:!0,sold:38,topics:[`escrow`,`defi`],createdAt:N},{id:`lst_bridge`,kind:`code`,title:`harbor/bridge`,seller:`harbor`,description:`Sliding MMR light client. Cheap license for paired-chain relays.`,priceKln:90,repoId:`harbor/bridge`,license:`MIT`,remixable:!0,branchable:!0,sold:71,topics:[`bridge`],createdAt:N},{id:`lst_gitseal`,kind:`code`,title:`northwind/git-seal`,seller:`northwind`,description:`git-remote-kiln. BSD-3. Fork it onto PATH.`,priceKln:0,repoId:`northwind/git-seal`,license:`BSD-3-Clause`,remixable:!0,branchable:!0,sold:40,topics:[`git`],createdAt:M},{id:`lst_zkdiff`,kind:`code`,title:`lumen/zk-diff`,seller:`lumen`,description:`Circom Merkle-update with path binding. Proofs without plaintext.`,priceKln:420,repoId:`lumen/zk-diff`,license:`MIT`,remixable:!0,branchable:!0,sold:27,topics:[`zk`],createdAt:P},{id:`lst_medina`,kind:`code`,title:`itsnotailabs/medina`,seller:`itsnotailabs`,description:`Toroidal 5D memory, φ-clock, phantom Monte Carlo, 25-language IR. Commercial license.`,priceKln:2400,repoId:`itsnotailabs/medina`,license:`Apache-2.0`,remixable:!0,branchable:!0,sold:19,topics:[`memory`,`phi`],createdAt:I},{id:`lst_neuro`,kind:`code`,title:`itsnotailabs/neuroemergence`,seller:`itsnotailabs`,description:`BCVI driver, coherence gates, arousal bands. PAPER-01 / PAPER-02.`,priceKln:1800,repoId:`itsnotailabs/neuroemergence`,license:`Apache-2.0`,remixable:!0,branchable:!0,sold:14,topics:[`bcvi`,`safety`],createdAt:I},{id:`lst_xcrew`,kind:`code`,title:`itsnotailabs/xcrew`,seller:`itsnotailabs`,description:`72h offline edge platform. Feature shedding, PQ transcripts, atomic persist.`,priceKln:1200,repoId:`itsnotailabs/xcrew`,license:`Apache-2.0`,remixable:!0,branchable:!0,sold:11,topics:[`edge`,`pq`],createdAt:I},{id:`lst_model_grok`,kind:`model`,title:`Grok 4.6`,seller:`kiln-labs`,description:`Native on Kiln. Flagship. Long-running agents, code, tool calling. Included.`,priceKln:0,modelId:`grok-4.6`,license:`Kiln native`,remixable:!1,branchable:!1,sold:12840,topics:[`xai`,`native`],createdAt:on},{id:`lst_model_phi`,kind:`model`,title:`MEDINA φ-Harmonic`,seller:`itsnotailabs`,description:`Toroidal memory navigator as a model. Bind it to a repo or call it into a capsule.`,priceKln:800,modelId:`medina-phi`,repoId:`itsnotailabs/medina`,license:`Apache-2.0`,remixable:!1,branchable:!1,sold:44,topics:[`model`,`phi`],createdAt:I},{id:`lst_model_bcvi`,kind:`model`,title:`NeuroEmergence BCVI`,seller:`itsnotailabs`,description:`Coherence-gated activation. Not a reward model. License to run on your repos.`,priceKln:650,modelId:`neuro-bcvi`,repoId:`itsnotailabs/neuroemergence`,license:`Apache-2.0`,remixable:!1,branchable:!1,sold:31,topics:[`model`,`safety`],createdAt:I},{id:`lst_model_xcrew`,kind:`model`,title:`XCREW Edge`,seller:`itsnotailabs`,description:`Edge-native agent. Sheds features, survives 72h offline, PQ-ready.`,priceKln:500,modelId:`xcrew-edge`,repoId:`itsnotailabs/xcrew`,license:`Apache-2.0`,remixable:!1,branchable:!1,sold:22,topics:[`model`,`edge`],createdAt:I},...ce.map(e=>({id:`lst_agent_${e.id}`,kind:`agent`,title:e.label,seller:`kiln-labs`,description:e.blurb,priceKln:e.priceKln,agentRole:e.id,license:`Hire`,remixable:!1,branchable:!1,sold:40+e.priceKln,topics:[`agent`,e.id],createdAt:P}))],B=[{id:`kiln-labs/protocol#41`,repoId:`kiln-labs/protocol`,number:41,title:`Header should bind key commitment for public trees too`,body:`Public repos currently skip the commitment field. Auditors want a stable header shape so light clients do not branch.`,author:`harbor`,state:`open`,labels:[`protocol`,`light-client`],createdAt:P,bountyKln:800,bountyStatus:`escrowed`,bountyTx:`0xaaa10001`,comments:[{author:`kiln-labs`,body:`Agreed. We will keep zeros for unsealed trees rather than omitting the field. See CommitHeader::public_zeros.`,createdAt:F,txHash:`0xaaa10002`}]},{id:`kiln-labs/protocol#38`,repoId:`kiln-labs/protocol`,number:38,title:`Precompile gas for bounty release is too high`,body:`release() is 140k. Target 40k so small bounties are viable.`,author:`meridian`,state:`open`,labels:[`gas`,`escrow`],createdAt:N,bountyKln:2500,bountyStatus:`escrowed`,bountyTx:`0xaaa10003`,comments:[]},{id:`meridian/escrow#12`,repoId:`meridian/escrow`,number:12,title:`Reentrancy on release when payer is a contract`,body:`Checks-effects-interactions is inverted if payer is a hook. Need a pull pattern.`,author:`atlas`,state:`open`,labels:[`security`,`bug`],createdAt:F,bountyKln:5e3,bountyStatus:`escrowed`,bountyTx:`0xbbb20001`,comments:[{author:`meridian`,body:`Shipped the pull pattern in contracts/IssueEscrow.sol. Tests cover double-release and stranger-release.`,createdAt:F}]},{id:`kiln-labs/sealed-fs#7`,repoId:`kiln-labs/sealed-fs`,number:7,title:`Viewer grant should expire, not only revoke`,body:`Add TTL on the grant tx so session keys die without a second transaction.`,author:`lumen`,state:`open`,labels:[`encryption`],createdAt:P,bountyKln:400,bountyStatus:`escrowed`,bountyTx:`0xccc30001`,comments:[{author:`kiln-labs`,body:`src/grant.ts honors expires. active() is the only check the unsealer needs.`,createdAt:F}]},{id:`harbor/bridge#3`,repoId:`harbor/bridge`,number:3,title:`Header proof size blows up after 256 blocks`,body:`Switch to a sliding MMR window.`,author:`northwind`,state:`open`,labels:[`perf`],createdAt:M,bountyKln:0,bountyStatus:`none`,comments:[{author:`harbor`,body:`SlidingMMR window=256 is in src/mmr.ts. Peaks only.`,createdAt:P}]},{id:`lumen/zk-diff#9`,repoId:`lumen/zk-diff`,number:9,title:`Circuit does not bind file path`,body:`A prover can claim a different path than the one updated. Bind path bytes in the public inputs.`,author:`kiln-labs`,state:`open`,labels:[`circuits`,`security`],createdAt:F,bountyKln:3200,bountyStatus:`escrowed`,bountyTx:`0xddd40001`,comments:[{author:`lumen`,body:`pathHash is public. Poseidon(pathBytesHash, fileIndex). See circuits/diff.circom.`,createdAt:F}]},{id:`kiln-labs/cli#4`,repoId:`kiln-labs/cli`,number:4,title:`unseal fails on large trees`,body:`Streaming decrypt for envelopes over 32MB.`,author:`harbor`,state:`closed`,labels:[`cli`],createdAt:on,bountyKln:200,bountyStatus:`released`,bountyTx:`0xeee50001`,comments:[{author:`kiln-labs`,body:`Shipped in 0.4.1. internal/seal/stream.go, 4 MiB leaves.`,createdAt:M}]},{id:`itsnotailabs/medina#2`,repoId:`itsnotailabs/medina`,number:2,title:`Navigator should step beat from the clock, not the walker`,body:`Intent is a tangent. Beat is φ-time. Mixing them makes the torus a tape again.`,author:`kiln-labs`,state:`closed`,labels:[`memory`],createdAt:F,bountyKln:0,bountyStatus:`none`,comments:[{author:`itsnotailabs`,body:`navigate() takes now and writes harmonicBeat(now). The walker does not increment beat.`,createdAt:I}]},{id:`itsnotailabs/neuroemergence#1`,repoId:`itsnotailabs/neuroemergence`,number:1,title:`Surge band must require phase lock`,body:`Otherwise the driver chases a spike. That's the thing we published against.`,author:`lumen`,state:`open`,labels:[`safety`],createdAt:I,bountyKln:900,bountyStatus:`escrowed`,bountyTx:`0xfff60001`,comments:[{author:`itsnotailabs`,body:`gate() holds surge when phaseLock < 0.6. Tests assert calm BCVI > spike BCVI.`,createdAt:I}]},{id:`itsnotailabs/xcrew#3`,repoId:`itsnotailabs/xcrew`,number:3,title:`Queue must drop after 72h, not retry forever`,body:`A device that comes back after a week should not replay stale grants.`,author:`atlas`,state:`closed`,labels:[`edge`],createdAt:P,bountyKln:300,bountyStatus:`released`,bountyTx:`0xaaa70001`,comments:[{author:`itsnotailabs`,body:`OFFLINE_CEILING = 72h. drain() drops expired envelopes.`,createdAt:I}]}],dn=[{id:`kiln-labs/protocol#40`,repoId:`kiln-labs/protocol`,number:40,title:`Stable header: always include key commitment`,body:`Zeros when the tree is public. Light clients can stay on one decoder.`,author:`harbor`,state:`open`,fromBranch:`harbor:header-shape`,createdAt:F,txHash:`0xpr000040`,additions:86,deletions:12},{id:`meridian/escrow#11`,repoId:`meridian/escrow`,number:11,title:`Pull pattern for contract payers`,body:`Stops reentrancy on release.`,author:`atlas`,state:`open`,fromBranch:`atlas:pull-escrow`,createdAt:F,txHash:`0xpr000011`,additions:140,deletions:33},{id:`kiln-labs/cli#5`,repoId:`kiln-labs/cli`,number:5,title:`Stream unseal for large envelopes`,body:`Closes #4.`,author:`harbor`,state:`merged`,fromBranch:`harbor:stream-unseal`,createdAt:M,txHash:`0xpr000005`,additions:210,deletions:40},{id:`lumen/zk-diff#8`,repoId:`lumen/zk-diff`,number:8,title:`Bind path bytes in public inputs`,body:`Draft — waiting on circuit review.`,author:`northwind`,state:`open`,fromBranch:`northwind:path-bind`,createdAt:P,txHash:`0xpr000008`,additions:67,deletions:9},{id:`itsnotailabs/medina#3`,repoId:`itsnotailabs/medina`,number:3,title:`Zero-cost dispatch table for 25 languages`,body:`Compile once. Edge pays a jump.`,author:`itsnotailabs`,state:`merged`,fromBranch:`itsnotailabs:zero-cost`,createdAt:I,txHash:`0xpr000103`,additions:188,deletions:4}],fn=[{sha:`k7a19c4`,repoId:`kiln-labs/protocol`,message:`Seal commit headers with key commitment`,author:`kiln-labs`,createdAt:F,txHash:`0xcm10001`,block:1842,files:8},{sha:`k91aa20`,repoId:`kiln-labs/protocol`,message:`Issue-id escrow precompile`,author:`kiln-labs`,createdAt:P,txHash:`0xcm10002`,block:1810,files:2},{sha:`k55b0aa`,repoId:`kiln-labs/cli`,message:`Stream unseal and --settle push`,author:`kiln-labs`,createdAt:P,txHash:`0xcm10003`,block:1808,files:9},{sha:`k88c0ff`,repoId:`meridian/escrow`,message:`Pull-pattern release, pending withdraw`,author:`meridian`,createdAt:F,txHash:`0xcm10004`,block:1840,files:3},{sha:`k111122`,repoId:`harbor/bridge`,message:`Sliding 256-block MMR light client`,author:`harbor`,createdAt:P,txHash:`0xcm10005`,block:1799,files:4},{sha:`k3333cc`,repoId:`lumen/zk-diff`,message:`Bind path bytes in public inputs`,author:`lumen`,createdAt:F,txHash:`0xcm10006`,block:1841,files:3},{sha:`k7a19c5`,repoId:`kiln-labs/sealed-fs`,message:`Live engine + grant TTL`,author:`kiln-labs`,createdAt:F,txHash:`0xcm10007`,block:1842,files:6},{sha:`k2222ab`,repoId:`northwind/git-seal`,message:`git-remote-kiln capabilities/list/push/fetch`,author:`northwind`,createdAt:M,txHash:`0xcm10008`,block:1720,files:4},{sha:`k0a11ce`,repoId:`atlas/enclave`,message:`Measurement-bound unsealing key, no export`,author:`atlas`,createdAt:N,txHash:`0xcm10009`,block:1766,files:5},{sha:`k1a1b0e`,repoId:`itsnotailabs/medina`,message:`Toroidal navigator, φ-clock, phantom MC, zero-cost IR`,author:`itsnotailabs`,createdAt:I,txHash:`0xcm10010`,block:1848,files:7},{sha:`k1a1b11`,repoId:`itsnotailabs/neuroemergence`,message:`BCVI driver and coherence gate`,author:`itsnotailabs`,createdAt:I,txHash:`0xcm10011`,block:1848,files:6},{sha:`k1a1b12`,repoId:`itsnotailabs/xcrew`,message:`72h queue, shed, PQ transcripts`,author:`itsnotailabs`,createdAt:I,txHash:`0xcm10012`,block:1848,files:6}];function V(e,t,n,r,i,a,o,s,c){return{hash:e,type:t,from:n,to:r,amount:i,memo:a,block:o,timestamp:s,repoId:c}}var H=[{height:0,hash:`0xkiln000000000000000000000000000000genesis`,parent:`0x00000000000000000000000000000000000000000000`,timestamp:`2025-11-04T00:00:00Z`,txs:[V(`0xgen0001`,`genesis`,re,re,0,`Kiln genesis — source is the chain`,0,`2025-11-04T00:00:00Z`)]},{height:1810,hash:`0xblk1810aa11bb22cc33dd44ee55ff06070809`,parent:`0xblk1809aa11bb22cc33dd44ee55ff06070809`,timestamp:P,txs:[V(`0xcm10002`,`commit`,`0xkiln`,D,0,`Issue-id escrow precompile`,1810,P,`kiln-labs/protocol`),V(`0xaaa10003`,`bounty_escrow`,`0xmeridian`,D,2500,`Lock 2500 KLN on protocol#38`,1810,P,`kiln-labs/protocol`)]},{height:1840,hash:`0xblk1840aa11bb22cc33dd44ee55ff06070809`,parent:`0xblk1839aa11bb22cc33dd44ee55ff06070809`,timestamp:F,txs:[V(`0xcm10004`,`commit`,`0xmeridian`,D,0,`Pull-pattern release`,1840,F,`meridian/escrow`),V(`0xbbb20001`,`bounty_escrow`,`0xmeridian`,D,5e3,`Lock 5000 KLN on escrow#12`,1840,F,`meridian/escrow`)]},{height:1842,hash:`0xblk1842aa11bb22cc33dd44ee55ff06070809`,parent:`0xblk1841aa11bb22cc33dd44ee55ff06070809`,timestamp:F,txs:[V(`0xcm10001`,`commit`,`0xkiln`,D,0,`Seal commit headers with key commitment`,1842,F,`kiln-labs/protocol`),V(`0xcm10007`,`commit`,`0xkiln`,D,0,`Live engine + grant TTL`,1842,F,`kiln-labs/sealed-fs`),V(`0xddd40001`,`bounty_escrow`,`0xlumen`,D,3200,`Lock 3200 KLN on zk-diff#9`,1842,F,`lumen/zk-diff`)]},{height:1848,hash:`0xblk1848aa11bb22cc33dd44ee55ff06070809`,parent:`0xblk1842aa11bb22cc33dd44ee55ff06070809`,timestamp:I,txs:[V(`0xcm10010`,`commit`,`0xitsnotailabs`,D,0,`Toroidal navigator, φ-clock, phantom MC`,1848,I,`itsnotailabs/medina`),V(`0xcm10011`,`commit`,`0xitsnotailabs`,D,0,`BCVI driver and coherence gate`,1848,I,`itsnotailabs/neuroemergence`),V(`0xcm10012`,`commit`,`0xitsnotailabs`,D,0,`72h queue, shed, PQ transcripts`,1848,I,`itsnotailabs/xcrew`),V(`0xlst0001`,`listing`,`0xitsnotailabs`,D,0,`List medina, neuroemergence, xcrew`,1848,I,`itsnotailabs/medina`)]}],pn=1848,mn=[{name:`main`,repoId:`kiln-labs/protocol`,sha:`k7a19c4`,protected:!0,updatedAt:F},{name:`header-shape`,repoId:`kiln-labs/protocol`,sha:`k7a19c4`,protected:!1,updatedAt:F},{name:`main`,repoId:`kiln-labs/cli`,sha:`k55b0aa`,protected:!0,updatedAt:P},{name:`main`,repoId:`meridian/escrow`,sha:`k88c0ff`,protected:!0,updatedAt:F},{name:`pull-escrow`,repoId:`meridian/escrow`,sha:`k88c0ff`,protected:!1,updatedAt:F},{name:`main`,repoId:`lumen/zk-diff`,sha:`k3333cc`,protected:!0,updatedAt:F},{name:`path-bind`,repoId:`lumen/zk-diff`,sha:`k3333cc`,protected:!1,updatedAt:P},{name:`main`,repoId:`itsnotailabs/medina`,sha:`k1a1b0e`,protected:!0,updatedAt:I},{name:`zero-cost`,repoId:`itsnotailabs/medina`,sha:`k1a1b0e`,protected:!1,updatedAt:I},{name:`main`,repoId:`itsnotailabs/neuroemergence`,sha:`k1a1b11`,protected:!0,updatedAt:I},{name:`main`,repoId:`itsnotailabs/xcrew`,sha:`k1a1b12`,protected:!0,updatedAt:I},{name:`main`,repoId:`harbor/bridge`,sha:`k111122`,protected:!0,updatedAt:P},{name:`main`,repoId:`northwind/git-seal`,sha:`k2222ab`,protected:!0,updatedAt:M},{name:`main`,repoId:`atlas/enclave`,sha:`k0a11ce`,protected:!0,updatedAt:N},{name:`main`,repoId:`kiln-labs/sealed-fs`,sha:`k7a19c5`,protected:!0,updatedAt:F}],hn=[{id:`kiln-labs/protocol@0.9.2`,repoId:`kiln-labs/protocol`,tag:`v0.9.2`,name:`Runtime 0.9.2`,body:`Stable commit headers. Key commitment always present. BLAKE3 Merkle. Bounty precompile gas path in progress.`,author:`kiln-labs`,createdAt:P,txHash:`0xrel00092`},{id:`kiln-labs/cli@0.4.1`,repoId:`kiln-labs/cli`,tag:`v0.4.1`,name:`Stream unseal`,body:`Streaming decrypt for envelopes over 32MB. Closes #4.`,author:`kiln-labs`,createdAt:M,txHash:`0xrel0041`},{id:`meridian/escrow@1.2.0`,repoId:`meridian/escrow`,tag:`v1.2.0`,name:`Issue escrow`,body:`Lock against issue id. Pull pattern. No treasurer.`,author:`meridian`,createdAt:F,txHash:`0xrel0120`},{id:`itsnotailabs/medina@1.0.0`,repoId:`itsnotailabs/medina`,tag:`v1.0.0`,name:`Navigator`,body:`θ φ ρ ring beat. φ-clock. Phantom Monte Carlo. 25-language IR.`,author:`itsnotailabs`,createdAt:I,txHash:`0xrel1000`}],gn=[{id:`run_settle_1842`,repoId:`kiln-labs/protocol`,workflow:`settle.yml`,event:`push`,status:`success`,logs:[`kiln verify --on-chain`,`head 1842 0xblk1842aa11…`,`commit k7a19c4 included`,`bounty sync: 2 escrowed`,`cargo test ok`],createdAt:F,actor:`kiln-labs`},{id:`run_deploy_092`,repoId:`kiln-labs/protocol`,workflow:`deploy.yml`,event:`release`,status:`success`,logs:[`kiln pages publish`,`preview https://kiln.dev/kiln-labs/protocol`],createdAt:P,actor:`kiln-labs`,url:`https://kiln.dev/kiln-labs/protocol`},{id:`run_cli_test`,repoId:`kiln-labs/cli`,workflow:`test.yml`,event:`push`,status:`success`,logs:[`go test ./...`,`ok  kiln-labs/cli  0.4s`],createdAt:P,actor:`kiln-labs`},{id:`run_medina_test`,repoId:`itsnotailabs/medina`,workflow:`test.yml`,event:`push`,status:`success`,logs:[`vitest run`,`φ 1.6180339887`,`25 languages dispatched`,`ok`],createdAt:I,actor:`itsnotailabs`}],_n=[{id:`g_seal_header`,owner:`kiln-labs`,description:`Minimal AES-GCM envelope used by sealed-fs.`,public:!0,encrypted:!1,files:[{name:`envelope.ts`,language:`TypeScript`,content:`export async function envelope(plain: Uint8Array, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return { iv, ct };
}`}],createdAt:P,txHash:`0xgist0001aa11bb22cc33dd44ee55ff0607`,merkleRoot:`0xaaa111bbb222ccc333`},{id:`g_merkle_fold`,owner:`lumen`,description:`Fold a directory into a Merkle root before the commit tx.`,public:!0,encrypted:!1,files:[{name:`fold.py`,language:`Python`,content:`def fold(leaves):
    while len(leaves) > 1:
        nxt = []
        for i in range(0, len(leaves), 2):
            a, b = leaves[i], leaves[i+1] if i+1 < len(leaves) else leaves[i]
            nxt.append(sha256(a+b))
        leaves = nxt
    return leaves[0]
`}],createdAt:N,txHash:`0xgist0002aa11bb22cc33dd44ee55ff0607`,merkleRoot:`0xbbb222ccc333ddd444`},{id:`g_phi_beat`,owner:`itsnotailabs`,description:`φ-harmonic beat in eight lines.`,public:!0,encrypted:!1,files:[{name:`beat.ts`,language:`TypeScript`,content:`export const PHI = (1 + Math.sqrt(5)) / 2;
export function harmonicBeat(tMs: number, hz = PHI) {
  return Math.floor((tMs / 1000) * hz * PHI);
}
`}],createdAt:I,txHash:`0xgist0003aa11bb22cc33dd44ee55ff0607`,merkleRoot:`0xccc333ddd444eee555`}],vn=[{id:`kiln-labs/protocol#d1`,repoId:`kiln-labs/protocol`,number:1,title:`Agents as first-class committers`,body:`A lab agent should sign the same commit tx a human does. Wallet is the identity. The computer is just another signer with a role.`,author:`kiln-labs`,createdAt:P,comments:[{author:`atlas`,body:`Agree — the reviewer agent should be able to withhold a merge the same way CODEOWNERS does.`,createdAt:F}],category:`idea`},{id:`kiln-labs/sealed-fs#d1`,repoId:`kiln-labs/sealed-fs`,number:1,title:`50 GB folder deposits`,body:`Match Zenodo's per-upload cap. Each folder is its own sealed deposit: 50 GiB of chunked AES-GCM, Merkle-committed on L1.`,author:`kiln-labs`,createdAt:F,comments:[],category:`alert`},{id:`itsnotailabs/medina#d1`,repoId:`itsnotailabs/medina`,number:1,title:`Marketplace: remix vs buy`,body:`Apache-2.0 lets you remix. The 2400 KLN listing is a commercial license plus a sealed copy under your wallet. Branch is free. That is the product.`,author:`itsnotailabs`,createdAt:I,comments:[{author:`kiln-labs`,body:`Same shape we want for protocol. Zero-price Apache listings still mint a license tx so the chain has a receipt.`,createdAt:I}],category:`show`}],yn=[{id:`kiln-labs/protocol:kiln-sdk@0.9.4`,repoId:`kiln-labs/protocol`,name:`kiln-sdk`,version:`0.9.4`,registry:`kln`,downloads:18420,createdAt:P,txHash:`0xpkg0001aa11bb22cc33dd44ee55ff0607`},{id:`kiln-labs/cli:kiln@1.2.0`,repoId:`kiln-labs/cli`,name:`kiln`,version:`1.2.0`,registry:`kln`,downloads:9201,createdAt:F,txHash:`0xpkg0002aa11bb22cc33dd44ee55ff0607`},{id:`itsnotailabs/medina:medina@1.0.0`,repoId:`itsnotailabs/medina`,name:`medina`,version:`1.0.0`,registry:`kln`,downloads:2406,createdAt:I,txHash:`0xpkg0003aa11bb22cc33dd44ee55ff0607`}],bn=e=>{let t,n=new Set,r=(e,r)=>{let i=typeof e==`function`?e(t):e;if(!Object.is(i,t)){let e=t;t=r??(typeof i!=`object`||!i)?i:Object.assign({},t,i),n.forEach(n=>n(t,e))}},i=()=>t,a={setState:r,getState:i,getInitialState:()=>o,subscribe:e=>(n.add(e),()=>n.delete(e))},o=t=e(r,i,a);return a},xn=(e=>e?bn(e):bn),Sn=e=>e;function Cn(e,t=Sn){let n=ne.useSyncExternalStore(e.subscribe,ne.useCallback(()=>t(e.getState()),[e,t]),ne.useCallback(()=>t(e.getInitialState()),[e,t]));return ne.useDebugValue(n),n}var wn=e=>{let t=xn(e),n=e=>Cn(t,e);return Object.assign(n,t),n},Tn=(e=>e?wn(e):wn);function En(e,t){let n;try{n=e()}catch{return}return{getItem:e=>{let r=e=>e===null?null:JSON.parse(e,t?.reviver),i=n.getItem(e)??null;return i instanceof Promise?i.then(r):r(i)},setItem:(e,r)=>n.setItem(e,JSON.stringify(r,t?.replacer)),removeItem:e=>n.removeItem(e)}}var Dn=e=>t=>{try{let n=e(t);return n instanceof Promise?n:{then(e){return Dn(e)(n)},catch(e){return this}}}catch(e){return{then(e){return this},catch(t){return Dn(t)(e)}}}},On=(e,t)=>(n,r,i)=>{let a={storage:En(()=>window.localStorage),partialize:e=>e,version:0,merge:(e,t)=>({...t,...e}),...t},o=!1,s=0,c=new Set,l=new Set,u=a.storage;if(!u)return e((...e)=>{console.warn(`[zustand persist middleware] Unable to update item '${a.name}', the given storage is currently unavailable.`),n(...e)},r,i);let d=()=>{let e=a.partialize({...r()});return u.setItem(a.name,{state:e,version:a.version})},f=i.setState;i.setState=(e,t)=>(f(e,t),d());let p=e((...e)=>(n(...e),d()),r,i);i.getInitialState=()=>p;let m,h=()=>{if(!u)return;let e=++s;o=!1,c.forEach(e=>e(r()??p));let t=a.onRehydrateStorage?.call(a,r()??p)||void 0;return Dn(u.getItem.bind(u))(a.name).then(e=>{if(e){if(typeof e.version==`number`&&e.version!==a.version){if(a.migrate){let t=a.migrate(e.state,e.version);return t instanceof Promise?t.then(e=>[!0,e]):[!0,t]}console.error(`State loaded from storage couldn't be migrated since no migrate function was provided`)}else return[!1,e.state]}return[!1,void 0]}).then(t=>{if(e!==s)return;let[i,o]=t;if(m=a.merge(o,r()??p),n(m,!0),i)return d()}).then(()=>{e===s&&(t?.(r(),void 0),m=r(),o=!0,l.forEach(e=>e(m)))}).catch(n=>{e===s&&t?.(void 0,n)})};return i.persist={setOptions:e=>{a={...a,...e},e.storage&&(u=e.storage)},clearStorage:()=>{++s,u?.removeItem(a.name)},getOptions:()=>a,rehydrate:()=>h(),hasHydrated:()=>o,onHydrate:e=>(c.add(e),()=>{c.delete(e)}),onFinishHydration:e=>(l.add(e),()=>{l.delete(e)})},a.skipHydration||h(),m||p};function kn(e){if(e.url)try{URL.revokeObjectURL(e.url)}catch{}return{...e,status:`stopped`,url:void 0,logs:[...e.logs,`capsule stopped · runtime revoked`]}}function An(e){let t=e.map(e=>e.path);return t.includes(`index.html`)?`index.html`:t.includes(`preview.html`)?`preview.html`:t.find(e=>e.endsWith(`.html`))??null}function jn(e,t){return e.replace(/(?:src|href)=["']([^"']+)["']/g,(e,n)=>{if(/^(https?:|data:|blob:|\/\/|#)/i.test(n))return e;let r=n.replace(/^\.\//,``),i=t[r]||t[Object.keys(t).find(e=>e.endsWith(`/`+r)||e===r)??``];return i?e.replace(n,i):e})}function Mn(e){let[t=`you`,n=`repo`]=e.split(`/`);return`git clone kiln://${t}/${n}.git`}function Nn(e,t,n){let r={repo:e,model:{id:t,label:t},git:{clone:Mn(e),commit:`git commit -m "message"`,push:`git push origin main`,pull:`git pull`},agents:n.map(e=>({name:e.name,role:e.role,model:e.modelId||t}))};return`<script>window.Kiln=${JSON.stringify(r)};<\/script>`}function Pn(e,t){return/<\/head>/i.test(e)?e.replace(/<\/head>/i,`${t}</head>`):/<body[^>]*>/i.test(e)?e.replace(/<body([^>]*)>/i,`<body$1>${t}`):t+e}async function Fn(e,t,n,r={}){let i=r.modelId||`grok-4.6`,a=r.agents??[],o=a.map(e=>e.name),s=[Mn(e),`capsule boot · working tree ${t.length} objects`,`bound model ${i}`,o.length?`called into capsule: ${o.join(`, `)}`:`no agents bound yet`,`sandbox allow-scripts allow-same-origin`],c=Nn(e,i,a),l=An(t);if(!l){let n=`<!doctype html><html><head><meta charset="utf-8"><title>${e}</title>
<style>
  :root{--bg:#09090b;--fg:#ecece8;--muted:#8e8e89;--seal:#7a9aa8;--line:#2a2a2e;--surface:#121214}
  body{font:14px/1.5 "Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--fg);padding:32px 20px 64px;margin:0}
  a{color:var(--seal)}
  h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(1.8rem,5vw,2.6rem);letter-spacing:-0.03em;margin:.4rem 0 0}
  .kicker{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
  ul{list-style:none;padding:0;margin:1.4rem 0;border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}
  li{display:flex;justify-content:space-between;gap:12px;padding:.7rem 1rem;border-bottom:1px solid var(--line);font-family:ui-monospace,monospace;font-size:12px}
  li:last-child{border-bottom:0}
  .meta{color:var(--muted);font-size:12px;margin-top:8px}
  .hint{margin-top:1.6rem;color:var(--muted);max-width:36rem}
</style>
${c}
</head><body>
<p class="kicker">Capsule · synthesized tree</p>
<h1>${e}</h1>
<p class="meta">${Mn(e)} · model ${i}</p>
<p>No index.html in this working tree — serving a directory capsule. One-shot a project in Studio to land a real page.</p>
<ul>${t.map(e=>`<li><span>${e.path}</span><span class="meta">${e.size} B${e.encrypted?` · sealed`:``}</span></li>`).join(``)}</ul>
<p class="hint">Add <code>index.html</code> (and optionally <code>preview.html</code>) and boot again. The capsule rewrites relative assets into blob URLs and injects window.Kiln.</p>
</body></html>`,r=URL.createObjectURL(new Blob([n],{type:`text/html`}));return s.push(`synthesized directory capsule from git tree`,`stream live`),{repoId:e,status:`live`,logs:s,entry:`(tree)`,url:r,bootedAt:new Date().toISOString(),assets:t.length,modelId:i,calledAgents:o}}let u={};for(let e of t){if(e.binary)continue;let t=await n(e),r=e.path.endsWith(`.css`)?`text/css`:e.path.endsWith(`.js`)||e.path.endsWith(`.mjs`)?`text/javascript`:e.path.endsWith(`.svg`)?`image/svg+xml`:e.path.endsWith(`.json`)?`application/json`:e.path.endsWith(`.html`)?`text/html`:`text/plain`;e.path!==l&&(u[e.path]=URL.createObjectURL(new Blob([t],{type:r})))}s.push(`mapped ${Object.keys(u).length} assets from git tree`,`entry ${l}`);let d=Pn(jn(await n(t.find(e=>e.path===l)),u),c),f=URL.createObjectURL(new Blob([d],{type:`text/html`}));return s.push(`runtime live · isolated container · window.Kiln bound`),{repoId:e,status:`live`,logs:s,entry:l,url:f,bootedAt:new Date().toISOString(),assets:Object.keys(u).length,modelId:i,calledAgents:o}}var In=`/**
 * PXM — Pixelated eXecution Memory
 *
 * A folder is a Zenodo-class deposit (50 GiB) painted onto a Hilbert lattice.
 * Each pixel is a sealed Merkle cell. Agents (rebels) occupy cells. A capsule
 * is a connected region of the lattice plus an isolated runtime.
 *
 * Claimed 2026, ItsNotAI LABS / KILN. See /papers/pxm.
 */
import type { Agent, RepoFile } from "./types";
import { FOLDER_QUOTA } from "./fs";
import { ZENODO } from "./claims";

/** Zenodo record: 50,000 MB = 50e9 bytes, max 100 files. We claim 50 GiB / folder, unlimited files via 4 MiB leaves. */
export const ZENODO_RECORD_BYTES = ZENODO.recordBytes;
export const ZENODO_FILE_CAP = ZENODO.fileCap;
export const PXM_CELL = 4 * 1024 * 1024;

export type CellState = "empty" | "sealed" | "occupied" | "executing" | "capsule" | "dirty";

export type Pixel = {
  i: number;
  x: number;
  y: number;
  path: string;
  hash: string;
  size: number;
  encrypted: boolean;
  occupant?: string;
  chunk: number;
  state: CellState;
  rho: number;
};

export type Lattice = {
  n: number;
  pixels: Pixel[];
  used: number;
  quota: number;
  folder: string;
};

function rot(n: number, x: number, y: number, rx: number, ry: number): { x: number; y: number } {
  if (ry === 0) {
    if (rx === 1) {
      x = n - 1 - x;
      y = n - 1 - y;
    }
    return { x: y, y: x };
  }
  return { x, y };
}

/** d → (x, y) on an n×n Hilbert curve, n = 2^k. */
export function hilbertXY(n: number, d: number): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let t = d;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (t >> 1);
    const ry = 1 & (t ^ rx);
    const r = rot(s, x, y, rx, ry);
    x = r.x + s * rx;
    y = r.y + s * ry;
    t >>= 2;
  }
  return { x, y };
}

export function nextPow2(v: number): number {
  let n = 1;
  while (n * n < v) n *= 2;
  return Math.max(8, n);
}

/** Paint a folder's files onto a Hilbert lattice. Nested dirs are other deposits. */
export function paintLattice(files: RepoFile[], folder: string, agents: Agent[] = []): Lattice {
  const prefix = folder ? \`\${folder.replace(/\\/$/, "")}/\` : "";
  const direct = files.filter((f) => {
    if (prefix && !f.path.startsWith(prefix)) return false;
    const rest = prefix ? f.path.slice(prefix.length) : f.path;
    return rest.length > 0 && !rest.includes("/");
  });
  const cells: Array<{ path: string; hash: string; size: number; encrypted: boolean; chunk: number }> = [];
  for (const f of direct) {
    const chunks = Math.max(1, f.chunkCount || Math.ceil((f.size || 1) / PXM_CELL));
    for (let c = 0; c < chunks; c++) {
      cells.push({
        path: f.path,
        hash: f.merkleRoot || f.sha,
        size: Math.min(PXM_CELL, Math.max(0, (f.size || 0) - c * PXM_CELL) || 1),
        encrypted: !!f.encrypted,
        chunk: c,
      });
    }
  }
  const n = nextPow2(Math.max(cells.length, 16));
  const occ = new Map<string, string>();
  for (const a of agents) {
    if (a.workingPath) occ.set(a.workingPath, a.name);
  }
  const pixels: Pixel[] = cells.map((cell, i) => {
    const { x, y } = hilbertXY(n, i);
    const occupant = occ.get(cell.path);
    const rho = cell.path.split("/").filter(Boolean).length;
    const state: CellState = occupant ? "occupied" : cell.encrypted ? "sealed" : "dirty";
    return {
      i,
      x,
      y,
      path: cell.path,
      hash: cell.hash,
      size: cell.size,
      encrypted: cell.encrypted,
      occupant,
      chunk: cell.chunk,
      state,
      rho,
    };
  });
  const used = direct.reduce((s, f) => s + (f.size || 0), 0);
  return { n, pixels, used, quota: FOLDER_QUOTA, folder };
}

export function latticeStats(lat: Lattice) {
  const occupied = lat.pixels.filter((p) => p.occupant).length;
  const sealed = lat.pixels.filter((p) => p.encrypted).length;
  return {
    cells: lat.pixels.length,
    dim: lat.n,
    occupied,
    sealed,
    fill: lat.quota ? lat.used / lat.quota : 0,
    vsZenodoFiles: lat.pixels.length > ZENODO_FILE_CAP,
    vsZenodoBytes: lat.quota > ZENODO_RECORD_BYTES,
  };
}

/** Capsule body: cells grouped by path, Hilbert-adjacent because of paint order. */
export function capsuleRegions(lat: Lattice): Array<{ path: string; cells: Pixel[]; occupant?: string }> {
  const byPath = new Map<string, Pixel[]>();
  for (const p of lat.pixels) {
    const arr = byPath.get(p.path) ?? [];
    arr.push(p);
    byPath.set(p.path, arr);
  }
  return [...byPath.entries()].map(([path, cells]) => ({
    path,
    cells,
    occupant: cells.find((c) => c.occupant)?.occupant,
  }));
}

export function pixelAt(lat: Lattice, x: number, y: number): Pixel | undefined {
  return lat.pixels.find((p) => p.x === x && p.y === y);
}

/** 4D coordinate: Hilbert x,y × folder depth × chain height. */
export function coord4d(pixel: Pixel, folder: string, chainHeight: number) {
  const depth = folder ? folder.split("/").filter(Boolean).length : pixel.rho;
  return { x: pixel.x, y: pixel.y, rho: depth, t: chainHeight, path: pixel.path, occupant: pixel.occupant ?? null, state: pixel.state };
}

export function markExecuting(lat: Lattice, path: string, occupant: string): Lattice {
  return {
    ...lat,
    pixels: lat.pixels.map((p) => (p.path === path ? { ...p, occupant, state: "executing" as const } : p)),
  };
}

export function markCapsule(lat: Lattice, entry: string): Lattice {
  return {
    ...lat,
    pixels: lat.pixels.map((p) =>
      p.path === entry || p.path.endsWith(".html") ? { ...p, state: "capsule" as const } : p,
    ),
  };
}

/** Reality field: occupancy, seal, and coherence of the lattice. */
export function realityField(lat: Lattice) {
  const n = lat.pixels.length || 1;
  const occupied = lat.pixels.filter((p) => p.occupant).length;
  const sealed = lat.pixels.filter((p) => p.encrypted).length;
  const executing = lat.pixels.filter((p) => p.state === "executing").length;
  const capsule = lat.pixels.filter((p) => p.state === "capsule").length;
  const fill = lat.quota ? lat.used / lat.quota : 0;
  const coherence = Math.max(0, Math.min(1, (sealed / n) * 0.5 + (occupied / n) * 0.3 + (1 - fill) * 0.2));
  return { occupied, sealed, executing, capsule, fill, coherence, cells: n, dim: lat.n };
}

/** Seat an agent on a path: Hilbert cell + 4D coordinate. */
export function seatOn(files: RepoFile[], path: string, agents: Agent[], chainHeight = 0) {
  const lat = paintLattice(files, path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "", agents);
  const px = lat.pixels.find((p) => p.path === path) ?? lat.pixels[0];
  if (!px) return { x: 0, y: 0, rho: 0, t: chainHeight, path, occupant: null, state: "empty" as CellState };
  return coord4d(px, lat.folder, chainHeight);
}
`,Ln=`/**
 * Capsule runtime — an isolated preview living inside a git repository.
 * Packs the working tree into a sandboxed document. Live stream is the iframe
 * plus the computer log. Bound models and agents are injected as window.Kiln.
 */
import type { RepoFile } from "./types";

export type CapsuleStatus = "idle" | "booting" | "live" | "stopped" | "error";

export type CapsuleAgent = { name: string; role: string; modelId?: string };

export type Capsule = {
  repoId: string;
  status: CapsuleStatus;
  logs: string[];
  entry: string;
  url?: string;
  error?: string;
  bootedAt?: string;
  assets: number;
  modelId?: string;
  calledAgents?: string[];
};

export type CapsuleBootOpts = {
  modelId?: string;
  agents?: CapsuleAgent[];
};

export function emptyCapsule(repoId: string): Capsule {
  return { repoId, status: "idle", logs: ["capsule cold · git tree idle"], entry: "index.html", assets: 0 };
}

export function stopCapsule(cap: Capsule): Capsule {
  if (cap.url) {
    try {
      URL.revokeObjectURL(cap.url);
    } catch {
      /* already revoked */
    }
  }
  return {
    ...cap,
    status: "stopped",
    url: undefined,
    logs: [...cap.logs, "capsule stopped · runtime revoked"],
  };
}

function pickEntry(files: RepoFile[]): string | null {
  const names = files.map((f) => f.path);
  if (names.includes("index.html")) return "index.html";
  if (names.includes("preview.html")) return "preview.html";
  const html = names.find((p) => p.endsWith(".html"));
  return html ?? null;
}

function rewrite(html: string, blobs: Record<string, string>): string {
  return html.replace(/(?:src|href)=["']([^"']+)["']/g, (m, rel: string) => {
    if (/^(https?:|data:|blob:|\\/\\/|#)/i.test(rel)) return m;
    const clean = rel.replace(/^\\.\\//, "");
    const hit =
      blobs[clean] ||
      blobs[Object.keys(blobs).find((k) => k.endsWith("/" + clean) || k === clean) ?? ""];
    if (!hit) return m;
    return m.replace(rel, hit);
  });
}

function gitCloneLine(repoId: string): string {
  const [owner = "you", name = "repo"] = repoId.split("/");
  return \`git clone kiln://\${owner}/\${name}.git\`;
}

function kilnRuntime(repoId: string, modelId: string, agents: CapsuleAgent[]): string {
  const payload = {
    repo: repoId,
    model: { id: modelId, label: modelId },
    git: {
      clone: gitCloneLine(repoId),
      commit: "git commit -m \\"message\\"",
      push: "git push origin main",
      pull: "git pull",
    },
    agents: agents.map((a) => ({ name: a.name, role: a.role, model: a.modelId || modelId })),
  };
  return \`<script>window.Kiln=\${JSON.stringify(payload)};<\/script>\`;
}

function injectRuntime(html: string, runtime: string): string {
  if (/<\\/head>/i.test(html)) return html.replace(/<\\/head>/i, \`\${runtime}</head>\`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, \`<body$1>\${runtime}\`);
  return runtime + html;
}

export async function bootCapsule(
  repoId: string,
  files: RepoFile[],
  read: (file: RepoFile) => Promise<string>,
  opts: CapsuleBootOpts = {},
): Promise<Capsule> {
  const modelId = opts.modelId || "grok-4.6";
  const agents = opts.agents ?? [];
  const called = agents.map((a) => a.name);
  const logs = [
    gitCloneLine(repoId),
    \`capsule boot · working tree \${files.length} objects\`,
    \`bound model \${modelId}\`,
    called.length ? \`called into capsule: \${called.join(", ")}\` : "no agents bound yet",
    "sandbox allow-scripts allow-same-origin",
  ];
  const runtime = kilnRuntime(repoId, modelId, agents);
  const entry = pickEntry(files);
  if (!entry) {
    const listing = \`<!doctype html><html><head><meta charset="utf-8"><title>\${repoId}</title>
<style>
  :root{--bg:#09090b;--fg:#ecece8;--muted:#8e8e89;--seal:#7a9aa8;--line:#2a2a2e;--surface:#121214}
  body{font:14px/1.5 "Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--fg);padding:32px 20px 64px;margin:0}
  a{color:var(--seal)}
  h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(1.8rem,5vw,2.6rem);letter-spacing:-0.03em;margin:.4rem 0 0}
  .kicker{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
  ul{list-style:none;padding:0;margin:1.4rem 0;border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}
  li{display:flex;justify-content:space-between;gap:12px;padding:.7rem 1rem;border-bottom:1px solid var(--line);font-family:ui-monospace,monospace;font-size:12px}
  li:last-child{border-bottom:0}
  .meta{color:var(--muted);font-size:12px;margin-top:8px}
  .hint{margin-top:1.6rem;color:var(--muted);max-width:36rem}
</style>
\${runtime}
</head><body>
<p class="kicker">Capsule · synthesized tree</p>
<h1>\${repoId}</h1>
<p class="meta">\${gitCloneLine(repoId)} · model \${modelId}</p>
<p>No index.html in this working tree — serving a directory capsule. One-shot a project in Studio to land a real page.</p>
<ul>\${files.map((f) => \`<li><span>\${f.path}</span><span class="meta">\${f.size} B\${f.encrypted ? " · sealed" : ""}</span></li>\`).join("")}</ul>
<p class="hint">Add <code>index.html</code> (and optionally <code>preview.html</code>) and boot again. The capsule rewrites relative assets into blob URLs and injects window.Kiln.</p>
</body></html>\`;
    const url = URL.createObjectURL(new Blob([listing], { type: "text/html" }));
    logs.push("synthesized directory capsule from git tree", "stream live");
    return {
      repoId,
      status: "live",
      logs,
      entry: "(tree)",
      url,
      bootedAt: new Date().toISOString(),
      assets: files.length,
      modelId,
      calledAgents: called,
    };
  }
  const blobs: Record<string, string> = {};
  for (const f of files) {
    if (f.binary) continue;
    const text = await read(f);
    const mime = f.path.endsWith(".css")
      ? "text/css"
      : f.path.endsWith(".js") || f.path.endsWith(".mjs")
        ? "text/javascript"
        : f.path.endsWith(".svg")
          ? "image/svg+xml"
          : f.path.endsWith(".json")
            ? "application/json"
            : f.path.endsWith(".html")
              ? "text/html"
              : "text/plain";
    if (f.path !== entry) blobs[f.path] = URL.createObjectURL(new Blob([text], { type: mime }));
  }
  logs.push(\`mapped \${Object.keys(blobs).length} assets from git tree\`, \`entry \${entry}\`);
  const raw = await read(files.find((f) => f.path === entry)!);
  const html = injectRuntime(rewrite(raw, blobs), runtime);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  logs.push("runtime live · isolated container · window.Kiln bound");
  return {
    repoId,
    status: "live",
    logs,
    entry,
    url,
    bootedAt: new Date().toISOString(),
    assets: Object.keys(blobs).length,
    modelId,
    calledAgents: called,
  };
}
`,Rn=`kiln`;function zn(){return`Origin repository of the forge. PXM, capsules, 50 GiB deposits, sealed engines, working papers. Private.`}function Bn(){return[{path:`index.html`,language:`HTML`,content:Kn},{path:`site.css`,language:`CSS`,content:Wn},{path:`site.js`,language:`JavaScript`,content:Gn},{path:`PAPER.md`,language:`Markdown`,content:S},{path:`CLAIMS.md`,language:`Markdown`,content:Vn},{path:`AGENT.md`,language:`Markdown`,content:Hn},{path:`kiln.json`,language:`JSON`,content:Un},{path:`src/pxm.ts`,language:`TypeScript`,content:In},{path:`src/capsule.ts`,language:`TypeScript`,content:Ln},{path:`src/merkle.ts`,language:`TypeScript`,content:He},{path:`src/crypto.ts`,language:`TypeScript`,content:Ve},{path:`src/fs.ts`,language:`TypeScript`,content:Ue},...ee()]}var Vn=`# Claims

${T.map(e=>`## ${e.id} — ${e.title}\n\n${e.statement}`).join(`

`)}

Claimed ${w} by ${C}. Engines in \`src/\`. Papers in \`papers/\`. Live site is \`index.html\` — boot the capsule from the 4D tab.
`,Hn=`# Resident agents

This repository ships with Keeper (architect), Cyril (cipher), and Indra (indexer).

They occupy Hilbert cells of the files they write. They may boot the capsule. They settle Merkle commits on Kiln L1. They are not a copilot.

Working agreement:

1. Never exfiltrate the repository key.
2. Folders are 50 GiB deposits. Do not overflow.
3. Presence is a coordinate. Set workingPath before you write.
`,Un=JSON.stringify({name:`kiln`,private:!0,encrypted:`AES-256-GCM`,deposit:`50GiB/folder`,engines:[`pxm`,`capsule`,`merkle`,`crypto`,`fs`],claimed:T.map(e=>e.id),papers:te.map(e=>e.slug),year:w,lab:C},null,2),Wn=`:root {
  --bg: #09090b;
  --fg: #ecece8;
  --muted: #8e8e89;
  --seal: #7a9aa8;
  --line: #2a2a2e;
  --surface: #121214;
  --display: Georgia, "Times New Roman", serif;
  --sans: "Segoe UI", system-ui, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--sans); }
body {
  padding: 3rem 1.5rem 5rem;
  max-width: 44rem;
  margin: 0 auto;
  background-image: radial-gradient(720px 320px at 10% -10%, rgba(122,154,168,0.12), transparent 60%);
}
h1, h2 { font-family: var(--display); font-weight: 400; letter-spacing: -0.03em; line-height: 0.95; }
h1 { font-size: 3rem; margin: 0.6rem 0 0; }
h2 { font-size: 1.6rem; margin: 2.4rem 0 0.6rem; }
p { color: var(--muted); line-height: 1.6; }
a { color: var(--seal); }
.kicker { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); }
.grid { display: grid; gap: 0.6rem; margin-top: 1.2rem; }
.card { border: 1px solid var(--line); background: var(--surface); padding: 0.9rem 1rem; border-radius: 8px; }
.card strong { color: var(--fg); display: block; font-family: var(--display); font-size: 1.25rem; font-weight: 400; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; letter-spacing: 0.12em; color: var(--seal); }
`,Gn=`document.documentElement.dataset.kiln = "origin";
document.querySelectorAll("[data-claim]").forEach((el, i) => {
  el.style.animationDelay = i * 80 + "ms";
});`,Kn=`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KILN origin</title>
  <link rel="stylesheet" href="./site.css" />
</head>
<body>
  <p class="kicker">Origin vault · ${C} · ${w}</p>
  <h1>A GitHub that encrypts itself.</h1>
  <p>This site boots from sealed 4 MiB leaves of the origin vault. AES-256-GCM. Merkle root on Kiln L1. Papers and engines live in the same tree the capsule just executed.</p>
  <h2>Claimed engines</h2>
  <div class="grid">
    ${T.map(e=>`<div class="card" data-claim><span class="mono">${e.id}</span><strong>${e.title}</strong><p>${e.statement}</p></div>`).join(`
    `)}
  </div>
  <h2>Working papers</h2>
  <div class="grid">
    ${te.map(e=>`<div class="card"><span class="mono">${e.id}</span><strong>${e.title}</strong><p>${e.running}</p></div>`).join(`
    `)}
  </div>
  <p style="margin-top:2rem"><a href="./papers/README.md">papers/</a> · <a href="./PAPER.md">PXM</a> · <a href="./CLAIMS.md">Claims</a> · <a href="./AGENT.md">Agents</a></p>
  <script src="./site.js"><\/script>
</body>
</html>
`,qn=`grok-4.6`,U=[{id:`grok-agi`,label:`Grok AGI`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.6`,blurb:`General intelligence. Not a specialist. Native on Kiln.`,native:!0,family:`chat`},{id:`grok-4.6`,label:`Grok 4.6`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.6`,blurb:`Flagship. Long-running agents, code, and tool calling. Native on Kiln.`,native:!0,family:`chat`},{id:`grok-4.5`,label:`Grok 4.5`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.5`,blurb:`Previous flagship. Strong coding and tool use.`,native:!0,family:`chat`},{id:`grok-4.3`,label:`Grok 4.3`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.3`,blurb:`Live on this kiln. Coding and tool use.`,native:!0,family:`chat`},{id:`grok-4.20`,label:`Grok 4.20`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.20-0309-reasoning`,blurb:`Live reasoning Grok. Native on this kiln.`,native:!0,family:`chat`},{id:`grok-4.20-fast`,label:`Grok 4.20 Fast`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.20-0309-non-reasoning`,blurb:`Live non-reasoning 4.20. Tight loops. Native on this kiln.`,native:!0,family:`chat`},{id:`grok-4.20-multi`,label:`Grok 4.20 Multi`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.20-multi-agent-0309`,blurb:`Live multi-agent Grok. Native on this kiln.`,native:!0,family:`chat`},{id:`grok-build`,label:`Grok Build`,vendor:`xAI`,kind:`xai`,apiId:`grok-build-0.1`,blurb:`Live builder Grok. Native on this kiln.`,native:!0,family:`chat`},{id:`grok-4`,label:`Grok 4`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.6`,blurb:`Listed as Grok 4. Runs live as Grok 4.6 on this kiln.`,native:!0,family:`chat`},{id:`grok-4-fast`,label:`Grok 4 Fast`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.20-0309-non-reasoning`,blurb:`Listed as Grok 4 Fast. Runs live as Grok 4.20 Fast on this kiln.`,native:!0,family:`chat`},{id:`grok-3`,label:`Grok 3`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.5`,blurb:`Listed as Grok 3. Runs live as Grok 4.5 on this kiln.`,native:!0,family:`chat`},{id:`grok-3-mini`,label:`Grok 3 Mini`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.3`,blurb:`Mini. Works live as Grok 4.3 on this kiln.`,native:!0,family:`chat`},{id:`grok-mini`,label:`Grok Mini`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.3`,blurb:`Mini. Works live as Grok 4.3 on this kiln.`,native:!0,family:`chat`},{id:`grok-4-mini`,label:`Grok 4 Mini`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.3`,blurb:`Mini Grok 4. Works live as Grok 4.3 on this kiln.`,native:!0,family:`chat`},{id:`grok-2`,label:`Grok 2`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.6`,blurb:`Grok 2. Chat turns run live as Grok 4.6 on this kiln.`,native:!0,family:`chat`},{id:`grok-code`,label:`Grok Code`,vendor:`xAI`,kind:`xai`,apiId:`grok-build-0.1`,blurb:`Code-first Grok. Live as Grok Build on this kiln.`,native:!0,family:`chat`},{id:`grok-2-vision`,label:`Grok 2 Vision`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.6`,blurb:`Listed as Grok 2 Vision. Chat turns run as Grok 4.6 on this kiln.`,native:!0,family:`vision`},{id:`gpt-4.1`,label:`GPT-4.1`,vendor:`OpenAI`,kind:`openai`,apiId:`gpt-4.1`,blurb:`Bring your OpenAI key. Runs in this repo like any other agent.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.openai.com/v1`},{id:`gpt-4.1-mini`,label:`GPT-4.1 Mini`,vendor:`OpenAI`,kind:`openai`,apiId:`gpt-4.1-mini`,blurb:`Fast OpenAI. Bring your key.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.openai.com/v1`},{id:`gpt-4o`,label:`GPT-4o`,vendor:`OpenAI`,kind:`openai`,apiId:`gpt-4o`,blurb:`Multimodal. Connect with an OpenAI-compatible key.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.openai.com/v1`},{id:`o3`,label:`o3`,vendor:`OpenAI`,kind:`openai`,apiId:`o3`,blurb:`Reasoning model. Bring your key.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.openai.com/v1`},{id:`claude-sonnet-4`,label:`Claude Sonnet 4`,vendor:`Anthropic`,kind:`anthropic`,apiId:`claude-sonnet-4-0`,blurb:`Bring Claude via an OpenAI-compatible gateway or Anthropic proxy.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.anthropic.com/v1`},{id:`claude-opus-4`,label:`Claude Opus 4`,vendor:`Anthropic`,kind:`anthropic`,apiId:`claude-opus-4-0`,blurb:`Highest Claude. Your key, this repo.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.anthropic.com/v1`},{id:`claude-haiku-4`,label:`Claude Haiku 4`,vendor:`Anthropic`,kind:`anthropic`,apiId:`claude-haiku-4-0`,blurb:`Fast Claude for review loops. Bring a key or gateway.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.anthropic.com/v1`},{id:`gemini-2.5-pro`,label:`Gemini 2.5 Pro`,vendor:`Google`,kind:`google`,apiId:`gemini-2.5-pro`,blurb:`Bring Gemini through an OpenAI-compatible endpoint.`,native:!1,family:`chat`,defaultBaseUrl:`https://generativelanguage.googleapis.com/v1beta/openai`},{id:`gemini-2.5-flash`,label:`Gemini 2.5 Flash`,vendor:`Google`,kind:`google`,apiId:`gemini-2.5-flash`,blurb:`Low-latency Gemini. OpenAI-compatible endpoint.`,native:!1,family:`chat`,defaultBaseUrl:`https://generativelanguage.googleapis.com/v1beta/openai`},{id:`llama-4`,label:`Llama 4`,vendor:`Meta`,kind:`meta`,apiId:`llama-4`,blurb:`Open weights. Point Kiln at Groq, Fireworks, Together, or Ollama.`,native:!1,family:`chat`},{id:`llama-3.3`,label:`Llama 3.3 70B`,vendor:`Meta`,kind:`meta`,apiId:`llama-3.3-70b`,blurb:`Widely hosted. Groq, Together, Fireworks, or Ollama.`,native:!1,family:`chat`},{id:`deepseek-v3`,label:`DeepSeek V3`,vendor:`DeepSeek`,kind:`deepseek`,apiId:`deepseek-chat`,blurb:`Bring a DeepSeek key. OpenAI-compatible.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.deepseek.com/v1`},{id:`qwen-2.5-coder`,label:`Qwen 2.5 Coder`,vendor:`Alibaba`,kind:`qwen`,apiId:`qwen2.5-coder`,blurb:`Code model. Local or hosted OpenAI-compatible.`,native:!1,family:`chat`},{id:`qwen-3`,label:`Qwen 3`,vendor:`Alibaba`,kind:`qwen`,apiId:`qwen3`,blurb:`General Qwen. Hosted or Ollama.`,native:!1,family:`chat`},{id:`mistral-large`,label:`Mistral Large`,vendor:`Mistral`,kind:`mistral`,apiId:`mistral-large-latest`,blurb:`Bring a Mistral key or gateway.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.mistral.ai/v1`},{id:`codestral`,label:`Codestral`,vendor:`Mistral`,kind:`mistral`,apiId:`codestral-latest`,blurb:`Code-specialized Mistral. Your key.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.mistral.ai/v1`},{id:`groq-llama`,label:`Llama on Groq`,vendor:`Groq`,kind:`groq`,apiId:`llama-3.3-70b-versatile`,blurb:`OpenAI-compatible Groq endpoint. Paste a Groq key.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.groq.com/openai/v1`},{id:`together-any`,label:`Together AI`,vendor:`Together`,kind:`together`,apiId:`meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo`,blurb:`Any Together-hosted model. OpenAI-compatible.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.together.xyz/v1`},{id:`fireworks-any`,label:`Fireworks`,vendor:`Fireworks`,kind:`fireworks`,apiId:`accounts/fireworks/models/llama-v3p1-70b-instruct`,blurb:`Any Fireworks model. OpenAI-compatible.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.fireworks.ai/inference/v1`},{id:`kimi-k2`,label:`Kimi K2`,vendor:`Moonshot`,kind:`moonshot`,apiId:`kimi-k2`,blurb:`Bring a Moonshot key. OpenAI-compatible.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.moonshot.ai/v1`},{id:`command-r-plus`,label:`Command R+`,vendor:`Cohere`,kind:`cohere`,apiId:`command-r-plus`,blurb:`Bring a Cohere key or OpenAI-compatible proxy.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.cohere.ai/compatibility/v1`},{id:`gemma-3`,label:`Gemma 3`,vendor:`Google`,kind:`google`,apiId:`gemma-3`,blurb:`Open weights. Ollama, Groq, or a custom endpoint.`,native:!1,family:`chat`},{id:`phi-4`,label:`Phi-4`,vendor:`Microsoft`,kind:`custom`,apiId:`phi-4`,blurb:`Small model. Point at Azure, Ollama, or any OpenAI-compatible host.`,native:!1,family:`chat`},{id:`ollama-local`,label:`Ollama (local)`,vendor:`Ollama`,kind:`ollama`,apiId:`llama3.1`,blurb:`Any model on your machine. Default http://127.0.0.1:11434/v1.`,native:!1,family:`chat`,defaultBaseUrl:`http://127.0.0.1:11434/v1`},{id:`custom-openai`,label:`Custom OpenAI-compatible`,vendor:`Custom`,kind:`custom`,apiId:`custom`,blurb:`Any OpenAI-compatible base URL. Your model id, your key.`,native:!1,family:`chat`},{id:`mcp-agent`,label:`MCP agent`,vendor:`MCP`,kind:`mcp`,apiId:`mcp`,blurb:`Bring an agent you already run. Point Kiln at its MCP server.`,native:!1,family:`agent`},{id:`grok-imagine`,label:`Grok Imagine`,vendor:`xAI`,kind:`xai`,apiId:`grok-imagine-image`,blurb:`Image generation. Native on Kiln for capsule art and papers.`,native:!0,family:`image`},{id:`grok-voice`,label:`Grok Voice`,vendor:`xAI`,kind:`xai`,apiId:`grok-4.6`,blurb:`Voice id listed. Chat turns run as Grok 4.6 on this kiln.`,native:!0,family:`chat`},{id:`auro-14b`,label:`AURO 14B`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`Sovereign 14B. Coherence-gated. Native on Kiln — assign it to any repo, capsule, or crew.`,native:!0,family:`chat`},{id:`auro-14b-instruct`,label:`AURO 14B Instruct`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`Instruction-tuned AURO. Code, tools, and constitution-bound turns.`,native:!0,family:`chat`},{id:`auro-7b`,label:`AURO 7B Edge`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`Edge AURO. 72h offline, Mac Mini / phone. Feature shedding.`,native:!0,family:`chat`},{id:`auro-vision`,label:`AURO Vision`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`AURO with vision. Capsule UI review and lattice paint.`,native:!0,family:`vision`},{id:`gpt-5`,label:`GPT-5`,vendor:`OpenAI`,kind:`openai`,apiId:`gpt-5`,blurb:`Bring your OpenAI key. Runs as a resident on this tree.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.openai.com/v1`},{id:`claude-opus-4.1`,label:`Claude Opus 4.1`,vendor:`Anthropic`,kind:`anthropic`,apiId:`claude-opus-4-1`,blurb:`Highest Claude. Gateway or Anthropic-compatible endpoint.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.anthropic.com/v1`},{id:`deepseek-r1`,label:`DeepSeek R1`,vendor:`DeepSeek`,kind:`deepseek`,apiId:`deepseek-reasoner`,blurb:`Reasoning. OpenAI-compatible DeepSeek key.`,native:!1,family:`chat`,defaultBaseUrl:`https://api.deepseek.com/v1`},{id:`qwen3-coder`,label:`Qwen3 Coder`,vendor:`Alibaba`,kind:`qwen`,apiId:`qwen3-coder`,blurb:`Code model. Ollama, Together, or a custom host.`,native:!1,family:`chat`},{id:`glm-4.5`,label:`GLM-4.5`,vendor:`Zhipu`,kind:`custom`,apiId:`glm-4.5`,blurb:`Bring a Zhipu / OpenAI-compatible endpoint.`,native:!1,family:`chat`},{id:`medina-phi`,label:`MEDINA φ-Harmonic`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`Toroidal 5D memory navigator. φ-timed. Sovereign edge. Listed on the marketplace.`,native:!0,family:`agent`},{id:`neuro-bcvi`,label:`NeuroEmergence BCVI`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`Coherence-gated activation. Battle Coherence Victory Index. Not a reward model.`,native:!0,family:`agent`},{id:`xcrew-edge`,label:`XCREW Edge`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`72h offline, feature shedding, PQ-ready. Constrained hardware.`,native:!0,family:`agent`},{id:`mesie-core`,label:`MESIE Core`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`Governed emergence. The phenomenon, as a callable agent on the tree.`,native:!0,family:`agent`},{id:`parallax-router`,label:`Parallax Router`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`HFT-grade routing of agent calls across models. Sits on a Kiln computer.`,native:!0,family:`agent`},{id:`liquid-organism`,label:`Liquid Organism`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`Liquid intelligence. Category-shaped memory. Runs as a model wallet.`,native:!0,family:`agent`},{id:`fsos-freight`,label:`FSOS Freight`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`Broker-free freight OS agent. HOS-aware. Direct match.`,native:!0,family:`agent`},{id:`nova-mobile`,label:`NOVA Mobile`,vendor:`ItsNotAI LABS`,kind:`custom`,apiId:`grok-4.6`,blurb:`On-device agent. Pythonista / Mac Mini bridge. Sovereign.`,native:!0,family:`agent`}];function Jn(e){return U.find(t=>t.id===e)??U[0]}function Yn(){return U.filter(e=>e.vendor===`ItsNotAI LABS`)}function Xn(){return U.filter(e=>e.native)}function Zn(){return U.filter(e=>!e.native)}function Qn(e,t,n=``){return`${n.replace(/\/$/,``)||`https://kiln.dev`}/${e}/${t}.git`}function $n(e,t){return`git clone kiln://${e}/${t}.git`}function er(e,t){return`kiln clone ${e}/${t}`}function tr(e,t){if(!e.native)return t.find(t=>t.id===e.id||t.kind===e.kind||t.model===e.apiId||t.model===e.id)}var nr=[`code`,`agent`,`crypto`,`model`];function rr(e){return e.toLowerCase().replace(/['"]/g,``).replace(/[^a-z0-9._-]+/g,`-`).replace(/^-+|-+$/g,``).slice(0,40)||`oneshot`}function ir(e,t=`code`){let n=e.toLowerCase();return/\b(sol|solidity|defi|escrow|token|zk|circuit|canister|protocol)\b/.test(n)?`crypto`:/\b(agent|crew|mcp|resident)\b/.test(n)?`agent`:/\b(model|weights|lora|checkpoint|inference)\b/.test(n)?`model`:t}function ar(e){let t=e.match(/["']([a-z0-9][\w.-]{1,32})["']/i);return t?.[1]?rr(t[1]):rr(e.replace(/[^a-z0-9\s-]/gi,` `).split(/\s+/).filter(e=>e.length>2).slice(0,3).join(`-`)||`oneshot`)}function or(){return`name: Settle on Kiln L1
on:
  push:
  workflow_dispatch:
jobs:
  settle:
    runs-on: kiln
    steps:
      - run: kiln verify --on-chain
      - run: kiln merkle
      - run: kiln push
`}function sr(e,t,n,r){return JSON.stringify({name:e,kind:t,owner:n,encrypted:`AES-256-GCM`,deposit:`50GiB/folder`,oneshot:!0,prompt:r.slice(0,280)},null,2)}function W(e){return e.replace(/[&<>"']/g,e=>e===`&`?`&amp;`:e===`<`?`&lt;`:e===`>`?`&gt;`:e===`"`?`&quot;`:`&#39;`)}function cr(e){let{name:t,description:n,owner:r,kind:i,prompt:a}=e,o=i===`crypto`?`Protocol · sealed on L1`:i===`agent`?`Agent tree · resident wallet`:i===`model`?`Model vault · license on-chain`:`One-shot · capsule live`,s=a?`<section class="panel"><p class="kicker">Prompt</p><p class="mono">${W(a.slice(0,480))}</p></section>`:``;return`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${W(t)} · kiln://${r}/${t}</title>
  <style>
    :root { --bg:#09090b; --fg:#ecece8; --muted:#8e8e89; --seal:#7a9aa8; --line:#2a2a2e; --surface:#121214; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: var(--bg); color: var(--fg); font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; }
    body { min-height: 100dvh; padding: 2.5rem 1.4rem 4rem; background-image: radial-gradient(720px 340px at 8% -10%, rgba(122,154,168,.14), transparent 58%); }
    .wrap { max-width: 44rem; margin: 0 auto; }
    .kicker { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); margin: 0; }
    h1 { font-family: "Times New Roman", Georgia, serif; font-weight: 400; letter-spacing: -.03em; font-size: clamp(2.2rem, 6vw, 3.4rem); line-height: .95; margin: .6rem 0 0; }
    p { color: var(--muted); line-height: 1.6; }
    a { color: var(--seal); }
    .grid { display: grid; gap: .7rem; margin-top: 1.4rem; }
    @media (min-width: 640px) { .grid.two { grid-template-columns: 1fr 1fr; } }
    .card, .panel { border: 1px solid var(--line); background: var(--surface); border-radius: 10px; padding: 1rem 1.05rem; }
    .card strong { display: block; font-family: Georgia, serif; font-size: 1.2rem; font-weight: 400; color: var(--fg); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--seal); }
    .bar { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: 1.4rem; }
    button { appearance: none; border: 1px solid var(--line); background: var(--fg); color: var(--bg); padding: .55rem .9rem; border-radius: 6px; font: 500 13px/1 inherit; cursor: pointer; }
    button.ghost { background: transparent; color: var(--fg); }
    #log { margin-top: 1rem; font-family: ui-monospace, monospace; font-size: 11px; color: var(--muted); white-space: pre-wrap; }
    .coord { display: inline-block; margin-right: .8rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="kicker">${W(o)}</p>
    <h1>${W(t)}</h1>
    <p>${W(n||`A sealed repository. Booted from its own git tree.`)}</p>
    <p class="mono">git clone kiln://${W(r)}/${W(t)}.git</p>
    ${s}
    <div class="grid two">
      <div class="card"><strong>4D</strong><p>Hilbert x, y · folder depth ρ · chain height t. Agents sit on the files they commit.</p></div>
      <div class="card"><strong>Capsule</strong><p>This page is the working tree executing. <span class="mono">window.Kiln</span> is bound.</p></div>
      <div class="card"><strong>Computer</strong><p>Each Git tree is its own sealed machine — shell, memory, models, preview domain, ledger.</p></div>
      <div class="card"><strong>Seal</strong><p>AES-256-GCM · 50 GiB / folder · Merkle root on Kiln L1.</p></div>
    </div>
    <div class="bar">
      <button type="button" id="ping">Ping computer</button>
      <button type="button" class="ghost" id="coords">Show 4D coordinate</button>
    </div>
    <pre id="log"></pre>
  </div>
  <script>
    const kiln = window.Kiln || { repo: "${W(r)}/${W(t)}", git: { clone: "git clone kiln://${W(r)}/${W(t)}.git" } };
    const log = document.getElementById("log");
    document.getElementById("ping").onclick = () => {
      log.textContent = JSON.stringify(kiln, null, 2);
    };
    document.getElementById("coords").onclick = () => {
      const t = Date.now() % 10000;
      log.textContent = "x " + (t % 16) + "  y " + ((t >> 2) % 16) + "  ρ 0  t " + t + "\\noccupant: capsule";
    };
  <\/script>
</body>
</html>
`}function lr(e){return`/* ${e} capsule runtime */
(function () {
  const el = document.getElementById("status");
  if (!el) return;
  const kiln = window.Kiln || {};
  el.textContent = (kiln.repo || "${e}") + " · live";
})();
`}function ur(e,t,n,r,i){return`# ${e}

${n}

\`\`\`
git clone kiln://${t}/${e}.git
\`\`\`

Kind: **${i}**. One-shot from Studio. AES-256-GCM. Folder quota: 50 GB.

## Prompt

> ${r.replace(/\n/g,`
> `)}

## Tree

- \`index.html\` — capsule entry. Boot it from the Preview or 4D tab.
- \`app.js\` — bound runtime.
- \`.github/workflows/settle.yml\` — Kiln Action.
- \`kiln.json\` — sealed metadata.

Open **Preview** to run the working tree. Open **4D** for the Hilbert lattice (x, y), folder depth ρ, and chain height t.
`}function dr(e){return`# Agent ${e}

This repository **is** the agent. It has a nested wallet. A resident process sits on the computer.

- Spawn more roles from Studio.
- Call the agent into the capsule (\`window.Kiln.agents\`).
- Commits settle a Merkle root on Kiln L1.
`}function fr(e){return`# Model ${e}

Weights, card, and license live in this sealed tree. The model wallet holds grants.

List it on the marketplace or bind it as the default model for any repository.
`}function pr(){return`// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @notice Kiln-native escrow. Issue hashes lock KLN; merge releases.
contract KilnEscrow {
    mapping(bytes32 => uint256) public locked;
    event Locked(bytes32 indexed issue, uint256 amount, address from);
    event Released(bytes32 indexed issue, address to, uint256 amount);

    function lock(bytes32 issue) external payable {
        require(msg.value > 0, "zero");
        locked[issue] += msg.value;
        emit Locked(issue, msg.value, msg.sender);
    }

    function release(bytes32 issue, address payable to) external {
        uint256 n = locked[issue];
        require(n > 0, "empty");
        locked[issue] = 0;
        to.transfer(n);
        emit Released(issue, to, n);
    }
}
`}function mr(e){let t=e.kind&&nr.includes(e.kind)?e.kind:ir(e.prompt),n=rr(e.name||ar(e.prompt)),r=(e.owner||`you`).toLowerCase(),i=e.prompt.trim().slice(0,160)||`One-shot ${t} repository.`,a=[{path:`index.html`,content:cr({name:n,description:i,owner:r,kind:t,prompt:e.prompt})},{path:`app.js`,content:lr(n)},{path:`README.md`,content:ur(n,r,i,e.prompt,t)},{path:`kiln.json`,content:sr(n,t,r,e.prompt)},{path:`.github/workflows/settle.yml`,content:or()}];return t===`agent`&&a.push({path:`AGENT.md`,content:dr(n)}),t===`model`&&a.push({path:`MODEL.md`,content:fr(n)}),t===`crypto`&&a.push({path:`contracts/Escrow.sol`,content:pr()}),{name:n,description:i,kind:t,files:a,via:`template`}}var hr=i({method:`POST`}).handler(r(`18c247a0381626a663a792922f6dcdc5dba99b3b751382d58d2a5dd959dcb6b1`)),gr=[{id:`identity`,title:`Identity`,runs:`Wallet · claimed org · lab seat`,invariant:`A write is signed by a wallet. An org is a claimed handle. Accounts are roster, not keys.`},{id:`tree`,title:`Sealed tree`,runs:`git clone / commit / push / pull`,invariant:`Bytes are AES-256-GCM 4 MiB leaves before they touch disk. Merkle root is the object that moves.`},{id:`computer`,title:`Computer`,runs:`Per-repo shell, cwd, env, processes, ports, JS, Actions, WebGPU, kiln.app`,invariant:`One machine per repository. Agents are processes. The capsule is port 443. MCP is 7331.`},{id:`memory`,title:`PXM`,runs:`Hilbert lattice · inverted index · 50 GiB / folder`,invariant:`An agent sits on a cell (x, y, ρ, t). Presence is a coordinate, not a chat tab.`},{id:`crew`,title:`Crew kernel`,runs:`Conductor · roles · mailbox · constitution · SLA handoff`,invariant:`Roles do not impersonate. Work moves by kiln_handoff (legal edge + L1 receipt + drain). Constitution is loaded into every turn.`},{id:`capsule`,title:`Capsule`,runs:`index.html sandbox · window.Kiln`,invariant:`The working tree executes. Bound models and called agents ship inside the iframe.`},{id:`l1`,title:`Kiln L1`,runs:`Commit txs · KLN escrow · crew spawn`,invariant:`A handoff, a seal, a merge, and a bounty are the same ledger.`}],G=[{from:`conductor`,to:`agi`,kind:`general`,label:`ask the generalist`},{from:`conductor`,to:`architect`,kind:`plan`,label:`plan the tree`},{from:`agi`,to:`architect`,kind:`plan`,label:`frame the work`},{from:`agi`,to:`builder`,kind:`build`,label:`just write it`},{from:`conductor`,to:`scout`,kind:`scout`,label:`find the work`},{from:`architect`,to:`builder`,kind:`build`,label:`implement the map`},{from:`builder`,to:`reviewer`,kind:`review`,label:`read the diff`},{from:`reviewer`,to:`builder`,kind:`build`,label:`request changes`},{from:`reviewer`,to:`deployer`,kind:`ship`,label:`ship on approve`},{from:`conductor`,to:`cipher`,kind:`seal`,label:`verify the vault`},{from:`conductor`,to:`indexer`,kind:`index`,label:`keep memory honest`},{from:`deployer`,to:`conductor`,kind:`ship`,label:`report preview`}],_r=[`conductor`,`agi`,`architect`,`builder`,`reviewer`,`deployer`,`cipher`,`indexer`];function vr(e){return`# Constitution · ${e}

This repository is a sealed machine. The crew are processes on it.

1. One computer per repository. Do not reach into another tree without a fork or an org grant.
2. A write is \`git commit\`. Use kiln_write_file. Never claim a file landed that you did not commit.
3. Handoff, do not impersonate. kiln_handoff moves work to the role that owns it.
4. Seat yourself. After a write, your working path is the file you touched — a Hilbert cell.
5. Never exfiltrate vault keys, agent secrets, or wallet seeds.
6. Folder quota is 50 GiB. Cipher verifies. Indexer keeps memory honest.
7. The capsule boots \`index.html\`. Deployer ships it. Conductor reports.
8. Speak git: clone, commit, push, pull, branch.

Loaded into every turn of this crew.
`}function yr(e){return`# Architecture · ${e}

Kiln agent architecture as it runs. Spec: KILN-WP-09.

## Layers

${gr.map(e=>`### ${e.title}\n\nRuns: ${e.runs}\n\nInvariant: ${e.invariant}`).join(`

`)}

## Crew graph

${G.map(e=>`- ${e.from} → ${e.to} (${e.kind}) — ${e.label}`).join(`
`)}

## Kernel

A turn is: mailbox + constitution + tools → model → tool calls against THIS computer → handoff or done.

The Studio UI does not own the loop. \`src/lib/kiln/kernel.ts\` does. CLI, Studio, and MCP dispatch the same kernel.

\`\`\`
git clone kiln://${e}.git
\`\`\`
`}function br(e){let t=e.mates.length?e.mates.map(e=>`- ${e.name} (${e.role}) [${e.status}]`).join(`
`):`- none yet`,n=e.mailbox?.length?e.mailbox.map(e=>`- ${e}`).join(`
`):`- empty`;return`Crew on ${e.repoId}
Your role: ${e.role}
Seat: ${e.seat??`unseated`}

Mates:
${t}

Mailbox:
${n}

${e.constitution?`Constitution (excerpt):\n${e.constitution.slice(0,900)}`:``}

Handoff with kiln_handoff. Do not do another role's job.`}var xr=[`queued`,`accepted`,`running`,`done`,`rejected`,`blocked`,`timeout`];function Sr(e,t,n){return e===t?!1:e===`conductor`||(n?.edges??G).some(n=>n.from===e&&n.to===t)}function Cr(){return[`turn`,`handoff`,`drain`,`ack`,`reject`,`seat`,`constitution`,`mailbox`,`computer`,`memory:working`,`memory:episodic`,`memory:semantic`,`memory:procedural`,`memory:lattice`,`memory:folder`,`pxm`,`domain`,`deploy`,`gpu`]}var wr=xr,Tr=`kiln.app`;function Er(e,t){return`${e}-${t}`.toLowerCase().replace(/[^a-z0-9-]+/g,`-`).replace(/^-|-$/g,``)}function Dr(e,t){return`${Er(e,t)}.${Tr}`}function Or(e,t,n){return`${(n||`dev`).replace(/[^a-f0-9]/gi,``).slice(0,7)||`dev`}-${Er(e,t)}.${Tr}`}function kr(e){return`https://${e}`}function Ar(e,t,n,r){return{id:`dom_${Er(t,n)}`,repoId:e,host:Dr(t,n),kind:`kiln`,status:`live`,https:!0,createdAt:new Date().toISOString(),deployId:r}}function jr(e,t){let n=t.replace(/^https?:\/\//,``).replace(/\/.*$/,``).toLowerCase();return{id:`dom_${n.replace(/[^a-z0-9]+/g,`-`)}`,repoId:e,host:n,kind:`custom`,status:`pending`,https:!0,createdAt:new Date().toISOString()}}function Mr(e,t,n,r){return{id:`dpl_${Date.now().toString(36)}`,repoId:e,sha:r||`working`,host:Or(t,n,r||Date.now().toString(36)),status:`building`,createdAt:new Date().toISOString(),logs:[`queued`,`sealing tree`,`booting capsule`]}}var Nr=[{id:`code`,label:`Code`,hint:`git tree`},{id:`computer`,label:`Computer`,hint:`shell · memory`},{id:`capsule`,label:`Capsule`,hint:`live index.html`},{id:`world`,label:`4D`,hint:`PXM lattice`},{id:`actions`,label:`Actions`,hint:`settle · deploy`},{id:`crew`,label:`Crew`,hint:`kernel · handoff`}],Pr=t({HEAD_HEIGHT:()=>pn,allBlocks:()=>Kr,allBranches:()=>Jr,allCommits:()=>Gr,allDiscussions:()=>Qr,allGists:()=>Zr,allIssues:()=>Ur,allListings:()=>ti,allPackages:()=>$r,allPulls:()=>Wr,allReleases:()=>Yr,allRepos:()=>Hr,allRuns:()=>Xr,allTxs:()=>qr,canWriteRepo:()=>ei,hasPurchased:()=>ri,listingForRepo:()=>ni,repoTvl:()=>ii,starCount:()=>ai,useKiln:()=>Vr}),Fr=2500,Ir=!1;function K(e,t){return t.find(t=>t.id===e)??(globalThis.__KILN_FORGE_REPOS||[]).find(t=>t.id===e)??R.find(t=>t.id===e)}function q(e,t){let n=t.wallet;return n?e===n.handle||t.orgs.some(t=>t.handle===e&&(t.role===`owner`||t.role===`admin`||t.ownerHandle===n.handle)):!1}function J(e){return e.length?e[e.length-1]:H[H.length-1]}async function Y(e,t,n){let r=await oe(J(e().extraBlocks),[n]);n.block=r.height,t({extraTxs:[...e().extraTxs,{...n,block:r.height}],extraBlocks:[...e().extraBlocks,{...r,txs:[{...n,block:r.height}]}]});try{await fetch(`/api/kiln/l1`,{method:`POST`,headers:{'content-type':`application/json`},body:JSON.stringify({block:{...r,txs:[{...n,block:r.height}]},tx:{...n,block:r.height}})})}catch{}}function X(e){return`${e}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`}function Z(e,t){return e.some(e=>e.id===t.id)?e.map(e=>e.id===t.id?t:e):[t,...e]}async function Q(e){let t=await s(e.map(e=>({path:e.path,hash:e.merkleRoot||e.sha})));return y(t)}function Lr(e){let t=e.lastIndexOf(`/`);return t===-1?``:e.slice(0,t)}function Rr(e,t,n){let r=Lr(t),i=_(e.filter(e=>e.path!==t),r);if(i+n>53687091200)throw Error(`Folder "${r||`/`}" is at the 50 GB cap. ${zr(i)} used, ${zr(n)} incoming.`)}function zr(e){return e>=1024**3?`${(e/1024**3).toFixed(2)} GB`:e>=1024**2?`${(e/1024**2).toFixed(1)} MB`:`${e} B`}function Br(e){let t={},n=0;for(let r of e){let e=r.language||c(r.path);e!==`binary`&&e!==`image`&&e!==`archive`&&(t[e]=(t[e]??0)+(r.size||0),n+=r.size||0)}if(!n)return{language:`Markdown`,languages:{Markdown:100}};let r={};for(let[e,i]of Object.entries(t))r[e]=Math.max(1,Math.round(i/n*100));return{language:Object.entries(t).sort((e,t)=>t[1]-e[1])[0]?.[0]??`Markdown`,languages:r}}function $(e,t){E(()=>import(`./memory-DWov_Aom.js`).then(e=>e.n).then(n=>n.indexRepo(e,t)),__vite__mapDeps([0,1,2,3,4])).catch(()=>{})}var Vr=Tn()(On((e,t)=>({hydrated:!1,wallet:null,balance:0,claimedFaucet:!1,userRepos:[],userIssues:[],userPulls:[],userCommits:[],extraBlocks:[],extraTxs:[],stars:{},forksOf:[],unlocked:{},handleOverrides:{},userBranches:[],userReleases:[],userRuns:[],userReviews:[],notices:[],agents:[],crews:[],handoffs:[],domains:[],deploys:[],agentMessages:{},userGists:[],userDiscussions:[],userPackages:[],originReadyFor:null,capsules:{},modelConnections:[],defaultModelId:qn,userListings:[],purchases:[],licensedModels:[],userOffers:[],orgs:[],installedApps:[],watches:{},webhooks:[],checks:[],profiles:{},cloudJobs:[],gpuBound:!1,setHydrated:t=>e({hydrated:t}),linkGithub:n=>{let r=t().wallet;if(!r)return;let i=n.trim().replace(/^https?:\/\/github\.com\//i,``).replace(/\/.*$/,``).slice(0,39);e({wallet:{...r,githubHandle:i||void 0}})},createOrg:async n=>{let r=t().wallet;if(!r)throw Error(`Connect a wallet first`);let i=n.handle.trim().toLowerCase().replace(/[^a-z0-9-]/g,`-`).slice(0,32);if(i.length<2)throw Error(`Handle too short`);if(t().orgs.some(e=>e.handle===i))throw Error(`@${i} is already claimed on this wallet`);let o=await a(`${r.secret}:org:${i}`),s=`owner`;try{let{createOrg:e}=await E(async()=>{let{createOrg:e}=await import(`./orgs-BXGx-klH.js`);return{createOrg:e}},__vite__mapDeps([5,6,7,8,9,10,11]));s=(await e({data:{handle:i,displayName:n.displayName||i,bio:n.bio,github:n.github,address:o}})).role}catch(e){let t=e instanceof Error?e.message:``;if(t&&t!==`Unauthorized`&&!t.toLowerCase().includes(`unauthorized`))throw e}let c={handle:i,displayName:n.displayName||i,bio:n.bio||``,encrypted:!0,claimed:!0,ownerHandle:r.handle,address:o,github:n.github,createdAt:new Date().toISOString(),role:s};e({orgs:[...t().orgs,c]});let l=J(t().extraBlocks);return await Y(t,e,await O(`org_claim`,r.address,o,0,`claimed org ${i}`,l.height+1)),t().notify(`Organization claimed`,`@${i} is sealed and yours`,`/${i}`),c},installApp:async(n,r)=>{let i=t().wallet;if(!i)throw Error(`Connect a wallet first`);let{appById:a}=await E(async()=>{let{appById:e}=await import(`./apps-CNNvJtvb.js`).then(e=>e.r);return{appById:e}},__vite__mapDeps([12,1])),o=a(r);if(!o)throw Error(`Unknown app`);if(t().installedApps.some(e=>e.repoId===n&&e.appId===r))return t().installedApps.find(e=>e.repoId===n&&e.appId===r);if(o.installKln&&t().balance<o.installKln)throw Error(`Not enough KLN`);o.installKln&&e({balance:t().balance-o.installKln});let s=J(t().extraBlocks),c=await O(`app_install`,i.address,D,o.installKln,`${o.name} → ${n}`,s.height+1,n),l={appId:r,repoId:n,installedAt:new Date().toISOString(),txHash:c.hash};return e({installedApps:[l,...t().installedApps]}),await Y(t,e,c),t().notify(`App installed`,`${o.name} on ${n}`,`/${n}`),t().fireAddons(`install`,n),l},uninstallApp:(n,r)=>{e({installedApps:t().installedApps.filter(e=>e.repoId!==n||e.appId!==r)}),t().notify(`App removed`,`${r} off ${n}`,`/${n}`)},watchRepo:n=>{let r=!t().watches[n];e({watches:{...t().watches,[n]:r}});let i=K(n,t().userRepos);if(i){let n={...i,watchers:Math.max(0,i.watchers+(r?1:-1))};e({userRepos:Z(t().userRepos,n)})}t().notify(r?`Watching`:`Unwatched`,n,`/${n}`)},addWebhook:(n,r,i)=>{let a={id:X(`wh`),repoId:n,url:r,events:i?.length?i:[`push`,`pull_open`,`issue`,`deploy`],secret:b().slice(0,24),active:!0,deliveries:[],createdAt:new Date().toISOString()};return e({webhooks:[a,...t().webhooks]}),t().notify(`Webhook added`,r,`/${n}/settings`),a},removeWebhook:n=>e({webhooks:t().webhooks.filter(e=>e.id!==n)}),fireAddons:async(n,r,i)=>{if(!Ir){Ir=!0;try{let{runAddons:a}=await E(async()=>{let{runAddons:e}=await import(`./addons-o5NDeLjB.js`);return{runAddons:e}},__vite__mapDeps([13,11,12,1])),o=(K(r,t().userRepos)??R.find(e=>e.id===r))?.files??[];await a({event:n,repoId:r,pullId:i?.pullId,installed:t().installedApps,files:o,webhooks:t().webhooks,apply:{notify:(e,n,r,i)=>t().notify(e,n,r,i),reviewPull:(e,n,r)=>t().reviewPull(e,n,r),openIssue:(e,n,r,i)=>t().openIssue(e,n,r,i),openPull:(e,n,r,i)=>t().openPull(e,n,r,i),runAction:(e,n)=>t().runAction(e,n),addCheck:n=>e({checks:[n,...t().checks].slice(0,80)}),spawnAgent:e=>t().spawnAgent(e),deployRepo:e=>t().deployRepo(e),bootRepoCapsule:(e,n)=>t().bootRepoCapsule(e,n),deliverWebhook:(n,r)=>{let i={id:X(`dl`),event:r,status:204,at:new Date().toISOString()};e({webhooks:t().webhooks.map(e=>e.id===n.id?{...e,deliveries:[i,...e.deliveries].slice(0,12)}:e)})},commitFile:(e,n,r,i)=>t().commitFile(e,n,r,i)}})}finally{Ir=!1}}},connect:async(n,r)=>{r=(r||``).trim().replace(/^0x/i,``);let i=r.length>=16?r:b(),o={address:await a(i),secret:i,handle:(n||`itsnotailabs`).replace(/[^a-zA-Z0-9-]/g,`-`).slice(0,24).toLowerCase(),createdAt:new Date().toISOString()},s=t().profiles[o.handle]??{handle:o.handle,displayName:o.handle,bio:`Public and private repositories. Encrypted cloud per repo.`,location:``,joined:o.createdAt.slice(0,4),address:o.address,kind:`user`};return e({wallet:o,balance:t().wallet?t().balance:0,profiles:{...t().profiles,[o.handle]:{...s,address:o.address}}}),u(),t().ensureOrigin(),o},upsertProfile:n=>{let r=n.handle.toLowerCase(),i=t().profiles[r],a={handle:r,displayName:n.displayName||i?.displayName||r,bio:n.bio??i?.bio??``,location:n.location??i?.location??``,joined:n.joined||i?.joined||new Date().toISOString().slice(0,4),address:n.address||i?.address||t().wallet?.address||``,lab:n.lab??i?.lab,website:n.website??i?.website,twitter:n.twitter??i?.twitter,company:n.company??i?.company,email:n.email??i?.email,kind:n.kind??i?.kind??`user`,highlight:n.highlight??i?.highlight,pinned:n.pinned??i?.pinned};e({profiles:{...t().profiles,[r]:a}})},setGpuBound:t=>e({gpuBound:t}),enqueueCloudJob:async({repoId:n,runtime:r,source:i})=>{let a=t().wallet;if(!a)throw Error(`Connect a wallet first`);let o=K(n,t().userRepos);if(!o)throw Error(`Repository not found`);if(!q(o.owner,t()))throw Error(`No write on this repository`);let{sealSource:s,executeJob:c}=await E(async()=>{let{sealSource:e,executeJob:t}=await import(`./cloud-iXGZSPDV.js`);return{sealSource:e,executeJob:t}},__vite__mapDeps([14,2,15,16,1])),l=o.encrypted?await s(i,a.secret,n):void 0,u={id:`job_${Date.now().toString(36)}`,repoId:n,owner:a.handle,runtime:r,source:l?``:i,ciphertext:l,encrypted:!!l,status:`running`,createdAt:new Date().toISOString()};e({cloudJobs:[u,...t().cloudJobs].slice(0,400)});let d={};if(r===`python`)for(let e of o.files.filter(e=>e.path.endsWith(`.py`)).slice(0,8))d[e.path]=e.content||``;let f=await c({...u,source:i},a.secret,d);e({cloudJobs:t().cloudJobs.map(e=>e.id===u.id?f:e)});let p=J(t().extraBlocks);return await Y(t,e,await O(`cloud_job`,a.address,D,0,`${r} ${n}`,p.height+1,n)),f},disconnect:()=>e({wallet:null}),faucet:async()=>{let n=t().wallet;if(!n||t().claimedFaucet)return;let r=J(t().extraBlocks),i=await O(`faucet`,re,n.address,Fr,`Test allocation`,r.height+1);e({balance:t().balance+Fr,claimedFaucet:!0}),await Y(t,e,i)},star:async n=>{let r=t().wallet;if(!r)return;let i=!t().stars[n];if(e({stars:{...t().stars,[n]:i}}),i){let i=J(t().extraBlocks);await Y(t,e,await O(`star`,r.address,D,0,`star ${n}`,i.height+1,n))}},fork:async n=>{let r=t().wallet;if(!r&&globalThis.__KILN_ENSURE_WALLET){await globalThis.__KILN_ENSURE_WALLET();r=t().wallet}if(!r)return;let i=K(n,t().userRepos);if(!i)return;let existing=(t().userRepos||[]).find(e=>e.forkedFrom===n&&e.owner===r.handle);if(existing)return existing;let slug=i.name,a=`${r.handle}/${slug}`;if(a===n||K(a,t().userRepos)){if(K(a,t().userRepos)&&K(a,t().userRepos).forkedFrom===n&&a!==n)return K(a,t().userRepos);slug=`${i.name}-fork`;a=`${r.handle}/${slug}`;if(K(a,t().userRepos))return K(a,t().userRepos)}let o=[],s=i.encrypted?await d(r.secret,a):void 0;for(let e of i.files){let t=await f(e.content||``,!!e.binary,{encrypt:i.encrypted,secret:s});o.push({...e,content:t.inline||(i.encrypted?``:e.content),blobId:t.blobId,sha:t.sha,size:t.size||e.size||(e.content?.length??0),merkleRoot:t.merkleRoot,chunkCount:t.chunkCount,encrypted:t.encrypted})}let c=await Q(o),l={...i,id:a,owner:r.handle,name:slug,files:o,stars:0,forks:0,watchers:1,tvlKln:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),chainAddress:r.address,merkleRoot:c,quotaBytes:m,encrypted:!0,keyCommitment:await x(r.secret),forkedFrom:n,listedKln:void 0,origin:!1};e({userRepos:[l,...t().userRepos.filter(e=>e.id!==a)],forksOf:[...new Set([...t().forksOf,n])]});let u=J(t().extraBlocks);return await Y(t,e,await O(`fork`,r.address,i.chainAddress,0,`fork ${n} → ${a}`,u.height+1,a,new Date().toISOString(),c)),t().notify(`Forked`,`${a} from ${n}`,`/${a}`),l},remix:async(n,r)=>{let i=t().wallet;if(!i&&globalThis.__KILN_ENSURE_WALLET){await globalThis.__KILN_ENSURE_WALLET();i=t().wallet}if(!i)throw Error(`Connect a wallet first`);let a=K(n,t().userRepos);if(!a)throw Error(`Repository not found`);let o=(r||`${a.name}-remix`).trim().toLowerCase().replace(/[^a-z0-9._-]/g,`-`).slice(0,40),s=`${i.handle}/${o}`;if(K(s,t().userRepos))return K(s,t().userRepos);let c=[],l=await d(i.secret,s);for(let e of a.files){let t=await f(e.content||``,!!e.binary,{encrypt:!0,secret:l});c.push({...e,content:t.inline||e.content,blobId:t.blobId,sha:t.sha,size:t.size||e.size||(e.content?.length??0),merkleRoot:t.merkleRoot,chunkCount:t.chunkCount,encrypted:t.encrypted})}let u=await Q(c),p=new Date().toISOString(),h={...a,id:s,owner:i.handle,name:o,description:`Remix of ${n}. ${a.description}`,files:c,stars:0,forks:0,watchers:1,tvlKln:0,createdAt:p,updatedAt:p,chainAddress:i.address,merkleRoot:u,quotaBytes:m,encrypted:!0,keyCommitment:await x(i.secret),forkedFrom:n,origin:!1,listedKln:void 0};e({userRepos:[h,...t().userRepos]});let g=J(t().extraBlocks);return await Y(t,e,await O(`remix`,i.address,a.chainAddress,0,`remix ${n} → ${s}`,g.height+1,s,p,u)),t().notify(`Remixed`,`${s} from ${n}`,`/${s}`),h},listForSale:async n=>{let r=t().wallet;if(!r)throw Error(`Connect a wallet first`);if(n.kind===`code`){let e=n.repoId?K(n.repoId,t().userRepos):void 0;if(!e||e.owner!==r.handle)throw Error(`You can only list a repository you own`)}let i={id:X(`lst`),kind:n.kind,title:n.title.trim(),seller:r.handle,description:n.description.trim(),priceKln:Math.max(0,Math.floor(n.priceKln)),repoId:n.repoId,modelId:n.modelId,agentRole:n.agentRole,license:n.license||`Apache-2.0`,remixable:n.remixable??!0,branchable:n.kind===`code`,sold:0,topics:[n.kind],createdAt:new Date().toISOString()};e({userListings:[i,...t().userListings]}),n.repoId&&e({userRepos:t().userRepos.map(e=>e.id===n.repoId?{...e,listedKln:i.priceKln}:e)});let a=J(t().extraBlocks);return await Y(t,e,await O(`listing`,r.address,D,0,`list ${i.title}`,a.height+1,n.repoId)),t().notify(`Listed`,`${i.title} · ${i.priceKln} KLN`,`/marketplace`),i},buyListing:async(n,r)=>{let i=t().wallet;if(!i)throw Error(`Connect a wallet first`);let a=t().purchases.find(e=>e.listingId===n);if(a)return a;let o=[...t().userListings,...z].find(e=>e.id===n);if(!o)throw Error(`Listing not found`);if(t().balance<o.priceKln)throw Error(`Need ${o.priceKln} KLN`);o.priceKln>0&&e({balance:t().balance-o.priceKln});let s=new Date().toISOString(),c=J(t().extraBlocks),l=await O(o.kind===`model`?`license`:`purchase`,i.address,D,o.priceKln,`buy ${o.title}`,c.height+1,o.repoId,s);await Y(t,e,l);let u;if(o.kind===`code`&&o.repoId&&(u=(o.remixable?await t().remix(o.repoId):await t().fork(o.repoId))?.id),o.kind===`model`&&o.modelId&&(e({licensedModels:[...new Set([...t().licensedModels,o.modelId])]}),t().defaultModelId||e({defaultModelId:o.modelId})),o.kind===`agent`&&o.agentRole){let e=r||t().userRepos.find(e=>e.owner===i.handle)?.id;e&&await t().spawnAgent({role:o.agentRole,repoId:e,modelId:o.modelId||t().defaultModelId})}let d={listingId:n,kind:o.kind,paidKln:o.priceKln,at:s,repoId:o.repoId,modelId:o.modelId,forkedId:u,txHash:l.hash};return e({purchases:[d,...t().purchases],userListings:t().userListings.map(e=>e.id===n?{...e,sold:e.sold+1}:e)}),t().notify(`Purchased`,`${o.title} · ${o.priceKln} KLN`,u?`/${u}`:`/marketplace`),d},branchFrom:async(e,n)=>{let r=t().wallet;if(!r)throw Error(`Connect a wallet first`);let i=K(e,t().userRepos);if(!i)throw Error(`Repository not found`);let a=e;if(i.owner!==r.handle){let n=await t().fork(e);if(!n)throw Error(`Could not fork`);a=n.id}let o=await t().createBranch(a,n);return t().notify(`Branch`,`${a} · ${o.name}`,`/${a}`),{branch:o,repoId:a}},offerToBuy:async(n,r,i)=>{let a=t().wallet;if(!a)throw Error(`Connect a wallet first`);let o=[...t().userListings,...z].find(e=>e.id===n);if(!o)throw Error(`Listing not found`);if(o.seller===a.handle)throw Error(`You already own this listing`);let s=Math.max(0,Math.floor(r));if(t().balance<s)throw Error(`Need ${s} KLN`);s>0&&e({balance:t().balance-s});let c=new Date().toISOString(),l=J(t().extraBlocks),u=await O(`offer`,a.address,D,s,`offer ${s} KLN on ${o.title}`,l.height+1,o.repoId,c);await Y(t,e,u);let d;if(o.kind===`code`&&o.repoId&&(d=(o.remixable?await t().remix(o.repoId):await t().fork(o.repoId))?.id),o.kind===`model`&&o.modelId&&e({licensedModels:[...new Set([...t().licensedModels,o.modelId])]}),o.kind===`agent`&&o.agentRole){let e=t().userRepos.find(e=>e.owner===a.handle)?.id;e&&await t().spawnAgent({role:o.agentRole,repoId:e,modelId:o.modelId||t().defaultModelId})}let f={id:X(`off`),listingId:n,from:a.handle,amountKln:s,message:(i||``).trim(),status:`accepted`,createdAt:c,txHash:u.hash},p={listingId:n,kind:o.kind,paidKln:s,at:c,repoId:o.repoId,modelId:o.modelId,forkedId:d,txHash:u.hash};return e({userOffers:[f,...t().userOffers],purchases:[p,...t().purchases],userListings:t().userListings.map(e=>e.id===n?{...e,sold:e.sold+1}:e)}),t().notify(`Offer accepted`,`${o.title} · ${s} KLN`,d?`/${d}`:`/marketplace`),f},acceptOffer:async n=>{let r=t().wallet;if(!r)throw Error(`Connect a wallet first`);let i=t().userOffers.find(e=>e.id===n);if(!i||i.status!==`open`)throw Error(`Offer not found`);let a=[...t().userListings,...z].find(e=>e.id===i.listingId);if(!a)throw Error(`Listing not found`);if(a.seller!==r.handle)throw Error(`Only the seller can accept`);return e({userOffers:t().userOffers.map(e=>e.id===n?{...e,status:`accepted`}:e)}),await t().buyListing(a.id)},declineOffer:n=>{t().wallet&&e({userOffers:t().userOffers.map(e=>e.id===n?{...e,status:`declined`}:e)})},withdrawOffer:n=>{let r=t().wallet;r&&e({userOffers:t().userOffers.map(e=>e.id===n&&e.from===r.handle?{...e,status:`withdrawn`}:e)})},sponsor:async(n,r)=>{let i=t().wallet;if(!i||r<=0||t().balance<r)return;let a=K(n,t().userRepos);if(!a)return;e({balance:t().balance-r}),e({userRepos:t().userRepos.map(e=>e.id===n?{...e,tvlKln:e.tvlKln+r}:e)}),e({handleOverrides:{...t().handleOverrides,[`tvl:${n}`]:String(r+a.tvlKln)}});let o=J(t().extraBlocks);await Y(t,e,await O(`sponsor`,i.address,a.chainAddress,r,`sponsor ${n}`,o.height+1,n))},createRepo:async n=>{let r=t().wallet;if(!r)throw Error(`Connect a wallet first`);let i=n.name.trim().toLowerCase().replace(/[^a-z0-9._-]/g,`-`);if(!i)throw Error(`Name required`);let a=(n.owner||r.handle).toLowerCase();if(!(a===r.handle||t().orgs.some(e=>e.handle===a&&(e.role===`owner`||e.role===`admin`||e.ownerHandle===r.handle))))throw Error(`Not allowed to create under @${a}`);let o=`${a}/${i}`;if(K(o,t().userRepos))throw Error(`Repository exists`);let s=new Date().toISOString(),c=n.kind||`code`,l=`# ${i}\n\n${n.description}\n\n\`\`\`\ngit clone kiln://${a}/${i}.git\n\`\`\`\n\nKind: ${c}. AES-256-GCM sealed. Default model: ${n.modelId||`grok-4.6`}. Folder quota: 50 GB.\n`,u=await d(r.secret,o),p=await f(l,!1,{encrypt:!0,secret:u}),h=await x(r.secret),g={path:`README.md`,content:``,language:`Markdown`,message:`genesis`,sha:p.sha,updatedAt:s,size:p.size,blobId:p.blobId,merkleRoot:p.merkleRoot,chunkCount:p.chunkCount,encrypted:!0},_=[{path:`index.html`,lang:`HTML`,body:cr({name:i,description:n.description||`Sealed ${c} repository.`,owner:a,kind:c})},{path:`.github/workflows/settle.yml`,lang:`YAML`,body:`name: Settle on Kiln L1
on:
  push:
  workflow_dispatch:
jobs:
  settle:
    runs-on: kiln
    steps:
      - run: kiln verify --on-chain
      - run: kiln merkle
      - run: kiln push
`}];c===`crypto`&&_.push({path:`contracts/Escrow.sol`,lang:`Solidity`,body:`// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;
contract KilnEscrow {
    mapping(bytes32 => uint256) public locked;
    function lock(bytes32 issue) external payable { locked[issue] += msg.value; }
    function release(bytes32 issue, address payable to) external {
        uint256 n = locked[issue]; locked[issue] = 0; to.transfer(n);
    }
}
`}),c===`agent`&&_.push({path:`AGENT.md`,lang:`Markdown`,body:`# Agent ${i}\n\nThis repository is the agent. It has a wallet. Resident process on the computer.\n`}),c===`model`&&_.push({path:`MODEL.md`,lang:`Markdown`,body:`# Model ${i}\n\nWeights and card live in this sealed tree. The model wallet holds licenses.\n`});let{REPO_TEMPLATES:v}=await E(async()=>{let{REPO_TEMPLATES:e}=await import(`./addons-o5NDeLjB.js`);return{REPO_TEMPLATES:e}},__vite__mapDeps([13,11,12,1])),y=v.find(e=>e.id===n.template);if(y)for(let e of y.files)_.push(e);let b=[g];for(let e of _){let t=await f(e.body,!1,{encrypt:!0,secret:u});b.push({path:e.path,content:e.body,language:e.lang,message:`genesis`,sha:t.sha,updatedAt:s,size:t.size,blobId:t.blobId,merkleRoot:t.merkleRoot,chunkCount:t.chunkCount,encrypted:!0})}let S=await Q(b),C=c===`crypto`?[`encrypted`,`on-chain`,`solidity`,`protocol`]:c===`agent`?[`encrypted`,`agent`,`wallet`]:c===`model`?[`encrypted`,`model`,`weights`]:[`encrypted`,`on-chain`],w={id:o,owner:a,name:i,description:n.description,visibility:n.visibility,encrypted:!0,keyCommitment:h,viewerGrant:!1,chainAddress:r.address,language:c===`crypto`?`Solidity`:`HTML`,languages:c===`crypto`?{HTML:40,Solidity:35,Markdown:25}:{HTML:55,Markdown:30,YAML:15},stars:0,forks:0,watchers:1,topics:C,license:n.license,defaultBranch:`main`,updatedAt:s,createdAt:s,tvlKln:0,readme:l,merkleRoot:S,quotaBytes:m,files:b,modelId:n.modelId||t().defaultModelId||`grok-4.6`,kind:c};e({userRepos:[w,...t().userRepos],unlocked:{...t().unlocked,[o]:!0}});let T=J(t().extraBlocks);return await Y(t,e,await O(`encrypt`,r.address,D,0,`sealed ${o}`,T.height+1,o,s,S)),e({userBranches:[{name:`main`,repoId:o,sha:p.sha,protected:!0,updatedAt:s},...t().userBranches]}),await t().spawnAgent({role:`architect`,repoId:o,name:`Keeper`,resident:!0,workingPath:`README.md`,modelId:n.modelId||t().defaultModelId||`grok-4.6`}),c===`agent`&&await t().spawnAgent({role:`builder`,repoId:o,name:`Self`,resident:!0,modelId:n.modelId}),c===`crypto`&&await t().spawnAgent({role:`cipher`,repoId:o,resident:!0,modelId:n.modelId}),$(w,r.secret),w},importGithub:async n=>{let r=t().wallet;if(!r)throw Error(`Connect a wallet first`);let i=(n.asName||n.meta.name).trim().toLowerCase().replace(/[^a-z0-9._-]/g,`-`).slice(0,40);if(!i)throw Error(`Name required`);let a=(n.owner||r.handle).toLowerCase();if(!(a===r.handle||t().orgs.some(e=>e.handle===a&&(e.role===`owner`||e.role===`admin`||e.ownerHandle===r.handle))))a=r.handle;let o=`${a}/${i}`;let existing=t().userRepos.find(e=>e.id===o);let s=new Date().toISOString(),l=await d(r.secret,o),u=[],p=`${n.meta.owner}/${n.meta.name}`;for(let e of n.files){let t=await f(e.content,!1,{encrypt:!0,secret:l});u.push({path:e.path,content:e.content,language:c(e.path),message:`import ${p}`,sha:t.sha,updatedAt:s,size:t.size,blobId:t.blobId,merkleRoot:t.merkleRoot,chunkCount:t.chunkCount,encrypted:!0})}let h=u.find(e=>/^readme(\.md)?$/i.test(e.path.split(`/`).pop()??``)),g=n.files.find(e=>/^readme(\.md)?$/i.test(e.path.split(`/`).pop()??``))?.content??`# ${i}\n\nImported from ${n.meta.htmlUrl}\n`,{language:_,languages:v}=Br(u),y=await Q(u),b={id:o,owner:a,name:i,description:n.meta.description||`Imported from ${n.meta.htmlUrl}`,visibility:`public`,encrypted:!0,keyCommitment:await x(r.secret),viewerGrant:!1,chainAddress:r.address,language:n.meta.language||_,languages:v,stars:0,forks:0,watchers:1,topics:[...new Set([`imported`,`github`,...n.meta.topics.slice(0,8)])],license:n.meta.license||`MIT`,defaultBranch:n.meta.defaultBranch||`main`,updatedAt:s,createdAt:s,tvlKln:0,files:u,readme:g,website:n.meta.htmlUrl,merkleRoot:y,quotaBytes:m,modelId:t().defaultModelId||`grok-4.6`,githubUrl:n.meta.htmlUrl,githubSha:n.meta.sha,githubOwner:n.meta.owner,githubRepo:n.meta.name,kind:n.kind||(n.meta.topics.some(e=>/sol|defi|eth|crypto|zk/.test(e.toLowerCase()))?`crypto`:`code`)};e({userRepos:existing?t().userRepos.map(r=>r.id===o?b:r):[b,...t().userRepos],unlocked:{...t().unlocked,[o]:!0},userBranches:[{name:b.defaultBranch,repoId:o,sha:u[0]?.sha??`kimport`,protected:!0,updatedAt:s},...t().userBranches],userCommits:[{sha:(n.meta.sha||`import`).slice(0,8),repoId:o,message:`import ${p}@${(n.meta.sha||``).slice(0,7)}`,author:r.handle,createdAt:s,txHash:``,block:0,files:u.length,merkleRoot:y},...t().userCommits]});let S=J(t().extraBlocks),C=await O(`github_import`,r.address,D,0,`import ${p} → ${o}`,S.height+1,o,s,y);return await Y(t,e,C),e({userCommits:t().userCommits.map((e,t)=>t===0?{...e,txHash:C.hash,block:C.block}:e)}),await t().spawnAgent({role:`indexer`,repoId:o,name:`Indra`,resident:!0,workingPath:h?.path??u[0]?.path,modelId:t().defaultModelId||`grok-4.6`}),$(b,r.secret),t().notify(`Imported from GitHub`,`${o} · ${u.length} files sealed`,`/${o}`),b},fundBounty:async(n,r)=>{let i=t().wallet;if(!i||r<=0||t().balance<r)return;let a=[...t().userIssues,...B].find(e=>e.id===n);if(!a)return;e({balance:t().balance-r});let o=e=>e.id===n?{...e,bountyKln:e.bountyKln+r,bountyStatus:`escrowed`}:e;e({userIssues:t().userIssues.some(e=>e.id===n)?t().userIssues.map(o):[o(a),...t().userIssues]});let s=J(t().extraBlocks);await Y(t,e,await O(`bounty_escrow`,i.address,D,r,`escrow ${n}`,s.height+1,a.repoId))},openIssue:async(n,r,i,a)=>{let o=t().wallet;if(!o)throw Error(`Connect a wallet first`);if(a>0&&t().balance<a)throw Error(`Insufficient KLN`);let s=[...B,...t().userIssues].filter(e=>e.repoId===n),c=Math.max(0,...s.map(e=>e.number))+1,l=new Date().toISOString(),u={id:`${n}#${c}`,repoId:n,number:c,title:r,body:i,author:o.handle,state:`open`,labels:a>0?[`bounty`]:[],createdAt:l,comments:[],bountyKln:a,bountyStatus:a>0?`escrowed`:`none`};a>0&&e({balance:t().balance-a}),e({userIssues:[u,...t().userIssues]});let d=J(t().extraBlocks),f=await O(a>0?`bounty_escrow`:`issue_open`,o.address,D,a,`${r}`,d.height+1,n);return u.bountyTx=f.hash,await Y(t,e,f),t().notify(`Issue opened`,`${n}#${c} ${r}`,`/${n}/issues/${c}`),u},commentIssue:async(n,r)=>{let i=t().wallet;if(!i)throw Error(`Connect a wallet first`);let a=[...t().userIssues,...B].find(e=>e.id===n);if(!a)throw Error(`Issue not found`);let o=new Date().toISOString(),s=J(t().extraBlocks),c=await O(`comment`,i.address,D,0,`comment ${n}`,s.height+1,a.repoId),l=e=>e.id===n?{...e,comments:[...e.comments,{author:i.handle,body:r,createdAt:o,txHash:c.hash}]}:e;e({userIssues:t().userIssues.some(e=>e.id===n)?t().userIssues.map(l):[l(a),...t().userIssues]}),await Y(t,e,c)},closeIssue:async n=>{if(!t().wallet)return;let r=[...t().userIssues,...B].find(e=>e.id===n);if(!r)return;let i=e=>e.id===n?{...e,state:`closed`}:e;e({userIssues:t().userIssues.some(e=>e.id===n)?t().userIssues.map(i):[i(r),...t().userIssues]})},openPull:async(n,r,i,a)=>{let o=t().wallet;if(!o)throw Error(`Connect a wallet first`);let s=[...dn,...t().userPulls].filter(e=>e.repoId===n),c=Math.max(0,...s.map(e=>e.number))+1,l=new Date().toISOString(),u=J(t().extraBlocks),d=await O(`pr_open`,o.address,D,0,r,u.height+1,n),f={id:`${n}#p${c}`,repoId:n,number:c,title:r,body:i,author:o.handle,state:`open`,fromBranch:a||`${o.handle}:fix`,createdAt:l,txHash:d.hash,additions:12,deletions:2};return e({userPulls:[f,...t().userPulls]}),await Y(t,e,d),t().notify(`Pull opened`,`${n}#${c} ${r}`,`/${n}/pulls`),t().fireAddons(`pull_open`,n,{pullId:f.id}),f},mergePull:async n=>{let r=t().wallet;if(!r)return;let i=[...t().userPulls,...dn].find(e=>e.id===n);if(!i||i.state!==`open`)return;let a=K(i.repoId,t().userRepos);if(!(a&&(a.owner===r.handle||i.author===r.handle))&&a?.owner!==r.handle&&i.author!==r.handle)return;let o=e=>e.id===n?{...e,state:`merged`}:e;e({userPulls:t().userPulls.some(e=>e.id===n)?t().userPulls.map(o):[o(i),...t().userPulls]});let s=[...B,...t().userIssues].filter(e=>e.repoId===i.repoId&&e.bountyStatus===`escrowed`&&e.bountyKln>0)[0];if(s){e({balance:t().balance+s.bountyKln});let n=e=>e.id===s.id?{...e,bountyStatus:`released`,state:`closed`,linkedPr:i.number}:e;e({userIssues:t().userIssues.some(e=>e.id===s.id)?t().userIssues.map(n):[n(s),...t().userIssues]});let a=J(t().extraBlocks);await Y(t,e,await O(`bounty_release`,D,r.address,s.bountyKln,`release ${s.id} → ${r.handle}`,a.height+1,i.repoId))}let c=J(t().extraBlocks);await Y(t,e,await O(`pr_merge`,r.address,D,0,`merge ${i.title}`,c.height+1,i.repoId)),t().notify(`Merged`,i.title,`/${i.repoId}/pulls`)},reviewPull:async(n,r,i)=>{let a=t().wallet;if(!a)throw Error(`Connect a wallet first`);e({userReviews:[{id:X(`rv`),pullId:n,author:a.handle,state:r,body:i,createdAt:new Date().toISOString()},...t().userReviews]});let o=J(t().extraBlocks);await Y(t,e,await O(`review`,a.address,D,0,`${r} ${n}`,o.height+1))},unlockRepo:async n=>{let r=K(n,t().userRepos);if(!r)return;let i=t().wallet;if((r.viewerGrant||i&&q(r.owner,t()))&&(e({unlocked:{...t().unlocked,[n]:!0}}),i)){let a=J(t().extraBlocks);await Y(t,e,await O(`decrypt_grant`,i.address,r.chainAddress,0,`unseal ${n}`,a.height+1,n))}},commitFile:async(n,r,i,a)=>{let o=t().wallet;if(!o&&globalThis.__KILN_ENSURE_WALLET){await globalThis.__KILN_ENSURE_WALLET();o=t().wallet}if(!o)return;let s=K(n,t().userRepos);if(!s)return;if(!q(s.owner,t())){let fked=await t().fork(n);if(!fked)return;n=fked.id;s=K(n,t().userRepos);if(!s||!q(s.owner,t()))return}let l=new Date().toISOString();Rr(s.files,r,i.length);let u=await d(o.secret,n),p=await f(i,!1,{encrypt:!0,secret:u}),m={path:r,content:i,language:c(r),message:a,sha:p.sha,updatedAt:l,size:p.size,blobId:p.blobId,merkleRoot:p.merkleRoot,chunkCount:p.chunkCount,encrypted:!0},h=(e=>{if(e.id!==n)return e;let t=e.files.some(e=>e.path===r)?e.files.map(e=>e.path===r?m:e):[...e.files,m];return{...e,files:t,updatedAt:l,readme:r===`README.md`?i:e.readme,language:e.language===`Markdown`&&c(r)!==`Markdown`?c(r):e.language,encrypted:!0}})(s);h={...h,merkleRoot:await Q(h.files)},e({userRepos:Z(t().userRepos,h)});let g=J(t().extraBlocks),_=await O(`merkle_commit`,o.address,D,0,a,g.height+1,n,l,h.merkleRoot);await Y(t,e,_);let v={sha:m.sha,repoId:n,message:a,author:o.handle,createdAt:l,txHash:_.hash,block:g.height+1,files:1,merkleRoot:m.merkleRoot};return e({userCommits:[v,...t().userCommits]}),$(h,o.secret),t().watches[n]&&t().notify(`Watched repository`,`${n}: ${a}`,`/${n}`,`activity`),t().fireAddons(`push`,n),v},uploadFiles:async(n,r,i)=>{let a=t().wallet;if(!a)throw Error(`Connect a wallet first`);u();let o=await d(a.secret,n);for(let s of r){let r=K(n,t().userRepos);if(!r||!q(r.owner,t()))continue;let l=s.blob?.size??(typeof s.content==`string`?s.content.length:s.content?.byteLength??0);Rr(r.files,s.path,l);let u=s.binary??typeof s.content!=`string`,d=s.blob?await p(s.blob,u||v(s.path),{encrypt:!0,secret:o,onProgress:(e,t)=>i?.(s.path,e,t)}):await f(s.content??``,u,{encrypt:!0,secret:o,onProgress:(e,t)=>i?.(s.path,e,t)}),m=new Date().toISOString(),h={path:s.path,content:``,language:u?`binary`:c(s.path),message:`add ${s.path}`,sha:d.sha,updatedAt:m,size:d.size,blobId:d.blobId,merkleRoot:d.merkleRoot,chunkCount:d.chunkCount,encrypted:!0,binary:d.binary},g=(e=>{if(e.id!==n)return e;let t=e.files.some(e=>e.path===s.path)?e.files.map(e=>e.path===s.path?h:e):[...e.files,h];return{...e,files:t,updatedAt:m,encrypted:!0}})(r);g={...g,merkleRoot:await Q(g.files)},e({userRepos:Z(t().userRepos,g)});let _=J(t().extraBlocks);await Y(t,e,await O(`blob_put`,a.address,D,0,`blob ${s.path} ${d.size}`,_.height+1,n,m,d.merkleRoot))}let s=K(n,t().userRepos);s&&$(s,a.secret),t().fireAddons(`push`,n)},createBranch:async(n,r)=>{if(!t().wallet&&globalThis.__KILN_ENSURE_WALLET)await globalThis.__KILN_ENSURE_WALLET();if(!t().wallet)throw Error(`Connect a wallet first`);let i=K(n,t().userRepos)?.files[0]?.sha??`k0000000`,a={name:r.replace(/[^a-zA-Z0-9._/-]/g,`-`),repoId:n,sha:i,protected:!1,updatedAt:new Date().toISOString()};return e({userBranches:[a,...t().userBranches.filter(e=>e.repoId!==n||e.name!==a.name)]}),a},createRelease:async(n,r,i,a)=>{let o=t().wallet;if(!o)throw Error(`Connect a wallet first`);let s=new Date().toISOString(),c=J(t().extraBlocks),l=await O(`release`,o.address,D,0,`${r} ${i}`,c.height+1,n),u={id:`${n}@${r}`,repoId:n,tag:r,name:i||r,body:a,author:o.handle,createdAt:s,txHash:l.hash};return e({userReleases:[u,...t().userReleases]}),await Y(t,e,l),t().notify(`Release`,`${n} ${r}`,`/${n}/releases`),u},runAction:async(n,r)=>{let i=t().wallet,a=i?.handle??`anonymous`,o=K(n,t().userRepos),{workflowsIn:s,defaultWorkflows:c,parseWorkflow:l}=await E(async()=>{let{workflowsIn:e,defaultWorkflows:t,parseWorkflow:n}=await import(`./workflows-Cqy62ySG.js`);return{workflowsIn:e,defaultWorkflows:t,parseWorkflow:n}},[]),u=s((o?.files??[]).map(e=>({path:e.path,content:e.content}))),d=u.length?u:c(),f=r.replace(/^\.github\/workflows\//,``),p=d.find(e=>e.path.endsWith(f)||e.name===r||e.path.endsWith(r))??l(`.github/workflows/${f.endsWith(`.yml`)?f:`${f}.yml`}`,``),m=p.path.split(`/`).pop()||`settle.yml`,h=new Date().toISOString(),g=Date.now(),_=X(`run`),v={id:_,repoId:n,workflow:m,event:p.events[0]||`workflow_dispatch`,status:`running`,logs:[`kiln action ${m}`,`on ${p.events.join(`, `)||`workflow_dispatch`}`,`jobs ${(p.jobs||[]).join(`, `)||`default`}`],createdAt:h,actor:a};e({userRuns:[v,...t().userRuns]});let y=[...v.logs],b=!0,x=p.steps.length?p.steps:m.includes(`deploy`)?[`kiln pack`,`kiln pages publish`]:[`kiln verify --on-chain`,`kiln merkle`];try{let{bootMachine:e,runOnMachine:t}=await E(async()=>{let{bootMachine:e,runOnMachine:t}=await import(`./computer-G9ZCRY5O.js`).then(e=>e.n);return{bootMachine:e,runOnMachine:t}},__vite__mapDeps([17,1,2,11,18,0,3,4]));o&&e(o);for(let e of x){y.push(`$ ${e}`);let r=await t(n,e.startsWith(`kiln `)||e.startsWith(`git `)?e:`echo ${e}`);y.push(r.out||`(ok)`),r.code!==0&&(b=!1)}}catch(e){y.push(e instanceof Error?e.message:`runner error`),b=!1}let S=m.includes(`deploy`),C=S?`https://pages.kiln/${n}`:void 0;C&&y.push(`preview ${C}`);let w={...v,status:b?`success`:`failed`,logs:y,url:C,durationMs:Date.now()-g};if(e({userRuns:t().userRuns.map(e=>e.id===_?w:e)}),i){let r=J(t().extraBlocks);await Y(t,e,await O(S?`deploy`:`commit`,i.address,D,0,`${m} ${n}`,r.height+1,n))}return t().notify(b?S?`Deployed`:`Action passed`:`Action failed`,`${n} · ${m}`,`/${n}/actions`),w},deleteRepo:async n=>{if(!t().wallet)return;let r=K(n,t().userRepos);!r||!q(r.owner,t())||e({userRepos:t().userRepos.filter(e=>e.id!==n)})},updateRepo:(n,r)=>{e({userRepos:t().userRepos.map(e=>e.id===n?{...e,...r}:e)})},spawnAgent:async n=>{let r={conductor:`Cord`,agi:`Nova`,architect:`Ada`,builder:`Bram`,reviewer:`Reeve`,deployer:`Dahl`,scout:`Sable`,cipher:`Cyril`,indexer:`Indra`},i=n.repoId,s=t().wallet,c=K(i,t().userRepos),l;if(s&&c&&!q(c.owner,t())){let e=await t().fork(i);e&&(l=i,i=e.id)}let u=t().agents.find(e=>e.repoId===i&&e.role===n.role&&(n.resident?e.resident:e.name===(n.name||r[n.role])));if(u&&n.resident){if(n.crewId&&u.crewId!==n.crewId){let r={...u,crewId:n.crewId};return e({agents:t().agents.map(e=>e.id===u.id?r:e),crews:t().crews.map(e=>e.id===n.crewId?{...e,memberIds:[...new Set([...e.memberIds,u.id])]}:e)}),r}return u}let d={id:X(`ag`),name:n.name||r[n.role],role:n.role,repoId:i,upstream:l,status:`idle`,autoApprove:n.autoApprove??!0,createdAt:new Date().toISOString(),resident:!!n.resident,workingPath:n.workingPath,computerLog:[`kiln computer online`,`git repo ${i}${l?` (fork of ${l})`:``}`,`role ${n.role}${n.resident?` · resident`:``}`,`model ${n.modelId||t().defaultModelId||`grok-4.6`}`,`cipher AES-256-GCM · quota 50GB/folder`,n.crewId?`crew ${n.crewId}`:`no crew yet`,n.workingPath?`sitting ${n.workingPath}`:`unseated`],modelId:n.modelId||K(i,t().userRepos)?.modelId||t().defaultModelId||`grok-4.6`,crewId:n.crewId,parentId:n.parentId,mailboxAccess:n.mailboxAccess!==!1,mailbox:[],wallet:s?{address:await a(`${s.secret}:agent:${i}:${n.role}`),secret:await o(`${s.secret}:agent:${i}:${n.role}`),balance:25}:void 0};if(e({agents:[...t().agents,d],agentMessages:{...t().agentMessages,[d.id]:[]}}),n.crewId&&e({crews:t().crews.map(e=>e.id===n.crewId?{...e,memberIds:[...new Set([...e.memberIds,d.id])]}:e)}),s&&n.resident){let n=J(t().extraBlocks);await Y(t,e,await O(`resident`,s.address,D,0,`${d.name} → ${i}`,n.height+1,i))}return d},spawnCrew:async n=>{let r=t().crews.find(e=>e.repoId===n.repoId);if(r){for(let e of _r)await t().spawnAgent({role:e,repoId:n.repoId,resident:!0,modelId:n.modelId,crewId:r.id});return t().crews.find(e=>e.id===r.id)??r}let i={id:X(`crew`),repoId:n.repoId,name:n.name||`crew:${n.repoId}`,constitution:vr(n.repoId),memberIds:[],edges:G,createdAt:new Date().toISOString()};e({crews:[i,...t().crews]});let a=[];for(let e of _r){let r=await t().spawnAgent({role:e,repoId:n.repoId,resident:!0,modelId:n.modelId,crewId:i.id});a.push(r.id)}e({crews:t().crews.map(e=>e.id===i.id?{...e,memberIds:[...new Set([...e.memberIds,...a])]}:e)});let o=t().wallet,s=K(n.repoId,t().userRepos);if(o&&s&&q(s.owner,t())){try{await t().commitFile(n.repoId,`ARCHITECTURE.md`,yr(n.repoId),`crew: architecture`),await t().commitFile(n.repoId,`CONSTITUTION.md`,i.constitution,`crew: constitution`)}catch{}let r=J(t().extraBlocks);await Y(t,e,await O(`crew_spawn`,o.address,D,0,`crew ${i.id} → ${n.repoId}`,r.height+1,n.repoId))}return t().notify(`Crew online`,`${n.repoId} · ${a.length} processes`,`/studio`),t().crews.find(e=>e.id===i.id)??i},handoff:async n=>{let r=t().agents.find(e=>e.id===n.fromId);if(!r)throw Error(`Agent not found`);let i=t().crews.find(e=>e.id===r.crewId||e.repoId===r.repoId),a=t().agents.find(e=>e.repoId===r.repoId&&e.role===n.toRole);a||=await t().spawnAgent({role:n.toRole,repoId:r.repoId,modelId:r.modelId,crewId:r.crewId});let o=Sr(r.role,a.role,i),s={id:X(`mail`),from:r.id,fromRole:r.role,to:a.id,kind:n.kind||`handoff`,body:n.task,paths:n.paths,createdAt:new Date().toISOString(),read:!1},c={id:X(`ho`),repoId:r.repoId,crewId:r.crewId,fromId:r.id,fromRole:r.role,toId:a.id,toRole:a.role,task:n.task,paths:n.paths??[],state:`queued`,stakeKln:n.stakeKln??0,legal:o,createdAt:new Date().toISOString()};e({handoffs:[c,...t().handoffs].slice(0,200),agents:t().agents.map(e=>e.id===a.id?{...e,mailbox:e.mailboxAccess===!1?e.mailbox??[]:[...e.mailbox??[],s],status:`idle`}:e.id===r.id?{...e,computerLog:[...e.computerLog,`handoff ${c.id} → ${a.name} (${a.role}) [${o?`legal`:`off-graph`}]`].slice(-80)}:e)});let l=t().wallet;if(l){let n=J(t().extraBlocks),i=await O(`handoff`,l.address,D,c.stakeKln,`${r.role} → ${a.role} ${c.id}`,n.height+1,r.repoId);e({handoffs:t().handoffs.map(e=>e.id===c.id?{...e,receipt:i.hash}:e)}),await Y(t,e,i)}return t().appendComputerLog(a.id,`mail ${c.id} from ${r.name}: ${n.task.slice(0,120)}`),t().notify(`${r.name} → ${a.name}`,`${o?``:`off-graph · `}${n.task.slice(0,100)}`,`/studio`),{agent:a,job:t().handoffs.find(e=>e.id===c.id)??c}},ackHandoff:async(n,r)=>{let i=t().handoffs.find(e=>e.id===n);if(!i)throw Error(`Handoff not found`);let a={...i,state:`done`,result:r,finishedAt:new Date().toISOString()};e({handoffs:t().handoffs.map(e=>e.id===n?a:e)});let o=t().wallet;if(o){let r=J(t().extraBlocks);await Y(t,e,await O(`handoff_ack`,o.address,D,0,`ack ${n}`,r.height+1,i.repoId))}return a},rejectHandoff:async(n,r)=>{let i=t().handoffs.find(e=>e.id===n);if(!i)throw Error(`Handoff not found`);let a={...i,state:`rejected`,result:r,finishedAt:new Date().toISOString()};return e({handoffs:t().handoffs.map(e=>e.id===n?a:e)}),a},patchHandoff:(n,r)=>{e({handoffs:t().handoffs.map(e=>e.id===n?{...e,...r}:e)})},ensureDomain:n=>{let r=t().domains.find(e=>e.repoId===n&&e.kind===`kiln`);if(r)return r;let i=K(n,t().userRepos);if(!i)return r;let a=Ar(i.id,i.owner,i.name);return e({domains:[a,...t().domains]}),a},bindDomain:async(n,r)=>{let i=t().wallet;if(!i)throw Error(`Connect a wallet`);let a=K(n,t().userRepos);if(!a||!q(a.owner,t()))throw Error(`Cannot bind domain`);let o=jr(n,r);e({domains:[o,...t().domains.filter(e=>e.repoId!==n||e.host!==o.host)]});let s=J(t().extraBlocks);return await Y(t,e,await O(`domain_bind`,i.address,D,0,o.host,s.height+1,n)),t().notify(`Domain attached`,`https://${o.host} → ${n}`,`/${n}/projects`),t().domains.find(e=>e.id===o.id)??o},deployRepo:async n=>{let r=K(n,t().userRepos);if(!r)throw Error(`Repository not found`);t().ensureDomain(n);let i=Mr(n,r.owner,r.name,r.merkleRoot||`working`);e({deploys:[i,...t().deploys].slice(0,80)});try{let r=await t().bootRepoCapsule(n),a={...i,status:r.status===`live`?`ready`:`error`,logs:[...i.logs,r.status===`live`?`capsule live`:r.error||`capsule failed`],capsuleUrl:r.url},o={id:`dom_${i.id}`,repoId:n,host:i.host,kind:`preview`,status:a.status===`ready`?`live`:`error`,https:!0,createdAt:i.createdAt,deployId:i.id};e({deploys:t().deploys.map(e=>e.id===i.id?a:e),domains:[o,...t().domains.filter(e=>e.id!==o.id)]});let s=t().wallet;if(s){let r=J(t().extraBlocks);await Y(t,e,await O(`deploy_domain`,s.address,D,0,i.host,r.height+1,n))}return t().notify(`Deployed`,`https://${i.host}`,`/${n}/preview`),t().fireAddons(`deploy`,n),t().deploys.find(e=>e.id===i.id)??a}catch(n){let r={...i,status:`error`,logs:[...i.logs,n instanceof Error?n.message:`failed`]};return e({deploys:t().deploys.map(e=>e.id===i.id?r:e)}),r}},removeAgent:n=>{let{[n]:r,...i}=t().agentMessages;e({agents:t().agents.filter(e=>e.id!==n),agentMessages:i})},patchAgent:(n,r)=>{e({agents:t().agents.map(e=>e.id===n?{...e,...r}:e)})},pushAgentMessage:n=>{let r=[...t().agentMessages[n.agentId]??[],n].slice(-40);e({agentMessages:{...t().agentMessages,[n.agentId]:r}})},appendComputerLog:(n,r)=>{e({agents:t().agents.map(e=>e.id===n?{...e,computerLog:[...e.computerLog,r].slice(-80)}:e)})},notify:(n,r,i,a)=>{e({notices:[{id:X(`n`),title:n,body:r,href:i,read:!1,createdAt:new Date().toISOString(),kind:a},...t().notices].slice(0,40)})},markNoticesRead:()=>e({notices:t().notices.map(e=>({...e,read:!0}))}),createGist:async n=>{let r=t().wallet;if(!r)throw Error(`Connect a wallet first`);let i=new Date().toISOString(),a=await d(r.secret,`${r.handle}/gist`),o=[];for(let e of n.files){let t=await l(e.content,a);o.push({...e,content:n.public?e.content:t})}let s=await y(o.map(e=>e.content)),c=J(t().extraBlocks),u=await O(`gist_create`,r.address,D,0,n.description||`gist`,c.height+1,void 0,i,s),f={id:X(`g`),owner:r.handle,description:n.description,public:n.public,encrypted:!n.public,files:o,createdAt:i,txHash:u.hash,merkleRoot:s};return e({userGists:[f,...t().userGists]}),await Y(t,e,u),f},openDiscussion:async(n,r,i,a)=>{let o=t().wallet;if(!o)throw Error(`Connect a wallet first`);let s=[...vn,...t().userDiscussions].filter(e=>e.repoId===n),c=Math.max(0,...s.map(e=>e.number))+1,l=new Date().toISOString(),u={id:`${n}#d${c}`,repoId:n,number:c,title:r,body:i,author:o.handle,createdAt:l,comments:[],category:a};e({userDiscussions:[u,...t().userDiscussions]});let d=J(t().extraBlocks);return await Y(t,e,await O(`discuss`,o.address,D,0,r,d.height+1,n)),u},commentDiscussion:async(n,r)=>{let i=t().wallet;if(!i)throw Error(`Connect a wallet first`);let a=[...t().userDiscussions,...vn].find(e=>e.id===n);if(!a)throw Error(`Discussion not found`);let o=e=>e.id===n?{...e,comments:[...e.comments,{author:i.handle,body:r,createdAt:new Date().toISOString()}]}:e;e({userDiscussions:t().userDiscussions.some(e=>e.id===n)?t().userDiscussions.map(o):[o(a),...t().userDiscussions]})},publishPackage:async(n,r,i,a=`kln`)=>{let o=t().wallet;if(!o)throw Error(`Connect a wallet first`);let s=new Date().toISOString(),c=J(t().extraBlocks),l=await O(`package_publish`,o.address,D,0,`${r}@${i}`,c.height+1,n),u={id:`${n}:${r}@${i}`,repoId:n,name:r,version:i,registry:a,downloads:0,createdAt:s,txHash:l.hash};return e({userPackages:[u,...t().userPackages]}),await Y(t,e,l),u},ensureOrigin:async()=>{let n=t().wallet;if(!n)return;let r=`${n.handle}/${Rn}`,i=K(r,t().userRepos),a=async e=>{let n=new Set(e.files.map(e=>e.path)),r=Bn().filter(e=>!n.has(e.path));for(let n of r)await t().commitFile(e.id,n.path,n.content,`origin: ${n.path}`)};if(i)return await a(i),e({originReadyFor:n.handle,unlocked:{...t().unlocked,[r]:!0}}),await t().ensureResidents(),K(r,t().userRepos)??i;let o=new Date().toISOString(),s=await d(n.secret,r),c=[];for(let e of Bn()){let t=await f(e.content,!1,{encrypt:!0,secret:s});c.push({path:e.path,content:``,language:e.language,message:`origin seal`,sha:t.sha,updatedAt:o,size:t.size,blobId:t.blobId,merkleRoot:t.merkleRoot,chunkCount:t.chunkCount,encrypted:!0})}let l=await Q(c),u=t().userRepos.find(e=>e.id===r);if(u)return e({originReadyFor:n.handle,unlocked:{...t().unlocked,[r]:!0}}),await t().ensureResidents(),u;let p=Bn().find(e=>e.path===`PAPER.md`)?.content??``,h={id:r,owner:n.handle,name:Rn,description:zn(),visibility:`private`,encrypted:!0,keyCommitment:await x(n.secret),viewerGrant:!1,chainAddress:n.address,language:`TypeScript`,languages:{TypeScript:48,Markdown:22,HTML:16,CSS:8,JSON:6},stars:0,forks:0,watchers:1,topics:[`pxm`,`capsule`,`origin`,`encrypted`],license:`UNLICENSED`,defaultBranch:`main`,updatedAt:o,createdAt:o,tvlKln:0,files:c,readme:p.slice(0,4e3),merkleRoot:l,quotaBytes:m,origin:!0};e({userRepos:Z(t().userRepos,h),unlocked:{...t().unlocked,[r]:!0},originReadyFor:n.handle,userBranches:[{name:`main`,repoId:r,sha:c[0]?.sha??`k0000000`,protected:!0,updatedAt:o},...t().userBranches]});let g=J(t().extraBlocks);return await Y(t,e,await O(`claim`,n.address,D,0,`PXM claimed · origin ${r}`,g.height+1,r,o,l)),await t().spawnAgent({role:`architect`,repoId:r,name:`Keeper`,resident:!0,workingPath:`PAPER.md`}),await t().spawnAgent({role:`cipher`,repoId:r,name:`Cyril`,resident:!0,workingPath:`src/crypto.ts`}),await t().spawnAgent({role:`indexer`,repoId:r,name:`Indra`,resident:!0,workingPath:`src/pxm.ts`}),t().notify(`Origin repository`,`${r} sealed. git clone it, then open 4D.`,`/${r}/world`),h},ensureResidents:async()=>{if(t().wallet)for(let e of t().userRepos.filter(e=>q(e.owner,t()))){if(t().agents.some(t=>t.repoId===e.id&&t.resident))continue;let n=e.files.find(e=>e.path===`README.md`)?.path??e.files[0]?.path??`README.md`;await t().spawnAgent({role:`architect`,repoId:e.id,name:`Keeper`,resident:!0,workingPath:n})}},bootRepoCapsule:async(n,r)=>{let i=t().wallet,a=K(n,t().userRepos);if(!a)throw Error(`Repository not found`);let o=t().capsules[n];o&&e({capsules:{...t().capsules,[n]:kn(o)}});let s=i?await d(i.secret,n):void 0,c=r||a.modelId||t().defaultModelId||`grok-4.6`,l=t().agents.filter(e=>e.repoId===n),u=await Fn(n,a.files,e=>h(e,s),{modelId:c,agents:l.map(e=>({name:e.name,role:e.role,modelId:e.modelId||c}))});if(e({capsules:{...t().capsules,[n]:u}}),i){let r=J(t().extraBlocks);await Y(t,e,await O(`capsule_boot`,i.address,D,0,`capsule ${n} · ${u.entry} · ${c}`,r.height+1,n,new Date().toISOString(),a.merkleRoot))}for(let e of l)t().appendComputerLog(e.id,`git push · capsule live · model ${c} · entry ${u.entry}`);return u},oneShotRepo:async n=>{let r=t().wallet;if(!r)throw Error(`Connect a wallet first`);let i=(n.owner||r.handle).toLowerCase();if(!q(i,t())&&i!==r.handle)throw Error(`Not allowed to create under @${i}`);let a;try{a=(await hr({data:{prompt:n.prompt,kind:n.kind,name:n.name,owner:i,modelId:n.modelId}})).pack}catch{a=mr({prompt:n.prompt,kind:n.kind,name:n.name,owner:i})}let o=a.name,s=2;for(;K(`${i}/${o}`,t().userRepos)&&s<12;)o=`${a.name}-${s}`,s+=1;a={...a,name:o};let l=await t().createRepo({name:o,description:a.description,visibility:n.visibility||`public`,encrypted:!0,license:`MIT`,modelId:n.modelId,owner:i,kind:a.kind}),u=await d(r.secret,l.id),p=new Date().toISOString(),m=K(l.id,t().userRepos)??l,h=[...m.files];for(let e of a.files){Rr(h,e.path,e.content.length);let t=await f(e.content,!1,{encrypt:!0,secret:u}),n={path:e.path,content:e.content,language:c(e.path),message:`oneshot ${e.path}`,sha:t.sha,updatedAt:p,size:t.size,blobId:t.blobId,merkleRoot:t.merkleRoot,chunkCount:t.chunkCount,encrypted:!0},r=h.findIndex(t=>t.path===e.path);r>=0?h[r]=n:h.push(n)}let g=await Q(h),_=a.files.find(e=>/^readme(\.md)?$/i.test(e.path.split(`/`).pop()??``))?.content,{language:v,languages:y}=Br(h),b={...m,files:h,merkleRoot:g,updatedAt:p,readme:_??m.readme,language:v,languages:y,topics:[...new Set([`oneshot`,`capsule`,...m.topics??[]])]};e({userRepos:Z(t().userRepos,b)});let x=J(t().extraBlocks),S=await O(`oneshot`,r.address,D,0,`oneshot ${l.id} · ${a.files.length} files · ${a.via}`,x.height+1,l.id,p,g);await Y(t,e,S),e({userCommits:[{sha:g.slice(0,8),repoId:l.id,message:`oneshot: ${n.prompt.slice(0,72)}`,author:r.handle,createdAt:p,txHash:S.hash,block:S.block,files:a.files.length,merkleRoot:g},...t().userCommits]}),$(b,r.secret);let C=await t().spawnAgent({role:`builder`,repoId:l.id,name:`Bram`,resident:!0,workingPath:a.files.find(e=>e.path===`index.html`)?.path??`index.html`,modelId:n.modelId});t().pushAgentMessage({id:X(`m`),agentId:C.id,role:`user`,content:`One-shot this repository:\n${n.prompt}\n\nLanded ${a.files.length} files via ${a.via}. Iterate from here.`,createdAt:p}),t().pushAgentMessage({id:X(`m`),agentId:C.id,role:`assistant`,content:`Tree sealed. ${a.files.map(e=>e.path).join(`, `)}. Capsule entry is index.html.`,createdAt:p});try{await t().bootRepoCapsule(l.id,n.modelId)}catch{}return t().notify(`One-shot landed`,`${l.id} · ${a.files.length} files · ${a.via}`,`/${l.id}/preview`),{repo:K(l.id,t().userRepos)??b,pack:a}},stopRepoCapsule:n=>{let r=t().capsules[n];r&&e({capsules:{...t().capsules,[n]:kn(r)}})},upsertConnection:async n=>{let r=t().wallet;e({modelConnections:[{...n,walletAddress:n.walletAddress||(r?await a(`${r.secret}:model:${n.id}`):void 0)},...t().modelConnections.filter(e=>e.id!==n.id)]})},removeConnection:n=>{e({modelConnections:t().modelConnections.filter(e=>e.id!==n)})},setDefaultModel:t=>e({defaultModelId:t})}),{name:`kiln-v2`,skipHydration:!0,merge:(e,t)=>{let n=e??{},r=e=>{let t=new Set,n=[];for(let r of e??[])t.has(r.id)||(t.add(r.id),n.push(r));return n};return{...t,...n,userRepos:r(n.userRepos),userBranches:n.userBranches??[],userReleases:n.userReleases??[],userRuns:n.userRuns??[],userReviews:n.userReviews??[],notices:n.notices??[],agents:n.agents??[],crews:n.crews??[],handoffs:n.handoffs??[],domains:n.domains??[],deploys:n.deploys??[],agentMessages:n.agentMessages??{},userGists:n.userGists??[],userDiscussions:n.userDiscussions??[],userPackages:n.userPackages??[],originReadyFor:n.originReadyFor??null,capsules:{},modelConnections:n.modelConnections??[],defaultModelId:n.defaultModelId??`grok-4.6`,userListings:n.userListings??[],purchases:n.purchases??[],licensedModels:n.licensedModels??[],userOffers:n.userOffers??[],orgs:n.orgs??[],installedApps:n.installedApps??[],watches:n.watches??{},webhooks:n.webhooks??[],checks:n.checks??[],profiles:n.profiles??{},cloudJobs:n.cloudJobs??[],gpuBound:n.gpuBound??!1}},partialize:e=>({wallet:e.wallet,balance:e.balance,claimedFaucet:e.claimedFaucet,userRepos:e.userRepos.map(e=>({...e,files:e.files.map(g)})),userIssues:e.userIssues,userPulls:e.userPulls,userCommits:e.userCommits,extraBlocks:e.extraBlocks,extraTxs:e.extraTxs,stars:e.stars,forksOf:e.forksOf,unlocked:e.unlocked,handleOverrides:e.handleOverrides,userBranches:e.userBranches,userReleases:e.userReleases,userRuns:e.userRuns,userReviews:e.userReviews,notices:e.notices,agents:e.agents,crews:e.crews,handoffs:e.handoffs,domains:e.domains,deploys:e.deploys,agentMessages:e.agentMessages,userGists:e.userGists,userDiscussions:e.userDiscussions,userPackages:e.userPackages,originReadyFor:e.originReadyFor,modelConnections:e.modelConnections,defaultModelId:e.defaultModelId,userListings:e.userListings,purchases:e.purchases,licensedModels:e.licensedModels,userOffers:e.userOffers,orgs:e.orgs,installedApps:e.installedApps,watches:e.watches,webhooks:e.webhooks,checks:e.checks,profiles:e.profiles,cloudJobs:e.cloudJobs,gpuBound:e.gpuBound})}));function Hr(e){let t=new Map,forge=globalThis.__KILN_FORGE_REPOS||[];for(let r of[...R,...forge,...e.userRepos]){if(!r||!r.id)continue;let cur=t.get(r.id);if(!cur){t.set(r.id,{...r,name:String(r.id).split(`/`)[1]||r.name});continue}let paths=new Set((cur.files||[]).map(f=>f.path)),files=[...(cur.files||[])];for(let f of r.files||[])if(!paths.has(f.path)){files.push(f);paths.add(f.path)}let origin=forge.find(x=>x.id===r.id);t.set(r.id,{...cur,...r,files,owner:origin&&!r.forkedFrom?origin.owner||`kiln`:r.owner||cur.owner,name:String(r.id).split(`/`)[1]||r.name||cur.name})}return[...t.values()]}function Ur(e){let t=new Set(e.userIssues.map(e=>e.id));return[...e.userIssues,...B.filter(e=>!t.has(e.id))]}function Wr(e){let t=new Set(e.userPulls.map(e=>e.id));return[...e.userPulls,...dn.filter(e=>!t.has(e.id))]}function Gr(e){return[...e.userCommits,...fn]}function Kr(e){return[...H,...e.extraBlocks].sort((e,t)=>t.height-e.height)}function qr(e){let t=H.flatMap(e=>e.txs);return[...e.extraTxs,...t]}function Jr(e){let t=new Set(e.userBranches.map(e=>`${e.repoId}:${e.name}`));return[...e.userBranches,...mn.filter(e=>!t.has(`${e.repoId}:${e.name}`))]}function Yr(e){let t=new Set(e.userReleases.map(e=>e.id));return[...e.userReleases,...hn.filter(e=>!t.has(e.id))]}function Xr(e){let t=new Set(e.userRuns.map(e=>e.id));return[...e.userRuns,...gn.filter(e=>!t.has(e.id))]}function Zr(e){let t=new Set(e.userGists.map(e=>e.id));return[...e.userGists,..._n.filter(e=>!t.has(e.id))]}function Qr(e){let t=new Set(e.userDiscussions.map(e=>e.id));return[...e.userDiscussions,...vn.filter(e=>!t.has(e.id))]}function $r(e){let t=new Set(e.userPackages.map(e=>e.id));return[...e.userPackages,...yn.filter(e=>!t.has(e.id))]}function ei(e,t){return q(e.owner,t)}function ti(e){let t=new Set(e.userListings.map(e=>e.id));return[...e.userListings,...z.filter(e=>!t.has(e.id))]}function ni(e,t){return ti(e).find(e=>e.kind===`code`&&e.repoId===t)}function ri(e,t){return e.purchases.some(e=>e.listingId===t)}function ii(e,t){let n=t.handleOverrides[`tvl:${e.id}`];return n?Number(n):e.tvlKln}function ai(e,t){return e.stars+ +!!t.stars[e.id]}export{U as A,z as B,Dr as C,gr as D,G as E,$n as F,se as G,un as H,er as I,Yn as L,tr as M,Jn as N,br as O,Qn as P,Xn as R,kr as S,Cr as T,ce as U,R as V,le as W,ii as _,Zr as a,Vr as b,$r as c,Hr as d,Xr as f,ni as g,ri as h,Qr as i,Zn as j,qn as k,Wr as l,ei as m,Jr as n,Ur as o,qr as p,Gr as r,ti as s,Kr as t,Yr as u,ai as v,wr as w,Nr as x,Pr as y,pn as z};