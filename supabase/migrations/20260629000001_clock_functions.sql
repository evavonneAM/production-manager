-- Sprint 4 — Clock-in/out & labor tracking.
-- All clock logic lives in SECURITY DEFINER functions so it is atomic, enforces the
-- one-active-task rule, and can roll totals up onto jobs/projects (which RLS forbids
-- Staff from writing directly). Errors use short codes the UI maps to translated text.

-- ============================================================================
-- Internal helper: close the caller's open session and roll up its minutes.
-- NOT granted to clients; only the other definer functions call it.
-- ============================================================================
create or replace function _close_open_session(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log     labor_logs%rowtype;
  v_minutes integer;
begin
  select * into v_log
  from labor_logs
  where user_id = p_uid and clocked_out_at is null
  order by clocked_in_at desc
  limit 1;

  if not found then
    return;
  end if;

  v_minutes := greatest(0, round(extract(epoch from (now() - v_log.clocked_in_at)) / 60.0))::int;

  update labor_logs set clocked_out_at = now(), duration_minutes = v_minutes where id = v_log.id;
  update tasks    set actual_minutes = actual_minutes + v_minutes where id = v_log.task_id;
  update jobs     set total_labor_minutes = total_labor_minutes + v_minutes where id = v_log.job_id;
  update projects set total_labor_minutes = total_labor_minutes + v_minutes where id = v_log.project_id;
end;
$$;

-- ============================================================================
-- auto_close_stale_sessions — safety net: any session open > 12h is closed AT
-- the 12h mark, flagged (admin_override), rolled up, and the user freed.
-- ============================================================================
create or replace function auto_close_stale_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r labor_logs%rowtype;
begin
  for r in
    select * from labor_logs
    where clocked_out_at is null
      and clocked_in_at < now() - interval '12 hours'
  loop
    update labor_logs
      set clocked_out_at = r.clocked_in_at + interval '12 hours',
          duration_minutes = 720,
          admin_override = true
      where id = r.id;
    update tasks    set actual_minutes = actual_minutes + 720, status = 'paused' where id = r.task_id;
    update jobs     set total_labor_minutes = total_labor_minutes + 720 where id = r.job_id;
    update projects set total_labor_minutes = total_labor_minutes + 720 where id = r.project_id;
    update users    set active_task_id = null where id = r.user_id and active_task_id = r.task_id;
  end loop;
end;
$$;

-- ============================================================================
-- clock_in — start a session on a task (enforces one-active-task + eligibility)
-- ============================================================================
create or replace function clock_in(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid         uuid := auth.uid();
  v_user      users%rowtype;
  v_task      tasks%rowtype;
  v_stage_dept uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  -- Opportunistic safety net (covers the case where pg_cron is unavailable).
  perform auto_close_stale_sessions();

  select * into v_user from users where id = uid for update;
  if v_user.active_task_id is not null then
    raise exception 'already_clocked_in';
  end if;

  select * into v_task from tasks where id = p_task_id;
  if not found or v_task.status not in ('unstarted', 'paused') then
    raise exception 'not_eligible';
  end if;

  -- Assigned to caller, or unassigned and in the caller's department.
  select department_id into v_stage_dept from job_stages where id = v_task.job_stage_id;
  if v_task.assigned_user_id is not null and v_task.assigned_user_id <> uid then
    raise exception 'not_eligible';
  end if;
  if v_task.assigned_user_id is null and v_stage_dept is distinct from v_user.department_id then
    raise exception 'not_eligible';
  end if;

  insert into labor_logs (user_id, task_id, job_id, project_id, clocked_in_at)
  select uid, v_task.id, v_task.job_id, j.project_id, now()
  from jobs j where j.id = v_task.job_id;

  update users      set active_task_id = v_task.id where id = uid;
  update tasks      set status = 'in_progress' where id = v_task.id;
  update job_stages set status = 'in_progress', entered_at = coalesce(entered_at, now())
    where id = v_task.job_stage_id and status = 'queued';
end;
$$;

-- ============================================================================
-- clock_out — close the caller's active session; task -> paused
-- ============================================================================
create or replace function clock_out()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  v_task_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select active_task_id into v_task_id from users where id = uid for update;
  if v_task_id is null then raise exception 'not_clocked_in'; end if;

  perform _close_open_session(uid);
  update tasks set status = 'paused' where id = v_task_id and status = 'in_progress';
  update users set active_task_id = null where id = uid;
end;
$$;

-- ============================================================================
-- complete_task — mark a task completed (assigned user, dept Lead, or Admin);
-- if the caller is clocked into it, close the session first.
-- ============================================================================
create or replace function complete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid          uuid := auth.uid();
  v_role       user_role;
  v_dept       uuid;
  v_active     uuid;
  v_task       tasks%rowtype;
  v_stage_dept uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select role, department_id, active_task_id into v_role, v_dept, v_active
  from users where id = uid for update;

  select * into v_task from tasks where id = p_task_id;
  if not found then raise exception 'not_eligible'; end if;

  select department_id into v_stage_dept from job_stages where id = v_task.job_stage_id;

  if not (
    v_task.assigned_user_id = uid
    or v_role = 'admin'
    or (v_role = 'lead' and v_stage_dept = v_dept)
  ) then
    raise exception 'not_eligible';
  end if;

  if v_active = p_task_id then
    perform _close_open_session(uid);
    update users set active_task_id = null where id = uid;
  end if;

  update tasks set status = 'completed' where id = p_task_id;
end;
$$;

-- ============================================================================
-- Grants — clients may call these; the internal helper stays private.
-- ============================================================================
grant execute on function clock_in(uuid)            to authenticated;
grant execute on function clock_out()               to authenticated;
grant execute on function complete_task(uuid)       to authenticated;
grant execute on function auto_close_stale_sessions() to authenticated;

-- ============================================================================
-- Schedule the safety net every 15 min via pg_cron (best-effort: if the
-- extension isn't available, the opportunistic call inside clock_in covers us).
-- ============================================================================
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('auto-close-stale-sessions', '*/15 * * * *', 'select auto_close_stale_sessions();');
  raise notice 'pg_cron scheduled: auto-close-stale-sessions';
exception when others then
  raise notice 'pg_cron unavailable (using opportunistic auto-close instead): %', sqlerrm;
end $$;
