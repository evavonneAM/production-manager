-- Production Manager — Row-Level Security (SPEC.md §17)
-- The frontend is not trusted; these policies are the real boundary.
-- The service_role key (Edge Functions / seeding) bypasses RLS entirely.

-- ============================================================================
-- Helper functions. SECURITY DEFINER + locked search_path so they can read the
-- caller's profile WITHOUT triggering RLS on public.users (avoids recursion).
-- ============================================================================
create or replace function auth_role()
returns user_role
language sql stable security definer set search_path = public
as $$ select role from public.users where id = auth.uid() $$;

create or replace function auth_department_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select department_id from public.users where id = auth.uid() $$;

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'admin' from public.users where id = auth.uid()), false) $$;

-- Department of an arbitrary user, read without RLS — needed because the users
-- table is read-restricted, so a Lead cannot subquery a teammate's department.
create or replace function user_department(target uuid)
returns uuid
language sql stable security definer set search_path = public
as $$ select department_id from public.users where id = target $$;

-- ============================================================================
-- Enable RLS on every table
-- ============================================================================
alter table departments   enable row level security;
alter table users         enable row level security;
alter table projects      enable row level security;
alter table jobs          enable row level security;
alter table job_stages    enable row level security;
alter table tasks         enable row level security;
alter table notes         enable row level security;
alter table inspections   enable row level security;
alter table labor_logs    enable row level security;
alter table materials     enable row level security;
alter table files         enable row level security;
alter table notifications enable row level security;

-- ============================================================================
-- departments — read: all; write: admin
-- ============================================================================
create policy departments_select on departments for select to authenticated using (true);
create policy departments_admin  on departments for all    to authenticated using (is_admin()) with check (is_admin());

-- ============================================================================
-- users — read: own + admin (base table); write: own profile, role/dept by admin
-- A read-only directory VIEW (below) exposes names/avatars to everyone so the UI
-- can show task assignees and note authors without opening up the base table.
-- ============================================================================
create policy users_select_self on users for select to authenticated using (id = auth.uid() or is_admin());
create policy users_update_self on users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy users_admin       on users for all    to authenticated using (is_admin()) with check (is_admin());

-- Note: a user updating their own row could in theory change their own role via
-- the client. Locked down by a guard trigger so only admins change role/department.
create or replace function enforce_user_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    return new;  -- service role / admin: unrestricted
  end if;
  if new.role is distinct from old.role or new.department_id is distinct from old.department_id then
    raise exception 'Only an admin may change a user''s role or department';
  end if;
  return new;
end;
$$;

create trigger users_enforce_update_rules
  before update on users
  for each row execute function enforce_user_update_rules();

-- Directory view: safe, non-sensitive profile fields, readable by all authenticated.
create view user_directory
with (security_invoker = off) as
  select id, full_name, avatar_url, department_id, role, is_active
  from public.users;

revoke all on user_directory from anon;
grant select on user_directory to authenticated;

-- ============================================================================
-- projects — read: all; write: admin
-- ============================================================================
create policy projects_select on projects for select to authenticated using (true);
create policy projects_admin  on projects for all    to authenticated using (is_admin()) with check (is_admin());

-- ============================================================================
-- jobs — read: all; write: admin; Leads may update jobs in their own dept
--        (column-limited to queue_position by the guard trigger)
-- ============================================================================
create policy jobs_select on jobs for select to authenticated using (true);
create policy jobs_admin   on jobs for all    to authenticated using (is_admin()) with check (is_admin());
create policy jobs_lead_update on jobs for update to authenticated
  using (
    auth_role() = 'lead'
    and (select department_id from job_stages where id = jobs.current_stage_id) = auth_department_id()
  )
  with check (
    auth_role() = 'lead'
    and (select department_id from job_stages where id = jobs.current_stage_id) = auth_department_id()
  );

-- ============================================================================
-- job_stages — read: all; write: admin; submit-for-inspection: Lead of own dept
-- ============================================================================
create policy job_stages_select on job_stages for select to authenticated using (true);
create policy job_stages_admin  on job_stages for all    to authenticated using (is_admin()) with check (is_admin());
create policy job_stages_lead_update on job_stages for update to authenticated
  using (auth_role() = 'lead' and department_id = auth_department_id())
  with check (auth_role() = 'lead' and department_id = auth_department_id());

