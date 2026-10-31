/**
 * G-WebGPU compute plane. This tab is a node.
 * Jobs are SAXPY over a seeded lattice. WebGPU when the device has it,
 * the same kernel on the CPU lane otherwise. Peers hear each other on
 * BroadcastChannel and can claim an offered job.
 */
import { DEFAULT_N, WGSL, checksum, cpuSaxpy, fields, hex32, rate } from "./gwebgpu-core.js";

const PLANE = "kiln-gwebgpu-v1";
const LEDGER = "kiln-gwebgpu-receipts";

function nodeId() {
  try {
    let id = sessionStorage.getItem("kiln-gwebgpu-node");
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      sessionStorage.setItem("kiln-gwebgpu-node", id);
    }
    return id;
  } catch {
    return "local";
  }
}

function readLedger() {
  try {
    const raw = JSON.parse(localStorage.getItem(LEDGER) || "[]");
    return Array.isArray(raw) ? raw.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function writeLedger(rows) {
  try {
    localStorage.setItem(LEDGER, JSON.stringify(rows.slice(0, 12)));
  } catch {
    /* private mode */
  }
}

async function adapterName() {
  if (typeof navigator === "undefined" || !navigator.gpu) return { ok: false, name: "none", reason: "This browser has no WebGPU." };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { ok: false, name: "none", reason: "No GPU adapter." };
    let info = adapter.info;
    if (!info && adapter.requestAdapterInfo) info = await adapter.requestAdapterInfo();
    const name = (info && (info.device || info.description)) || "WebGPU adapter";
    return { ok: true, name: String(name), features: [...adapter.features].slice(0, 8) };
  } catch (e) {
    return { ok: false, name: "none", reason: e instanceof Error ? e.message : "GPU probe failed" };
  }
}

async function gpuSaxpy(a, x, y) {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("no adapter");
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: WGSL });
  const compiled = await module.getCompilationInfo();
  const errors = compiled.messages.filter((m) => m.type === "error");
  if (errors.length) {
    device.destroy();
    throw new Error(errors.map((m) => m.message).join("; "));
  }
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });
  const n = y.length;
  const bytes = n * 4;
  const usageIn = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
  const make = (data, usage) => {
    const buffer = device.createBuffer({ size: bytes, usage });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  };
  const ba = make(a, usageIn);
  const bx = make(x, usageIn);
  const by = make(y, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
  const staging = device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: ba } },
      { binding: 1, resource: { buffer: bx } },
      { binding: 2, resource: { buffer: by } },
    ],
  });
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.dispatchWorkgroups(Math.ceil(n / 256));
  pass.end();
  enc.copyBufferToBuffer(by, 0, staging, 0, bytes);
  device.queue.submit([enc.finish()]);
  if (device.queue.onSubmittedWorkDone) await device.queue.onSubmittedWorkDone();
  await staging.mapAsync(GPUMapMode.READ);
  const out = new Float32Array(staging.getMappedRange().slice(0));
  staging.unmap();
  device.destroy();
  return out;
}

export async function runJob({ n = DEFAULT_N, seed = 1, preferGpu = true } = {}) {
  const { a, x, y } = fields(n, seed);
  const cpu = cpuSaxpy(a, x, y);
  const t0 = performance.now();
  let via = "cpu";
  let out;
  let gpuError = "";
  if (preferGpu && typeof navigator !== "undefined" && navigator.gpu) {
    try {
      out = await gpuSaxpy(a, x, y.slice());
      via = "webgpu";
    } catch (e) {
      gpuError = e instanceof Error ? e.message : "webgpu failed";
      out = cpu;
      via = "cpu";
    }
  } else {
    out = cpuSaxpy(a, x, y);
  }
  const ms = Math.max(0.1, performance.now() - t0);
  const got = checksum(out);
  let mismatch = 0;
  let first = -1;
  const limit = Math.min(out.length, cpu.length);
  for (let i = 0; i < limit; i++) {
    if (out[i] !== cpu[i]) {
      mismatch++;
      if (first < 0) first = i;
    }
  }
  if (out.length !== cpu.length) mismatch += Math.abs(out.length - cpu.length);
  return {
    n,
    seed: seed >>> 0,
    via,
    ms: Math.round(ms * 10) / 10,
    rate: rate(n, ms),
    checksum: hex32(got.xor),
    sum: got.sum,
    agree: mismatch === 0,
    mismatch,
    first,
    sample: first >= 0 ? { gpu: out[first], cpu: cpu[first] } : null,
    gpuError,
    at: new Date().toISOString(),
  };
}

