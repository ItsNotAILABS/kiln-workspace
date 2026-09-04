function e(){if(!(typeof navigator>`u`))return navigator.gpu}var t=null;async function n(){if(t)return t;let n=e();if(!n)return t={available:!1,adapter:`none`,features:[],reason:`This browser has no WebGPU.`},t;try{let e=await n.requestAdapter();return e?(t={available:!0,adapter:e.info?.device||`adapter`,features:[...e.features.values()]},t):(t={available:!1,adapter:`none`,features:[],reason:`No GPU adapter.`},t)}catch(e){return t={available:!1,adapter:`none`,features:[],reason:e instanceof Error?e.message:`GPU probe failed`},t}}async function r(t){let n=Math.min(t.length,4096),r=new Uint32Array(Math.max(64,Math.ceil(n/4)));for(let e=0;e<n;e++)r[e>>2]|=t[e]<<(e&3)*8;let i=e();if(i)try{let e=await i.requestAdapter();if(e){let t=await e.requestDevice(),n=t.createShaderModule({code:`
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
fn rotl(x: u32, n: u32) -> u32 { return (x << n) | (x >> (32u - n)); }
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&input)) { return; }
  var x = input[i];
  x = x * 2654435761u;
  x = rotl(x, 13u) ^ (x >> 7u);
  x = x * 1597334677u;
  output[i] = x ^ (i * 0x9e3779b9u);
}
`}),i=t.createComputePipeline({layout:`auto`,compute:{module:n,entryPoint:`main`}}),a=t.createBuffer({size:r.byteLength,usage:136}),o=t.createBuffer({size:r.byteLength,usage:132}),s=t.createBuffer({size:r.byteLength,usage:9});t.queue.writeBuffer(a,0,r);let c=i.getBindGroupLayout(0),l=t.createBindGroup({layout:c,entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:o}}]}),u=t.createCommandEncoder(),d=u.beginComputePass();d.setPipeline(i),d.setBindGroup(0,l),d.dispatchWorkgroups(Math.ceil(r.length/64)),d.end(),u.copyBufferToBuffer(o,0,s,0,r.byteLength),t.queue.submit([u.finish()]),await s.mapAsync(1);let f=new Uint32Array(s.getMappedRange().slice(0));s.unmap();let p=0,m=1;for(let e of f)p=p+e>>>0,m=Math.imul(m,e||1)>>>0;return t.destroy(),{hex:(p.toString(16).padStart(8,`0`)+m.toString(16).padStart(8,`0`)).repeat(2).slice(0,64),via:`webgpu`}}}catch{}let a=await crypto.subtle.digest(`SHA-256`,t);return{hex:[...new Uint8Array(a)].map(e=>e.toString(16).padStart(2,`0`)).join(``),via:`cpu`}}async function i(e){return r(new TextEncoder().encode(e.join(`|`)))}async function a(e){return{...await i(e.length?e:[`empty`]),cells:e.length}}export{r as gpuMix,a as gpuPaint,n as probeGpu};