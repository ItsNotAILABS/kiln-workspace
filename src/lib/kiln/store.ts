import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";
import { syncHash } from "@/lib/utils";
import type {
  ActionRun,
  Agent,
  Branch,
  Comment,
  Discussion,
  Domain,
  Gist,
  Issue,
  LabelDef,
  MergeMethod,
  Milestone,
  Notice,
  PagesConfig,
  Profile,
  ProjectCard,
  Pull,
  Release,
  Repo,
  RepoFile,
  SecretItem,
  SecurityAlert,
  Wallet,
  Webhook,
  WikiPage,
} from "./types";
import {
  SEED_AGENTS,
  SEED_ALERTS,
  SEED_BRANCHES,
  SEED_COMMITS,
  SEED_DISCUSSIONS,
  SEED_DOMAINS,
  SEED_GISTS,
  SEED_ISSUES,
  SEED_LISTINGS,
  SEED_PACKAGES,
  SEED_PROJECTS,
  SEED_PROFILES,
  SEED_PULLS,
  SEED_RELEASES,
  SEED_REPOS,
  SEED_RUNS,
  SEED_WIKI,
} from "./seed";

export type KilnState = {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  wallet: Wallet | null;
  balance: number;
  connect: (handle: string) => void;
  disconnect: () => void;
  extraRepos: Repo[];
  stars: Record<string, boolean>;
  watches: Record<string, boolean>;
  forksOf: string[];
  userIssues: Issue[];
  userPulls: Pull[];
  wiki: WikiPage[];
  discussions: Discussion[];
  projectCards: ProjectCard[];
  actionRuns: ActionRun[];
  releases: Release[];
  gists: Gist[];
  notices: Notice[];
  agents: Agent[];
  domains: Domain[];
  branches: Branch[];
  collaborators: Record<string, string[]>;
  following: string[];
  gistStars: Record<string, boolean>;
  alerts: SecurityAlert[];
  labels: LabelDef[];
  milestones: Milestone[];
  webhooks: Webhook[];
  secrets: SecretItem[];
  pages: PagesConfig[];
  markNoticesRead: () => void;
  star: (repoId: string) => void;
  watchRepo: (repoId: string) => void;
  fork: (repoId: string) => Repo | null;
  follow: (handle: string) => void;
  starGist: (id: string) => void;
  createRepo: (opts: {
    name: string;
    description: string;
    visibility: Repo["visibility"];
    kind: Repo["kind"];
    files?: RepoFile[];
    license?: string;
    gitignore?: string;
    template?: boolean;
  }) => Repo | null;
  importRepo: (repo: Repo) => Repo;
  editFile: (repoId: string, path: string, content: string, message: string) => void;
  deleteFile: (repoId: string, path: string) => void;
  createIssue: (repoId: string, title: string, body: string, labels?: string[]) => Issue | null;
  commentIssue: (id: string, body: string) => void;
  setIssueState: (id: string, state: Issue["state"]) => void;
  assignIssue: (id: string, handle: string) => void;
  setIssueLabels: (id: string, labels: string[]) => void;
  setIssueMilestone: (id: string, milestone?: string) => void;
  createLabel: (repoId: string, name: string, color: string, description: string) => void;
  createMilestone: (repoId: string, title: string, description: string) => void;
  createPull: (repoId: string, title: string, body: string, fromBranch: string) => Pull | null;
  mergePull: (id: string, method?: MergeMethod) => void;
  closePull: (id: string) => void;
  reviewPull: (id: string, state: "approve" | "request" | "comment", body: string) => void;
  commentPull: (id: string, body: string) => void;
  saveWiki: (repoId: string, slug: string, title: string, body: string) => void;
  addDiscussion: (repoId: string, title: string, body: string, category: string) => void;
  replyDiscussion: (id: string, body: string) => void;
  moveCard: (id: string, column: ProjectCard["column"]) => void;
  addCard: (repoId: string, title: string) => void;
  addRelease: (repoId: string, tag: string, title: string, body: string) => void;
  rerunAction: (repoId: string, workflow: string) => void;
  createGist: (description: string, name: string, content: string, pub: boolean) => Gist;
  createBranch: (repoId: string, name: string) => void;
  addCollaborator: (repoId: string, handle: string) => void;
  updateRepo: (repoId: string, patch: Partial<Pick<Repo, "description" | "visibility" | "website" | "archived" | "topics" | "name">>) => void;
  deleteRepo: (repoId: string) => void;
  dismissAlert: (id: string) => void;
  fixAlert: (id: string) => void;
  addWebhook: (repoId: string, url: string, events: string[]) => void;
  addSecret: (repoId: string, name: string) => void;
  setPages: (repoId: string, enabled: boolean) => void;
  sponsor: (repoId: string, amount: number) => void;
};

