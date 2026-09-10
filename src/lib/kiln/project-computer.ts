import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type ProjectVisibility = "private" | "team" | "public";
export type ProjectRole = "owner" | "admin" | "builder" | "reviewer" | "viewer";
export type MachineState = "stopped" | "starting" | "running" | "degraded" | "stopping" | "failed";
export type ServiceKind = "node" | "python" | "julia" | "mcp" | "model" | "preview" | "worker" | "database" | "queue" | "custom";

const WRITE_ROLES = new Set<ProjectRole>(["owner", "admin", "builder"]);
const ADMIN_ROLES = new Set<ProjectRole>(["owner", "admin"]);

function slugify(value: string): string {
  return String(value || "project")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "project";
}

async function uuid(): Promise<string> {
  const { randomUUID } = await import("node:crypto");
  return randomUUID();
}

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}

async function roleFor(projectId: string, userId: string): Promise<ProjectRole | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql.query<{ role: ProjectRole }>(
    `select role from kiln_project_members where project_id = $1 and user_id = $2 limit 1`,
    [projectId, userId],
  );
  return rows[0]?.role ?? null;
}

async function requireRole(projectId: string, userId: string, allowed: Set<ProjectRole>): Promise<ProjectRole> {
  const role = await roleFor(projectId, userId);
  if (!role || !allowed.has(role)) throw new Error("FORBIDDEN_PROJECT_CAPABILITY");
  return role;
}

export const listMyProjects = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    return sql.query<{
      id: string;
      owner_user_id: string;
      owner_handle: string;
      name: string;
      slug: string;
      visibility: ProjectVisibility;
      source_kind: string;
      source_uri: string | null;
      source_owner: string | null;
      source_repo: string | null;
      source_ref: string | null;
      source_commit_sha: string | null;
      vault_key_commitment: string | null;
      memory_root_digest: string | null;
      machine_state: MachineState;
      capsule_version: number;
      role: ProjectRole;
      updated_at: string;
    }>(
      `select p.*, m.role
         from kiln_projects p
         join kiln_project_members m on m.project_id = p.id
        where m.user_id = $1
        order by p.updated_at desc`,
      [context.userId],
    );
  });

