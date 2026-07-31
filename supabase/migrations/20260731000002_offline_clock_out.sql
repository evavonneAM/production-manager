-- Sprint 14 offline resilience: a clock-out tapped without signal is queued on
-- the phone and replayed on reconnect carrying its ORIGINAL tap time, so labor
-- stays accurate. clock_out() gains an optional bounded timestamp.

-- Drop the old signatures first — a defaulted parameter would otherwise
-- create ambiguous overloads for every internal 1-arg/0-arg call.
drop function _close_open_session(uuid);
drop function clock_out();

create or replace function _close_open_session(p_uid uuid, p_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log     labor_logs%rowtype;
  v_at      timestamptz;
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

  -- Sanity bounds on client-supplied times: never before the clock-in,
  -- never in the (beyond clock-skew) future.
  v_at := coalesce(p_at, now());
  if v_at < v_log.clocked_in_at then v_at := v_log.clocked_in_at; end if;
  if v_at > now() + interval '2 minutes' then v_at := now(); end if;

  v_minutes := greatest(0, round(extract(epoch from (v_at - v_log.clocked_in_at)) / 60.0))::int;

  update labor_logs
     set clocked_out_at = v_at,
         duration_minutes = v_minutes
   where id = v_log.id;

  update tasks
     set actual_minutes = actual_minutes + v_minutes
   where id = v_log.task_id;

  update jobs
     set total_labor_minutes = total_labor_minutes + v_minutes
   where id = v_log.job_id;

  update projects
     set total_labor_minutes = total_labor_minutes + v_minutes
   where id = v_log.project_id;
end;
$$;

create or replace function clock_out(p_at timestamptz default null)
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

  perform _close_open_session(uid, p_at);
  update tasks set status = 'paused' where id = v_task_id and status = 'in_progress';
  update users set active_task_id = null where id = uid;
end;
$$;

-- The internal-helper lockdown applies to the new signature too.
revoke execute on function _close_open_session(uuid, timestamptz) from public, anon, authenticated;
