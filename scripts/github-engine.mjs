#!/usr/bin/env node
/**
 * KILN public-tree import engine.
 *
 * Same-origin API used by the original New page
 * (githubListRepos / githubImportTree). Looks up any public GitHub
 * user, org, or owner/repo — not a hardcoded list — then pulls
 * GitHub's own zipball (Code → Download ZIP) and unpacks it.
 *
 * Lookup order:
 *   1. ungh.cc (no GitHub REST quota)
 *   2. api.github.com
 *   3. github.com HTML
 *   4. GitHub search (users + repositories)
 *
 * Import order:
 *   1. zipball from codeload.github.com
 *   2. file tree (ungh / git trees) + raw.githubusercontent.com
 *
 * Nothing in the original UI is rewritten. This is the engine
 * those buttons already call.
 */
import zlib from "node:zlib";

const UA = "KILN-import-engine/1.0 (+https://kiln.app)";
const UNGH = "https://ungh.cc";
const GH = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const CODELOAD = "https://codeload.github.com";

const SKIP_DIR = new Set([
  "node_modules", "dist", "build", ".git", "vendor", "target",
  ".next", "coverage", "__pycache__", ".venv", "out", ".turbo",
  ".cache", "Pods",
]);
const SKIP_EXT =
  /\.(png|jpe?g|gif|webp|pdf|zip|tar|gz|tgz|wasm|woff2?|mp4|webm|ico|bin|pyc|so|dylib|exe|lock|map|ttf|otf|eot|mp3|wav|ogg|psd|ai|sketch|fig)$/i;

const MAX_FILES = 2500;
const MAX_BYTES = 40_000_000;
const MAX_FILE = 1_500_000;
const MAX_ZIP = 80_000_000;
const LOOKUP_TTL_MS = 5 * 60 * 1000;

const lookupCache = new Map();

function skipPath(p) {
  const parts = String(p).split("/").filter(Boolean);
  for (const part of parts) {
    if (SKIP_DIR.has(part)) return true;
    if (part.startsWith(".") && part !== ".github" && part !== ".gitignore") return true;
  }
  return SKIP_EXT.test(p);
}

function json(status, body) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}

async function get(url, { binary = false, timeout = 18000, maxBytes = 0 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": UA },
      signal: ac.signal,
      redirect: "follow",
    });
    if (binary) {
      if (maxBytes && Number(r.headers.get("content-length") || 0) > maxBytes) {
        return { ok: false, status: 413, data: null, error: "archive too large" };
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (maxBytes && buf.length > maxBytes) {
        return { ok: false, status: 413, data: null, error: "archive too large" };
      }
      return { ok: r.ok, status: r.status, data: buf };
    }
    const text = await r.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text.slice(0, 240), html: text };
    }
    return { ok: r.ok, status: r.status, data, text };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : "fetch failed" };
  } finally {
    clearTimeout(t);
  }
}

