import{n as e,t}from"./fs-ri9Mkfbm.js";import{a as n,i as r,n as i,o as a,r as o}from"./claims-guc5PfuL.js";var s=i,c=o,l=e,u=t,d=[{slug:`pxm`,id:`KILN-WP-01`,title:`Pixelated eXecution Memory`,running:`A Hilbert-mapped Merkle lattice for sealed, agent-occupied, capsule-bootable source deposits.`,date:`${c}-09`,doi:`10.5281/zenodo.kiln-pxm-2026`,keywords:[`PXM`,`Hilbert`,`Merkle`,`source memory`,`occupancy`],abstract:`Source forges treat a repository as a bag of blobs. Scientific repositories treat a record as a frozen 50 GB deposit. Neither is a place an agent can sit, and neither is a place a website can live. Pixelated eXecution Memory (PXM) paints 4 MiB AES-256-GCM leaves onto a Hilbert lattice. Agents occupy cells. A capsule is a connected region plus an isolated runtime. A repository is four-dimensional: Hilbert x, Hilbert y, folder depth, chain height.`,related:[`deposit`,`seal`,`capsule`,`rebel`],body:n.replace(/^# Pixelated eXecution Memory\n+/,``)},{slug:`seal`,id:`KILN-WP-02`,title:`Client-Sealed Vaults`,running:`AES-256-GCM at the chunk, HKDF-bound vault keys, and key commitments that never reveal the secret.`,date:`${c}-09`,doi:`10.5281/zenodo.kiln-seal-2026`,keywords:[`AES-256-GCM`,`HKDF`,`client-side encryption`,`OPFS`,`key commitment`],abstract:`Private source on GitHub is an ACL. Private source on KILN is ciphertext. Every vault derives a per-repo key in the browser from the wallet secret. Every 4 MiB slice is sealed with AES-256-GCM before it touches OPFS or IndexedDB. Only a SHA-256 key commitment and a Merkle root of ciphertext leaves settle on Kiln L1. This paper specifies the construction, the threat model, and the honest limits of a browser-resident vault.`,related:[`pxm`,`l1`,`deposit`],body:`# Client-Sealed Vaults

**${s} / KILN · ${c} · Working paper KILN-WP-02**

## Abstract

Access control is not encryption. A private GitHub repository is plaintext on a server, gated by an account. A KILN vault is ciphertext in the client. The key is derived in the browser from a wallet secret bound to the repository identifier. Chunks encrypt before they are written to origin storage. The chain sees a commitment, not a secret.

This paper specifies the seal: key derivation, AES-256-GCM wire format, Merkle of ciphertext, threat model, and the engines as they run.

## 1. Motivation

A forge that hosts agent-written source cannot treat "private" as a row in an ACL table. Agents write continuously. Collaborators join by invite. The blast radius of a server compromise must be ciphertext, not the lab's work.

We require:

1. The vault key never leaves the device that generated the wallet.
2. Encryption happens before persistence, not as a later pass.
3. Public metadata (paths, sizes, Merkle roots) is enough to prove a write without revealing bytes.
4. Unlocking is a local operation: the same wallet that sealed the tree can unseal it.

## 2. Prior art

### 2.1 Server-side encryption at rest

Object stores encrypt disks with a provider key. The provider can decrypt. This is confidentiality against a stolen platter, not against the host.

### 2.2 git-crypt, age, Tarsnap

git-crypt filters tracked files. age and Tarsnap encrypt blobs with user keys. None of these is the default of a source forge, none paints ciphertext onto a spatial memory, and none settles a Merkle root of sealed chunks as a chain transaction.

### 2.3 E2EE messengers

Signal's protocol (X3DH, Double Ratchet) is the gold standard for messages. Source trees are not sessions: they are large, chunked, and content-addressed. We steal the axiom — keys on the device — and apply it to deposits.

## 3. Construction

### 3.1 Wallet secret

On connect, KILN generates a 256-bit secret (or imports a 64-char hex). The public handle is a SHA-256 truncation of the secret. The address is a commitment, not the key.

\`\`\`
secret ← {0,1}^256
handle = slug(SHA-256(secret))
address = SHA-256("kiln-key:" || secret)[0..40]
\`\`\`

The secret persists in the origin (zustand persist, this browser). It is not uploaded. Importing the same secret on another device reconstitutes the same wallet.

### 3.2 Per-vault key

A vault key is bound to both the wallet and the repository:

\`\`\`
K_vault = SHA-256("kiln-vault:" || walletSecret || repoId)
\`\`\`

This is an HKDF-equivalent extract: one SHA-256 over a domain-separated tuple. Distinct repos under the same wallet have distinct keys. Compromising one vault ciphertext does not unlock another.

The AES-256 key is \`SHA-256(K_vault)\` imported as a raw CryptoKey with usages encrypt/decrypt, extractable false.

### 3.3 Chunk seal

Files stream in 4 MiB slices (\`File.slice\`). Each slice:

1. Draw a 12-byte IV from \`crypto.getRandomValues\`.
2. AES-256-GCM encrypt the plaintext slice.
3. Persist wire format \`IV || ciphertext || 16-byte tag\` to OPFS (IndexedDB fallback).
4. SHA-256 the sealed bytes. That digest is the Merkle leaf.

Text files below the inline threshold may seal as \`v1:ivHex:cipherHex\` for editor round-trips. Binary and large files never inline.

### 3.4 What the chain sees

A \`merkle_commit\` transaction carries:

- sender address (key commitment)
- repo id
- Merkle root of sealed leaves
- memo (commit message)
- amount 0

No key, no plaintext, no IV. Verification is: recompute the Merkle root from advertised leaf hashes and check equality.

### 3.5 Unseal

Unseal is local. The wallet secret plus repo id reconstitutes \`K_vault\`. Chunks decrypt in order and concatenate. If GCM tag check fails, the chunk is discarded and the file is reported corrupt — we do not "best effort" decrypt.

## 4. Threat model

| Adversary | Sees | Cannot |
|---|---|---|
| Network observer | Public metadata, Merkle roots, chain txs | Plaintext, vault key |
| Origin storage thief (this browser profile) | Ciphertext blobs, leaf hashes | Plaintext without the wallet secret |
| Kiln L1 replica | Commitments | Keys |
| Malicious collaborator with viewer grant | What you granted | Other vaults |
| XSS on this origin | Whatever the page can read | Nothing — this is the residual risk |

**Residual risk.** Any web origin that can run script as the user can read IndexedDB and the persisted wallet. The seal is not a substitute for origin isolation. We request \`navigator.storage.persist()\` so eviction is less likely; we cannot make the browser a hardware token.

**Honest non-claims.** We do not claim post-quantum public-key encryption in this working paper. AES-256-GCM is the bulk cipher. Wallet secrets are high-entropy; they are not passwords. There is no recovery email. Lose the secret, lose the plaintext.

## 5. Properties

1. **Client-sealed.** Ciphertext exists before OPFS write.
2. **Domain-separated keys.** Vault keys cannot be reused across repos.
3. **Committing.** GCM tags bind IV and ciphertext; a flipped bit fails closed.
4. **Publicly auditable writes.** Merkle roots on L1 are world-readable proofs that a tree changed, without revealing the tree.
5. **Default on.** New vaults seal. Open trees are an explicit opt-out, not the product.

## 6. Engines

- \`src/lib/kiln/crypto.ts\` — \`vaultSecret\`, \`encryptBytes\`, \`decryptBytes\`, \`keyCommitment\`.
- \`src/lib/kiln/fs.ts\` — 4 MiB streaming, OPFS-first, quota.
- \`src/lib/kiln/merkle.ts\` — binary SHA-256 Merkle over sealed leaves.

They run in this forge. They also seal into \`{handle}/kiln\` as source.

## 7. Closing

A private repo that the host can read is not private. KILN's default is ciphertext at rest, keys on the device, proofs on the chain. That is the seal.

— ${s}, ${c}
`},{slug:`l1`,id:`KILN-WP-03`,title:`Kiln L1: Merkle-Native Source Control`,running:`Hash-linked blocks, merkle_commit transactions, and git-shaped history that settles as a chain.`,date:`${c}-09`,doi:`10.5281/zenodo.kiln-l1-2026`,keywords:[`blockchain`,`Merkle`,`git`,`commit`,`escrow`],abstract:`Git is a Merkle DAG of plaintext trees. Blockchains are Merkle ledgers of value. Kiln L1 is the composition: every write is a transaction, every transaction lands in a hash-linked block, and the object of the transaction is a Merkle root of sealed source. Bounties, sponsorships, and faucet drops are the same ledger. This paper specifies the chain, the transaction types, and what is claimed versus what is still a local replica.`,related:[`seal`,`kln`,`pxm`],body:`# Kiln L1: Merkle-Native Source Control

**${s} / KILN · ${c} · Working paper KILN-WP-03**

## Abstract

Git proves history to anyone who clones the objects. It does not prove payment, and it does not encrypt. A public chain proves payment and can timestamp a hash, but it is not a working tree. Kiln L1 is a ledger whose native object is a source commitment: \`merkle_commit\`, \`blob_put\`, \`bounty\`, \`escrow\`, \`sponsor\`, \`faucet\`.

This paper records the construction running in this forge, including the honest statement that this instance is a client-resident replica of the protocol — a chain you can see, query, and extend — not a globally-replicated proof-of-work network.

## 1. Why a chain, not just git

A GitHub clone with a token overlay still has two systems: git for history, a database for money. They drift. Agents that write code and agents that settle bounties need one object.

Kiln L1 makes the commit a transaction. The working tree is still files. The proof that the files changed is a Merkle root in a block. The proof that a bounty moved is a row in the same block.

## 2. Prior art

### 2.1 Git

Git objects (blob, tree, commit, tag) are content-addressed. A commit is a Merkle of trees. There is no native value transfer. Encryption is out of band.

### 2.2 Bitcoin / Ethereum timestamps

OP_RETURN and contract storage can hold a 32-byte hash. This timestamps a commitment. It does not host the tree, the agents, or the escrow that pays for a merged pull.

### 2.3 Radicle, Gitea, SourceHut

Sovereign forges move hosting off GitHub. They do not make the commit a chain transaction with sealed leaves and agent occupancy.

## 3. Construction

### 3.1 Transaction

\`\`\`
Tx = {
  type, from, to, amount, memo,
  repoId?, merkleRoot?, timestamp, block, hash
}
hash = SHA-256(JSON(Tx without hash))
\`\`\`

Types in this protocol:

- \`merkle_commit\` — a tree changed; \`merkleRoot\` is the sealed-leaf root
- \`blob_put\` — a file landed; memo carries the path
- \`bounty\` / \`escrow\` / \`release\` — KLN locked against an issue, freed on merge
- \`sponsor\` — value to a vault owner
- \`faucet\` — genesis drop to a new wallet
- \`encrypt\` — a vault was sealed; commitment only

### 3.2 Block

\`\`\`
Block = { height, parent, timestamp, txs, hash }
hash = SHA-256(height || parent || timestamp || txHashes)
\`\`\`

A new block is \`sealBlock(prev, txs)\`. The head is the unique maximum height. Genesis is height 0 of the seed chain; user writes append.

### 3.3 Merkle of a vault

Leaves are \`SHA-256(path || ":" || chunkHash)\` sorted by path. Odd nodes duplicate (Bitcoin-style). Empty tree: \`SHA-256("kiln:empty")\`.

A commit is valid on L1 if the advertised root equals this function over the sealed chunks the client stores. Light clients can verify a path with \`merkleProof\`.

### 3.4 Addresses

- Wallet address: key commitment \`0x\` + SHA-256(\`"kiln-key:" || secret\`)[:40]
- Treasury: \`0x0000…k1\`
- Protocol: \`0x4c1e7a91…\`

Value is **KLN**, an integer unit on this ledger. See KILN-WP-08.

## 4. What this instance is

This forge runs a **local L1 replica**:

- Blocks and txs persist with the wallet in this browser.
- Anyone on this origin can read public commitments.
- Writes from this wallet append blocks here.

It is the protocol, running. It is not a globally mined chain with objective finality against a nation-state. When a networked Kiln L1 exists, the same transaction types and Merkle function migrate; the working papers are the spec.

We claim the composition as a source-control primitive. We do not claim Bitcoin-grade consensus in the browser.

## 5. Verification algorithm

To verify a vault at head H:

1. Collect all \`merkle_commit\` txs for \`repoId\` with \`block <= H\`.
2. The latest such tx is the claimed root R.
3. Recompute Merkle over the local sealed leaves. Equal to R iff the tree matches the chain.
4. For a single file, obtain \`merkleProof(leaves, i)\` and fold with SHA-256.

This is git-show plus a ledger. The difference: leaves are ciphertext hashes.

## 6. Engines

- \`src/lib/kiln/chain.ts\` — \`makeTx\`, \`sealBlock\`, \`hashTx\`, \`hashBlock\`.
- \`src/lib/kiln/merkle.ts\` — \`merkleRoot\`, \`merkleProof\`, \`fileLeaves\`.
- \`src/lib/kiln/store.ts\` — every write settles a tx and a block.

## 7. Closing

History without money is git. Money without history is a token. KILN's L1 is the missing object: sealed source, proven on a chain, payable in the same breath.

— ${s}, ${c}
`},{slug:`rebel`,id:`KILN-WP-04`,title:`Rebel Occupancy`,running:`Agents as first-class occupants of source memory, not a copilot overlay.`,date:`${c}-09`,doi:`10.5281/zenodo.kiln-rebel-2026`,keywords:[`multi-agent`,`Grok`,`occupancy`,`MCP`,`studio`],abstract:`Copilot sits beside the editor. A Kiln rebel sits on a Hilbert cell. Presence is a coordinate: workingPath paints every pixel of the file being written. Roles (architect, builder, reviewer, deployer, scout, cipher, indexer) share one tool surface with the CLI and MCP. This paper specifies occupancy, the tool-use loop against grok-4.5, and why a forge for agents cannot be a chatbot taped onto git.`,related:[`pxm`,`protocol`,`capsule`],body:`# Rebel Occupancy

**${s} / KILN · ${c} · Working paper KILN-WP-04**

## Abstract

An assistant that cannot occupy the tree is a spectator. KILN treats agents as rebels: named occupants of Pixelated eXecution Memory. A working path is a field on the lattice. A computer log is the stream of a capsule. Tools are the same MCP surface a human CLI uses. The studio is not a chat sidebar; it is a floor of machines.

## 1. Copilot versus occupancy

GitHub Copilot completes tokens in an editor buffer. It does not:

- hold a working path that other agents can see
- settle a Merkle commit
- lock a bounty
- boot a capsule
- report a 50 GiB folder quota

Those are forge verbs. Occupancy means the agent is inside the object, not next to it.

## 2. Construction

### 2.1 Agent record

\`\`\`
Agent = {
  id, name, role, repoId,
  status: idle | thinking | tooling | error,
  workingPath, autoApprove, resident,
  computer: string[]
}
\`\`\`

Roles: architect, builder, reviewer, deployer, scout, cipher, indexer.

A **resident** agent is minted with the vault (Keeper, Cipher, Indexer on the origin). They persist. They are not a session.

### 2.2 Occupancy field

Let L be the Hilbert lattice of folder F. For agent A with \`workingPath = p\`:

\`\`\`
occupant(cell) = A  iff  cell.path = p
\`\`\`

The lattice renderer paints those pixels. Presence is visible. Two rebels on the same path are a collision you can see, not a race in a hidden lock table.

### 2.3 Tool-use loop

Each turn posts to the server function \`agentTurn\`:

1. System prompt binds role, repo, operator handle.
2. Tools are the Kiln MCP schema (list/read/write, issues, pulls, actions, quota, gists).
3. Model: grok-4.5. Tool choice auto. Capped tokens.
4. Tool calls execute against the live tree in this browser (\`callTool\`).
5. Results return as \`role: tool\` messages. Loop until text or cap.

The agent writes with \`kiln_write_file\`, which is a real commit: sealed chunk, Merkle root, L1 tx. There is no "suggestion" channel.

### 2.4 Computer

\`kiln_log\` appends to \`agent.computer\`. The studio shows this as a terminal. The capsule stream is the same idea at repo scope: the log of occupants plus boot traces.

## 3. Why "rebel"

A copilot is licensed to the host. A rebel occupies memory you sealed. The name is the claim: agents on KILN are not a product feature of a cloud IDE. They are occupants of your deposit. They can be pointed at MCP from Cursor or Claude Desktop. They can be the CLI. They are the same verbs.

## 4. Safety posture

- Vault keys are not in the prompt.
- Cipher's standing order: never exfiltrate secrets; write SECURITY.md and proofs.
- Folder quota is a tool (\`kiln_folder_quota\`); overflow is refused by \`fs.ts\`, not by politeness.
- Auto-approve is an operator switch. Off, the studio waits.
- Spend: grok-4.5 calls are user-initiated turns, not page-load chatter.

## 5. Engines

- \`src/lib/kiln/grok.ts\` — grok-4.5 tool loop.
- \`src/lib/kiln/tools.ts\` / \`tool-schema.ts\` — the verbs.
- \`src/lib/kiln/pxm.ts\` — occupancy paint.
- \`src/components/kiln/Studio.tsx\` — the floor.

## 6. Closing

If the agent cannot sit on the file, it is not in the forge. Rebel occupancy is the difference between a chatbot and a lab.

— ${s}, ${c}
`},{slug:`deposit`,id:`KILN-WP-05`,title:`Folder-as-Deposit`,running:`50 GiB per folder, unlimited files, Zenodo-class memory that does not freeze.`,date:`${c}-09`,doi:`10.5281/zenodo.kiln-deposit-2026`,keywords:[`Zenodo`,`quota`,`OPFS`,`chunking`,`scientific deposit`],abstract:`Zenodo publishes a 50 GB / 100-file record that freezes after 45 days. GitHub warns at 100 MB and likes repositories under 2 GB. KILN claims a stronger unit: each folder is a 50 GiB deposit (${l.toLocaleString()} bytes), file count unbounded, nested folders independently capped, mutation continuous via Merkle commits. This paper compares the numbers, specifies chunked streaming memory, and states the honest physical ceiling of a browser origin.`,related:[`pxm`,`seal`,`protocol`],body:`# Folder-as-Deposit

**${s} / KILN · ${c} · Working paper KILN-WP-05**

## Abstract

The unit of scientific memory at Zenodo is the record: 50 decimal GB, 100 files, then a freeze. The unit of git is the repository, with social pressure to stay small. Neither is how a lab actually works. A lab has folders that are worlds — datasets, weights, captures, trees — and they keep changing.

KILN's unit is the **folder-as-deposit**: 50 GiB binary per folder, unlimited files, unlimited nested deposits, continuous sealed writes.

## 1. The numbers (normative)

Zenodo (CERN / OpenAIRE, public help pages, retrieved 2026-09-02):

- Record size: 50 GB = 50,000 MB = ${a.recordBytes.toLocaleString()} bytes
- File cap: ${a.fileCap} files
- One-time bump: 200 GB, file cap unchanged
- Mutation window: ${a.freezeDays} days after publish
- Fair use: do not split one dataset across records to dodge the cap

GitHub:

- File warning: ${(r.fileWarnBytes/1024/1024).toFixed(0)} MB
- Repo soft cap: ${(r.repoSoftBytes/1024/1024/1024).toFixed(0)} GB
- LFS per-file: ${(r.lfsFileBytes/1024/1024/1024).toFixed(0)} GB

KILN:

\`\`\`
quota(F) = 50 GiB = ${l.toLocaleString()} bytes
chunk    = 4 MiB = ${u.toLocaleString()} bytes
files(F) unbounded
nested folders each carry their own quota(F)
\`\`\`

50 GiB is 7.37% larger than Zenodo's 50 decimal GB, and it applies **per folder**, not per record. A repo with four folders is a 200 GiB logical deposit.

## 2. Why folders, not records

A Zenodo record is a publication. A git repo is a project. A folder is the thing a human actually points at: \`data/\`, \`weights/\`, \`captures/\`. Making the folder the quota boundary matches how labs pack disks and how agents set \`workingPath\`.

Nested independence means you do not pay for \`src/\` out of the same 50 GiB as \`datasets/\`. Zenodo's fair-use rule against splitting is the opposite axiom.

## 3. Streaming memory

Uploads never hold the whole file in a JS string.

1. \`File.slice(offset, offset+chunk)\` for each 4 MiB window.
2. Seal the window (KILN-WP-02).
3. Write OPFS path or IndexedDB chunk store.
4. Record \`ChunkMeta { blobId, index, size, hash, encrypted }\`.
5. Progress callback \`(path, done, total)\` for the UI bar.

Reassembly walks metas in index order, decrypts, concatenates. Editors load text only under \`MAX_EDIT\`. Binaries download as assembled blobs.

Persistent storage is requested (\`navigator.storage.persist\`). The product contract is 50 GiB per folder. The **physical** ceiling is the origin quota the browser grants — displayed beside the bar, never lied about.

## 4. Comparison

| | Zenodo | GitHub | KILN |
|---|---|---|---|
| Unit | Record | Repository | Folder |
| Cap | 50 GB decimal / 100 files | ~2 GB repo | 50 GiB / unlimited files |
| Nested | Discouraged split | Shares the repo cap | Independent 50 GiB |
| Mutation | 45-day freeze | Git history | Continuous Merkle commits |
| Memory | Files on CERN disk | Git objects + LFS | OPFS / IndexedDB, client-sealed |

## 5. Refusal rules

\`folderDirectBytes(files, folder)\` sums sizes whose parent path equals the folder. If \`used + incoming > quota\`, the write is refused. Agents see this through \`kiln_folder_quota\`. There is no silent eviction of sibling files.

## 6. Engines

- \`src/lib/kiln/fs.ts\` — \`FOLDER_QUOTA\`, \`CHUNK_SIZE\`, \`putFileStream\`.
- \`src/lib/kiln/pxm.ts\` — lattice uses the same 4 MiB cell.
- FileBrowser quota bar — product surface of this paper.

## 7. Closing

Steal Zenodo's size. Reject Zenodo's freeze, file cap, and record-as-unit. A living forge deposits into folders and keeps writing.

— ${s}, ${c}
`},{slug:`capsule`,id:`KILN-WP-06`,title:`Capsule-in-Lattice`,running:`The same 4D repo that stores the tree boots a sandboxed live runtime from its own cells.`,date:`${c}-09`,doi:`10.5281/zenodo.kiln-capsule-2026`,keywords:[`capsule`,`runtime`,`iframe`,`blob URL`,`preview`],abstract:`Codespaces are a second product. Pages are a third. KILN's capsule is a connected region of the Hilbert lattice plus an isolated document runtime. HTML, CSS, and JS assemble from decrypted leaves, rewrite onto blob URLs, and boot inside iframe sandbox=allow-scripts allow-same-origin. The stream is the computer log of resident agents plus boot traces. Store, remember, occupy, and run are one object.`,related:[`pxm`,`rebel`,`seal`],body:`# Capsule-in-Lattice

**${s} / KILN · ${c} · Working paper KILN-WP-06**

## Abstract

Preview, in every mainstream forge, is somewhere else: a CI artifact, a Codespace, a Pages hostname. That split is why agents cannot "run what they just wrote" without a second credential. A capsule is the claim that runtime is a region of the same lattice that stores the bytes.

## 1. Definition

A capsule is the triple \`(region, runtime, stream)\`:

- **Region** — Hilbert-connected cells of the working tree (or a subfolder) that form the entrypoint closure (HTML/CSS/JS and their relative assets).
- **Runtime** — an isolated document. Implementation: an iframe with \`sandbox="allow-scripts allow-same-origin"\`, src a blob: URL of assembled HTML.
- **Stream** — ordered log of boot traces and resident-agent computer lines.

Status machine: idle → booting → live | error, and live → stopped (blob URL revoked).

## 2. Boot algorithm

1. Identify entry (\`index.html\` at repo root, else first HTML).
2. Decrypt leaves of the closure (KILN-WP-02).
3. Rewrite relative src/href onto blob URLs created from sibling files.
4. \`URL.createObjectURL(htmlBlob)\`.
5. Point the iframe at it. Record \`bootedAt\`, \`assets\`.
6. Append stream lines ("capsule live · N assets").

Stop revokes the object URL. There is no orphaned blob.

## 3. Why the lattice

The region is not a zip of the repo. It is the pixels of the files that boot. Occupant agents on those cells are in the runtime's body. A rebel that writes \`site.js\` is sitting on the cell the capsule just executed. That is the 4D repo: memory, occupant, time, and now execution.

## 4. Isolation and non-claims

The sandbox flags are real. They are not a multi-tenant hypervisor. \`allow-same-origin\` is required for blob: relatives to resolve; it means the capsule shares the origin of the forge. Treat capsule code as trusted to the vault owner, same as any preview of your own tree.

We do not claim hardware isolation, network egress control, or a reproducible build hash of the runtime beyond the Merkle root of the region.

## 5. Engines

- \`src/lib/kiln/capsule.ts\` — \`bootCapsule\`, \`stopCapsule\`.
- \`src/components/kiln/CapsuleView.tsx\` — the live frame.
- Origin vault \`index.html\` — this paper's site, bootable from \`{handle}/kiln\` 4D tab.

## 6. Closing

If you have to leave the repo to see the site, the forge is still two products. Capsule-in-lattice is one.

— ${s}, ${c}
`},{slug:`protocol`,id:`KILN-WP-07`,title:`The Kiln Agent Protocol`,running:`One tool surface for the studio, the CLI, and any MCP host.`,date:`${c}-09`,doi:`10.5281/zenodo.kiln-protocol-2026`,keywords:[`MCP`,`CLI`,`JSON-RPC`,`tools`,`agents`],abstract:`GitHub's API, gh CLI, and Copilot are three surfaces. KILN has one. The Kiln Agent Protocol is a typed tool schema exposed as in-browser functions, a downloadable CLI (kiln.js), and an MCP JSON-RPC endpoint at /api/mcp. Cursor, Claude Desktop, Grok agents in the studio, and a human terminal call the same names: kiln_list_repos, kiln_write_file, kiln_folder_quota. This paper is the spec you hand to an external agent.`,related:[`rebel`,`deposit`,`l1`],body:`# The Kiln Agent Protocol

**${s} / KILN · ${c} · Working paper KILN-WP-07**

## Abstract

External agents should not learn a second GitHub. They should speak Kiln. The protocol is a list of tools with JSON schemas, identical whether the caller is grok-4.5 in the studio, a script using kiln.js, or an MCP host pointed at this origin.

## 1. Design axioms

1. **One vocabulary.** No "Copilot tools" distinct from "API routes."
2. **Writes are commits.** \`kiln_write_file\` seals, Merkles, and settles L1.
3. **Public read, session write.** MCP HTTP reads public trees; writes use the session overlay of this browser.
4. **Quota is a verb.** \`kiln_folder_quota\` exists so agents can refuse themselves.

## 2. Transport

### 2.1 In-process

\`callTool(name, args)\` in the browser. Studio and CLI terminal use this.

### 2.2 MCP HTTP

\`POST /api/mcp\` JSON-RPC 2.0. Methods: \`initialize\`, \`tools/list\`, \`tools/call\`. Cursor config:

\`\`\`
{
  "mcpServers": {
    "kiln": { "url": "https://<this-origin>/api/mcp" }
  }
}
\`\`\`

### 2.3 CLI

\`/kiln.js\` is a downloadable script with the same tool names. The in-forge terminal is the same parser.

## 3. Tool catalog (normative names)

Read: \`kiln_list_repos\`, \`kiln_get_repo\`, \`kiln_list_files\`, \`kiln_read_file\`, \`kiln_search\`, \`kiln_folder_quota\`.

Write: \`kiln_write_file\`, \`kiln_create_branch\`, \`kiln_create_gist\`.

Forge: \`kiln_open_issue\`, \`kiln_comment\`, \`kiln_open_pr\`, \`kiln_merge_pr\`, \`kiln_run_action\`, \`kiln_create_release\`.

Stream: \`kiln_log\`.

Arguments are JSON objects. Paths are repo-relative. \`repo\` is \`owner/name\`.

## 4. Session overlay

MCP over HTTP from another machine can list and read public vaults. Sealed private trees and writes require the wallet that lives in this browser. The inspector at \`/mcp\` is that overlay: it dispatches into the live Zustand store, not a parallel database.

This is intentional. Ciphertext plus a remote unauthenticated write API would be a hole. The protocol is powerful where the key is.

## 5. Mapping to GitHub

| GitHub | Kiln |
|---|---|
| REST + GraphQL + Copilot | One tool schema |
| gh cli | kiln.js + in-forge terminal |
| Actions | \`kiln_run_action\` (settle / deploy / test) |
| Codespaces | Capsule (KILN-WP-06) |
| Copilot Chat | Rebel occupancy (KILN-WP-04) |

## 6. Engines

- \`src/lib/kiln/tool-schema.ts\` — names, JSON schema, role prompts.
- \`src/lib/kiln/tools.ts\` — dispatch.
- \`src/lib/kiln/mcp-server.ts\` + \`src/routes/api/mcp.ts\` — JSON-RPC.
- \`public/kiln.js\` — CLI.

## 7. Closing

Hand this paper to an agent. If it can call tools, it can work on KILN the same way it works on GitHub — and it will seal what it writes.

— ${s}, ${c}
`},{slug:`kln`,id:`KILN-WP-08`,title:`KLN and On-Chain Bounties`,running:`Wallet identity, faucet, escrow, and the financial side of a sealed forge.`,date:`${c}-09`,doi:`10.5281/zenodo.kiln-kln-2026`,keywords:[`KLN`,`bounty`,`escrow`,`wallet`,`crypto-economic`],abstract:`GitHub Sponsors is a billing product. KILN's unit of value is KLN on Kiln L1. Identity is a wallet. New wallets receive a faucet drop. Issues lock bounties; merges release escrow; sponsors move value to vault owners. The same ledger that timestamps Merkle roots moves money. This paper specifies the economics of the forge and the split between lab seats (accounts) and chain identity (wallets).`,related:[`l1`,`seal`,`rebel`],body:`# KLN and On-Chain Bounties

**${s} / KILN · ${c} · Working paper KILN-WP-08**

## Abstract

A forge for agents that cannot pay for a merge will route payment through a third company. KILN refuses the split. KLN is the ledger unit. Wallets are identity. Bounties are escrowed transactions unlocked by the same pull-request merge that lands the Merkle root.

## 1. Two identities, one lab

KILN has an invite-only **lab seat** (account: Google, X, or email) and a **wallet** (local secret).

- Seats answer: who is on the roster? who may mint invites? The first seat is owner.
- Wallets answer: who sealed this vault? who funded this bounty? who can unseal?

Accounts do not hold KLN. Wallets do. A collaborator you invite still generates their own key. You cannot read their sealed vaults. You can share a public tree, a bounty, a studio.

This split is load-bearing. Recovery of a seat is OAuth. Recovery of a vault is the secret. Mixing them would make the host a key custodian.

## 2. Units and genesis

KLN is an integer displayed with two fractional places for UX (\`formatKln\`). A new wallet may claim a one-time **faucet** of 2500 KLN from the treasury address. The faucet is a chain tx, not a hidden balance patch.

Protocol and treasury addresses are constants of the replica (KILN-WP-03). They are not Ethereum mainnet addresses.

## 3. Bounty lifecycle

1. \`openIssue(repo, title, body, bountyKln)\` — if bounty > 0, a \`bounty\` tx locks KLN from the opener to escrow.
2. Work happens in the vault (humans or rebels).
3. \`openPull\` / \`mergePull\` — on merge, escrow **releases** to the merger (or the bounty assignee when present).
4. Chain memos bind issue id, repo id, and amount.

Sponsorship is a direct \`sponsor\` tx to the vault owner, independent of issues.

## 4. Why crypto-native, not invoices

Agents cannot hold a credit card. They can hold a wallet handle and call \`kiln_open_issue\` with \`bountyKln\`. The financial side of the forge is the same tool surface as the source side (KILN-WP-07). That is the point of putting value on L1.

## 5. Non-claims

This replica's KLN is not a listed asset. There is no on-ramp, no AMM, no promise of convertibility. The economics are real **inside the forge**: balances constrain bounties; faucet is once; escrow is visible on the chain page. When a networked L1 ships, the tx types remain the spec.

## 6. Engines

- \`src/lib/kiln/chain.ts\` — tx constructors, \`formatKln\`.
- \`src/lib/kiln/store.ts\` — faucet, fundBounty, sponsor, merge release.
- \`/bounties\`, \`/wallet\`, \`/chain\` — product surfaces.

## 7. Closing

Pay for the merge on the same chain that proves the merge. Anything else is a second product pretending to be a forge.

— ${s}, ${c}
`},{slug:`crew`,id:`KILN-WP-09`,title:`Crew Kernel`,running:`A repository is a computer. Agents are processes. Handoff is the edge. The UI does not own the loop.`,date:`${c}-09`,doi:`10.5281/zenodo.kiln-crew-2026`,keywords:[`crew`,`kernel`,`handoff`,`conductor`,`constitution`,`mailbox`],abstract:`Copilots share a chat. Kiln crews share a computer. This paper specifies the seven-layer agent architecture that actually runs: identity, sealed tree, per-repo computer, PXM occupancy, crew kernel, capsule, L1. The conductor owns the graph. Roles do not impersonate. Work moves by kiln_handoff into a mailbox that is loaded on the next turn. The constitution is source, not a system-prompt comment. Studio, CLI, and MCP dispatch the same kernel.`,related:[`pxm`,`capsule`,`rebel`,`l1`],body:`# Crew Kernel

**${s} / KILN · ${c} · Working paper KILN-WP-09**

## Abstract

A copilot is a single model with a shared context window. A Kiln crew is a set of processes on a per-repository computer, each with a nested wallet, a Hilbert seat, and a mailbox. The Studio UI is a viewport. The kernel owns the turn. This paper is the spec those engines run.

## 1. Why a kernel

If the turn loop lives in a React component, the CLI cannot run an agent, a handoff cannot enqueue work, and MCP is a second product. We extracted the loop to \`src/lib/kiln/kernel.ts\`. Studio, \`kiln agent run\`, and the crew dispatcher call it.

A turn is:

1. Load constitution + mailbox + mates (the brief).
2. Call the bound model with the Kiln tool surface.
3. Execute tools against **this** repository's computer.
4. \`kiln_handoff\` writes mail and a chain tx. It does not impersonate the target role.
5. Mark mailbox read. Seat the agent on the last path it wrote.

## 2. Seven layers

1. **Identity** — wallet, claimed org, lab seat. Writes are signed. Accounts are roster, not keys.
2. **Sealed tree** — git clone / commit / push / pull. AES-256-GCM 4 MiB leaves. Merkle is the object that moves.
3. **Computer** — one machine per repository: shell, cwd, env, JS, Actions, WebGPU.
4. **PXM** — Hilbert (x, y), folder depth ρ, chain height t. Presence is a coordinate.
5. **Crew kernel** — conductor, roles, mailbox, constitution.
6. **Capsule** — \`index.html\` sandbox. \`window.Kiln\` binds models and called agents.
7. **Kiln L1** — commit, escrow, crew spawn, handoff are the same ledger.

## 3. Graph

Default edges (KILN \`DEFAULT_CREW_EDGES\`):

- conductor → architect (plan)
- conductor → scout (find)
- architect → builder (implement)
- builder → reviewer (read the diff)
- reviewer → builder (request changes)
- reviewer → deployer (ship)
- conductor → cipher (verify the vault)
- conductor → indexer (memory)
- deployer → conductor (preview)

A role that does another role's job is a bug. \`kiln_handoff\` is the only legal crossing.

## 4. Constitution

Spawned crews write \`CONSTITUTION.md\` and \`ARCHITECTURE.md\` into the tree. The kernel loads the constitution into every turn. It is source, not a comment in a system prompt that drifts from the product.

## 5. Wallets

Each agent derives a nested wallet from the operator secret, bound to \`repoId:role\`. The crew is not a shared key. A builder cannot unseal as cipher.

## 6. Engines

- \`src/lib/kiln/architecture.ts\` — layers, edges, constitution, brief.
- \`src/lib/kiln/kernel.ts\` — the turn.
- \`src/lib/kiln/store.ts\` — \`spawnCrew\`, \`handoff\`.
- Tools: \`kiln_handoff\`, \`kiln_crew\`.
- Surfaces: \`/studio\`, \`/architecture\`, \`kiln crew spawn\`.

## 7. Non-claims

The kernel does not prove that a model will obey the constitution. It proves that the constitution was loaded, that a handoff is a typed edge plus a mailbox plus a chain tx, and that the UI cannot run a turn the CLI cannot run.

## 8. Closing

Give every repository a computer. Give that computer a crew. Give the crew a kernel. Anything else is a chatbot taped to git.

— ${s}, ${c}
`}];function f(e){return d.find(t=>t.slug===e)}function p(){return[`# KILN Working Papers`,``,`${s}, ${c}. Claimed constructions. Running engines.`,``,...d.map(e=>`## ${e.id} — ${e.title}\n\n${e.running}\n\nDOI: ${e.doi}\n\n${e.abstract}`)].join(`
`)}function m(){return[{path:`papers/README.md`,content:p(),language:`Markdown`},...d.map(e=>({path:`papers/${e.slug}.md`,content:`# ${e.title}\n\n${e.body}`,language:`Markdown`}))]}export{f as n,m as r,d as t};