function cssText() {
  return `#gwebgpu-plane{position:fixed;z-index:24;left:0;right:0;bottom:0;overflow:auto;background:#09090b;color:#ecece8;font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;-webkit-overflow-scrolling:touch}
#gwebgpu-plane *{box-sizing:border-box}
#gwebgpu-plane .wrap{max-width:52rem;margin:0 auto;padding:1.25rem 1rem 3rem}
#gwebgpu-plane .kicker{margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9a9a96}
#gwebgpu-plane h1{margin:.35rem 0 0;font-family:Newsreader,Georgia,serif;font-weight:500;font-size:clamp(2rem,8vw,3.25rem);letter-spacing:-.03em;line-height:.95}
#gwebgpu-plane .lead{margin:.75rem 0 0;max-width:38rem;color:#9a9a96;font-size:.95rem;line-height:1.5}
#gwebgpu-plane .stats{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:1.1rem}
@media(min-width:720px){#gwebgpu-plane .stats{grid-template-columns:repeat(4,1fr)}}
#gwebgpu-plane .stat{border:1px solid #2a2a2e;background:#141416;border-radius:10px;padding:.7rem .75rem;min-height:4.4rem}
#gwebgpu-plane .stat span{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9a9a96}
#gwebgpu-plane .stat strong{display:block;margin-top:.3rem;font-family:ui-monospace,monospace;font-size:.85rem;font-weight:500;word-break:break-word}
#gwebgpu-plane .row{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}
#gwebgpu-plane button{min-height:44px;padding:0 1rem;border-radius:8px;border:1px solid #3a342c;background:#1c1916;color:#ecece8;font:inherit;cursor:pointer}
#gwebgpu-plane button.primary{background:#c4a574;color:#14110e;border-color:#c4a574;font-weight:600}
#gwebgpu-plane button:disabled{opacity:.55;cursor:default}
#gwebgpu-plane .card{margin-top:1rem;border:1px solid #2a2a2e;border-radius:12px;background:#101012;padding:.9rem 1rem}
#gwebgpu-plane .card h2{margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#c4a574;font-weight:600}
#gwebgpu-plane .result{margin:.55rem 0 0;font-family:ui-monospace,monospace;font-size:.82rem;line-height:1.55}
#gwebgpu-plane .ok{color:#b7d3b0}
#gwebgpu-plane .bad{color:#e0a090}
#gwebgpu-plane pre{margin:.6rem 0 0;padding:.75rem;overflow:auto;background:#09090b;border-radius:8px;border:1px solid #2a2a2e;font-size:11px;line-height:1.45;color:#d7d4cc}
#gwebgpu-plane ul{list-style:none;margin:.4rem 0 0;padding:0}
#gwebgpu-plane li{display:flex;justify-content:space-between;gap:.75rem;padding:.55rem 0;border-top:1px solid #2a2a2e;font-family:ui-monospace,monospace;font-size:12px}
#gwebgpu-plane .muted{color:#9a9a96}
`;
}

