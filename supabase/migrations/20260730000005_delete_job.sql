-- Owner request (2026-07-30): admins can delete a job from Edit job — needed
-- after item→job splitting left duplicate jobs on real orders.
--  * Jobs with logged labor are protected (history is never destroyed).
--  * Estimate line items that pointed at the job return to "suggested".
--  * Tasks/stages/materials/files on the job cascade away; the department
--    queue re-sequences.
create or replace function delete_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  v_role  user_role;
  v_job   jobs%rowtype;
  v_labor integer;
  v_dept  uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select role into v_role from users where id = uid;
  if v_role is distinct from 'admin' then raise exception 'not_eligible'; end if;

  select * into v_job from jobs where id = p_job_id;
  if not found then raise exception 'not_found'; end if;

  select count(*)::int into v_labor from labor_logs where job_id = p_job_id;
  if v_labor > 0 then raise exception 'has_labor'; end if;

  select department_id into v_dept from job_stages where id = v_job.current_stage_id;

  update er_line_items set status = 'suggested', job_id = null where job_id = p_job_id;
  delete from jobs where id = p_job_id;

  if v_dept is not null then
    perform _resequence_department_queue(v_dept);
  end if;
end;
$$;
