-- Sprint 6 — Workflow engine: submit → inspect (approve/reject) → priority-ordered hand-off.
-- All state changes are atomic SECURITY DEFINER functions. They enforce eligibility
-- (a submitter can't approve their own stage unless Admin) and write rows RLS forbids
-- Staff/Leads from writing directly. Short error codes map to translated UI messages.

-- ============================================================================
-- Internal: insert a per-language notification row.
-- ============================================================================
create or replace function _notify(
  p_user_id uuid, p_type notification_type,
  p_title_en text, p_title_ru text, p_title_es text,
  p_body_en text, p_body_ru text, p_body_es text,
  p_job_id uuid
) returns void
language sql security definer set search_path = public
as $$
  insert into notifications
    (user_id, type, title_en, title_ru, title_es, body_en, body_ru, body_es, related_job_id, sent_at)
  values
    (p_user_id, p_type, p_title_en, p_title_ru, p_title_es, p_body_en, p_body_ru, p_body_es, p_job_id, now());
$$;

-- ============================================================================
-- Internal: is this user allowed to inspect this stage?
-- Admin (anywhere), or the Lead of the stage's department who did NOT submit it.
-- ============================================================================
create or replace function _eligible_inspector(p_uid uuid, p_job_stage_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role       user_role;
  v_dept       uuid;
  v_stage_dept uuid;
  v_submitter  uuid;
begin
  select role, department_id into v_role, v_dept from users where id = p_uid;
  if v_role = 'admin' then return true; end if;
  select department_id, submitted_by into v_stage_dept, v_submitter
  from job_stages where id = p_job_stage_id;
  return v_role = 'lead' and v_stage_dept = v_dept and v_submitter is distinct from p_uid;
end;
$$;

-- ============================================================================
-- Internal: the priority-ordered hand-off math. Recompute queue_position for
-- every job whose CURRENT stage is in this department, ordered by project
-- priority (nulls last), then arrival time, then job creation. A Lead's manual
-- reorder (Sprint 11) edits queue_position directly and holds until the next
-- arrival re-sequences (per SPEC §4).
-- ============================================================================
create or replace function _resequence_department_queue(p_department_id uuid)
returns void
language sql security definer set search_path = public
as $$
  with ranked as (
    select j.id,
      row_number() over (
        order by coalesce(p.priority_rank, 2147483647) asc,
                 js.entered_at asc nulls last,
                 j.created_at asc
      ) as pos
    from jobs j
    join job_stages js on js.id = j.current_stage_id
    join projects p on p.id = j.project_id
    where js.department_id = p_department_id
      and j.status in ('queued', 'in_production')
  )
  update jobs set queue_position = ranked.pos
  from ranked where jobs.id = ranked.id;
$$;

-- ============================================================================
-- submit_stage_for_inspection — Lead (own dept) or Admin marks the current
-- stage ready; it appears on the Inspection Queue.
-- ============================================================================
create or replace function submit_stage_for_inspection(p_job_stage_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  v_role  user_role;
  v_dept  uuid;
  v_stage job_stages%rowtype;
  v_job   jobs%rowtype;
  rec     record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select role, department_id into v_role, v_dept from users where id = uid;
  select * into v_stage from job_stages where id = p_job_stage_id;
  if not found then raise exception 'not_found'; end if;

  select * into v_job from jobs where id = v_stage.job_id;
  if v_job.current_stage_id is distinct from p_job_stage_id then raise exception 'not_current_stage'; end if;
  if v_stage.status not in ('queued', 'in_progress') then raise exception 'not_submittable'; end if;
  if not (v_role = 'admin' or (v_role = 'lead' and v_dept = v_stage.department_id)) then
    raise exception 'not_eligible';
  end if;

  update job_stages
    set status = 'pending_inspection', submitted_by = uid, submitted_at = now()
    where id = p_job_stage_id;

  -- Notify eligible inspectors: all admins + the dept's lead (excluding the submitter).
  for rec in
    select u.id from users u
    where u.is_active and u.id <> uid
      and (u.role = 'admin' or (u.role = 'lead' and u.department_id = v_stage.department_id))
  loop
    perform _notify(rec.id, 'stage_pending_inspection',
      'Inspection needed: ' || v_job.job_code,
      'Требуется приёмка: ' || v_job.job_code,
      'Inspección requerida: ' || v_job.job_code,
      v_job.job_code || ' is ready for inspection.',
      v_job.job_code || ' готов к приёмке.',
      v_job.job_code || ' está listo para inspección.',
      v_job.id);
  end loop;
end;
$$;

-- ============================================================================
-- approve_stage — advance the job: next stage Queued, inserted into the
-- receiving department's queue by priority; or job Complete if final.
-- ============================================================================
create or replace function approve_stage(p_job_stage_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  v_stage job_stages%rowtype;
  v_job   jobs%rowtype;
  v_next  job_stages%rowtype;
  rec     record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into v_stage from job_stages where id = p_job_stage_id;
  if not found then raise exception 'not_found'; end if;
  if v_stage.status <> 'pending_inspection' then raise exception 'not_pending'; end if;
  if not _eligible_inspector(uid, p_job_stage_id) then raise exception 'not_eligible'; end if;

  select * into v_job from jobs where id = v_stage.job_id;

  insert into inspections (job_stage_id, inspector_id, decision, decided_at)
  values (p_job_stage_id, uid, 'approved', now());

  update job_stages set status = 'approved', approved_at = now() where id = p_job_stage_id;

  select * into v_next from job_stages
  where job_id = v_stage.job_id and sequence > v_stage.sequence
  order by sequence asc limit 1;

  if found then
    update job_stages set status = 'queued', entered_at = now() where id = v_next.id;
    update jobs set current_stage_id = v_next.id, status = 'in_production' where id = v_job.id;
    perform _resequence_department_queue(v_next.department_id);

    -- Notify the receiving department (lead + members).
    for rec in
      select u.id, u.role from users u
      where u.is_active and u.department_id = v_next.department_id and u.id <> uid
    loop
      perform _notify(rec.id, 'stage_approved',
        'New work: ' || v_job.job_code,
        'Новая работа: ' || v_job.job_code,
        'Nuevo trabajo: ' || v_job.job_code,
        v_job.job_code || ' arrived in your department.',
        v_job.job_code || ' поступил в ваш отдел.',
        v_job.job_code || ' llegó a tu departamento.',
        v_job.id);
      if rec.role = 'lead' then
        perform _notify(rec.id, 'job_arrived_in_queue',
          'Queue: ' || v_job.job_code, 'Очередь: ' || v_job.job_code, 'Cola: ' || v_job.job_code,
          v_job.job_code || ' is in your queue.',
          v_job.job_code || ' в вашей очереди.',
          v_job.job_code || ' está en tu cola.',
          v_job.id);
      end if;
    end loop;
  else
    update jobs set status = 'complete' where id = v_job.id;
  end if;
end;
$$;

-- ============================================================================
-- reject_stage — record a rejection with a mandatory note; return the stage to
-- In Progress and notify the people who did the work.
-- ============================================================================
create or replace function reject_stage(p_job_stage_id uuid, p_note_text text, p_note_language language)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  v_stage   job_stages%rowtype;
  v_job     jobs%rowtype;
  v_note_id uuid;
  rec       record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_note_text is null or length(trim(p_note_text)) = 0 then raise exception 'note_required'; end if;
  select * into v_stage from job_stages where id = p_job_stage_id;
  if not found then raise exception 'not_found'; end if;
  if v_stage.status <> 'pending_inspection' then raise exception 'not_pending'; end if;
  if not _eligible_inspector(uid, p_job_stage_id) then raise exception 'not_eligible'; end if;

  select * into v_job from jobs where id = v_stage.job_id;

  -- Rejection note (DeepL translation backfills in Sprint 7).
  insert into notes (project_id, job_id, author_id, original_text, original_language, translation_status)
  values (v_job.project_id, v_job.id, uid, p_note_text, p_note_language, 'pending')
  returning id into v_note_id;

  insert into inspections (job_stage_id, inspector_id, decision, note_id, decided_at)
  values (p_job_stage_id, uid, 'rejected', v_note_id, now());

  update job_stages set status = 'in_progress' where id = p_job_stage_id;

  -- Notify the submitting dept's lead + everyone who logged time on this stage.
  for rec in
    select distinct u.id from users u
    where u.is_active and u.id <> uid and (
      (u.role = 'lead' and u.department_id = v_stage.department_id)
      or u.id in (
        select ll.user_id from labor_logs ll
        join tasks t on t.id = ll.task_id
        where t.job_stage_id = p_job_stage_id
      )
    )
  loop
    perform _notify(rec.id, 'stage_rejected',
      'Returned: ' || v_job.job_code,
      'Возвращено: ' || v_job.job_code,
      'Devuelto: ' || v_job.job_code,
      v_job.job_code || ' was returned: ' || p_note_text,
      v_job.job_code || ' возвращён: ' || p_note_text,
      v_job.job_code || ' fue devuelto: ' || p_note_text,
      v_job.id);
  end loop;
end;
$$;

-- ============================================================================
-- Grants (clients call these; helpers stay private)
-- ============================================================================
grant execute on function submit_stage_for_inspection(uuid)          to authenticated;
grant execute on function approve_stage(uuid)                         to authenticated;
grant execute on function reject_stage(uuid, text, language)          to authenticated;
