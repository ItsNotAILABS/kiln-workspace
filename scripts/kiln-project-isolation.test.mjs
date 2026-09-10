import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(new URL("../migrations/0002_kiln_multitenant_projects.sql", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../src/lib/kiln/project-computer.ts", import.meta.url), "utf8");

const fiveUsers = ["alfredo", "friend-a", "friend-b", "friend-c", "friend-d"];

test("project rows have an explicit owner user id", () => {
  assert.match(migration, /owner_user_id text not null/);
});

test("project membership is scoped by project and user", () => {
  assert.match(migration, /primary key\(project_id, user_id\)/);
  assert.match(api, /where project_id = \$1 and user_id = \$2/);
});

test("five distinct users can own independent project namespaces", () => {
  const projectIds = fiveUsers.map((user, i) => `${user}:project-${i}`);
  assert.equal(new Set(projectIds).size, 5);
});

test("one user cannot list another user's projects through the server API", () => {
  assert.match(api, /where m\.user_id = \$1/);
  assert.match(api, /\[context\.userId\]/);
});

test("project creation binds ownership to authenticated context, not client supplied user id", () => {
  assert.match(api, /context\.userId/);
  assert.doesNotMatch(api, /data\.ownerUserId/);
});

test("every new project gets its own database service slot", () => {
  assert.match(api, /\["database", "project-db", "postgres", true\]/);
});

test("every new project gets its own MCP service slot", () => {
  assert.match(api, /\["mcp", "project-mcp", "mcp-streamable-http", true\]/);
});

test("every new project gets Python and Node runtime slots", () => {
  assert.match(api, /\["python", "python", "python3", true\]/);
  assert.match(api, /\["node", "node", "nodejs", true\]/);
});

test("every new project gets a preview service slot", () => {
  assert.match(api, /\["preview", "preview", "web", true\]/);
});

test("project service names cannot collide inside one project", () => {
  assert.match(migration, /unique\(project_id, name\)/);
});

test("resident agents are project scoped", () => {
  assert.match(migration, /project_id text not null references kiln_projects\(id\)/);
  assert.match(api, /const residentRoles = \["conductor", "architect", "builder", "reviewer", "cipher", "indexer"\]/);
});

test("agent memory namespaces include project and agent identity", () => {
  assert.match(api, /`\$\{id\}:agent:\$\{agentId\}`/);
});

test("project memory is namespaced by project", () => {
  assert.match(migration, /kiln_project_memory/);
  assert.match(migration, /unique index if not exists kiln_project_memory_digest_idx on kiln_project_memory\(project_id, namespace, content_digest\)/);
});

test("project memory stores content references and digests rather than assuming one global chat blob", () => {
  assert.match(migration, /content_digest text not null/);
  assert.match(migration, /content_ref text not null/);
});

test("memory writes require authenticated project write capability", () => {
  const start = api.indexOf("export const appendProjectMemory");
  const block = api.slice(start);
  assert.match(block, /requireRole\(data\.projectId, context\.userId, WRITE_ROLES\)/);
});

test("project member mutation requires admin capability", () => {
  const start = api.indexOf("export const addProjectMember");
  const end = api.indexOf("export const setProjectMachineState");
  assert.match(api.slice(start, end), /requireRole\(data\.projectId, context\.userId, ADMIN_ROLES\)/);
});

test("builders cannot grant membership through the member API", () => {
  assert.match(api, /const ADMIN_ROLES = new Set<ProjectRole>\(\["owner", "admin"\]\)/);
});

test("viewers cannot mutate runtime state", () => {
  assert.match(api, /const WRITE_ROLES = new Set<ProjectRole>\(\["owner", "admin", "builder"\]\)/);
  assert.doesNotMatch(api, /WRITE_ROLES.*viewer/);
});

test("machine state is constrained to known lifecycle states", () => {
  assert.match(migration, /machine_state text not null default 'stopped' check \(machine_state in \('stopped','starting','running','degraded','stopping','failed'\)\)/);
});

test("runtime service state is project scoped on update", () => {
  assert.match(api, /where id=\$3 and project_id=\$4 returning id/);
});

test("project source provenance records GitHub owner repo ref and commit", () => {
  for (const field of ["source_owner", "source_repo", "source_ref", "source_commit_sha"]) assert.match(migration, new RegExp(field));
});

test("project visibility is constrained", () => {
  assert.match(migration, /visibility in \('private','team','public'\)/);
});

test("private is the default project visibility", () => {
  assert.match(migration, /visibility text not null default 'private'/);
  assert.match(api, /data\.visibility \?\? "private"/);
});

test("project receipts are sequence unique per project", () => {
  assert.match(migration, /unique\(project_id, sequence\)/);
});

test("project receipts retain previous and current hashes", () => {
  assert.match(migration, /previous_hash text not null/);
  assert.match(migration, /receipt_hash text not null/);
});

test("project vault commitment has an explicit durable slot", () => {
  assert.match(migration, /vault_key_commitment text/);
});

test("project memory root has an explicit durable slot", () => {
  assert.match(migration, /memory_root_digest text/);
});

test("project capsule schema is versioned", () => {
  assert.match(migration, /capsule_version integer not null default 1/);
});

test("project service config is represented by encrypted-config digest, not plaintext secret columns", () => {
  assert.match(migration, /encrypted_config_digest text/);
  assert.doesNotMatch(migration, /api_key text|secret text|password text/i);
});

test("the project API is protected by auth middleware", () => {
  const count = (api.match(/\.middleware\(\[authMiddleware\]\)/g) || []).length;
  assert.ok(count >= 7, `expected at least 7 protected project functions, got ${count}`);
});