function now() {
  return new Date().toISOString();
}

function handleOf(s: KilnState) {
  return s.wallet?.handle ?? "guest";
}

export function allRepos(s: Pick<KilnState, "extraRepos">): Repo[] {
  const extraIds = new Set(s.extraRepos.map((r) => r.id));
  return [...s.extraRepos, ...SEED_REPOS.filter((r) => !extraIds.has(r.id))];
}

export function allIssues(s: Pick<KilnState, "userIssues">): Issue[] {
  const ids = new Set(s.userIssues.map((i) => i.id));
  return [...s.userIssues, ...SEED_ISSUES.filter((i) => !ids.has(i.id))];
}

export function allPulls(s: Pick<KilnState, "userPulls">): Pull[] {
  const ids = new Set(s.userPulls.map((p) => p.id));
  return [...s.userPulls, ...SEED_PULLS.filter((p) => !ids.has(p.id))];
}

export function findRepo(s: Pick<KilnState, "extraRepos">, owner: string, name: string): Repo | undefined {
  const list = allRepos(s);
  return (
    list.find((r) => r.owner === owner && r.name === name) ||
    list.find((r) => r.id === `${owner}/${name}`) ||
    list.find((r) => r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase())
  );
}

export function starCount(repo: Repo, s: Pick<KilnState, "stars">) {
  return repo.stars + (s.stars[repo.id] ? 1 : 0);
}

export function cloneGit(owner: string, name: string) {
  return `git clone kiln://${owner}/${name}.git`;
}
export function cloneHttps(owner: string, name: string, origin = "") {
  return `git clone ${origin || "https://kiln.dev"}/${owner}/${name}.git`;
}
export function cloneCli(owner: string, name: string) {
  return `kiln clone ${owner}/${name}`;
}
export function kilnHost(owner: string, name: string) {
  return `${owner}-${name}.kiln.app`;
}

export const STANDARD_LABELS: { name: string; color: string; description: string }[] = [
  { name: "bug", color: "#c45c4a", description: "Something isn't working" },
  { name: "documentation", color: "#7a9aa8", description: "Improvements or additions to documentation" },
  { name: "duplicate", color: "#5e5e5a", description: "This issue or pull request already exists" },
  { name: "enhancement", color: "#4f8d6e", description: "New feature or request" },
  { name: "good first issue", color: "#d8d4cc", description: "Good for newcomers" },
  { name: "help wanted", color: "#7a9aa8", description: "Extra attention is needed" },
  { name: "invalid", color: "#5e5e5a", description: "This doesn't seem right" },
  { name: "question", color: "#7a9aa8", description: "Further information is requested" },
  { name: "wontfix", color: "#5e5e5a", description: "This will not be worked on" },
];

export function seedLabels(): LabelDef[] {
  const out: LabelDef[] = [];
  for (const r of SEED_REPOS) {
    for (const l of STANDARD_LABELS) out.push({ repoId: r.id, ...l });
  }
  const seen = new Set(out.map((l) => l.repoId + l.name));
  for (const i of SEED_ISSUES) {
    for (const name of i.labels) {
      const key = i.repoId + name;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ repoId: i.repoId, name, color: "#7a9aa8", description: name });
    }
  }
  return out;
}

