/**
 * Kiln L1 Ripple — the settlement contract.
 * Parent hash + monotonic height. Ciphertext stays off-chain.
 * Methods: merkle_commit, account_open, computer_boot, remember, github_import, resident.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { signLedger, verifyLedger, walletByAddress, PQ } from "./kiln-wallet.mjs";
import { publicFromSecret } from "./kiln-pq.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "l1.json");

export const RIPPLE_CONTRACT = {
  name: "KilnRipple",
  version: "1",
  address: "0x4c1e7a91b0c3d2e8f5a6478901234567890abcde",
  genesisHeight: 1848,
  genesisHash: "0xblk1848aa11bb22cc33dd44ee55ff06070809",
  methods: ["merkle_commit", "account_open", "computer_boot", "remember", "github_import", "resident", "claim", "fork", "badge_mint", "vault_open", "orchestrator_seat", "orchestrator_repl", "repo_create", "mind_learn", "harden", "session_revoke", "base_write", "base_open", "wallet_pq", "passport_mint", "ingest_write"],
};

function sha(s) {
  return "0x" + crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 48);
}

function emptyChain() {
  return {
    contract: RIPPLE_CONTRACT,
    height: RIPPLE_CONTRACT.genesisHeight,
    head: RIPPLE_CONTRACT.genesisHash,
    blocks: [],
    txs: [],
  };
}

export function loadRipple() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  let chain = emptyChain();
  try {
    chain = { ...emptyChain(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    /* genesis */
  }
  if (!Array.isArray(chain.blocks)) chain.blocks = [];
  if (!Array.isArray(chain.txs)) chain.txs = [];
  const maxH = chain.blocks.reduce((m, b) => Math.max(m, Number(b?.height) || 0), 0);
  chain.height = Math.max(Number(chain.height) || 0, maxH, RIPPLE_CONTRACT.genesisHeight);
  chain.head = chain.head || chain.blocks.at(-1)?.hash || RIPPLE_CONTRACT.genesisHash;
  chain.contract = RIPPLE_CONTRACT;
  return chain;
}

function persist(chain) {
  const slim = {
    contract: RIPPLE_CONTRACT,
    height: chain.height,
    head: chain.head,
    blocks: (chain.blocks || []).slice(-400),
    txs: (chain.txs || []).slice(-2000),
  };
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(slim));
  fs.renameSync(tmp, FILE);
  return slim;
}

export function rippleStatus() {
  const c = loadRipple();
  return {
    ok: true,
    contract: RIPPLE_CONTRACT,
    height: c.height,
    head: c.head,
    blocks: (c.blocks || []).slice(-24),
    txs: (c.txs || []).slice(-40),
  };
}

export function settleRipple(input = {}) {
  const chain = loadRipple();
  const txIn = input.tx && typeof input.tx === "object" ? input.tx : input;
  const type = String(txIn.type || input.type || "merkle_commit").slice(0, 40);
  const from = String(txIn.from || input.from || RIPPLE_CONTRACT.address);
  const to = String(txIn.to || input.to || RIPPLE_CONTRACT.address);
  const repoId = String(txIn.repoId || input.repoId || "");
  const merkleRoot = String(txIn.merkleRoot || input.merkleRoot || "");
  const memo = String(txIn.memo || input.memo || type).slice(0, 240);
  const height = chain.height + 1;
  const parent = chain.head || RIPPLE_CONTRACT.genesisHash;
  const timestamp = String(txIn.timestamp || input.timestamp || new Date().toISOString());
  const secret = String(txIn.secret || input.secret || "");
  const tx = {
    type,
    from,
    to,
    amount: 0,
    memo,
    repoId,
    merkleRoot,
    timestamp,
    block: height,
    hash: sha(`${type}:${from}:${repoId}:${merkleRoot}:${height}:${timestamp}`),
  };
  if (txIn.sig) tx.sig = txIn.sig;
  if (txIn.pq) tx.pq = txIn.pq;
  if (txIn.alg) tx.alg = txIn.alg;
  if (secret && !tx.sig) {
    try {
      const signed = signLedger(secret, tx);
      tx.sig = signed.sig;
      tx.pq = signed.address;
      tx.alg = PQ.dsa;
    } catch {
      /* unsigned still settles; merkle is the proof */
    }
  }
  if (tx.sig) {
    let pub = null;
    if (secret) {
      try {
        pub = publicFromSecret(secret).dsaPublicKey;
      } catch {
        pub = null;
      }
    }
    if (!pub) {
      const w = walletByAddress(from) || walletByAddress(tx.pq) || null;
      pub = w?.dsaPublicKey || null;
    }
    if (!pub) return { ok: false, error: "unknown pq seat" };
    const v = verifyLedger(tx, pub);
    if (!v.ok) return { ok: false, error: "bad ml-dsa" };
    tx.alg = tx.alg || PQ.dsa;
  }
  const block = {
    height,
    parent,
    timestamp,
    txs: [tx],
    hash: sha(`${parent}:${height}:${tx.hash}`),
    contract: RIPPLE_CONTRACT.address,
  };
  chain.blocks = [...chain.blocks, block];
  chain.txs = [...chain.txs, tx];
  chain.height = height;
  chain.head = block.hash;
  persist(chain);
  return { ok: true, height, hash: block.hash, tx: tx.hash, parent, contract: RIPPLE_CONTRACT.address };
}