function paint(root, state) {
  const lane = state.probe.ok ? "WebGPU" : "CPU lane";
  const last = state.last;
  root.innerHTML = `
    <div class="wrap">
      <p class="kicker">G-WebGPU · plane</p>
      <h1>Compute plane</h1>
      <p class="lead">This browser is a node. SAXPY runs on the GPU when the device has WebGPU, and on the same kernel’s CPU lane when it does not. Offer a job and any other Kiln tab on this origin can claim it.</p>
      <div class="stats">
        <div class="stat"><span>Node</span><strong>${state.node}</strong></div>
        <div class="stat"><span>Adapter</span><strong>${state.probe.ok ? state.probe.name : "none"}</strong></div>
        <div class="stat"><span>Lane</span><strong>${lane}</strong></div>
        <div class="stat"><span>Peers</span><strong>${state.peers.size}</strong></div>
      </div>
      <div class="row">
        <button type="button" class="primary" data-act="run" ${state.busy ? "disabled" : ""}>${state.busy ? "Running" : "Run SAXPY"}</button>
        <button type="button" data-act="offer" ${state.busy ? "disabled" : ""}>Offer to the plane</button>
      </div>
      <div class="card">
        <h2>Last receipt</h2>
        <p class="result">${
          last
            ? `${last.n.toLocaleString()} elements · ${last.ms} ms · ${last.rate}<br>${last.via} · ${last.checksum} · sum ${last.sum}<br><span class="${last.agree ? "ok" : "bad"}">${last.agree ? "Agrees with the CPU check." : `${last.mismatch} elements differ. First at ${last.first}: GPU ${last.sample?.gpu} · CPU ${last.sample?.cpu}`}</span>${last.gpuError ? `<br><span class="muted">${last.gpuError}</span>` : ""}`
            : `<span class="muted">${state.busy ? "Dispatching…" : "Waiting for the first dispatch."}</span>`
        }</p>
        ${state.probe.reason ? `<p class="result muted">${state.probe.reason}</p>` : ""}
      </div>
      <div class="card">
        <h2>Kernel</h2>
        <pre id="gwebgpu-wgsl"></pre>
      </div>
      <div class="card">
        <h2>Plane ledger</h2>
        <ul>
          ${
            state.ledger.length
              ? state.ledger
                  .map(
                    (r) =>
                      `<li><span>${r.node || state.node} · ${r.via}</span><span class="muted">${r.checksum} · ${r.ms} ms</span></li>`,
                  )
                  .join("")
              : `<li><span class="muted">No receipts yet.</span><span></span></li>`
          }
        </ul>
      </div>
    </div>`;
  const pre = root.querySelector("#gwebgpu-wgsl");
  if (pre) pre.textContent = WGSL;
}

