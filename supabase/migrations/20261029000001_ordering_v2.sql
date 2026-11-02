-- Ordering v2 (owner, 2026-10-29): supply requests from anyone on the team,
-- partly-received materials, pickup vs delivery, and the workroom's own
-- supply categories.

-- ---------------------------------------------------------------------------
-- Categories. 'hardware' and 'other' both show as "Components/Other"; no rows
-- move, so the materials sheet keeps its values.
alter type material_category add value if not exists 'upholstery_supplies';
alter type material_category add value if not exists 'drapery_supplies';
alter type material_category add value if not exists 'drapery_hardware';
alter type material_category add value if not exists 'wood_shop';

-- ---------------------------------------------------------------------------
-- Materials: how much has come in (for "Partly here") and how it gets here.
-- App-only fields: the sheet sync doesn't read or write them. Anyone may set
-- received_quantity (it's a status field, like is_arrived); the update-rules
-- trigger only guards the detail columns.
alter table materials add column received_quantity numeric
  check (received_quantity is null or received_quantity >= 0);
alter table materials add column fulfillment text
  check (fulfillment in ('delivery', 'pickup'));

-- ---------------------------------------------------------------------------
-- Supply requests: anyone asks for shop stock (or something for a job);
-- Admin / Procurement move them along.
create table supply_requests (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid not null default auth.uid() references users(id) on delete cascade,
  item         text not null check (length(trim(item)) > 0),
  quantity     text,
  job_id       uuid references jobs(id) on delete set null,
  link         text,
  note         text,
  -- Storage paths in the private 'files' bucket (supply-requests/<id>/...).
  photo_paths  text[] not null default '{}',
  status       text not null default 'new' check (status in ('new', 'ordered', 'done')),
  status_by    uuid references users(id) on delete set null,
  status_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_supply_requests_status on supply_requests (status, created_at desc);
create index idx_supply_requests_by on supply_requests (requested_by, created_at desc);

create trigger supply_requests_set_updated_at
  before update on supply_requests
  for each row execute function set_updated_at();

alter table supply_requests enable row level security;

-- Everyone sees the list (staff can see a request is already in).
create policy supply_requests_select on supply_requests
  for select to authenticated using (true);

-- Anyone files a request, only as themselves, and only as "new".
create policy supply_requests_insert on supply_requests
  for insert to authenticated
  with check (requested_by = auth.uid() and status = 'new');

-- Admin / Procurement move requests along.
create policy supply_requests_manage on supply_requests
  for update to authenticated
  using (is_admin() or auth_department_id() = (select id from departments where name = 'Procurement'))
  with check (is_admin() or auth_department_id() = (select id from departments where name = 'Procurement'));

-- The requester can withdraw their own while it's still new; admins any.
create policy supply_requests_delete on supply_requests
  for delete to authenticated
  using (is_admin() or (requested_by = auth.uid() and status = 'new'));
