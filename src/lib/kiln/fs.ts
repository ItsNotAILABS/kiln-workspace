import { encryptBytes, decryptBytes, sha256Hex, vaultSecret } from "./crypto";
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
  if (file.binary) return `[binary ${formatBytes(file.size)}]`;
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
    const id = `${file.blobId}:${i}`;
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
  if (size > FOLDER_QUOTA) throw new Error(`File exceeds the 50 GB folder cap (${formatBytes(FOLDER_QUOTA)})`);
  const encrypt = !!opts?.encrypt && !!opts.secret;
  const secret = opts?.secret ?? "";
  const chunkCount = Math.max(1, Math.ceil(size / CHUNK_SIZE));
  const hashes: string[] = [];
  let firstInline = "";
  const seed = `${size}:${Date.now()}:${Math.random()}`;
  const blobId = `b${(await sha256Hex(seed)).slice(0, 24)}`;

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(size, start + CHUNK_SIZE);
    const slice = source.slice(start, end);
    let buf: Uint8Array = new Uint8Array(await slice.arrayBuffer());
    if (encrypt) buf = await encryptBytes(buf, secret);
    const hash = await sha256Hex(buf);
    hashes.push(hash);
    await putChunk(`${blobId}:${i}`, buf);
    if (i === 0 && !binary && !encrypt && typeof firstInline === "string" && size <= MAX_INLINE) {
      firstInline = new TextDecoder().decode(new Uint8Array(await source.slice(0, size).arrayBuffer()));
    }
    opts?.onProgress?.(end, size);
  }

  const root = await merkleRoot(hashes);
  const sha = `k${root.replace(/^0x/, "").slice(0, 7)}`;
  await idbPut(META, blobId, { blobId, chunkCount, size, merkleRoot: root, encrypted: encrypt });
  return { sha, size, inline: firstInline, blobId, binary, merkleRoot: root, chunkCount, encrypted: encrypt };
}

async function storeChunks(
  bytes: Uint8Array,
  binary: boolean,
  opts?: { encrypt?: boolean; secret?: string; onProgress?: (done: number, total: number) => void },
): Promise<StoredFile> {
  const size = bytes.byteLength;
  if (size > FOLDER_QUOTA) throw new Error(`File exceeds the 50 GB folder cap (${formatBytes(FOLDER_QUOTA)})`);
  const encrypt = !!opts?.encrypt && !!opts.secret;
  const secret = opts?.secret ?? "";
  const chunkCount = Math.max(1, Math.ceil(size / CHUNK_SIZE) || 1);
  const hashes: string[] = [];
  const blobId = `b${(await sha256Hex(bytes.length ? bytes : new TextEncoder().encode("empty"))).slice(0, 24)}${encrypt ? "e" : ""}`;

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(size, start + CHUNK_SIZE);
    let slice: Uint8Array = bytes.subarray(start, end);
    if (encrypt) slice = await encryptBytes(slice, secret);
    const hash = await sha256Hex(slice);
    hashes.push(hash);
    await putChunk(`${blobId}:${i}`, slice);
    opts?.onProgress?.(end, size);
  }

  const root = await merkleRoot(hashes);
  const inline =
    !binary && !encrypt && typeof bytes === "object" && size <= MAX_INLINE ? new TextDecoder().decode(bytes) : "";
  await idbPut(META, blobId, { blobId, chunkCount, size, merkleRoot: root, encrypted: encrypt });
  return {
    sha: `k${root.replace(/^0x/, "").slice(0, 7)}`,
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
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n < 1024 * 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  return `${(n / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
}

/** Bytes of files sitting directly in `dir` (nested folders have their own 50 GB cap). */
export function folderDirectBytes(files: RepoFile[], dir: string): number {
  const prefix = dir ? `${dir.replace(/\/$/, "")}/` : "";
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
