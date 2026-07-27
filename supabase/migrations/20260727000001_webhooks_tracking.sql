-- Sprint 12 — webhook intake groundwork (Estimate Rocket + email tracking capture).

-- ============================================================================
-- Raw webhook log: every incoming payload is stored verbatim before any
-- processing, so nothing is ever lost and payloads can be inspected/replayed
-- (the manual "Re-sync" path re-processes rows from here).
-- ============================================================================
create table webhook_events (
  id          uuid primary key default gen_random_uuid(),
  source      text not null check (source in ('estimate_rocket', 'email')),
  payload     jsonb not null,
  processed   boolean not null default false,
  error       text,
  received_at timestamptz not null default now()
);

create index idx_webhook_events_source on webhook_events (source, received_at desc);

alter table webhook_events enable row level security;
create policy webhook_events_admin_read on webhook_events
  for select to authenticated using (is_admin());
-- No insert/update policies: intake Edge Functions (service role) only.

-- ============================================================================
-- Captured tracking numbers (owner request 2026-07-17): extracted from
-- shipping-confirmation emails. Matching to a material is always a human
-- action (false-positive safety) via the RPCs below.
-- ============================================================================
create type tracking_status as enum ('captured', 'matched', 'dismissed');

create table tracking_numbers (
  id              uuid primary key default gen_random_uuid(),
  tracking_number text not null unique,
  carrier         text not null check (carrier in ('ups', 'fedex', 'usps', 'other')),
  sender          text,
  subject         text,
  email_date      timestamptz,
  status          tracking_status not null default 'captured',
  material_id     uuid references materials(id) on delete set null,
  matched_by      uuid references users(id) on delete set null,
  matched_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_tracking_status   on tracking_numbers (status, created_at desc);
create index idx_tracking_material on tracking_numbers (material_id);

alter table tracking_numbers enable row level security;
create policy tracking_numbers_select on tracking_numbers
  for select to authenticated using (true);
-- No direct write policies: email-intake (service role) inserts; the RPCs
-- below are the only way users change rows.

-- Ordering-dashboard eligibility: Admin or Procurement (mirrors the UI rule).
create or replace function _tracking_eligible(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
      from users u
      left join departments d on d.id = u.department_id
     where u.id = uid
       and (u.role = 'admin' or d.name = 'Procurement')
  );
$$;

-- Attach a tracking number to a material (or detach with null → back to
-- 'captured'). SECURITY DEFINER so the RLS write lockdown stays absolute.
create or replace function match_tracking(p_tracking_id uuid, p_material_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not _tracking_eligible(uid) then raise exception 'not_eligible'; end if;
  if p_material_id is not null
     and not exists (select 1 from materials where id = p_material_id) then
    raise exception 'not_found';
  end if;

  update tracking_numbers
     set material_id = p_material_id,
         status      = case when p_material_id is null then 'captured'::tracking_status
                            else 'matched'::tracking_status end,
         matched_by  = case when p_material_id is null then null else uid end,
         matched_at  = case when p_material_id is null then null else now() end
   where id = p_tracking_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Hide junk captures (marketing emails with number-shaped strings, etc.).
create or replace function dismiss_tracking(p_tracking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not _tracking_eligible(uid) then raise exception 'not_eligible'; end if;

  update tracking_numbers
     set status = 'dismissed', material_id = null, matched_by = null, matched_at = null
   where id = p_tracking_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;
