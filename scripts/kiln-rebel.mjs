/**
 * Kiln Rebel — occupancy through generation.
 * Higgsfield API is the power. The tree is the place.
 * Key lives in the seat vault, never on the computer, never in git.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";
import { spaceHome, rememberSpace } from "./kiln-space.mjs";
import { resolveInside } from "./kiln-security.mjs";
import { sealBlob, openBlob } from "./kiln-vault.mjs";
import { normalizeHandle } from "./kiln-accounts.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BASE = String(process.env.HF_API_BASE_URL || "https://api.higgsfield.ai").replace(/\/+$/, "");
const KEY_SCOPE = "higgsfield";
const JOBS = new Map();

export const REBEL_MODELS = [
  { id: "soul-2", label: "Soul 2", surface: "image", family: "soul", path: "higgsfield-ai/soul/v2/standard", aspects: ["1:1", "16:9", "9:16", "4:3", "3:4"], resolutions: ["720p", "1080p"] },
  { id: "soul-cinema", label: "Soul Cinema", surface: "image", family: "soul", path: "higgsfield-ai/soul/cinema", aspects: ["1:1", "16:9", "9:16", "4:3", "3:4"], resolutions: ["720p", "1080p"] },
  { id: "grok-imagine-2", label: "Grok Imagine 2", surface: "image", family: "grok", path: "xai/grok-imagine-image-2.0", aspects: ["1:1", "16:9", "9:16"], resolutions: ["1k", "2k"] },
  { id: "flux-2", label: "FLUX.2", surface: "image", family: "flux", path: "flux-2-pro", aspects: ["1:1", "16:9", "9:16", "4:3"], resolutions: ["1k", "2k"] },
  { id: "ideogram-4", label: "Ideogram 4", surface: "image", family: "ideogram", path: "ideogram/v4.0", aspects: ["1:1", "16:9", "9:16"], resolutions: ["1k", "2k"] },
  { id: "recraft-4.1", label: "Recraft 4.1", surface: "image", family: "recraft", path: "recraft/v4.1/text-to-image", aspects: ["1:1", "16:9", "9:16"], resolutions: ["1k", "2k"] },
  { id: "qwen-image-3", label: "Qwen Image 3", surface: "image", family: "qwen", path: "alibaba/qwen-image-3/text-to-image", aspects: ["1:1", "16:9", "9:16"], resolutions: ["1k", "2k"] },
  { id: "z-image-turbo", label: "Z-Image Turbo", surface: "image", family: "z", path: "z-image/turbo", aspects: ["1:1", "16:9", "9:16"], resolutions: ["1k"] },
  { id: "dop-lite", label: "DoP Lite", surface: "image", family: "dop", path: "higgsfield-ai/dop/lite", aspects: ["1:1", "16:9", "9:16"], resolutions: ["720p", "1080p"] },
  { id: "seedance-2.5", label: "Seedance 2.5", surface: "video", family: "seedance", path: "bytedance/seedance-2.5", aspects: ["16:9", "9:16", "1:1"], durations: ["4", "5", "8"] },
  { id: "seedance-2", label: "Seedance 2.0", surface: "video", family: "seedance", path: "bytedance/seedance-2.0", aspects: ["16:9", "9:16", "1:1"], durations: ["5", "8"] },
  { id: "seedance-2-fast", label: "Seedance 2.0 Fast", surface: "video", family: "seedance", path: "bytedance/seedance-2.0/fast", aspects: ["16:9", "9:16"], durations: ["5", "8"] },
  { id: "kling-3-turbo", label: "Kling 3.0 Turbo", surface: "video", family: "kling", path: "kling-video/v3.0-turbo/text-to-video", pathImage: "kling-video/v3.0-turbo/image-to-video", aspects: ["16:9", "9:16", "1:1"], durations: ["5", "10"] },
  { id: "kling-3-pro", label: "Kling 3.0 Pro", surface: "video", family: "kling", path: "kling-video/v3.0/pro/text-to-video", pathImage: "kling-video/v3.0/pro/image-to-video", aspects: ["16:9", "9:16"], durations: ["5", "10"] },
  { id: "wan-3", label: "Wan 3.0", surface: "video", family: "wan", path: "alibaba/wan-3.0/text-to-video", aspects: ["16:9", "9:16"], durations: ["5", "8"] },
  { id: "minimax-hailuo-2.3", label: "Hailuo 2.3", surface: "video", family: "minimax", path: "minimax/hailuo-2.3/standard/text-to-video", aspects: ["16:9", "9:16"], durations: ["6", "10"] },
  { id: "happy-horse-1", label: "Happy Horse 1.0", surface: "video", family: "horse", path: "alibaba/happy-horse/text-to-video", aspects: ["16:9", "9:16"], durations: ["5"] },
  { id: "pixverse-6", label: "PixVerse 6", surface: "video", family: "pixverse", path: "pixverse/v6/text-to-video", aspects: ["16:9", "9:16"], durations: ["5", "8"] },
  { id: "ltx-2.5-pro", label: "LTX 2.5 Pro", surface: "video", family: "ltx", path: "lightricks/ltx-2.5/text-to-video/pro", aspects: ["16:9", "9:16"], durations: ["5", "8"] },
  { id: "grok-imagine-video", label: "Grok Imagine Video", surface: "video", family: "grok", path: "xai/grok-imagine-video/v1.5/text-to-video", pathImage: "xai/grok-imagine-video/v1.5/reference-to-video", aspects: ["16:9", "9:16"], durations: ["6", "10"] },
];

function modelOf(id) {
  return REBEL_MODELS.find((m) => m.id === id) || null;
}

function splitRepo(repoId) {
  const raw = String(repoId || "").replace(/^\/+/, "");
  const [owner, ...rest] = raw.split("/");
  const name = (rest.join("/") || "home").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 40);
  const handle = normalizeHandle(owner);
  return { owner: handle, name, id: `${handle}/${name}` };
}

function gitCommit(dir, message) {
  if (!fs.existsSync(path.join(dir, ".git"))) {
    spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" });
    spawnSync("git", ["config", "user.email", "rebel@kiln"], { cwd: dir, encoding: "utf8" });
    spawnSync("git", ["config", "user.name", "Kiln Rebel"], { cwd: dir, encoding: "utf8" });
  }
  spawnSync("git", ["add", "-A"], { cwd: dir, encoding: "utf8" });
  spawnSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", String(message || "rebel occupy").slice(0, 72), "--allow-empty"], {
    cwd: dir,
    encoding: "utf8",
  });
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" });
  return String(r.stdout || "").trim();
}

function runsFile(repoId) {
  return path.join(spaceHome(splitRepo(repoId).id), "rebel", "RUNS.json");
}

function loadRuns(repoId) {
  try {
    const doc = JSON.parse(fs.readFileSync(runsFile(repoId), "utf8"));
    return Array.isArray(doc.runs) ? doc : { repoId: splitRepo(repoId).id, runs: [] };
  } catch {
    return { repoId: splitRepo(repoId).id, runs: [] };
  }
}

function saveRuns(repoId, doc) {
  const { id } = splitRepo(repoId);
  const dest = runsFile(id);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify({ repoId: id, updatedAt: new Date().toISOString(), runs: (doc.runs || []).slice(0, 80) }, null, 2));
}

function publicCatalog() {
  return REBEL_MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    surface: m.surface,
    family: m.family,
    aspects: m.aspects || ["1:1"],
    resolutions: m.resolutions || [],
    durations: m.durations || [],
  }));
}

function mapBody(model, { prompt, aspect, resolution, duration, imageUrl }) {
  const body = { prompt: String(prompt || "").slice(0, 4000) };
  if (aspect) body.aspect_ratio = aspect;
  if (resolution) body.resolution = resolution;
  if (duration) body.duration = Number(duration) || duration;
  if (model.family === "soul") {
    body.batch_size = 1;
    body.enhance_prompt = false;
  }
  if (imageUrl) {
    if (model.family === "kling" || model.family === "seedance" || model.family === "wan" || model.family === "grok") {
      body.image_url = imageUrl;
      body.image_urls = [imageUrl];
    }
  }
  return body;
}

function mapPath(model, { imageUrl }) {
  if (imageUrl && model.pathImage) return model.pathImage;
  return model.path;
}

function authHeader(key) {
  const raw = String(key || "").trim();
  if (!raw) return "";
  if (/^key\s+/i.test(raw)) return raw;
  return "Key " + raw.replace(/^key\s+/i, "");
}

function readKey(handle, secret) {
  if (!handle || !secret) return "";
  const opened = openBlob({ handle, scope: KEY_SCOPE, secret });
  if (opened.ok && opened.text) return String(opened.text).trim();
  return "";
}

function hasKey(handle, secret) {
  return !!readKey(handle, secret);
}

async function hfSend(key, method, pth, body) {
  const url = `${BASE}${pth.startsWith("/") ? pth : "/" + pth}`;
  const res = await fetch(url, {
    method,
    headers: {
      authorization: authHeader(key),
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 800) };
  }
  if (!res.ok) {
    const err = data?.detail || data?.error || data?.message || `higgsfield ${res.status}`;
    const e = new Error(typeof err === "string" ? err : JSON.stringify(err).slice(0, 240));
    e.status = res.status;
    e.body = data;
    throw e;
  }
  return data;
}

function recordJob(job) {
  JOBS.set(job.requestId, job);
  try {
    const doc = loadRuns(job.repoId);
    const i = doc.runs.findIndex((r) => r.requestId === job.requestId);
    const slim = {
      requestId: job.requestId,
      model: job.model,
      surface: job.surface,
      prompt: job.prompt,
      status: job.status,
      repoId: job.repoId,
      path: job.path || "",
      url: job.url || "",
      error: job.error || "",
      at: job.at || new Date().toISOString(),
    };
    if (i >= 0) doc.runs[i] = { ...doc.runs[i], ...slim };
    else doc.runs.unshift(slim);
    saveRuns(job.repoId, doc);
  } catch {
    /* disk later */
  }
}

