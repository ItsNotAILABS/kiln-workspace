/**
 * G-WebGPU plane math. Same SAXPY the GPU shader runs: Y = A*X + Y.
 * Seeded so two nodes can check the same job.
 */

export const WGSL = `@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> X: array<f32>;
@group(0) @binding(2) var<storage, read_write> Y: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&Y)) { return; }
  Y[i] = A[i] * X[i] + Y[i];
}
`;

export const DEFAULT_N = 1 << 18;

export function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

export function fields(n, seed) {
  const next = lcg(seed >>> 0);
  const a = new Float32Array(n);
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = 1 + (next() & 255) / 255;
    x[i] = ((next() & 65535) / 65535) * 2 - 1;
    y[i] = ((next() & 1023) / 1023) * 0.5;
  }
  return { a, x, y };
}

const f32scratch = new Float32Array(1);
function f32(n) {
  f32scratch[0] = n;
  return f32scratch[0];
}

export function cpuSaxpy(a, x, y) {
  const out = new Float32Array(y.length);
  for (let i = 0; i < y.length; i++) out[i] = f32(f32(a[i] * x[i]) + y[i]);
  return out;
}

export function checksum(buf) {
  let xor = 0x811c9dc5;
  let sum = 0;
  const bits = new Uint32Array(buf.buffer, buf.byteOffset, buf.length);
  for (let i = 0; i < buf.length; i += 64) {
    xor = Math.imul(xor ^ bits[i], 16777619) >>> 0;
    sum += buf[i];
  }
  return { xor, sum: Math.round(sum * 1e4) / 1e4 };
}

export function agrees(left, right) {
  if (left.xor !== right.xor) return false;
  return Math.abs(left.sum - right.sum) < 0.05;
}

export function rate(n, ms) {
  const flops = (n * 2) / (ms / 1000);
  if (flops >= 1e9) return `${(flops / 1e9).toFixed(2)} GFLOP/s`;
  if (flops >= 1e6) return `${(flops / 1e6).toFixed(1)} MFLOP/s`;
  return `${Math.round(flops).toLocaleString()} FLOP/s`;
}

export function hex32(n) {
  return (n >>> 0).toString(16).padStart(8, "0");
}