export function seedMilestones(): Milestone[] {
  return SEED_REPOS.slice(0, 6).map((r, i) => ({
    id: `ms-${r.id}`,
    repoId: r.id,
    title: i % 2 ? "v1.0" : "Next",
    description: "Shipped when the tree settles.",
    due: "2026-12-01",
    state: "open" as const,
  }));
}

export function entriesAt(files: RepoFile[], dir = "") {
  const prefix = dir ? dir.replace(/\/$/, "") + "/" : "";
  const folders = new Set<string>();
  const at: RepoFile[] = [];
  for (const f of files) {
    if (dir) {
      if (f.path === dir) continue;
      if (!f.path.startsWith(prefix)) continue;
    }
    const rest = dir ? f.path.slice(prefix.length) : f.path;
    const slash = rest.indexOf("/");
    if (slash === -1) at.push(f);
    else folders.add(rest.slice(0, slash));
  }
  return {
    folders: [...folders].sort(),
    files: [...at].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export function allTopics(s: Pick<KilnState, "extraRepos">) {
  const map = new Map<string, number>();
  for (const r of allRepos(s)) {
    for (const t of r.topics) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function allCommits(repo: Repo) {
  const fromFiles = repo.files.map((f) => ({
    sha: f.sha,
    repoId: repo.id,
    message: f.message,
    author: repo.owner,
    createdAt: f.updatedAt,
    files: [f.path],
  }));
  const seeded = SEED_COMMITS.filter((c) => c.repoId === repo.id);
  const seen = new Set<string>();
  const out = [];
  for (const c of [...fromFiles, ...seeded]) {
    if (seen.has(c.sha)) continue;
    seen.add(c.sha);
    out.push(c);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function forkList(s: Pick<KilnState, "extraRepos">, repoId: string) {
  const name = repoId.split("/")[1];
  return allRepos(s).filter((r) => r.name === name && r.id !== repoId);
}

export function patchIssue(s: KilnState, id: string, fn: (i: Issue) => Issue) {
  const fromSeed = SEED_ISSUES.find((i) => i.id === id);
  if (s.userIssues.some((i) => i.id === id)) return { userIssues: s.userIssues.map((i) => (i.id === id ? fn(i) : i)) };
  if (fromSeed) return { userIssues: [fn(fromSeed), ...s.userIssues] };
  return {};
}

export function patchPull(s: KilnState, id: string, fn: (p: Pull) => Pull) {
  const fromSeed = SEED_PULLS.find((p) => p.id === id);
  if (s.userPulls.some((p) => p.id === id)) return { userPulls: s.userPulls.map((p) => (p.id === id ? fn(p) : p)) };
  if (fromSeed) return { userPulls: [fn(fromSeed), ...s.userPulls] };
  return {};
}

export function profileOf(handle: string): Profile {
  return (
    SEED_PROFILES[handle] ?? {
      handle,
      displayName: handle,
      bio: "A kiln member.",
      joined: "2026",
      address: `0x${syncHash(handle).slice(1).padEnd(40, "0")}`,
      kind: "user",
      followers: 0,
      following: 0,
      orgs: [],
      pinned: [],
    }
  );
}

export const useKiln = create<KilnState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      wallet: null,
      balance: 2500,
      extraRepos: [],
      stars: {},
      watches: {},
      forksOf: [],
      userIssues: [],
      userPulls: [],
      wiki: [...SEED_WIKI],
      discussions: [...SEED_DISCUSSIONS],
      projectCards: [...SEED_PROJECTS],
      actionRuns: [...SEED_RUNS],
      releases: [...SEED_RELEASES],
      gists: [...SEED_GISTS],
      notices: [
        { id: "n1", kind: "pull", title: "harbor opened kiln-labs/protocol#40", href: "/kiln-labs/protocol/pulls/40", createdAt: "2026-08-28T16:00:00Z", read: false },
        { id: "n2", kind: "security", title: "High alert on meridian/escrow", href: "/meridian/escrow/security", createdAt: "2026-08-28T16:00:00Z", read: false },
        { id: "n3", kind: "ci", title: "protocol CI passed on main", href: "/kiln-labs/protocol/actions", createdAt: "2026-08-28T16:00:00Z", read: true },
      ],
      agents: [...SEED_AGENTS],
      domains: [...SEED_DOMAINS],
      branches: [...SEED_BRANCHES],
      collaborators: {},
      following: ["kiln-labs", "itsnotailabs"],
      gistStars: {},
      alerts: SEED_ALERTS.map((a) => ({ ...a })),
      labels: seedLabels(),
      milestones: seedMilestones(),
      webhooks: [],
      secrets: [],
      pages: [],
      connect: (handle) => {
        const h = handle.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase() || "you";
        set({
          wallet: { handle: h, address: `0x${syncHash(h).slice(1).padEnd(40, "0")}`, secret: syncHash("secret:" + h) },
        });
        toast(`Connected · ${h}`);
      },
      disconnect: () => set({ wallet: null }),
      markNoticesRead: () => set({ notices: get().notices.map((n) => ({ ...n, read: true })) }),
      star: (repoId) => {
        if (!get().wallet) return toast("Connect a wallet first");
        set({ stars: { ...get().stars, [repoId]: !get().stars[repoId] } });
      },
      watchRepo: (repoId) => {
        if (!get().wallet) return toast("Connect a wallet first");
        set({ watches: { ...get().watches, [repoId]: !get().watches[repoId] } });
      },
      fork: (repoId) => {
        const s = get();
        if (!s.wallet) {
          toast("Connect a wallet first");
          return null;
        }
        const src = allRepos(s).find((r) => r.id === repoId);
        if (!src) return null;
        const name = src.name;
        const id = `${s.wallet.handle}/${name}`;
        if (allRepos(s).some((r) => r.id === id)) {
          toast("Already forked");
          return allRepos(s).find((r) => r.id === id) ?? null;
        }
        const copy: Repo = {
          ...src,
          id,
          owner: s.wallet.handle,
          stars: 0,
          forks: 0,
          watchers: 1,
          createdAt: now(),
          updatedAt: now(),
          githubUrl: undefined,
        };
        set({ extraRepos: [copy, ...s.extraRepos], forksOf: [...s.forksOf, repoId] });
        toast(`Forked → ${id}`);
        return copy;
      },
      follow: (handle) => {
        const s = get();
        if (!s.wallet) return toast("Connect a wallet first");
        const on = s.following.includes(handle);
        set({ following: on ? s.following.filter((h) => h !== handle) : [...s.following, handle] });
        toast(on ? `Unfollowed ${handle}` : `Following ${handle}`);
      },
      starGist: (id) => {
        const s = get();
        set({ gistStars: { ...s.gistStars, [id]: !s.gistStars[id] } });
      },
      createRepo: (opts) => {
        const s = get();
        if (!s.wallet) {
          toast("Connect a wallet first");
          return null;
        }
        const name = opts.name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-|-$/g, "") || "untitled";
        const id = `${s.wallet.handle}/${name}`;
        if (allRepos(s).some((r) => r.id === id)) {
          toast("Name already exists");
          return null;
        }
        const readme = `# ${name}\n\n${opts.description}\n`;
        const files: RepoFile[] = opts.files?.length
          ? opts.files
          : [
              {
                path: "README.md",
                language: "Markdown",
                message: "genesis",
                content: readme,
                size: readme.length,
                sha: syncHash(readme),
                updatedAt: now(),
              },
              {
                path: "LICENSE",
                language: "Text",
                message: "genesis",
                content: opts.license === "MIT" ? "MIT License\n" : "Apache-2.0\n",
                size: 12,
                sha: syncHash("lic" + name),
                updatedAt: now(),
              },
              ...(opts.gitignore
                ? [
                    {
                      path: ".gitignore",
                      language: "Text",
                      message: "genesis",
                      content: opts.gitignore,
                      size: opts.gitignore.length,
                      sha: syncHash("gi" + name),
                      updatedAt: now(),
                    } satisfies RepoFile,
                  ]
                : []),
            ];
        const repo: Repo = {
          id,
          owner: s.wallet.handle,
          name,
          description: opts.description,
          visibility: opts.visibility,
          encrypted: opts.visibility === "private",
          keyCommitment: opts.visibility === "private" ? `0x${syncHash(id).slice(1)}` : "0x0000000000000000000000000000000000000000",
          viewerGrant: true,
          chainAddress: s.wallet.address,
          language: files.find((f) => f.language !== "Markdown" && f.language !== "Text")?.language ?? "Markdown",
          languages: tallyLangs(files),
          stars: 0,
          forks: 0,
          watchers: 1,
          topics: [],
          license: opts.license ?? "MIT",
          defaultBranch: "main",
          updatedAt: now(),
          createdAt: now(),
          tvlKln: 0,
          files,
          readme: files.find((f) => /^readme\.md$/i.test(f.path))?.content ?? "",
          quotaBytes: 50 * 1024 * 1024 * 1024,
          modelId: "grok-4.6",
          kind: opts.kind,
        };
        set({ extraRepos: [repo, ...s.extraRepos] });
        toast(`Created ${id}`);
        return repo;
      },
      importRepo: (repo) => {
        const s = get();
        const existing = s.extraRepos.filter((r) => r.id !== repo.id);
        set({ extraRepos: [repo, ...existing] });
        toast(`Imported ${repo.id}`);
        return repo;
      },
      editFile: (repoId, path, content, message) => {
        const s = get();
        const apply = (r: Repo): Repo => {
          if (r.id !== repoId) return r;
          const next = r.files.some((f) => f.path === path)
            ? r.files.map((f) =>
                f.path === path
                  ? { ...f, content, size: content.length, sha: syncHash(content + path), message, updatedAt: now() }
                  : f,
              )
            : [
                ...r.files,
                {
                  path,
                  language: langOf(path),
                  content,
                  size: content.length,
                  sha: syncHash(content + path),
                  message,
                  updatedAt: now(),
                },
              ];
          return {
            ...r,
            files: next,
            readme: next.find((f) => /^readme\.md$/i.test(f.path))?.content ?? r.readme,
            languages: tallyLangs(next),
            updatedAt: now(),
          };
        };
        const seedHit = SEED_REPOS.find((r) => r.id === repoId);
        const extras = s.extraRepos.some((r) => r.id === repoId)
          ? s.extraRepos.map(apply)
          : seedHit
            ? [apply(seedHit), ...s.extraRepos]
            : s.extraRepos;
        set({ extraRepos: extras });
        toast(`Committed ${path}`);
      },
      deleteFile: (repoId, path) => {
        const s = get();
        const apply = (r: Repo): Repo => {
          if (r.id !== repoId) return r;
          const next = r.files.filter((f) => f.path !== path);
          return {
            ...r,
            files: next,
            readme: next.find((f) => /^readme\.md$/i.test(f.path))?.content ?? "",
            languages: tallyLangs(next),
            updatedAt: now(),
          };
        };
        const seedHit = SEED_REPOS.find((r) => r.id === repoId);
        const extras = s.extraRepos.some((r) => r.id === repoId)
          ? s.extraRepos.map(apply)
          : seedHit
            ? [apply(seedHit), ...s.extraRepos]
            : s.extraRepos;
        set({ extraRepos: extras });
        toast(`Deleted ${path}`);
      },
      createIssue: (repoId, title, body, labels = []) => {
        const s = get();
        if (!s.wallet) {
          toast("Connect a wallet first");
          return null;
        }
        const nums = allIssues(s).filter((i) => i.repoId === repoId).map((i) => i.number);
        const number = Math.max(0, ...nums) + 1;
        const item: Issue = {
          id: `${repoId}#${number}`,
          repoId,
          number,
          title,
          body,
          author: handleOf(s),
          state: "open",
          labels,
          assignees: [],
          createdAt: now(),
          updatedAt: now(),
          bountyKln: 0,
          bountyStatus: "none",
          comments: [],
        };
        set({
          userIssues: [item, ...s.userIssues],
          notices: [{ id: `n-${item.id}`, kind: "issue", title: `${item.author} opened ${item.id}`, href: `/${repoId}/issues/${number}`, createdAt: now(), read: false }, ...s.notices],
        });
        toast(`Opened #${number}`);
        return item;
      },
      commentIssue: (id, body) => {
        const s = get();
        const c: Comment = { id: syncHash(id + body + now()), author: handleOf(s), body, createdAt: now() };
        const patch = (i: Issue) => (i.id === id ? { ...i, comments: [...i.comments, c], updatedAt: now() } : i);
        const fromSeed = SEED_ISSUES.find((i) => i.id === id);
        if (s.userIssues.some((i) => i.id === id)) set({ userIssues: s.userIssues.map(patch) });
        else if (fromSeed) set({ userIssues: [patch(fromSeed), ...s.userIssues] });
      },
      setIssueState: (id, state) => {
        const s = get();
        set(patchIssue(s, id, (i) => ({ ...i, state, updatedAt: now() })));
      },
      assignIssue: (id, handle) => {
        const s = get();
        set(
          patchIssue(s, id, (i) => ({
            ...i,
            assignees: i.assignees.includes(handle) ? i.assignees.filter((a) => a !== handle) : [...i.assignees, handle],
            updatedAt: now(),
          })),
        );
      },
      setIssueLabels: (id, labels) => {
        const s = get();
        set(patchIssue(s, id, (i) => ({ ...i, labels, updatedAt: now() })));
      },
      setIssueMilestone: (id, milestone) => {
        const s = get();
        set(patchIssue(s, id, (i) => ({ ...i, milestone, updatedAt: now() })));
      },
      createLabel: (repoId, name, color, description) => {
        const s = get();
        if (s.labels.some((l) => l.repoId === repoId && l.name === name)) return;
        set({ labels: [...s.labels, { repoId, name, color: color || "#7a9aa8", description }] });
      },
      createMilestone: (repoId, title, description) => {
        const s = get();
        set({
          milestones: [{ id: `ms-${syncHash(repoId + title + now())}`, repoId, title, description, state: "open" }, ...s.milestones],
        });
      },
      createPull: (repoId, title, body, fromBranch) => {
        const s = get();
        if (!s.wallet) {
          toast("Connect a wallet first");
          return null;
        }
        const nums = allPulls(s).filter((p) => p.repoId === repoId).map((p) => p.number);
        const number = Math.max(0, ...nums) + 1;
        const item: Pull = {
          id: `${repoId}#${number}`,
          repoId,
          number,
          title,
          body,
          author: handleOf(s),
          state: "open",
          fromBranch,
          toBranch: "main",
          createdAt: now(),
          updatedAt: now(),
          additions: 12,
          deletions: 2,
          comments: [],
          reviews: [],
          files: [],
        };
        set({ userPulls: [item, ...s.userPulls] });
        toast(`Opened pull #${number}`);
        return item;
      },
      mergePull: (id, method = "merge") => {
        const s = get();
        set(patchPull(s, id, (p) => ({ ...p, state: "merged", mergeMethod: method, updatedAt: now() })));
        toast(method === "squash" ? "Squash-merged" : method === "rebase" ? "Rebased and merged" : "Merged");
      },
      closePull: (id) => {
        const s = get();
        set(patchPull(s, id, (p) => ({ ...p, state: "closed", updatedAt: now() })));
        toast("Pull closed");
      },
      reviewPull: (id, state, body) => {
        const s = get();
        const rev = { author: handleOf(s), state, body, createdAt: now() };
        const patch = (p: Pull) => (p.id === id ? { ...p, reviews: [...p.reviews, rev], updatedAt: now() } : p);
        const fromSeed = SEED_PULLS.find((p) => p.id === id);
        if (s.userPulls.some((p) => p.id === id)) set({ userPulls: s.userPulls.map(patch) });
        else if (fromSeed) set({ userPulls: [patch(fromSeed), ...s.userPulls] });
      },
      commentPull: (id, body) => {
        const s = get();
        const c: Comment = { id: syncHash(id + body + now()), author: handleOf(s), body, createdAt: now() };
        const patch = (p: Pull) => (p.id === id ? { ...p, comments: [...p.comments, c] } : p);
        const fromSeed = SEED_PULLS.find((p) => p.id === id);
        if (s.userPulls.some((p) => p.id === id)) set({ userPulls: s.userPulls.map(patch) });
        else if (fromSeed) set({ userPulls: [patch(fromSeed), ...s.userPulls] });
      },
      saveWiki: (repoId, slug, title, body) => {
        const s = get();
        const page: WikiPage = { repoId, slug, title, body, updatedAt: now(), author: handleOf(s) };
        const rest = s.wiki.filter((w) => !(w.repoId === repoId && w.slug === slug));
        set({ wiki: [page, ...rest] });
        toast("Wiki saved");
      },
      addDiscussion: (repoId, title, body, category) => {
        const s = get();
        const number = Math.max(0, ...s.discussions.filter((d) => d.repoId === repoId).map((d) => d.number)) + 1;
        set({
          discussions: [
            { id: `d-${repoId}-${number}`, repoId, number, title, body, author: handleOf(s), category, createdAt: now(), comments: [] },
            ...s.discussions,
          ],
        });
      },
      replyDiscussion: (id, body) => {
        const s = get();
        const c: Comment = { id: syncHash(id + body), author: handleOf(s), body, createdAt: now() };
        set({ discussions: s.discussions.map((d) => (d.id === id ? { ...d, comments: [...d.comments, c] } : d)) });
      },
      moveCard: (id, column) => set({ projectCards: get().projectCards.map((c) => (c.id === id ? { ...c, column } : c)) }),
      addCard: (repoId, title) =>
        set({ projectCards: [{ id: syncHash(repoId + title + now()), repoId, title, column: "Backlog" }, ...get().projectCards] }),
      addRelease: (repoId, tag, title, body) => {
        const s = get();
        set({
          releases: [
            { id: `rel-${tag}-${repoId}`, repoId, tag, title, body, author: handleOf(s), createdAt: now(), prerelease: false, assets: [] },
            ...s.releases,
          ],
        });
        toast(`Released ${tag}`);
      },
      rerunAction: (repoId, workflow) => {
        const run: ActionRun = {
          id: `run-${Date.now()}`,
          repoId,
          workflow,
          event: "workflow_dispatch",
          status: "success",
          branch: "main",
          sha: syncHash(repoId + now()).slice(0, 8),
          createdAt: now(),
          duration: "18s",
          logs: ["workflow_dispatch", "kiln verify --on-chain", "ok"],
        };
        set({ actionRuns: [run, ...get().actionRuns] });
        toast("Queued run");
      },
      createGist: (description, name, content, pub) => {
        const s = get();
        const g: Gist = {
          id: `g-${syncHash(name + now())}`,
          owner: handleOf(s),
          description,
          public: pub,
          files: [{ name, content, language: langOf(name) }],
          createdAt: now(),
          updatedAt: now(),
          stars: 0,
        };
        set({ gists: [g, ...s.gists] });
        return g;
      },
      createBranch: (repoId, name) => {
        const s = get();
        if (s.branches.some((b) => b.repoId === repoId && b.name === name)) return;
        set({
          branches: [...s.branches, { name, repoId, sha: syncHash(repoId + name).slice(0, 8), protected: false, updatedAt: now() }],
        });
        toast(`Branch ${name}`);
      },
      addCollaborator: (repoId, handle) => {
        const cur = get().collaborators[repoId] ?? [];
        if (cur.includes(handle)) return;
        set({ collaborators: { ...get().collaborators, [repoId]: [...cur, handle] } });
      },
      updateRepo: (repoId, patch) => {
        const s = get();
        const apply = (r: Repo) => {
          if (r.id !== repoId) return r;
          const next = { ...r, ...patch, updatedAt: now() };
          if (patch.name && patch.name !== r.name) {
            const name = patch.name.replace(/[^a-zA-Z0-9._-]/g, "-");
            next.name = name;
            next.id = `${r.owner}/${name}`;
          }
          return next;
        };
        const seedHit = SEED_REPOS.find((r) => r.id === repoId);
        const extras = s.extraRepos.some((r) => r.id === repoId) ? s.extraRepos.map(apply) : seedHit ? [apply(seedHit), ...s.extraRepos] : s.extraRepos;
        set({ extraRepos: extras });
      },
      deleteRepo: (repoId) => {
        set({ extraRepos: get().extraRepos.filter((r) => r.id !== repoId) });
        toast("Repository deleted");
      },
      dismissAlert: (id) => {
        set({ alerts: get().alerts.map((a) => (a.id === id ? { ...a, state: "dismissed" as const } : a)) });
        toast("Alert dismissed");
      },
      fixAlert: (id) => {
        set({ alerts: get().alerts.map((a) => (a.id === id ? { ...a, state: "fixed" as const } : a)) });
        toast("Marked fixed");
      },
      addWebhook: (repoId, url, events) => {
        const s = get();
        set({
          webhooks: [{ id: syncHash(repoId + url + now()), repoId, url, events, active: true }, ...s.webhooks],
        });
        toast("Webhook added");
      },
      addSecret: (repoId, name) => {
        const s = get();
        set({
          secrets: [{ id: syncHash(repoId + name + now()), repoId, name, updatedAt: now() }, ...s.secrets],
        });
        toast("Secret stored");
      },
      setPages: (repoId, enabled) => {
        const s = get();
        const rest = s.pages.filter((p) => p.repoId !== repoId);
        set({ pages: [{ repoId, enabled, branch: "main", path: "/" }, ...rest] });
        toast(enabled ? "Pages enabled" : "Pages disabled");
      },
      sponsor: (repoId, amount) => {
        const s = get();
        if (!s.wallet) return toast("Connect a wallet first");
        if (s.balance < amount) return toast("Not enough KLN");
        set({ balance: s.balance - amount });
        toast(`Sponsored ${amount} KLN on ${repoId}`);
      },
    }),
    {
      name: "kiln-v4",
      skipHydration: true,
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
          : localStorage,
      ),
      partialize: (s) => ({
        wallet: s.wallet,
        balance: s.balance,
        extraRepos: s.extraRepos,
        stars: s.stars,
        watches: s.watches,
        forksOf: s.forksOf,
        userIssues: s.userIssues,
        userPulls: s.userPulls,
        wiki: s.wiki,
        discussions: s.discussions,
        projectCards: s.projectCards,
        actionRuns: s.actionRuns,
        releases: s.releases,
        gists: s.gists,
        notices: s.notices,
        agents: s.agents,
        domains: s.domains,
        branches: s.branches,
        collaborators: s.collaborators,
        following: s.following,
        gistStars: s.gistStars,
        alerts: s.alerts,
        labels: s.labels,
        milestones: s.milestones,
        webhooks: s.webhooks,
        secrets: s.secrets,
        pages: s.pages,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function langOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    rs: "Rust",
    go: "Go",
    sol: "Solidity",
    py: "Python",
    md: "Markdown",
    yml: "YAML",
    yaml: "YAML",
    json: "JSON",
    toml: "TOML",
    circom: "Circom",
    sh: "Shell",
    html: "HTML",
    css: "CSS",
  };
  if (/license/i.test(path)) return "Text";
  return map[ext] ?? "Text";
}

export function tallyLangs(files: RepoFile[]): Record<string, number> {
  const skip = new Set(["Markdown", "Text", "YAML"]);
  const counts: Record<string, number> = {};
  let total = 0;
  for (const f of files) {
    const lang = f.language;
    if (skip.has(lang)) continue;
    counts[lang] = (counts[lang] ?? 0) + f.size;
    total += f.size;
  }
  if (!total) return { Markdown: 100 };
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = Math.max(1, Math.round((v / total) * 100));
  return out;
}

export { SEED_COMMITS, SEED_ALERTS, SEED_PACKAGES, SEED_LISTINGS, SEED_PROFILES };
