-- Production Manager — initial schema (SPEC.md §10)
-- Every table carries created_at / updated_at. updated_at is maintained by a trigger.
-- Row-Level Security policies live in the next migration (…_rls_policies.sql).

-- ============================================================================
-- Enums
-- ============================================================================
create type user_role          as enum ('admin', 'lead', 'staff');
create type language           as enum ('en', 'ru', 'es');
create type project_status     as enum ('estimate', 'scheduled', 'in_progress', 'on_hold', 'complete', 'delivered');
create type job_status         as enum ('queued', 'in_production', 'complete', 'cancelled');
create type stage_status       as enum ('upcoming', 'queued', 'in_progress', 'pending_inspection', 'approved', 'rejected');
create type task_status        as enum ('pending_approval', 'unstarted', 'in_progress', 'paused', 'completed', 'cancelled');
create type inspection_decision as enum ('approved', 'rejected');
create type translation_status as enum ('pending', 'done', 'failed');
create type sync_source        as enum ('app', 'sheet');
create type file_type          as enum ('photo', 'pdf');
create type notification_type  as enum (
  'task_assigned', 'task_assigned_dept', 'task_approval_request',
  'task_approved', 'task_rejected', 'stage_pending_inspection',
  'stage_approved', 'stage_rejected', 'job_arrived_in_queue',
  'task_due_soon', 'task_overdue', 'material_arrived_all',
  'project_created', 'note_added', 'clock_in_long'
);

-- ============================================================================
-- Shared trigger function: keep updated_at current
-- ============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- Tables
-- Circular foreign keys (users↔departments, users↔tasks, etc.) are added with
-- ALTER TABLE after both ends exist.
-- ============================================================================

