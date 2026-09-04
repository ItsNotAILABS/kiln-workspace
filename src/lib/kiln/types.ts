export type Visibility = "public" | "private";
export type RepoKind = "code" | "agent" | "crypto" | "model";
export type IssueState = "open" | "closed";
export type PullState = "open" | "merged" | "closed";
export type MergeMethod = "merge" | "squash" | "rebase";
export type BountyStatus = "none" | "escrowed" | "released";
export type NoticeKind = "issue" | "pull" | "discuss" | "release" | "security" | "ci" | "star";

export type RepoFile = {
  path: string;
  language: string;
  message: string;
  sha: string;
  updatedAt: string;
  content: string;
  size: number;
  merkleRoot?: string;
  chunkCount?: number;
  encrypted?: boolean;
  blobId?: string;
  binary?: boolean;
};

export type Repo = {
  id: string;
  owner: string;
  name: string;
  description: string;
  visibility: Visibility;
  encrypted: boolean;
  keyCommitment: string;
  viewerGrant: boolean;
  chainAddress: string;
  language: string;
  languages: Record<string, number>;
  stars: number;
  forks: number;
  watchers: number;
  topics: string[];
  license: string;
  defaultBranch: string;
  updatedAt: string;
  createdAt: string;
  tvlKln: number;
  files: RepoFile[];
  readme: string;
  website?: string;
  merkleRoot?: string;
  quotaBytes: number;
  modelId: string;
  githubUrl?: string;
  githubSha?: string;
  githubOwner?: string;
  githubRepo?: string;
  kind: RepoKind;
  listedKln?: number;
  archived?: boolean;
};

export type Profile = {
  handle: string;
  displayName: string;
  lab?: string;
  company?: string;
  bio: string;
  location?: string;
  joined: string;
  address: string;
  website?: string;
  twitter?: string;
  kind: "org" | "user";
  followers: number;
  following: number;
  orgs: string[];
  highlight?: string;
  pinned: string[];
};

export type Comment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  txHash?: string;
};

export type Issue = {
  id: string;
  repoId: string;
  number: number;
  title: string;
  body: string;
  author: string;
  state: IssueState;
  labels: string[];
  assignees: string[];
  milestone?: string;
  createdAt: string;
  updatedAt: string;
  bountyKln: number;
  bountyStatus: BountyStatus;
  bountyTx?: string;
  comments: Comment[];
};

export type Pull = {
  id: string;
  repoId: string;
  number: number;
  title: string;
  body: string;
  author: string;
  state: PullState;
  fromBranch: string;
  toBranch: string;
  createdAt: string;
  updatedAt: string;
  txHash?: string;
  additions: number;
  deletions: number;
  comments: Comment[];
  reviews: { author: string; state: "approve" | "request" | "comment"; body: string; createdAt: string }[];
  files: { path: string; patch: string; additions: number; deletions: number }[];
  mergeMethod?: MergeMethod;
  draft?: boolean;
};

export type Branch = {
  name: string;
  repoId: string;
  sha: string;
  protected: boolean;
  updatedAt: string;
};

export type Commit = {
  sha: string;
  repoId: string;
  message: string;
  author: string;
  createdAt: string;
  files: string[];
  parent?: string;
};

export type Release = {
  id: string;
  repoId: string;
  tag: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  prerelease: boolean;
  assets: { name: string; size: string }[];
};

export type WikiPage = {
  repoId: string;
  slug: string;
  title: string;
  body: string;
  updatedAt: string;
  author: string;
};

export type Discussion = {
  id: string;
  repoId: string;
  number: number;
  title: string;
  body: string;
  author: string;
  category: string;
  createdAt: string;
  comments: Comment[];
};

export type ProjectCard = {
  id: string;
  repoId: string;
  title: string;
  column: "Backlog" | "Ready" | "In progress" | "Done";
  issueId?: string;
};

export type ActionRun = {
  id: string;
  repoId: string;
  workflow: string;
  event: string;
  status: "queued" | "running" | "success" | "failure";
  branch: string;
  sha: string;
  createdAt: string;
  duration: string;
  logs: string[];
};

