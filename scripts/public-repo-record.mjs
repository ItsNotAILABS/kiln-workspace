// Public repo records — the ONE shaping implementation for the records
// serve-original.mjs serves (public account surface + account doc).
//
// The daemon's repo details are the schema source. These functions carry
// every contract field through; a field may be added here, never dropped
// here. scripts/public-repo-contract.test.mjs pins the contract: if a
// declared field stops surviving this shaping, the test fails.
//
// Contract fields beyond the basics (ENTERPRISE-PLAN §3):
//   pages: { enabled: boolean, path: string }  — from details.pages
//          {enabled, branch, path}; branch is an internal hosting detail
//          and is NOT published.
//   paper: { enabled: boolean }               — from details.paper {enabled}
// Both are ALWAYS emitted (disabled defaults when the daemon omits them),
// so a consumer can rely on their presence instead of guessing whether
// absence means "off" or "dropped on the way".

export function surfaceFields(details) {
  const pages = details && typeof details === "object" ? details.pages : null;
  const paper = details && typeof details === "object" ? details.paper : null;
  return {
    pages: {
      enabled: !!(pages && pages.enabled),
      path: pages && typeof pages.path === "string" ? pages.path : "",
    },
    paper: { enabled: !!(paper && paper.enabled) },
  };
}

// The public account surface record (computePublicRepo's shape).
// parts: { owner, repo, branch, commits, files, readme, languages, language, tip }
export function publicRepoRecord(details, parts) {
  const { owner, repo, branch, commits, files, readme, languages, language, tip } = parts;
  return {
    id: `${owner}/${repo}`,
    owner,
    name: repo,
    description: details.description || "",
    topics: Array.isArray(details.topics) ? details.topics : [],
    visibility: "public",
    defaultBranch: branch,
    createdAt: details.createdAt || null,
    updatedAt: tip?.date || details.createdAt || null,
    commitCount: typeof details.commitCount === "number" ? details.commitCount : commits.length,
    fileCount: typeof details.fileCount === "number" ? details.fileCount : files.length,
    tip: tip
      ? { sha: tip.sha, shortSha: String(tip.sha).slice(0, 7), subject: tip.subject, author: tip.author, date: tip.date }
      : null,
    commits,
    files,
    readme,
    language,
    languages,
    ...surfaceFields(details),
  };
}

// The account-doc record (forgeRepoRecord's shape).
// parts: { owner, name, branch, tip, files, fileCountFallback, languages, language, readme }
export function forgeRepoRecordShape(details, parts) {
  const { owner, name, branch, tip, files, fileCountFallback, languages, language, readme } = parts;
  return {
    id: `${owner}/${name}`,
    owner,
    name,
    description: details.description || "",
    topics: Array.isArray(details.topics) ? details.topics : [],
    visibility: details.visibility || "private",
    encrypted: false,
    viewerGrant: true,
    language,
    languages,
    stars: 0,
    forks: 0,
    watchers: 0,
    defaultBranch: branch,
    createdAt: details.createdAt || null,
    updatedAt: tip?.date || details.createdAt || null,
    commitCount: typeof details.commitCount === "number" ? details.commitCount : 0,
    fileCount: typeof details.fileCount === "number" ? details.fileCount : fileCountFallback,
    tip: tip ? { sha: tip.sha, shortSha: String(tip.sha).slice(0, 7), subject: tip.subject, date: tip.date } : null,
    files,
    readme: readme.slice(0, 4000),
    kind: "code",
    forgeBridge: true,
    ...surfaceFields(details),
  };
}