export function installGWebGpu() {
  if (globalThis.__KILN_GWEBGPU) return;
  globalThis.__KILN_GWEBGPU = true;
  const node = nodeId();
  const state = {
    node,
    probe: { ok: false, name: "probing", reason: "" },
    peers: new Map(),
    ledger: readLedger(),
    last: null,
    busy: false,
    root: null,
  };
  let channel = null;
  try {
    channel = new BroadcastChannel(PLANE);
  } catch {
    channel = null;
  }

  function render() {
    if (!state.root) return;
    const header = document.querySelector("header");
    const top = header ? Math.ceil(header.getBoundingClientRect().bottom) : 0;
    state.root.style.top = Math.max(48, top) + "px";
    paint(state.root, state);
  }

  async function execute(seed, from, n) {
    state.busy = true;
    render();
    const receipt = await runJob({ n: n || DEFAULT_N, seed, preferGpu: true });
    receipt.node = node;
    receipt.from = from || node;
    state.last = receipt;
    state.ledger = [receipt, ...state.ledger].slice(0, 12);
    writeLedger(state.ledger);
    state.busy = false;
    render();
    publish({ type: "receipt", receipt });
    return receipt;
  }

  function onMsg(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "hello" && msg.node && msg.node !== node) {
      state.peers.set(msg.node, Date.now());
      if (state.root) render();
    }
    if (msg.type === "job" && msg.job && msg.job.from !== node && !state.busy) {
      publish({ type: "claim", id: msg.job.id, node });
      void execute(msg.job.seed, msg.job.from);
    }
    if (msg.type === "receipt" && msg.receipt && msg.receipt.node !== node) {
      state.ledger = [msg.receipt, ...state.ledger.filter((r) => r.at !== msg.receipt.at)].slice(0, 12);
      writeLedger(state.ledger);
      if (state.root) render();
    }
  }

  function publish(msg) {
    if (channel) {
      try { channel.postMessage(msg); } catch { /* closed */ }
    }
    try {
      localStorage.setItem("kiln-gwebgpu-bus", JSON.stringify({ ...msg, stamp: Date.now() + Math.random() }));
    } catch { /* private */ }
  }

  if (channel) channel.onmessage = (ev) => onMsg(ev.data || {});
  window.addEventListener("storage", (ev) => {
    if (ev.key !== "kiln-gwebgpu-bus" || !ev.newValue) return;
    try { onMsg(JSON.parse(ev.newValue)); } catch { /* ignore */ }
  });
  publish({ type: "hello", node });
  let polling = false;
  async function pollPlane() {
    if (polling || state.busy) return;
    if (location.pathname !== "/gpu" && location.pathname !== "/gpu/") return;
    polling = true;
    try {
      const board = await fetch("/api/kiln/loop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "gpuBoard" }),
      }).then((r) => r.json());
      const job = (board.jobs || []).find((row) => row && row.status === "open" && row.from !== node);
      if (!job) return;
      const claimed = await fetch("/api/kiln/loop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "gpuClaim", id: job.id, node }),
      }).then((r) => r.json());
      if (!claimed || !claimed.job) return;
      const receipt = await execute(claimed.job.seed >>> 0, claimed.job.from, claimed.job.n);
      await fetch("/api/kiln/loop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "gpuReceipt", id: claimed.job.id, receipt }),
      });
    } catch {
      /* the plane answers on the next beat */
    } finally {
      polling = false;
    }
  }
  setInterval(() => {
    publish({ type: "hello", node });
    void pollPlane();
    const now = Date.now();
    let dropped = false;
    for (const [id, seen] of state.peers) {
      if (now - seen > 7000) {
        state.peers.delete(id);
        dropped = true;
      }
    }
    if (dropped && state.root) render();
  }, 2000);

  function ensure() {
    const on = location.pathname === "/gpu" || location.pathname === "/gpu/";
    if (!on) {
      if (state.root) {
        state.root.remove();
        state.root = null;
      }
      return;
    }
    if (!document.getElementById("gwebgpu-css")) {
      const style = document.createElement("style");
      style.id = "gwebgpu-css";
      style.textContent = cssText();
      document.head.appendChild(style);
    }
    if (!state.root) {
      const root = document.createElement("div");
      root.id = "gwebgpu-plane";
      document.body.appendChild(root);
      state.root = root;
      root.addEventListener("click", (ev) => {
        const btn = ev.target.closest("button");
        if (!btn || state.busy) return;
        const act = btn.getAttribute("data-act");
        if (act === "run") void execute((Math.random() * 0xffffffff) >>> 0, node);
        if (act === "offer") {
          const seed = (Math.random() * 0xffffffff) >>> 0;
          void (async () => {
            let id = "";
            try {
              const offered = await fetch("/api/kiln/loop", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "gpuOffer", seed, n: DEFAULT_N, from: node }),
              }).then((r) => r.json());
              id = (offered && offered.job && offered.job.id) || "";
            } catch {
              /* this tab still runs the kernel */
            }
            publish({ type: "job", job: { id: id || crypto.randomUUID(), seed, from: node, n: DEFAULT_N } });
            const receipt = await execute(seed, node, DEFAULT_N);
            if (!id) return;
            await fetch("/api/kiln/loop", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "gpuReceipt", id, receipt }),
            }).catch(() => {});
          })();
        }
      });
      void adapterName().then((probe) => {
        state.probe = probe;
        render();
      });
      void execute(0x6b696c6e, node);
      return;
    }
    const header = document.querySelector("header");
    const top = header ? Math.ceil(header.getBoundingClientRect().bottom) : 0;
    state.root.style.top = Math.max(48, top) + "px";
  }

  const boot = () => {
    try {
      ensure();
    } catch (e) {
      console.warn("gwebgpu", e);
    }
  };
  boot();
  window.addEventListener("popstate", boot);
  const push = history.pushState.bind(history);
  history.pushState = function (...args) {
    const out = push(...args);
    boot();
    return out;
  };
  const replace = history.replaceState.bind(history);
  history.replaceState = function (...args) {
    const out = replace(...args);
    boot();
    return out;
  };
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest("a");
    if (!a) return;
    setTimeout(boot, 0);
    setTimeout(boot, 60);
  });
}
