-- Estimate Rocket appointments. Each ER account (AM, HOV, RHU) has a
-- "Subscribe to Calendar" iCal link; the er-calendar-sync function reads those
-- links (Supabase secrets ER_ICS_AM / ER_ICS_HOV / ER_ICS_RHU) and copies the
-- appointments here so the Calendar screen can show them. Read-only copy:
-- appointments are still made and changed in Estimate Rocket.
create table er_appointments (
  id          uuid primary key default gen_random_uuid(),
  business    text not null check (business in ('AM', 'HOV', 'RHU')),
  uid         text not null,
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  location    text,
  description text,
  -- Set when the title/description carries a known work-order number.
  project_id  uuid references projects(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business, uid)
);

create index idx_er_appointments_start on er_appointments (starts_at);

create trigger er_appointments_set_updated_at
  before update on er_appointments
  for each row execute function set_updated_at();

alter table er_appointments enable row level security;
create policy er_appointments_select on er_appointments
  for select to authenticated using (true);
-- No insert/update/delete policies: service role (er-calendar-sync) only.

-- Refresh every 15 minutes, same pattern as the gcal-sync cron.
do $$
begin
  perform cron.schedule(
    'er-calendar-sync-15min',
    '*/15 * * * *',
    $cron$
    select net.http_post(
      url     := 'https://yjqlmypzwchwsjemgqsy.supabase.co/functions/v1/er-calendar-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcWxteXB6d2Nod3NqZW1ncXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjAzMTAsImV4cCI6MjA5NzI5NjMxMH0.dcQqSLXyR7aYvRQqK5lsLUEXg5p7BNHJ8HTRKJPW3oE"}'::jsonb,
      body    := '{}'::jsonb
    );
    $cron$
  );
  raise notice 'er-calendar-sync cron scheduled (every 15 min)';
exception when others then
  raise notice 'could not schedule er-calendar-sync cron (non-fatal): %', sqlerrm;
end $$;