-- ============================================================================
-- inspections — read: all; insert: eligible inspectors only; records immutable
--   (Admin anywhere; Lead of the submitting department; submitter ≠ inspector
--    unless Admin). No update/delete: a rejected-then-approved stage is two rows.
-- ============================================================================
create policy inspections_select on inspections for select to authenticated using (true);
create policy inspections_insert on inspections for insert to authenticated
  with check (
    inspector_id = auth.uid()
    and (
      is_admin()
      or (
        auth_role() = 'lead'
        and (select department_id from job_stages where id = job_stage_id) = auth_department_id()
        and (select submitted_by   from job_stages where id = job_stage_id) is distinct from auth.uid()
      )
    )
  );

-- ============================================================================
-- tasks — read: all; create: anyone (status forced by trigger); update: admin,
--         dept Lead (own dept), or the assigned user
-- ============================================================================
create policy tasks_select on tasks for select to authenticated using (true);
create policy tasks_insert on tasks for insert to authenticated with check (created_by = auth.uid());
create policy tasks_admin  on tasks for all    to authenticated using (is_admin()) with check (is_admin());
create policy tasks_lead_update on tasks for update to authenticated
  using (auth_role() = 'lead' and (select department_id from job_stages where id = tasks.job_stage_id) = auth_department_id())
  with check (auth_role() = 'lead' and (select department_id from job_stages where id = tasks.job_stage_id) = auth_department_id());
create policy tasks_assigned_update on tasks for update to authenticated
  using (assigned_user_id = auth.uid())
  with check (assigned_user_id = auth.uid());

-- ============================================================================
-- labor_logs — read: own + dept Lead + admin; a user writes their own logs;
--              admin/Lead may override (manual clock-out of their people)
-- ============================================================================
create policy labor_logs_select on labor_logs for select to authenticated
  using (
    user_id = auth.uid()
    or is_admin()
    or (auth_role() = 'lead' and user_department(labor_logs.user_id) = auth_department_id())
  );
create policy labor_logs_insert_own on labor_logs for insert to authenticated with check (user_id = auth.uid());
create policy labor_logs_update_own on labor_logs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy labor_logs_admin on labor_logs for all to authenticated using (is_admin()) with check (is_admin());
create policy labor_logs_lead_update on labor_logs for update to authenticated
  using (auth_role() = 'lead' and user_department(labor_logs.user_id) = auth_department_id())
  with check (auth_role() = 'lead' and user_department(labor_logs.user_id) = auth_department_id());

-- ============================================================================
-- notes — read: all; create: anyone (as themselves); update/delete: own + admin
-- ============================================================================
create policy notes_select     on notes for select to authenticated using (true);
create policy notes_insert      on notes for insert to authenticated with check (author_id = auth.uid());
create policy notes_update_own  on notes for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy notes_delete      on notes for delete to authenticated using (author_id = auth.uid() or is_admin());
create policy notes_admin       on notes for all    to authenticated using (is_admin()) with check (is_admin());

-- ============================================================================
-- files — read: all; upload: anyone (as themselves); delete: own + admin
-- ============================================================================
create policy files_select on files for select to authenticated using (true);
create policy files_insert on files for insert to authenticated with check (uploaded_by = auth.uid());
create policy files_delete on files for delete to authenticated using (uploaded_by = auth.uid() or is_admin());
create policy files_admin  on files for all    to authenticated using (is_admin()) with check (is_admin());

-- ============================================================================
-- materials — read: all; details: Procurement + Admin; ordered/arrived flags:
--             anyone (the guard trigger limits non-Procurement to status fields)
-- ============================================================================
create policy materials_select on materials for select to authenticated using (true);
create policy materials_admin  on materials for all    to authenticated using (is_admin()) with check (is_admin());
create policy materials_procurement on materials for all to authenticated
  using (auth_department_id() = (select id from departments where name = 'Procurement'))
  with check (auth_department_id() = (select id from departments where name = 'Procurement'));
create policy materials_status_update on materials for update to authenticated using (true) with check (true);

-- ============================================================================
-- notifications — read: own; update own (mark read); insert: system only
--                 (no insert policy → only the service role can create them)
-- ============================================================================
create policy notifications_select_own on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
