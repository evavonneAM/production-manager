-- Sprint 9 — materials: sync snapshot + "all materials arrived" notification.

-- The last state both the app and the sheet agreed on, for three-way change
-- detection in the sheets-sync Edge Function. Null = never synced.
alter table materials add column synced_snapshot jsonb;

-- ============================================================================
-- When the LAST outstanding material for a job arrives, notify the job's
-- current-stage department Lead + Admins (SPEC §12 / notification_type
-- material_arrived_all). Fires on the arrival flip that completes the set.
-- ============================================================================
create or replace function notify_all_materials_arrived()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job       jobs%rowtype;
  v_dept      uuid;
  rec         record;
begin
  if not (new.is_arrived and not coalesce(old.is_arrived, false)) then
    return new;
  end if;
  -- Only when every material on the job has now arrived.
  if exists (select 1 from materials where job_id = new.job_id and id <> new.id and not is_arrived) then
    return new;
  end if;

  select * into v_job from jobs where id = new.job_id;
  select department_id into v_dept from job_stages where id = v_job.current_stage_id;

  for rec in
    select u.id from users u
    where u.is_active
      and (u.role = 'admin' or (u.role = 'lead' and u.department_id = v_dept))
  loop
    perform _notify(rec.id, 'material_arrived_all',
      'Materials complete: ' || v_job.job_code,
      'Материалы получены: ' || v_job.job_code,
      'Materiales completos: ' || v_job.job_code,
      'All materials for ' || v_job.job_code || ' have arrived.',
      'Все материалы для ' || v_job.job_code || ' получены.',
      'Todos los materiales de ' || v_job.job_code || ' han llegado.',
      v_job.id);
  end loop;
  return new;
end;
$$;

create trigger materials_notify_all_arrived
  after update on materials
  for each row execute function notify_all_materials_arrived();
