const enc = new TextEncoder();
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
  return sha256Hex(`kiln-vault:${walletSecret}:${repoId}`);
}

export async function encryptText(plain: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, enc.encode(plain));
  return `v1:${toHex(iv)}:${toHex(cipher)}`;
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
  return `0x${(await sha256Hex(`kiln-key:${secret}`)).slice(0, 40)}`;
}

export async function makeAddress(secret: string): Promise<string> {
  return `0x${(await sha256Hex(`kiln-addr:${secret}`)).slice(0, 40)}`;
}

export function randomSecret(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return toHex(b);
}

export function truncateHex(h: string, size = 4): string {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  return `0x${s.slice(0, size)}…${s.slice(-size)}`;
}

export function nid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function detectLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TSX",
    js: "JavaScript",
    jsx: "JSX",
    mjs: "JavaScript",
    py: "Python",
    rs: "Rust",
    go: "Go",
    md: "Markdown",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    yml: "YAML",
    yaml: "YAML",
    sol: "Solidity",
    toml: "TOML",
    sh: "Shell",
    svg: "SVG",
  };
  return map[ext] || (path.includes("Dockerfile") ? "Dockerfile" : "Text");
}

export function handleize(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 39) || "lab"
  );
}

export { toHex };
