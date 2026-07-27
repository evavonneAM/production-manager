-- Sprint 12 — Split Job (BUILD_PLAN: ER payloads carry no line items, so an
-- imported single job can be split into -A/-B/… pieces by an admin).
--
-- The original job keeps ALL its production state (stages, tasks, labor,
-- materials, QR) and just gains the "-A" suffix; each new piece is a fresh
-- job starting at the beginning of the same routing, queued in its first
-- department. Only unsuffixed jobs can be split (no splitting a split).
create or replace function split_job(p_job_id uuid, p_new_names text[])
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  v_role    user_role;
  v_job     jobs%rowtype;
  v_name    text;
  v_i       integer := 0;
  v_new_id  uuid;
  v_new_ids uuid[] := '{}';
  v_first   uuid;
  v_dept    uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select role into v_role from users where id = uid;
  if v_role is distinct from 'admin' then raise exception 'not_eligible'; end if;

  select * into v_job from jobs where id = p_job_id;
  if not found then raise exception 'not_found'; end if;
  if v_job.suffix is not null then raise exception 'already_split'; end if;
  if coalesce(array_length(p_new_names, 1), 0) < 1 then raise exception 'no_names'; end if;
  if array_length(p_new_names, 1) > 25 then raise exception 'too_many_pieces'; end if;

  -- Original becomes piece A, state untouched.
  update jobs
     set job_code = v_job.job_code || '-A', suffix = 'A'
   where id = p_job_id;

  foreach v_name in array p_new_names loop
    v_i := v_i + 1;
    insert into jobs (project_id, job_code, suffix, name, description, status)
    values (
      v_job.project_id,
      v_job.job_code || '-' || chr(65 + v_i),  -- B, C, …
      chr(65 + v_i),
      coalesce(nullif(trim(v_name), ''), v_job.name),
      null,
      'queued'
    )
    returning id into v_new_id;

    -- Fresh copy of the original's routing; first stage queued, rest upcoming.
    insert into job_stages (job_id, department_id, sequence, status, entered_at)
    select v_new_id, department_id, sequence,
           case when sequence = 1 then 'queued'::stage_status else 'upcoming'::stage_status end,
           case when sequence = 1 then now() else null end
      from job_stages
     where job_id = p_job_id
     order by sequence;

    select id into v_first from job_stages where job_id = v_new_id and sequence = 1;
    update jobs set current_stage_id = v_first where id = v_new_id;

    v_new_ids := v_new_ids || v_new_id;
  end loop;

  -- Slot the new pieces into their first department's queue by priority.
  select department_id into v_dept
    from job_stages where job_id = p_job_id and sequence = 1;
  perform _resequence_department_queue(v_dept);

  return v_new_ids;
end;
$$;
