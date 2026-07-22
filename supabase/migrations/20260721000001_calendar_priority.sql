-- Sprint 11 — calendar & priority-board groundwork.

-- Remembers the pushed Google Calendar event per project (update, don't duplicate).
alter table projects add column gcal_event_id text;

-- Google Calendar events whose titles/descriptions carry a job or work-order
-- code (owner's naming convention). Written only by the gcal-sync function.
create table calendar_events (
  id            uuid primary key default gen_random_uuid(),
  gcal_event_id text not null unique,
  title         text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  all_day       boolean not null default false,
  location      text,
  project_id    uuid references projects(id) on delete cascade,
  job_id        uuid references jobs(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_calendar_events_project on calendar_events (project_id);
create index idx_calendar_events_job     on calendar_events (job_id);
create index idx_calendar_events_start   on calendar_events (starts_at);

create trigger calendar_events_set_updated_at
  before update on calendar_events
  for each row execute function set_updated_at();

alter table calendar_events enable row level security;
create policy calendar_events_select on calendar_events
  for select to authenticated using (true);
-- No insert/update/delete policies: service role (gcal-sync) only.

-- ============================================================================
-- Priority Board (SPEC S04): admin reorders projects; ranks are 1..n in the
-- given order, and every active department queue is re-sorted to match.
-- ============================================================================
create or replace function set_project_priorities(p_project_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  v_role user_role;
  i      integer;
  dept   uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select role into v_role from users where id = uid;
  if v_role is distinct from 'admin' then raise exception 'not_eligible'; end if;

  for i in 1 .. coalesce(array_length(p_project_ids, 1), 0) loop
    update projects set priority_rank = i where id = p_project_ids[i];
  end loop;

  -- Priority feeds the shop floor: re-sequence every department with live jobs.
  for dept in
    select distinct js.department_id
    from jobs j
    join job_stages js on js.id = j.current_stage_id
    where j.status in ('queued', 'in_production')
  loop
    perform _resequence_department_queue(dept);
  end loop;
end;
$$;

grant execute on function set_project_priorities(uuid[]) to authenticated;
