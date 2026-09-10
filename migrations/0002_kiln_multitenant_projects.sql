-- KILN multi-tenant project-computer substrate.
-- Every durable row is explicitly tenant/project scoped. No world-readable project rows.

create table if not exists kiln_projects (
  id text primary key,
  owner_user_id text not null,
  owner_handle text not null,
  name text not null,
  slug text not null,
  visibility text not null default 'private' check (visibility in ('private','team','public')),
  source_kind text not null default 'native' check (source_kind in ('native','github-import','fork')),
  source_uri text,
  source_owner text,
  source_repo text,
  source_ref text,
  source_commit_sha text,
  vault_key_commitment text,
  memory_root_digest text,
  machine_state text not null default 'stopped' check (machine_state in ('stopped','starting','running','degraded','stopping','failed')),
  capsule_version integer not null default 1 check (capsule_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, slug)
);

create index if not exists kiln_projects_owner_idx on kiln_projects(owner_user_id, updated_at desc);
create index if not exists kiln_projects_source_idx on kiln_projects(source_owner, source_repo);

create table if not exists kiln_project_members (
  project_id text not null references kiln_projects(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner','admin','builder','reviewer','viewer')),
  added_by_user_id text not null,
  created_at timestamptz not null default now(),
  primary key(project_id, user_id)
);

create index if not exists kiln_project_members_user_idx on kiln_project_members(user_id, project_id);

create table if not exists kiln_project_services (
  id text primary key,
  project_id text not null references kiln_projects(id) on delete cascade,
  kind text not null check (kind in ('node','python','julia','mcp','model','preview','worker','database','queue','custom')),
  name text not null,
  runtime text not null,
  command text,
  endpoint text,
  state text not null default 'stopped' check (state in ('stopped','starting','running','degraded','stopping','failed')),
  local_only boolean not null default true,
  encrypted_config_digest text,
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name)
);

create index if not exists kiln_project_services_project_idx on kiln_project_services(project_id, state);

create table if not exists kiln_project_agents (
  id text primary key,
  project_id text not null references kiln_projects(id) on delete cascade,
  owner_user_id text not null,
  role text not null,
  name text not null,
  model_id text not null,
  resident boolean not null default true,
  state text not null default 'idle' check (state in ('idle','queued','running','waiting_approval','blocked','failed','offline')),
  capability_digest text,
  memory_namespace text not null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kiln_project_agents_project_idx on kiln_project_agents(project_id, resident, state);

create table if not exists kiln_project_memory (
  id text primary key,
  project_id text not null references kiln_projects(id) on delete cascade,
  namespace text not null,
  memory_class text not null check (memory_class in ('working','episodic','semantic','procedural','research','evidence')),
  content_digest text not null,
  content_ref text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb
);

create index if not exists kiln_project_memory_lookup_idx on kiln_project_memory(project_id, memory_class, created_at desc);
create unique index if not exists kiln_project_memory_digest_idx on kiln_project_memory(project_id, namespace, content_digest);

create table if not exists kiln_project_receipts (
  id text primary key,
  project_id text not null references kiln_projects(id) on delete cascade,
  sequence bigint not null,
  event text not null,
  actor_user_id text,
  actor_agent_id text,
  previous_hash text not null,
  receipt_hash text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now(),
  unique(project_id, sequence),
  unique(project_id, receipt_hash)
);

create index if not exists kiln_project_receipts_project_idx on kiln_project_receipts(project_id, sequence desc);
