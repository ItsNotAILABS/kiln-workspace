var e=2026,t=`ItsNotAI LABS`,n=`KILN`,r={recordBytes:5e10,fileCap:100,bumpBytes:2e11,freezeDays:45},i={fileWarnBytes:104857600,repoSoftBytes:2147483648,lfsFileBytes:2147483648},a=[{id:`PXM`,title:`Pixelated eXecution Memory`,statement:`A folder is a Hilbert-painted lattice of 4 MiB Merkle cells. Each cell is an AES-256-GCM ciphertext leaf. Locality in the file is locality on the lattice. This is the memory the rebels sit in.`},{id:`DEPOSIT`,title:`Folder-as-deposit`,statement:`Each folder is a Zenodo-class deposit: 50 GiB (53,687,091,200 bytes), not 50 decimal GB. Nested folders each carry an independent cap. File count is unbounded — Zenodo caps a record at 100 files.`},{id:`CAPSULE`,title:`Capsule-in-lattice`,statement:`A capsule is a connected region of the lattice plus an isolated runtime. The same 4D repo that stores the tree boots a sandboxed live preview of the site, the app, the stream.`},{id:`REBEL`,title:`Rebel occupancy`,statement:`Agents are first-class occupants of cells. A working path paints the corresponding Hilbert pixels. Presence is a coordinate, not a chat sidebar.`},{id:`FOURD`,title:`4D repository`,statement:`A repo is (x, y, ρ, t): Hilbert x, Hilbert y, folder depth, chain height. Occupant is a field on the cell. Code, memory, runtime, and swarm share one object.`},{id:`SEAL`,title:`Client-sealed Merkle commits`,statement:`Chunks encrypt in the browser (AES-256-GCM) before OPFS/IndexedDB. The Merkle root settles as a Kiln L1 transaction. The key never leaves the device. Only the commitment is public.`}],o=`# Pixelated eXecution Memory

**A Hilbert-mapped Merkle lattice for sealed, agent-occupied, capsule-bootable source deposits.**

${t} / ${n} · ${e}
Claimed constructions: PXM, folder-as-deposit, capsule-in-lattice, rebel occupancy, 4D repo.

## Abstract

Source forges still treat a repository as a bag of blobs with a linear log. Scientific repositories such as Zenodo treat a record as a frozen 50 GB / 100-file deposit. Neither model is a place an agent can *sit*, and neither model is a place a website can *live*.

We claim **Pixelated eXecution Memory (PXM)**: each folder is a Zenodo-class deposit whose 4 MiB ciphertext leaves are painted onto a Hilbert lattice. Agents (rebels) occupy cells they write. A **capsule** is a connected region of that lattice plus an isolated runtime, so the same object that stores the tree boots a live preview of the site. A repository is four-dimensional: Hilbert *x*, Hilbert *y*, folder depth *ρ*, chain time *t*.

This paper records the construction, the comparison with Zenodo and GitHub, and the engines as they run in KILN.

## 1. Prior art

### 1.1 Zenodo

Zenodo (CERN / OpenAIRE) publishes a hard per-record ceiling: **50 GB = 50,000 MB = 50,000,000,000 bytes**, and **at most 100 files**. A one-time bump to 200 GB is available; the file cap stays 100. After publish, the depositor may mutate files for 45 days. Fair-use forbids splitting one dataset across records to dodge the cap. The model is a *frozen scientific deposit*, public by default, DOI-backed.

It is the right size to steal. It is the wrong shape for a living forge.

### 1.2 GitHub / Git LFS

GitHub warns at 100 MB per file, recommends repositories stay under 2 GB, and offers LFS with a 2 GB per-file ceiling. History is a Merkle DAG of *plaintext* trees. Encryption, if any, is an aftermarket. Agents, if any, are a copilot overlay — they do not occupy the tree.

### 1.3 Content-addressed stores

IPFS UnixFS typically chunks at 256 KiB. Hilbert-order layouts are known in image databases and cache-oblivious memory, because a Hilbert curve preserves locality better than row-major scan. Merkle trees are known. AES-GCM is known. Place-cell lattices in hippocampus research show that biological memory is spatially addressable.

**None of these is PXM.** The claim is the composition.

## 2. Construction

### 2.1 Folder-as-deposit

Let a folder *F* be a set of files whose paths contain no further slash relative to *F*. The **direct byte mass** of *F* is the sum of file sizes sitting in *F*, not in children.

\`\`\`
quota(F) = 50 GiB = 53,687,091,200 bytes
assert  Σ_{f ∈ F} |f|  ≤  quota(F)
\`\`\`

Nested folders are other deposits. A repository is therefore unbounded in depth; only a single folder is capped. File count is unbounded. Compare Zenodo: one record, 50 decimal GB, 100 files, then freeze.

KILN uses **50 GiB** (binary), which is 7.37% larger than Zenodo's 50 decimal GB, and applies it *per folder*, not per record.

### 2.2 Sealed leaves

A file is streamed in 4 MiB slices (\`File.slice\`). Each slice is AES-256-GCM sealed with a vault key derived by HKDF-equivalent SHA-256:

\`\`\`
K = SHA-256("kiln-vault:" || walletSecret || repoId)
\`\`\`

Ciphertext is written OPFS-first, IndexedDB fallback. A SHA-256 of each sealed chunk is a Merkle leaf. The file root and the tree root settle on Kiln L1 as \`merkle_commit\` / \`blob_put\` transactions. The key commitment \`SHA-256("kiln-key:" || walletSecret)\` is the only public handle on the secret.

Persistent origin storage is requested (\`navigator.storage.persist\`). The 50 GiB folder cap is the product contract; the browser origin quota is the honest physical ceiling and is displayed beside the bar.

### 2.3 Pixelated eXecution Memory

Let *L* be the sequence of 4 MiB leaves in path-then-chunk order. Let *n = 2^k* be the smallest power of two whose square holds |L|. Map index *i* to lattice coordinate *(x, y)* by the Hilbert curve *d → (x, y)* on an *n × n* square.

Properties we use:

1. **Locality.** Consecutive chunks of one file occupy neighbouring pixels. A large binary does not spray across the lattice.
2. **Addressability.** A cell is *(path, chunk, hash, sealed, occupant)*. Memory is a picture.
3. **Occupancy.** An agent with \`workingPath = p\` paints every cell whose path is *p*. Rebels sit on the memory they write.
4. **Capsule region.** The connected set of cells belonging to the entrypoint (HTML/CSS/JS closure) is the capsule's body.

This is pixelated memory: discrete, spatial, occupiable. It is not a metaphor for embeddings. The pixels *are* the chunks.

### 2.4 Capsule-in-lattice

A capsule is the triple *(region, runtime, stream)*:

- **Region** — the Hilbert-connected cells of the working tree (or a subfolder).
- **Runtime** — an isolated document (\`iframe sandbox="allow-scripts allow-same-origin"\`) whose HTML/CSS/JS are assembled from decrypted leaves and rewritten onto blob URLs.
- **Stream** — the computer log of resident agents plus boot traces.

The same 4D repo is therefore a git tree, a memory picture, a live website, and a swarm. There is no second product for "preview" or "codespace." The capsule *is* the container.

### 2.5 4D repository

\`\`\`
coord = (x, y, ρ, t)
  x, y  Hilbert cell
  ρ     folder depth (which deposit)
  t     Kiln L1 height (which beat)
occupant(coord) ∈ Agents ∪ {∅}
\`\`\`

Time is the chain. Depth is the tree. The lattice is the picture. Occupant is the rebel.

### 2.6 Resident agents

Every repository owned on KILN receives a resident agent ("Keeper") at genesis. The origin vault \`{handle}/kiln\` also receives Cipher and Indexer. They write the same sealed trees a human writes. They sit on cells. They boot capsules. They are not a copilot overlay.

## 3. Claims (normative)

1. **PXM.** Named construction: Hilbert-painted 4 MiB AES-GCM Merkle cells as the memory of a source folder.
2. **Folder-as-deposit.** 50 GiB per folder, unlimited files, unlimited nested deposits. Strictly stronger than Zenodo's 50 GB / 100 files / 45-day freeze.
3. **Capsule-in-lattice.** Isolated live runtime bound to a lattice region, inside the repo object.
4. **Rebel occupancy.** Agent presence is a field on the cell.
5. **4D repo.** *(x, y, ρ, t)* as the native object of the forge.
6. **Client-sealed L1 commits.** Ciphertext at rest, Merkle root on chain, key in the wallet.

We do not claim Hilbert curves, Merkle trees, AES-GCM, or Zenodo's 50 GB number. We claim the composition as a source-control primitive, running here.

## 4. Comparison

| | Zenodo | GitHub | KILN PXM |
|---|---|---|---|
| Unit | Record | Repository | Folder (deposit) |
| Cap | 50 GB decimal / 100 files | ~2 GB repo, 100 MB file warn | 50 GiB / unlimited files |
| Nested | Split records (discouraged) | Directories share the repo cap | Each folder is a new 50 GiB deposit |
| Mutation | 45-day freeze after publish | Git history | Continuous Merkle commits |
| Encryption | Server ACL, plaintext at rest | Plaintext | AES-256-GCM per chunk, client-side |
| Proof | MD5/SHA of files | Git tree SHA | SHA-256 Merkle root on L1 |
| Runtime | None | Actions / Codespaces (side) | Capsule inside the lattice |
| Agents | None | Copilot overlay | Occupants of cells |
| Identity | Account | Account | Wallet + invite-only lab seat |

## 5. Engines (this forge)

The engines are not diagrams. They run in this product:

- \`src/lib/kiln/pxm.ts\` — Hilbert paint, occupancy, capsule regions.
- \`src/lib/kiln/capsule.ts\` — isolated boot from the working tree.
- \`src/lib/kiln/fs.ts\` — 4 MiB streaming, OPFS, 50 GiB folder quota.
- \`src/lib/kiln/merkle.ts\` — binary SHA-256 Merkle.
- \`src/lib/kiln/crypto.ts\` — AES-256-GCM, vault key, key commitment.

They are also sealed, privately, into \`{your-handle}/kiln\` — the origin vault of this forge, under your account, AES-256-GCM, on-chain Merkle root. Open the 4D tab. Boot the capsule. The paper you are reading is the site that live-streams from those cells.

## 6. Closing

A forge for agents cannot be a bag of files with a chatbot taped on. Memory has to be a place. Runtime has to be the same place. Occupancy has to be visible. The deposit has to be large enough that a lab actually puts its work there.

PXM is that place. We claim it.

— ${t}, ${e}
`;export{o as a,i,t as n,r as o,e as r,a as t};