async function depositMedia(job, mediaUrl) {
  const { id } = splitRepo(job.repoId);
  const dir = spaceHome(id);
  const extGuess = job.surface === "video" ? "mp4" : "png";
  let buf;
  let ext = extGuess;
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error("could not pull output");
  const ctype = String(res.headers.get("content-type") || "");
  if (ctype.includes("webm")) ext = "webm";
  else if (ctype.includes("mp4")) ext = "mp4";
  else if (ctype.includes("jpeg")) ext = "jpg";
  else if (ctype.includes("webp")) ext = "webp";
  else if (ctype.includes("png")) ext = "png";
  else if (ctype.includes("gif")) ext = "gif";
  buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 48_000_000) throw new Error("output too large to occupy");
  const rel = `rebel/${String(job.requestId).slice(0, 8)}-${job.model}.${ext}`;
  const dest = resolveInside(dir, rel);
  if (!dest) throw new Error("bad path");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  const metaRel = `rebel/${String(job.requestId).slice(0, 8)}-${job.model}.json`;
  const metaDest = resolveInside(dir, metaRel);
  fs.writeFileSync(
    metaDest,
    JSON.stringify(
      {
        requestId: job.requestId,
        model: job.model,
        prompt: job.prompt,
        surface: job.surface,
        source: mediaUrl,
        occupied: rel,
        isolation: `kiln://${id}`,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  const commit = gitCommit(dir, `rebel occupy ${job.model} ${rel}`);
  rememberSpace({ repoId: id, kind: "lattice", text: `rebel ${job.model} ${rel}` });
  return { path: rel, bytes: buf.length, sha256: sha, commit, isolation: `kiln://${id}` };
}

function pickMedia(status) {
  const images = Array.isArray(status?.images) ? status.images : [];
  const img = images.find((x) => x && x.url)?.url;
  const video = status?.video?.url || status?.video_url;
  const jobs = Array.isArray(status?.jobs) ? status.jobs : [];
  for (const j of jobs) {
    const u = j?.results?.raw?.url || j?.results?.min?.url || j?.url;
    if (u) return u;
  }
  return video || img || status?.url || "";
}

export async function runRebel(args = {}, ctx = {}) {
  const action = String(args.action || args.op || "catalog");
  const viewer = ctx.viewer || null;
  const secret = ctx.secret || "";
  const handle = viewer ? normalizeHandle(viewer) : "";

  if (action === "catalog") {
    return {
      ok: true,
      power: "higgsfield",
      base: "https://api.higgsfield.ai",
      keyed: !!(handle && secret && hasKey(handle, secret)),
      models: publicCatalog(),
      claim: "A rebel occupies the cell it writes. Generation is occupancy.",
    };
  }

  if (!handle) return { ok: false, error: "sign in to occupy" };

  if (action === "key") {
    const raw = String(args.key || args.secret || args.value || "").trim();
    if (!raw) return { ok: false, error: "paste id:secret" };
    if (!secret) return { ok: false, error: "session unwrap missing" };
    const sealed = sealBlob({ handle, scope: KEY_SCOPE, plaintext: raw, secret });
    if (!sealed.ok) return sealed;
    return { ok: true, keyed: true, commitment: sealed.commitment };
  }

  if (action === "key-status") {
    return { ok: true, keyed: hasKey(handle, secret) };
  }

  const repoId = splitRepo(args.repo || args.repoId || `${handle}/home`).id;
  if (!repoId.startsWith(handle + "/") && handle !== "kiln") {
    return { ok: false, error: "isolation: that computer is not yours" };
  }

  if (action === "runs") {
    const doc = loadRuns(repoId);
    return { ok: true, repoId, runs: doc.runs.slice(0, 40), keyed: hasKey(handle, secret) };
  }

  if (action === "submit") {
    const model = modelOf(args.model);
    if (!model) return { ok: false, error: "unknown model" };
    const prompt = String(args.prompt || "").trim();
    if (prompt.length < 3) return { ok: false, error: "prompt too short" };
    const key = readKey(handle, secret);
    if (!key) return { ok: false, error: "seal a Higgsfield key first", need: "key" };
    const body = mapBody(model, {
      prompt,
      aspect: args.aspect || args.aspect_ratio,
      resolution: args.resolution,
      duration: args.duration,
      imageUrl: args.imageUrl || args.image_url,
    });
    const pth = mapPath(model, { imageUrl: args.imageUrl || args.image_url });
    try {
      const queued = await hfSend(key, "POST", pth, body);
      const requestId = queued.request_id || queued.requestId;
      if (!requestId) return { ok: false, error: "no request_id", raw: queued };
      const job = {
        requestId,
        status: queued.status || "queued",
        model: model.id,
        surface: model.surface,
        prompt,
        repoId,
        handle,
        at: new Date().toISOString(),
        path: pth,
      };
      recordJob(job);
      return { ok: true, ...job, isolation: `kiln://${repoId}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "submit failed" };
    }
  }

  if (action === "status") {
    const requestId = String(args.requestId || args.request_id || "").trim();
    if (!requestId) return { ok: false, error: "requestId required" };
    const key = readKey(handle, secret);
    if (!key) return { ok: false, error: "seal a Higgsfield key first", need: "key" };
    try {
      const status = await hfSend(key, "GET", `/requests/${encodeURIComponent(requestId)}/status`);
      const st = String(status.status || "unknown");
      let job = JOBS.get(requestId) || { requestId, repoId, handle, model: args.model || "unknown", surface: "image", prompt: "" };
      job.status = st;
      job.raw = { status: st };
      if (st === "completed" || st === "success" || st === "done") {
        const media = pickMedia(status);
        job.url = media;
        if (media && !job.deposited) {
          try {
            const dep = await depositMedia(job, media);
            job.deposited = true;
            job.file = dep.path;
            job.bytes = dep.bytes;
            job.commit = dep.commit;
            job.sha256 = dep.sha256;
          } catch (e) {
            job.error = e instanceof Error ? e.message : "deposit failed";
          }
        }
      }
      if (st === "failed" || st === "nsfw" || st === "canceled") {
        job.error = status.error || st;
      }
      recordJob(job);
      return {
        ok: true,
        requestId,
        status: st,
        url: job.url || "",
        file: job.file || "",
        commit: job.commit || "",
        error: job.error || "",
        isolation: `kiln://${job.repoId}`,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "status failed" };
    }
  }

  if (action === "cancel") {
    const requestId = String(args.requestId || "").trim();
    if (!requestId) return { ok: false, error: "requestId required" };
    const key = readKey(handle, secret);
    if (!key) return { ok: false, error: "seal a Higgsfield key first", need: "key" };
    try {
      const out = await hfSend(key, "POST", `/requests/${encodeURIComponent(requestId)}/cancel`, {});
      return { ok: true, requestId, status: out.status || "canceled" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "cancel failed" };
    }
  }

  return { ok: false, error: `unknown rebel action ${action}` };
}