-- departments -----------------------------------------------------------------
create table departments (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null unique,
  lead_user_id             uuid,            -- FK → users added below
  default_routing_position integer,         -- null = not part of the default routing
  is_archived              boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- users (profile row; id mirrors auth.users.id) -------------------------------
create table users (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null unique,
  full_name      text not null,
  phone          text,
  avatar_url     text,
  department_id  uuid references departments(id) on delete set null,
  role           user_role not null default 'staff',
  language       language not null default 'en',
  active_task_id uuid,            -- FK → tasks added below; null = not clocked in
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table departments
  add constraint departments_lead_user_id_fkey
  foreign key (lead_user_id) references users(id) on delete set null;

-- projects --------------------------------------------------------------------
create table projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  client_name         text not null,
  work_order_number   text unique,                       -- e.g. AM1234 (from Estimate Rocket)
  estimate_rocket_id  text,
  description         text,
  status              project_status not null default 'estimate',
  priority_rank       integer,                            -- lower = higher priority
  scheduled_start     date,
  scheduled_end       date,
  qr_code_uuid        uuid not null unique default gen_random_uuid(),
  thumbnail_url       text,
  total_labor_minutes integer not null default 0,         -- denormalized; synced in Sprint 4
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- jobs ------------------------------------------------------------------------
create table jobs (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  job_code            text not null unique,               -- AM1234-A; equals WO number for single-item
  suffix              text,                               -- 'A','B',… 'AA'; null for single-item
  name                text not null,
  description         text,
  status              job_status not null default 'queued',
  current_stage_id    uuid,                               -- FK → job_stages added below
  queue_position      integer,
  qr_code_uuid        uuid not null unique default gen_random_uuid(),
  total_labor_minutes integer not null default 0,         -- denormalized; synced in Sprint 4
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- job_stages (one row per stage in a job's routing) ---------------------------
create table job_stages (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  department_id uuid not null references departments(id),
  sequence      integer not null,                         -- 1,2,3… order within the routing
  status        stage_status not null default 'upcoming',
  submitted_by  uuid references users(id) on delete set null,
  submitted_at  timestamptz,
  entered_at    timestamptz,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (job_id, sequence)
);

alter table jobs
  add constraint jobs_current_stage_id_fkey
  foreign key (current_stage_id) references job_stages(id) on delete set null;

-- tasks -----------------------------------------------------------------------
create table tasks (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references jobs(id) on delete cascade,
  job_stage_id     uuid not null references job_stages(id) on delete cascade,
  name             text not null,
  assigned_user_id uuid references users(id) on delete set null,  -- null = any dept member
  status           task_status not null default 'unstarted',
  created_by       uuid not null references users(id),
  approved_by      uuid references users(id) on delete set null,
  estimated_hours  numeric,
  actual_minutes   integer not null default 0,
  due_date         date,
  instructions     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table users
  add constraint users_active_task_id_fkey
  foreign key (active_task_id) references tasks(id) on delete set null;

-- notes (stores original + en/ru/es translations) ----------------------------
create table notes (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  job_id             uuid references jobs(id) on delete cascade,
  task_id            uuid references tasks(id) on delete cascade,
  author_id          uuid not null references users(id),
  original_text      text not null,
  original_language  language not null,
  en_text            text,
  ru_text            text,
  es_text            text,
  translation_status translation_status not null default 'pending',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- inspections (permanent record of each decision) -----------------------------
create table inspections (
  id           uuid primary key default gen_random_uuid(),
  job_stage_id uuid not null references job_stages(id) on delete cascade,
  inspector_id uuid not null references users(id),
  decision     inspection_decision not null,
  note_id      uuid references notes(id) on delete set null,   -- required for rejections (enforced in app)
  decided_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- labor_logs ------------------------------------------------------------------
create table labor_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id),
  task_id          uuid not null references tasks(id) on delete cascade,
  job_id           uuid not null references jobs(id) on delete cascade,      -- denormalized
  project_id       uuid not null references projects(id) on delete cascade,  -- denormalized
  clocked_in_at    timestamptz not null default now(),
  clocked_out_at   timestamptz,                                              -- null = active session
  duration_minutes integer,
  admin_override   boolean not null default false,                           -- manual or auto-12h close
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- materials -------------------------------------------------------------------
create table materials (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  name          text not null,
  description   text,
  quantity      numeric not null,
  unit          text,
  supplier      text,
  is_ordered    boolean not null default false,
  ordered_at    timestamptz,
  is_arrived    boolean not null default false,
  arrived_at    timestamptz,
  qr_code_uuid  uuid unique default gen_random_uuid(),     -- component-level tag
  sheet_row_ref text,                                       -- Google Sheets row anchor
  sync_source   sync_source not null default 'app',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- files -----------------------------------------------------------------------
create table files (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  job_id          uuid references jobs(id) on delete cascade,
  inspection_id   uuid references inspections(id) on delete set null,
  uploaded_by     uuid not null references users(id),
  file_name       text not null,
  file_type       file_type not null,
  storage_path    text not null,
  file_size_bytes integer not null,
  thumbnail_path  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- notifications (text stored per language) ------------------------------------
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  type            notification_type not null,
  title_en        text not null,
  title_ru        text not null,
  title_es        text not null,
  body_en         text not null,
  body_ru         text not null,
  body_es         text not null,
  related_job_id  uuid references jobs(id) on delete cascade,
  related_task_id uuid references tasks(id) on delete cascade,
  is_read         boolean not null default false,
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- Indexes (Postgres does not auto-index foreign keys)
-- ============================================================================
create index idx_users_department      on users (department_id);
create index idx_projects_status       on projects (status);
create index idx_projects_priority     on projects (priority_rank);
create index idx_jobs_project          on jobs (project_id);
create index idx_jobs_current_stage    on jobs (current_stage_id);
create index idx_jobs_status           on jobs (status);
create index idx_job_stages_job        on job_stages (job_id);
create index idx_job_stages_department on job_stages (department_id);
create index idx_job_stages_status     on job_stages (status);
create index idx_tasks_job             on tasks (job_id);
create index idx_tasks_job_stage       on tasks (job_stage_id);
create index idx_tasks_assigned        on tasks (assigned_user_id);
create index idx_tasks_status          on tasks (status);
create index idx_labor_logs_user       on labor_logs (user_id);
create index idx_labor_logs_task       on labor_logs (task_id);
create index idx_labor_logs_job        on labor_logs (job_id);
create index idx_labor_logs_project    on labor_logs (project_id);
create index idx_labor_logs_active     on labor_logs (user_id) where clocked_out_at is null;
create index idx_notes_project         on notes (project_id);
create index idx_notes_job             on notes (job_id);
create index idx_notes_task            on notes (task_id);
create index idx_inspections_stage     on inspections (job_stage_id);
create index idx_materials_job         on materials (job_id);
create index idx_files_project         on files (project_id);
create index idx_files_job             on files (job_id);
create index idx_notifications_user    on notifications (user_id, is_read);

-- ============================================================================
-- updated_at triggers on every table
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'departments','users','projects','jobs','job_stages','tasks',
    'notes','inspections','labor_logs','materials','files','notifications'
  ]
  loop
    execute format(
      'create trigger %1$s_set_updated_at before update on %1$s
       for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- Auto-create a profile row when an auth account is created (Sprint 2 relies on this)
-- ============================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- Task creation rules (SPEC §9): Staff-created tasks — and Leads creating tasks
-- outside their own department — start as 'pending_approval'.
-- RLS decides WHO may insert; this trigger forces the correct starting status.
-- ============================================================================
create or replace function enforce_task_creation_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_role user_role;
  creator_dept uuid;
  stage_dept   uuid;
begin
  select role, department_id into creator_role, creator_dept
  from public.users where id = new.created_by;

  select department_id into stage_dept
  from public.job_stages where id = new.job_stage_id;

  if creator_role = 'staff' then
    new.status := 'pending_approval';
  elsif creator_role = 'lead' and stage_dept is distinct from creator_dept then
    new.status := 'pending_approval';
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_creation_rules
  before insert on tasks
  for each row execute function enforce_task_creation_rules();

-- ============================================================================
-- Job update guard (SPEC §17): a Lead may only change queue_position, and only
-- on jobs whose current stage is in their own department. Admin/system: no limit.
-- ============================================================================
create or replace function enforce_job_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  urole    user_role;
  udept    uuid;
  job_dept uuid;
begin
  if uid is null then
    return new;  -- service role / system: unrestricted
  end if;

  select role, department_id into urole, udept from public.users where id = uid;

  if urole = 'admin' then
    return new;
  end if;

  if urole = 'lead' then
    job_dept := (select department_id from public.job_stages where id = new.current_stage_id);
    if job_dept is distinct from udept then
      raise exception 'Leads can only modify jobs whose current stage is in their own department';
    end if;
    if new.project_id          is distinct from old.project_id
    or new.job_code            is distinct from old.job_code
    or new.suffix              is distinct from old.suffix
    or new.name                is distinct from old.name
    or new.description         is distinct from old.description
    or new.status              is distinct from old.status
    or new.current_stage_id    is distinct from old.current_stage_id
    or new.qr_code_uuid        is distinct from old.qr_code_uuid
    or new.total_labor_minutes is distinct from old.total_labor_minutes then
      raise exception 'Leads may only change queue_position on jobs';
    end if;
  end if;

  return new;
end;
$$;

create trigger jobs_enforce_update_rules
  before update on jobs
  for each row execute function enforce_job_update_rules();

-- ============================================================================
-- Material update guard (SPEC §17): anyone may flip ordered/arrived status
-- (e.g. via QR scan), but only Procurement or Admin may edit material details.
-- ============================================================================
create or replace function enforce_material_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  urole     user_role;
  udept     uuid;
  proc_dept uuid;
begin
  if uid is null then
    return new;  -- service role / system: unrestricted
  end if;

  select role, department_id into urole, udept from public.users where id = uid;
  if urole = 'admin' then
    return new;
  end if;

  select id into proc_dept from public.departments where name = 'Procurement';
  if udept = proc_dept then
    return new;
  end if;

  -- Everyone else: only the ordered/arrived status fields may change.
  if new.name          is distinct from old.name
  or new.description   is distinct from old.description
  or new.quantity      is distinct from old.quantity
  or new.unit          is distinct from old.unit
  or new.supplier      is distinct from old.supplier
  or new.qr_code_uuid  is distinct from old.qr_code_uuid
  or new.sheet_row_ref is distinct from old.sheet_row_ref then
    raise exception 'Only Procurement or Admin may edit material details; others may only update ordered/arrived status';
  end if;

  return new;
end;
$$;

create trigger materials_enforce_update_rules
  before update on materials
  for each row execute function enforce_material_update_rules();