export type SecurityAlert = {
  id: string;
  repoId: string;
  severity: "critical" | "high" | "medium" | "low";
  package: string;
  summary: string;
  state: "open" | "fixed" | "dismissed";
  createdAt: string;
};

export type LabelDef = {
  repoId: string;
  name: string;
  color: string;
  description: string;
};

export type Milestone = {
  id: string;
  repoId: string;
  title: string;
  description: string;
  due?: string;
  state: "open" | "closed";
};

export type Webhook = {
  id: string;
  repoId: string;
  url: string;
  events: string[];
  active: boolean;
};

export type SecretItem = {
  id: string;
  repoId: string;
  name: string;
  updatedAt: string;
};

export type PagesConfig = {
  repoId: string;
  enabled: boolean;
  branch: string;
  path: string;
};

export type PackageItem = {
  id: string;
  repoId: string;
  name: string;
  ecosystem: "npm" | "container" | "cargo" | "pypi";
  version: string;
  downloads: number;
  updatedAt: string;
};

export type Gist = {
  id: string;
  owner: string;
  description: string;
  public: boolean;
  files: { name: string; content: string; language: string }[];
  createdAt: string;
  updatedAt: string;
  stars: number;
};

export type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  href: string;
  createdAt: string;
  read: boolean;
};

export type Agent = {
  id: string;
  repoId: string;
  name: string;
  role: string;
  resident: boolean;
  modelId: string;
  status?: "idle" | "thinking" | "tooling";
};

export type Domain = {
  id: string;
  repoId: string;
  host: string;
  kind: "kiln" | "custom";
  status: "live" | "pending";
  https: boolean;
  createdAt: string;
};

export type Listing = {
  id: string;
  repoId: string;
  title: string;
  priceKln: number;
  category: string;
};

export type WorkflowFile = {
  repoId: string;
  name: string;
  path: string;
  on: string[];
  yaml: string;
};

export type Wallet = {
  handle: string;
  address: string;
  secret: string;
};

export const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Rust: "#dea584",
  Go: "#00add8",
  Solidity: "#aa6746",
  Python: "#3572a5",
  Markdown: "#083fa1",
  YAML: "#cb171e",
  Circom: "#c4a35a",
  Shell: "#89e051",
  JSON: "#292929",
  TOML: "#9c4221",
  Text: "#8e8e89",
  Makefile: "#427819",
  HTML: "#e34c26",
  CSS: "#563d7c",
  C: "#555555",
  "C++": "#f34b7d",
};

export const AGENT_ROLES = [
  { id: "conductor", label: "Conductor", blurb: "Owns the crew graph. Handoffs work. Does not write product code.", priceKln: 140 },
  { id: "architect", label: "Architect", blurb: "Plans structure, opens issues, writes the map.", priceKln: 120 },
  { id: "builder", label: "Builder", blurb: "Writes files, commits, keeps the tree moving.", priceKln: 80 },
  { id: "reviewer", label: "Reviewer", blurb: "Reads diffs, comments, blocks bad merges.", priceKln: 90 },
  { id: "deployer", label: "Deployer", blurb: "Runs actions, tags releases, ships the preview.", priceKln: 70 },
  { id: "scout", label: "Scout", blurb: "Searches the forge, summarizes, finds the work.", priceKln: 40 },
  { id: "cipher", label: "Cipher", blurb: "Seals trees, rotates keys, verifies Merkle proofs.", priceKln: 110 },
  { id: "indexer", label: "Indexer", blurb: "Keeps folder memory, quota, and search indexes honest.", priceKln: 55 },
] as const;

export const REPO_KINDS: { id: RepoKind; label: string; blurb: string }[] = [
  { id: "code", label: "Code", blurb: "A sealed git repository. The default." },
  { id: "agent", label: "Agent", blurb: "The tree is the agent. It gets its own wallet and a resident process." },
  { id: "crypto", label: "Protocol", blurb: "Contracts, circuits, canisters. Escrow and KLN first-class." },
  { id: "model", label: "Model", blurb: "Weights, cards, and a model wallet. License or sell on the marketplace." },
];
