// Module-load sim: import each edited module (and its whole chunk graph)
// in Node with browser-global shims. Catches top-level ReferenceErrors,
// dead imports and wiring explosions — the failure class that ships
// silently through `node --check`. Prints RAN CLEAN when all load.
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";

const ASSETS = "/home/hatch/workspace/.worktrees/kiln-oauth-preflight/public/assets";
const store = new Map();
const el = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
  setAttribute() {}, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [],
});
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  URL, URLSearchParams, TextEncoder, TextDecoder, Date, Math, JSON, Promise,
  Map, Set, WeakMap, WeakSet, Symbol, Proxy, Reflect, BigInt, ArrayBuffer, Uint8Array,
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "", headers: { get: () => null } }),
  crypto: globalThis.crypto,
  Request: globalThis.Request, Response: globalThis.Response, Headers: globalThis.Headers,
  AbortController: globalThis.AbortController, AbortSignal: globalThis.AbortSignal,
  Blob: globalThis.Blob, FormData: globalThis.FormData, File: globalThis.File,
  ReadableStream: globalThis.ReadableStream, WritableStream: globalThis.WritableStream, TransformStream: globalThis.TransformStream,
  MessageChannel: globalThis.MessageChannel, MessagePort: globalThis.MessagePort,
  structuredClone: globalThis.structuredClone, atob: globalThis.atob, btoa: globalThis.btoa,
  performance: globalThis.performance, EventTarget: globalThis.EventTarget,
  DOMException: globalThis.DOMException, CompressionStream: globalThis.CompressionStream, DecompressionStream: globalThis.DecompressionStream,
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
  location: { href: "http://local/explore", pathname: "/explore", search: "", hash: "", origin: "http://local", assign() {}, replace() {}, reload() {} },
  navigator: { userAgent: "loadsim", language: "en-US", onLine: true },
  history: { pushState() {}, replaceState() {}, back() {}, state: null },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 16),
  cancelAnimationFrame: clearTimeout,
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  document: {
    documentElement: el(), body: el(), head: el(), title: "",
    createElement: () => el(), createElementNS: () => el(),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t), data: String(t) }),
    createComment: (t) => ({ nodeType: 8, textContent: String(t) }),
    createDocumentFragment: () => el(),
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    addEventListener() {}, removeEventListener() {}, cookie: "",
  },
  Event: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
  CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
  MutationObserver: class { observe() {} disconnect() {} },
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  HTMLElement: class {}, Element: class {}, Node: class {},
  getComputedStyle: () => ({}),
  innerWidth: 375, innerHeight: 667, devicePixelRatio: 2,
  scrollTo() {}, alert() {}, open: () => null,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const cache = new Map(); // file -> { mod, linkP }
function instantiate(spec) {
  const file = path.resolve(ASSETS, spec.replace(/^\.\//, ""));
  if (cache.has(file)) return cache.get(file).mod;
  const src = fs.readFileSync(file, "utf8");
  const mod = new vm.SourceTextModule(src, { identifier: file, context: sandbox });
  const rec = { mod, linkP: null };
  cache.set(file, rec);
  rec.linkP = mod.link((child) => Promise.resolve(instantiate(child)));
  rec.linkP.catch(() => {}); // errors surface at settle time below
  return mod;
}
async function settleLinks() {
  let prev = -1;
  while (prev !== cache.size) {
    prev = cache.size;
    await Promise.allSettled([...cache.values()].map((r) => r.linkP));
  }
  for (const [file, rec] of cache) {
    try { await rec.linkP; } catch (e) { throw new Error(`link ${path.basename(file)}: ${e.message}`); }
  }
}

const targets = process.argv.slice(2);
let failed = 0;
for (const t of targets) {
  cache.clear();
  try {
    const root = instantiate(t);
    await settleLinks();
    await root.evaluate();
    console.log(`LOADED ${t} — exports: ${Object.keys(root.namespace).join(",") || "(none)"}`);
  } catch (e) {
    failed++;
    console.log(`FAILED ${t}: ${e && e.constructor ? e.constructor.name : "Error"}: ${String((e && e.message) || e).slice(0, 260)}`);
  }
}
console.log(failed === 0 ? "RAN CLEAN" : `LOAD FAILURES: ${failed}`);