function parseQuery(raw) {
  let q = String(raw || "").trim();
  if (!q) return { kind: "empty", query: "" };
  q = q.replace(/^@/, "");
  const url = q.match(/github\.com[/:]([^/\s?#]+)(?:\/([^/\s?#]+))?/i);
  if (url) {
    const owner = url[1];
    const repo = (url[2] || "").replace(/\.git$/i, "").replace(/\/$/, "");
    return repo ? { kind: "repo", owner, repo, query: `${owner}/${repo}` } : { kind: "user", owner, query: owner };
  }
  if (/^https?:\/\//i.test(q)) {
    return { kind: "search", query: q };
  }
  const parts = q.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const owner = parts[0].replace(/\.git$/i, "");
    const repo = parts[1].replace(/\.git$/i, "");
    return { kind: "repo", owner, repo, query: `${owner}/${repo}` };
  }
  if (/\s/.test(q) || /[:.]/.test(q)) {
    return { kind: "search", query: q };
  }
  return { kind: "user", owner: q, query: q };
}

function mapGhRepo(r) {
  const full = r.full_name || r.repo || (r.owner && r.name ? `${typeof r.owner === "string" ? r.owner : r.owner.login}/${r.name}` : r.name);
  const [owner, name] = String(full || "").split("/");
  return {
    fullName: full,
    name: r.name || name || "",
    owner: (typeof r.owner === "string" ? r.owner : r.owner?.login) || owner || "",
    description: r.description || "",
    language: r.language || r.lang || "",
    stars: r.stargazers_count ?? r.stars ?? 0,
    forks: r.forks_count ?? r.forks ?? 0,
    fork: !!r.fork,
    archived: !!r.archived,
    htmlUrl: r.html_url || (full ? `https://github.com/${full}` : ""),
    defaultBranch: r.default_branch || r.defaultBranch || "main",
    topics: r.topics || [],
    license: r.license?.spdx_id || r.license?.name || r.license || "MIT",
  };
}

function mapUnghRepo(r) {
  const full = r.repo || `${r.owner || ""}/${r.name}`;
  const [owner, name] = String(full).split("/");
  return {
    fullName: full,
    name: r.name || name,
    owner: owner,
    description: r.description || "",
    language: r.language || "",
    stars: r.stars || 0,
    forks: r.forks || 0,
    fork: !!r.fork,
    archived: !!r.archived,
    htmlUrl: `https://github.com/${full}`,
    defaultBranch: r.defaultBranch || "main",
    topics: [],
    license: "MIT",
  };
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = String(it.fullName || "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

async function listUnghUser(owner) {
  const res = await get(`${UNGH}/users/${encodeURIComponent(owner)}/repos`);
  if (!res.ok || !res.data?.repos) return [];
  return res.data.repos.map(mapUnghRepo);
}

async function getUnghRepo(owner, repo) {
  const res = await get(`${UNGH}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (!res.ok || !res.data?.repo) return null;
  const r = res.data.repo;
  return mapUnghRepo({
    repo: r.repo || `${owner}/${repo}`,
    name: r.name || repo,
    description: r.description,
    stars: r.stars,
    forks: r.forks,
    defaultBranch: r.defaultBranch,
    language: r.language,
  });
}

async function listGhUser(owner) {
  let res = await get(`${GH}/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated`);
  if (!res.ok) res = await get(`${GH}/orgs/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated`);
  if (!res.ok || !Array.isArray(res.data)) return [];
  return res.data.map(mapGhRepo);
}

async function getGhRepo(owner, repo) {
  const res = await get(`${GH}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (!res.ok || !res.data?.full_name) return null;
  return mapGhRepo(res.data);
}

function parseHtmlRepos(html, owner) {
  const names = [];
  const re = new RegExp(`href="/(${owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[A-Za-z0-9._-]+)"`, "gi");
  let m;
  while ((m = re.exec(html))) names.push(m[1]);
  const hover = html.matchAll(/data-hovercard-type="repository"[^>]*href="\/([^"]+)"/gi);
  for (const h of hover) names.push(h[1]);
  return dedupe(
    [...new Set(names.map((n) => n.replace(/\/$/, "")))]
      .filter((n) => n.toLowerCase().startsWith(owner.toLowerCase() + "/"))
      .map((full) => {
        const [, name] = full.split("/");
        return {
          fullName: full,
          name,
          owner,
          description: "",
          language: "",
          stars: 0,
          forks: 0,
          htmlUrl: `https://github.com/${full}`,
          defaultBranch: "main",
          topics: [],
          license: "MIT",
        };
      }),
  );
}

async function listHtmlUser(owner) {
  const pages = [
    `https://github.com/${encodeURIComponent(owner)}?tab=repositories`,
    `https://github.com/orgs/${encodeURIComponent(owner)}/repositories`,
    `https://github.com/${encodeURIComponent(owner)}`,
  ];
  for (const url of pages) {
    const res = await get(url);
    const html = res.text || res.data?.html || "";
    if (!html || html.length < 200) continue;
    const items = parseHtmlRepos(html, owner);
    if (items.length) return items;
  }
  return [];
}

async function searchGh(query) {
  const items = [];
  const users = await get(`${GH}/search/users?q=${encodeURIComponent(query)}&per_page=5`);
  if (users.ok && Array.isArray(users.data?.items)) {
    for (const u of users.data.items.slice(0, 3)) {
      const listed = await listUnghUser(u.login);
      if (listed.length) items.push(...listed);
      else items.push(...(await listGhUser(u.login)));
    }
  }
  const repos = await get(
    `${GH}/search/repositories?q=${encodeURIComponent(query)}&per_page=30&sort=updated`,
  );
  if (repos.ok && Array.isArray(repos.data?.items)) {
    items.push(...repos.data.items.map(mapGhRepo));
  }
  return items;
}

async function lookup(query) {
  const parsed = parseQuery(query);
  if (parsed.kind === "empty") {
    return { ok: false, error: "Need a GitHub user, org, owner/repo, or search", items: [] };
  }
  const cacheKey = parsed.query.toLowerCase();
  const hit = lookupCache.get(cacheKey);
  if (hit && Date.now() - hit.at < LOOKUP_TTL_MS) return hit.result;

  const items = [];
  try {
    if (parsed.kind === "repo") {
      const one =
        (await getUnghRepo(parsed.owner, parsed.repo)) ||
        (await getGhRepo(parsed.owner, parsed.repo));
      if (one) items.push(one);
    } else if (parsed.kind === "user") {
      let listed = await listUnghUser(parsed.owner);
      if (listed.length < 20) {
        listed = dedupe(listed.concat(await listHtmlUser(parsed.owner), await listGhUser(parsed.owner)));
      }
      items.push(...listed);
      if (!listed.length) {
        items.push(...(await searchGh(parsed.query)));
      }
    } else {
      items.push(...(await searchGh(parsed.query)));
    }
  } catch (e) {
    const result = {
      ok: false,
      error: e instanceof Error ? e.message : "GitHub lookup failed",
      items: [],
    };
    return result;
  }

  const result = {
    ok: true,
    items: dedupe(items),
    via: "kiln-import-engine",
    query: parsed.query,
    kind: parsed.kind,
  };
  if (!result.items.length) {
    result.ok = false;
    result.error = `No public repositories for "${parsed.query}". Try owner/repo or a GitHub username.`;
  }
  lookupCache.set(cacheKey, { at: Date.now(), result });
  return result;
}

function unzip(buf) {
  const files = [];
  let eocd = -1;
  const start = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zipball");
  const cdOff = buf.readUInt32LE(eocd + 16);
  const cdEntries = buf.readUInt16LE(eocd + 10);
  let p = cdOff;
  for (let n = 0; n < cdEntries; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith("/")) continue;
    const lp = localOff;
    if (lp + 30 > buf.length || buf.readUInt32LE(lp) !== 0x04034b50) continue;
    const lNameLen = buf.readUInt16LE(lp + 26);
    const lExtra = buf.readUInt16LE(lp + 28);
    const dataStart = lp + 30 + lNameLen + lExtra;
    const compressed = buf.subarray(dataStart, dataStart + compSize);
    let data;
    try {
      if (method === 0) data = compressed;
      else if (method === 8) data = zlib.inflateRawSync(compressed);
      else continue;
    } catch {
      continue;
    }
    files.push({ path: name, data });
  }
  return files;
}

function stripZipRoot(path) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return path;
  return parts.slice(1).join("/");
}

function selectTextFiles(entries) {
  const files = [];
  let skipped = 0;
  let bytes = 0;
  const sorted = entries
    .map((e) => ({ path: stripZipRoot(e.path), data: e.data }))
    .filter((e) => e.path && !e.path.endsWith("/"))
    .sort((a, b) => a.path.localeCompare(b.path));
  for (const e of sorted) {
    if (skipPath(e.path)) {
      skipped += 1;
      continue;
    }
    if (!e.data || e.data.length > MAX_FILE) {
      skipped += 1;
      continue;
    }
    if (files.length >= MAX_FILES || bytes + e.data.length > MAX_BYTES) {
      skipped += 1;
      continue;
    }
    const sample = e.data.subarray(0, 800);
    if (sample.includes(0)) {
      skipped += 1;
      continue;
    }
    const content = e.data.toString("utf8");
    bytes += content.length;
    files.push({
      path: e.path,
      content,
      size: content.length,
      language: "",
      sha: "",
      encrypted: false,
    });
  }
  return { files, skipped };
}

async function importZip(owner, repo, branch) {
  const refs = [
    `refs/heads/${branch}`,
    branch,
    "refs/heads/main",
    "refs/heads/master",
    "HEAD",
  ];
  const seen = new Set();
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    const url = `${CODELOAD}/${owner}/${repo}/zip/${ref}`;
    const res = await get(url, { binary: true, timeout: 25000, maxBytes: MAX_ZIP });
    if (!res.ok || !res.data || res.data.length < 64) continue;
    if (res.data[0] !== 0x50 || res.data[1] !== 0x4b) continue;
    try {
      const unpacked = unzip(res.data);
      const picked = selectTextFiles(unpacked);
      if (picked.files.length) {
        return { ...picked, via: "zip", branch: ref.replace(/^refs\/heads\//, "") };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function importTree(owner, repo, branch) {
  let filesMeta = [];
  let sha = branch;
  const ungh = await get(`${UNGH}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/files/${encodeURIComponent(branch)}`);
  if (ungh.ok && Array.isArray(ungh.data?.files)) {
    filesMeta = ungh.data.files;
    sha = ungh.data.meta?.sha || branch;
  } else {
    const tree = await get(`${GH}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (tree.ok && Array.isArray(tree.data?.tree)) {
      filesMeta = tree.data.tree.filter((e) => e.type === "blob").map((e) => ({ path: e.path, sha: e.sha, size: e.size }));
      sha = tree.data.sha || branch;
    }
  }
  const blobs = filesMeta.filter((e) => e.path && !skipPath(e.path)).slice(0, MAX_FILES);
  const files = [];
  let skipped = filesMeta.length - blobs.length;
  let bytes = 0;
  for (const b of blobs) {
    if (bytes > MAX_BYTES) {
      skipped += 1;
      continue;
    }
    if (b.size && b.size > MAX_FILE) {
      skipped += 1;
      continue;
    }
    const raw = await get(`${RAW}/${owner}/${repo}/${branch}/${b.path}`, { binary: true, timeout: 12000, maxBytes: MAX_FILE + 1 });
    if (!raw.ok || !raw.data) {
      skipped += 1;
      continue;
    }
    if (raw.data.includes(0) && raw.data.subarray(0, 400).includes(0)) {
      skipped += 1;
      continue;
    }
    const content = raw.data.toString("utf8");
    bytes += content.length;
    files.push({
      path: b.path,
      content,
      size: content.length,
      language: "",
      sha: b.sha || "",
      encrypted: false,
    });
  }
  return files.length ? { files, skipped, via: "git tree", branch, sha } : null;
}

async function importRepo(owner, repo) {
  owner = String(owner || "").trim();
  repo = String(repo || "").replace(/\.git$/i, "").trim();
  if (!owner || !repo) return { ok: false, error: "Need owner/repo", files: [] };

  const metaItem =
    (await getUnghRepo(owner, repo)) ||
    (await getGhRepo(owner, repo)) ||
    {
      fullName: `${owner}/${repo}`,
      name: repo,
      owner,
      description: "",
      language: "",
      stars: 0,
      forks: 0,
      htmlUrl: `https://github.com/${owner}/${repo}`,
      defaultBranch: "main",
      topics: [],
      license: "MIT",
    };
  const branch = metaItem.defaultBranch || "main";

  let packed = await importZip(owner, repo, branch);
  if (!packed) packed = await importTree(owner, repo, branch);
  if (!packed || !packed.files.length) {
    return { ok: false, error: `Could not fetch ${owner}/${repo}`, files: [] };
  }

  return {
    ok: true,
    files: packed.files,
    skipped: packed.skipped || 0,
    via: packed.via,
    meta: {
      owner,
      repo,
      name: metaItem.name || repo,
      fullName: metaItem.fullName || `${owner}/${repo}`,
      branch: packed.branch || branch,
      defaultBranch: branch,
      description: metaItem.description || "",
      htmlUrl: metaItem.htmlUrl,
      stars: metaItem.stars || 0,
      forks: metaItem.forks || 0,
      license: metaItem.license || "MIT",
      language: metaItem.language || "",
      topics: metaItem.topics || [],
      sha: packed.sha || packed.branch || branch,
    },
  };
}

export async function githubListRepos(arg) {
  const query = String(arg?.data?.query || arg?.query || "").trim();
  return lookup(query);
}

export async function githubImportTree(arg) {
  const owner = String(arg?.data?.owner || arg?.owner || "").trim();
  const repo = String(arg?.data?.repo || arg?.repo || "").trim();
  return importRepo(owner, repo);
}

const MAX_ACCOUNT = 24;

function rankAccountRepos(items, login) {
  const me = String(login || "").toLowerCase();
  const score = (r) => {
    let n = 0;
    if (String(r.owner || "").toLowerCase() === me) n += 1_000_000;
    if (!r.fork) n += 100_000;
    if (!r.archived) n += 10_000;
    n += Number(r.stars || 0);
    return n;
  };
  return [...items].sort((a, b) => score(b) - score(a));
}

export async function githubImportAccount(arg) {
  const q = String(arg?.data?.query || arg?.query || arg?.q || "").trim();
  const limit = Math.min(MAX_ACCOUNT, Math.max(1, Number(arg?.data?.limit || arg?.limit || MAX_ACCOUNT) || MAX_ACCOUNT));
  const listed = await lookup(q);
  const parsed = parseQuery(q);
  const login = parsed.owner || q.replace(/^@/, "");
  const ranked = rankAccountRepos(listed.items || [], login);
  const items = ranked.slice(0, limit);
  return {
    ok: items.length > 0,
    login,
    query: q,
    total: (listed.items || []).length,
    limit,
    via: listed.via || "engine",
    error: items.length ? undefined : listed.error || `No public repositories for "${q}"`,
    items,
  };
}

export async function handleGithubRequest(pathname, searchParams) {
  if (!pathname.startsWith("/api/github")) return null;
  if (pathname === "/api/github" || pathname === "/api/github/") {
    const q = String(searchParams.get("q") || searchParams.get("query") || "").trim();
    if (q) {
      const result = await lookup(q);
      return json(result.ok || result.items?.length ? 200 : 404, result);
    }
    return json(200, {
      engine: "kiln-import-engine",
      lookup: "/api/github/lookup?q=",
      import: "/api/github/import?owner=&repo=",
      account: "/api/github/account?q=",
    });
  }
  if (pathname === "/api/github/lookup") {
    const q = searchParams.get("q") || searchParams.get("query") || "";
    const result = await lookup(q);
    return json(result.ok || result.items?.length ? 200 : 404, result);
  }
  if (pathname === "/api/github/account" || pathname === "/api/github/import-account") {
    const q = searchParams.get("q") || searchParams.get("query") || "";
    const limit = searchParams.get("limit") || "";
    const result = await githubImportAccount({ query: q, limit });
    return json(result.ok ? 200 : 404, result);
  }
  if (pathname === "/api/github/import") {
    const owner = searchParams.get("owner") || "";
    const repo = searchParams.get("repo") || "";
    const result = await importRepo(owner, repo);
    return json(result.ok ? 200 : 400, result);
  }
  const m = pathname.match(/^\/api\/github\/import\/([^/]+)\/([^/]+)$/);
  if (m) {
    const result = await importRepo(decodeURIComponent(m[1]), decodeURIComponent(m[2]));
    return json(result.ok ? 200 : 400, result);
  }
  return json(404, { ok: false, error: "unknown github engine path" });
}
