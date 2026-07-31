-- Owner hit this on AM6904-C (2026-07-31): unassigned tasks are claimable
-- only within the stage's department, which blocked the admin herself.
-- Admins now clock into any workable task; staff/lead rules unchanged.
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

  -- Assigned to caller, or unassigned and in the caller's department;
  -- admins may pick up any workable task (small-shop reality).
  select department_id into v_stage_dept from job_stages where id = v_task.job_stage_id;
  if v_user.role <> 'admin' then
    if v_task.assigned_user_id is not null and v_task.assigned_user_id <> uid then
      raise exception 'not_eligible';
    end if;
    if v_task.assigned_user_id is null and v_stage_dept is distinct from v_user.department_id then
      raise exception 'not_eligible';
    end if;
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