export const createProjectComputer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: {
    name: string;
    ownerHandle: string;
    visibility?: ProjectVisibility;
    source?: { uri?: string; owner?: string; repo?: string; ref?: string; commitSha?: string };
  }) => data)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const id = await uuid();
    const name = String(data.name || "").trim();
    if (!name) throw new Error("PROJECT_NAME_REQUIRED");
    const ownerHandle = slugify(data.ownerHandle || "user");
    const baseSlug = slugify(name);
    const visibility: ProjectVisibility = data.visibility ?? "private";
    if (!["private", "team", "public"].includes(visibility)) throw new Error("INVALID_VISIBILITY");

    // Avoid collisions without leaking another user's project names.
    const slug = `${baseSlug}-${id.slice(0, 8)}`;
    const sourceKind = data.source?.repo ? "github-import" : "native";

    await sql.query("begin");
    try {
      await sql.query(
        `insert into kiln_projects (
           id, owner_user_id, owner_handle, name, slug, visibility, source_kind,
           source_uri, source_owner, source_repo, source_ref, source_commit_sha
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          id,
          context.userId,
          ownerHandle,
          name,
          slug,
          visibility,
          sourceKind,
          data.source?.uri ?? null,
          data.source?.owner ?? null,
          data.source?.repo ?? null,
          data.source?.ref ?? null,
          data.source?.commitSha ?? null,
        ],
      );
      await sql.query(
        `insert into kiln_project_members(project_id,user_id,role,added_by_user_id)
         values ($1,$2,'owner',$2)`,
        [id, context.userId],
      );

      // Every repository starts as its own computer with deterministic service slots.
      const services: Array<[ServiceKind, string, string, boolean]> = [
        ["database", "project-db", "postgres", true],
        ["mcp", "project-mcp", "mcp-streamable-http", true],
        ["python", "python", "python3", true],
        ["node", "node", "nodejs", true],
        ["preview", "preview", "web", true],
      ];
      for (const [kind, serviceName, runtime, localOnly] of services) {
        await sql.query(
          `insert into kiln_project_services(id,project_id,kind,name,runtime,state,local_only)
           values ($1,$2,$3,$4,$5,'stopped',$6)`,
          [await uuid(), id, kind, serviceName, runtime, localOnly],
        );
      }

      const residentRoles = ["conductor", "architect", "builder", "reviewer", "cipher", "indexer"];
      for (const role of residentRoles) {
        const agentId = await uuid();
        await sql.query(
          `insert into kiln_project_agents(
             id,project_id,owner_user_id,role,name,model_id,resident,state,memory_namespace
           ) values ($1,$2,$3,$4,$5,$6,true,'idle',$7)`,
          [
            agentId,
            id,
            context.userId,
            role,
            `KILN ${role}`,
            role === "conductor" ? "grok-4.6" : "project-default",
            `${id}:agent:${agentId}`,
          ],
        );
      }
      await sql.query("commit");
    } catch (error) {
      await sql.query("rollback");
      throw error;
    }

    return { ok: true as const, projectId: id, slug, visibility, sourceKind };
  });

export const getProjectComputer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { projectId: string }) => data)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const role = await roleFor(data.projectId, context.userId);
    if (!role) throw new Error("PROJECT_NOT_FOUND_OR_FORBIDDEN");

    const project = (await sql.query(
      `select id,owner_user_id,owner_handle,name,slug,visibility,source_kind,source_uri,
              source_owner,source_repo,source_ref,source_commit_sha,vault_key_commitment,
              memory_root_digest,machine_state,capsule_version,created_at,updated_at
         from kiln_projects where id=$1`,
      [data.projectId],
    ))[0];
    const services = await sql.query(
      `select id,kind,name,runtime,endpoint,state,local_only,last_heartbeat_at,updated_at
         from kiln_project_services where project_id=$1 order by kind,name`,
      [data.projectId],
    );
    const agents = await sql.query(
      `select id,role,name,model_id,resident,state,memory_namespace,last_seen_at,updated_at
         from kiln_project_agents where project_id=$1 order by resident desc,role,name`,
      [data.projectId],
    );
    const members = await sql.query(
      `select user_id,role,created_at from kiln_project_members where project_id=$1 order by created_at`,
      [data.projectId],
    );
    const memory = await sql.query(
      `select memory_class,count(*)::int as entries,max(created_at) as last_write
         from kiln_project_memory where project_id=$1 group by memory_class order by memory_class`,
      [data.projectId],
    );
    const receipts = await sql.query(
      `select sequence,event,receipt_hash,previous_hash,created_at
         from kiln_project_receipts where project_id=$1 order by sequence desc limit 25`,
      [data.projectId],
    );
    return { ok: true as const, role, project, services, agents, members, memory, receipts };
  });

export const addProjectMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { projectId: string; userId: string; role: Exclude<ProjectRole, "owner"> }) => data)
  .handler(async ({ data, context }) => {
    await requireRole(data.projectId, context.userId, ADMIN_ROLES);
    if (!["admin", "builder", "reviewer", "viewer"].includes(data.role)) throw new Error("INVALID_MEMBER_ROLE");
    if (!String(data.userId || "").trim()) throw new Error("MEMBER_USER_ID_REQUIRED");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      `insert into kiln_project_members(project_id,user_id,role,added_by_user_id)
       values($1,$2,$3,$4)
       on conflict(project_id,user_id) do update set role=excluded.role, added_by_user_id=excluded.added_by_user_id`,
      [data.projectId, data.userId, data.role, context.userId],
    );
    return { ok: true as const };
  });

export const setProjectMachineState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { projectId: string; state: MachineState }) => data)
  .handler(async ({ data, context }) => {
    await requireRole(data.projectId, context.userId, WRITE_ROLES);
    if (!["stopped", "starting", "running", "degraded", "stopping", "failed"].includes(data.state)) {
      throw new Error("INVALID_MACHINE_STATE");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      `update kiln_projects set machine_state=$1,updated_at=now() where id=$2`,
      [data.state, data.projectId],
    );
    return { ok: true as const, state: data.state };
  });

export const updateServiceRuntime = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: {
    projectId: string;
    serviceId: string;
    state: "stopped" | "starting" | "running" | "degraded" | "stopping" | "failed";
    endpoint?: string;
  }) => data)
  .handler(async ({ data, context }) => {
    await requireRole(data.projectId, context.userId, WRITE_ROLES);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const result = await sql.query<{ id: string }>(
      `update kiln_project_services
          set state=$1,endpoint=$2,last_heartbeat_at=case when $1='running' then now() else last_heartbeat_at end,updated_at=now()
        where id=$3 and project_id=$4 returning id`,
      [data.state, data.endpoint ?? null, data.serviceId, data.projectId],
    );
    if (!result.length) throw new Error("SERVICE_NOT_FOUND");
    return { ok: true as const };
  });

export const appendProjectMemory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: {
    projectId: string;
    namespace?: string;
    memoryClass: "working" | "episodic" | "semantic" | "procedural" | "research" | "evidence";
    contentRef: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) => data)
  .handler(async ({ data, context }) => {
    await requireRole(data.projectId, context.userId, WRITE_ROLES);
    if (!String(data.content || "").length) throw new Error("MEMORY_CONTENT_REQUIRED");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const digest = await sha256(data.content);
    const id = await uuid();
    await sql.query(
      `insert into kiln_project_memory(
         id,project_id,namespace,memory_class,content_digest,content_ref,created_by,metadata_json
       ) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       on conflict(project_id,namespace,content_digest) do nothing`,
      [
        id,
        data.projectId,
        data.namespace || `${data.projectId}:project`,
        data.memoryClass,
        digest,
        data.contentRef,
        context.userId,
        JSON.stringify(data.metadata || {}),
      ],
    );
    await sql.query(
      `update kiln_projects set memory_root_digest=$1,updated_at=now() where id=$2`,
      [digest, data.projectId],
    );
    return { ok: true as const, id, digest };
  });
