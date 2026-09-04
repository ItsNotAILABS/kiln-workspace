const LIST = "/api/gh/list";
const IMPORT = "/api/gh/import";

export async function githubListRepos(arg) {
  const query = String(arg?.data?.query || arg?.query || "").trim();
  if (!query) return { ok: false, error: "Need a GitHub user, org, or owner/repo", items: [] };
  try {
    const r = await fetch(LIST, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GitHub lookup failed", items: [] };
  }
}

export async function githubImportTree(arg) {
  const owner = String(arg?.data?.owner || arg?.owner || "").trim();
  const repo = String(arg?.data?.repo || arg?.repo || "")
    .trim()
    .replace(/\.git$/i, "");
  if (!owner || !repo) return { ok: false, error: "Need owner/repo", files: [] };
  try {
    const r = await fetch(IMPORT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner, repo }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed", files: [] };
  }
}

export { githubImportTree as r, githubListRepos as n };
