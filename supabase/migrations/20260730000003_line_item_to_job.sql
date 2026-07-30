-- Owner feedback (2026-07-30, Kim Randles order): estimate line items should
-- split into jobs directly from the review panel — the manual Split Job flow
-- made admins retype names and lost the item's specs.
alter table er_line_items add column job_id uuid references jobs(id) on delete set null;

-- Turn a suggested line item into its own job.
--  * First job-worthy item CLAIMS the project's lone unsuffixed job (renames
--    it, sets its scope) — no pointless "-A" when one piece is the whole order.
--  * Later items suffix the existing lone job to -A (split semantics) and
--    create the next letter, copying the sibling's routing, queued at stage 1.
create or replace function line_item_to_job(p_line_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  v_role    user_role;
  v_item    er_line_items%rowtype;
  v_project projects%rowtype;
  v_jobs    integer;
  v_lone    jobs%rowtype;
  v_claimed integer;
  v_base    text;
  v_next    text;
  v_new_id  uuid;
  v_first   uuid;
  v_dept    uuid;
  v_src     uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select role into v_role from users where id = uid;
  if v_role is distinct from 'admin' then raise exception 'not_eligible'; end if;

  select * into v_item from er_line_items where id = p_line_item_id;
  if not found then raise exception 'not_found'; end if;
  if v_item.status <> 'suggested' then raise exception 'not_suggested'; end if;

  select * into v_project from projects where id = v_item.project_id;
  select count(*) into v_jobs from jobs where project_id = v_project.id;
  select count(*) into v_claimed from er_line_items
   where project_id = v_project.id and job_id is not null;

  -- Case 1: claim the lone unsuffixed imported job.
  if v_jobs = 1 and v_claimed = 0 then
    select * into v_lone from jobs where project_id = v_project.id;
    if v_lone.suffix is null then
      update jobs set name = v_item.name, description = v_item.description
       where id = v_lone.id;
      update er_line_items set status = 'accepted', job_id = v_lone.id
       where id = p_line_item_id;
      return v_lone.id;
    end if;
  end if;

  -- Case 2: a new suffixed job. Suffix the lone unsuffixed job to -A first.
  if v_jobs = 1 then
    select * into v_lone from jobs where project_id = v_project.id;
    if v_lone.suffix is null then
      update jobs set job_code = v_lone.job_code || '-A', suffix = 'A'
       where id = v_lone.id;
    end if;
  end if;

  v_base := coalesce(v_project.work_order_number,
                     (select regexp_replace(job_code, '-[A-Z]+$', '') from jobs
                       where project_id = v_project.id limit 1));
  select chr(65 + count(*)) into v_next from jobs where project_id = v_project.id;

  insert into jobs (project_id, job_code, suffix, name, description, status)
  values (v_project.id, v_base || '-' || v_next, v_next, v_item.name, v_item.description, 'queued')
  returning id into v_new_id;

  -- Copy a sibling's routing; first stage queued, rest upcoming.
  select id into v_src from jobs where project_id = v_project.id and id <> v_new_id limit 1;
  insert into job_stages (job_id, department_id, sequence, status, entered_at)
  select v_new_id, department_id, sequence,
         case when sequence = 1 then 'queued'::stage_status else 'upcoming'::stage_status end,
         case when sequence = 1 then now() else null end
    from job_stages
   where job_id = v_src
   order by sequence;

  select id into v_first from job_stages where job_id = v_new_id and sequence = 1;
  update jobs set current_stage_id = v_first where id = v_new_id;

  select department_id into v_dept from job_stages where job_id = v_new_id and sequence = 1;
  perform _resequence_department_queue(v_dept);

  update er_line_items set status = 'accepted', job_id = v_new_id where id = p_line_item_id;
  return v_new_id;
end;
$$;
