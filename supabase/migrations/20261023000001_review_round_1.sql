-- Code review 2026-10-23, round 1 (owner approved). Four fixes:
--   #1  Admin-only files were hidden in the files table but still readable in
--       the storage bucket by any signed-in user.
--   #9  The materials and jobs update locks listed only the June columns, and
--   #17 (found while testing) the jobs lock also fired inside the app's own
--       functions, so a Lead could not clock out or approve an inspection.
--   #3  The 5-minute Sheets and 15-minute Calendar jobs now send a secret
--       (Vault "cron_secret" = Edge Function secret CRON_SECRET), because the
--       functions no longer accept the public key alone.

-- #1 Storage ------------------------------------------------------------------
-- Reads the files table without RLS, so it sees admin-only rows a staff member
-- cannot. A just-uploaded object with no files row yet stays readable.
create or replace function public.is_admin_only_object(object_name text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.files f
    where f.admin_only and (f.storage_path = object_name or f.thumbnail_path = object_name)
  )
$$;
revoke execute on function public.is_admin_only_object(text) from public, anon;
grant execute on function public.is_admin_only_object(text) to authenticated;

drop policy "files_read" on storage.objects;
create policy "files_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'files' and (public.is_admin() or not public.is_admin_only_object(name)));

-- #9 / #17 Update locks ----------------------------------------------------------
-- The locks now run as the caller (security invoker). A direct write from the
-- app runs as role "authenticated" and is checked; a write made inside one of
-- the app's own functions (clock-out, approve, split job…) runs as the
-- function's owner and is left to that function's own checks.

create or replace function enforce_job_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  urole    user_role;
  udept    uuid;
  job_dept uuid;
begin
  if current_user <> 'authenticated' or auth.uid() is null then
    return new;  -- service role, or the app's own definer functions
  end if;

  urole := auth_role();
  udept := auth_department_id();

  if urole = 'admin' then
    return new;
  end if;

  if urole = 'lead' then
    job_dept := (select department_id from public.job_stages where id = new.current_stage_id);
    if job_dept is distinct from udept then
      raise exception 'Leads can only modify jobs whose current stage is in their own department';
    end if;
    -- Everything except queue_position (and the timestamp) is locked.
    if (to_jsonb(new) - array['queue_position', 'updated_at']) is distinct from (to_jsonb(old) - array['queue_position', 'updated_at']) then
      raise exception 'Leads may only change queue_position on jobs';
    end if;
  end if;

  return new;
end;
$$;

create or replace function enforce_material_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  status_cols constant text[] := array['is_ordered', 'ordered_at', 'is_arrived', 'arrived_at', 'sync_source', 'updated_at'];
begin
  if current_user <> 'authenticated' or auth.uid() is null then
    return new;  -- service role, or the app's own definer functions
  end if;

  if is_admin() or auth_department_id() = (select id from public.departments where name = 'Procurement') then
    return new;
  end if;

  -- Everyone else: only the ordered/arrived status fields may change. Listed
  -- as what MAY change, so a column added later is locked automatically.
  if (to_jsonb(new) - status_cols) is distinct from (to_jsonb(old) - status_cols) then
    raise exception 'Only Procurement or Admin may edit material details; others may only update ordered/arrived status';
  end if;

  return new;
end;
$$;

-- #3 Scheduled syncs send the cron secret ---------------------------------------
do $$
begin
  perform cron.schedule(
    'sheets-sync-5min',
    '*/5 * * * *',
    $cron$
    select net.http_post(
      url     := 'https://yjqlmypzwchwsjemgqsy.supabase.co/functions/v1/sheets-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcWxteXB6d2Nod3NqZW1ncXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjAzMTAsImV4cCI6MjA5NzI5NjMxMH0.dcQqSLXyR7aYvRQqK5lsLUEXg5p7BNHJ8HTRKJPW3oE',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body    := '{}'::jsonb
    );
    $cron$
  );
  perform cron.schedule(
    'gcal-sync-15min',
    '*/15 * * * *',
    $cron$
    select net.http_post(
      url     := 'https://yjqlmypzwchwsjemgqsy.supabase.co/functions/v1/gcal-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcWxteXB6d2Nod3NqZW1ncXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjAzMTAsImV4cCI6MjA5NzI5NjMxMH0.dcQqSLXyR7aYvRQqK5lsLUEXg5p7BNHJ8HTRKJPW3oE',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body    := '{}'::jsonb
    );
    $cron$
  );
exception when others then
  raise notice 'could not reschedule syncs (non-fatal): %', sqlerrm;
end $$;
