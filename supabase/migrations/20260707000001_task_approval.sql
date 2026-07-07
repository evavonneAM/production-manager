-- Sprint 8 — task creation approval (SPEC §9).
-- The enforce_task_creation_rules trigger already sets pending_approval on insert for
-- Staff (and Leads creating outside their dept). Here we notify approvers on creation and
-- add approve/reject functions. Eligibility: Admin, or the Lead of the task's stage dept.

-- ============================================================================
-- Notify approvers when a task is created needing approval.
-- ============================================================================
create or replace function notify_task_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage_dept uuid;
  v_job        jobs%rowtype;
  rec          record;
begin
  if new.status <> 'pending_approval' then
    return new;
  end if;
  select department_id into v_stage_dept from job_stages where id = new.job_stage_id;
  select * into v_job from jobs where id = new.job_id;

  for rec in
    select u.id from users u
    where u.is_active and u.id <> new.created_by
      and (u.role = 'admin' or (u.role = 'lead' and u.department_id = v_stage_dept))
  loop
    perform _notify(rec.id, 'task_approval_request',
      'Task approval: ' || v_job.job_code,
      'Одобрение задачи: ' || v_job.job_code,
      'Aprobación de tarea: ' || v_job.job_code,
      new.name || ' needs approval.',
      new.name || ' требует одобрения.',
      new.name || ' necesita aprobación.',
      v_job.id);
  end loop;
  return new;
end;
$$;

create trigger tasks_notify_approval
  after insert on tasks
  for each row execute function notify_task_approval();

-- ============================================================================
-- approve_task — make a pending task clockable.
-- ============================================================================
create or replace function approve_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid          uuid := auth.uid();
  v_role       user_role;
  v_dept       uuid;
  v_task       tasks%rowtype;
  v_stage_dept uuid;
  v_job        jobs%rowtype;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select role, department_id into v_role, v_dept from users where id = uid;
  select * into v_task from tasks where id = p_task_id;
  if not found then raise exception 'not_found'; end if;
  if v_task.status <> 'pending_approval' then raise exception 'not_pending'; end if;
  select department_id into v_stage_dept from job_stages where id = v_task.job_stage_id;
  if not (v_role = 'admin' or (v_role = 'lead' and v_dept = v_stage_dept)) then
    raise exception 'not_eligible';
  end if;

  update tasks set status = 'unstarted', approved_by = uid where id = p_task_id;

  select * into v_job from jobs where id = v_task.job_id;
  perform _notify(v_task.created_by, 'task_approved',
    'Task approved: ' || v_job.job_code,
    'Задача одобрена: ' || v_job.job_code,
    'Tarea aprobada: ' || v_job.job_code,
    v_task.name || ' was approved.',
    v_task.name || ' одобрена.',
    v_task.name || ' fue aprobada.',
    v_job.id);
end;
$$;

-- ============================================================================
-- reject_task — archive a pending task with a reason (returns the note id so the
-- client can kick off its translation, like inspection rejections).
-- ============================================================================
create or replace function reject_task(p_task_id uuid, p_note_text text, p_note_language language)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid          uuid := auth.uid();
  v_role       user_role;
  v_dept       uuid;
  v_task       tasks%rowtype;
  v_stage_dept uuid;
  v_job        jobs%rowtype;
  v_note_id    uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_note_text is null or length(trim(p_note_text)) = 0 then raise exception 'note_required'; end if;
  select role, department_id into v_role, v_dept from users where id = uid;
  select * into v_task from tasks where id = p_task_id;
  if not found then raise exception 'not_found'; end if;
  if v_task.status <> 'pending_approval' then raise exception 'not_pending'; end if;
  select department_id into v_stage_dept from job_stages where id = v_task.job_stage_id;
  if not (v_role = 'admin' or (v_role = 'lead' and v_dept = v_stage_dept)) then
    raise exception 'not_eligible';
  end if;

  select * into v_job from jobs where id = v_task.job_id;

  insert into notes (project_id, job_id, task_id, author_id, original_text, original_language, translation_status)
  values (v_job.project_id, v_job.id, p_task_id, uid, p_note_text, p_note_language, 'pending')
  returning id into v_note_id;

  update tasks set status = 'cancelled', approved_by = uid where id = p_task_id;

  perform _notify(v_task.created_by, 'task_rejected',
    'Task rejected: ' || v_job.job_code,
    'Задача отклонена: ' || v_job.job_code,
    'Tarea rechazada: ' || v_job.job_code,
    v_task.name || ': ' || p_note_text,
    v_task.name || ': ' || p_note_text,
    v_task.name || ': ' || p_note_text,
    v_job.id);

  return v_note_id;
end;
$$;

grant execute on function approve_task(uuid)                to authenticated;
grant execute on function reject_task(uuid, text, language) to authenticated;
