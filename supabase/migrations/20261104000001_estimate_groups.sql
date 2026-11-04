-- Estimates: room / window groups, install-at address and deposit (owner workshop
-- 2026-10-24, docs/estimate-items-plan.md). Admins only, like the other estimate tables.

-- Groups are optional. Each has its own subtotal; "approved" is the per-room
-- "Client approved" switch (only approved rooms count toward the deposit and,
-- later, become jobs). New rooms start approved; untick the ones the client declines.
create table estimate_groups (
  id           uuid primary key default gen_random_uuid(),
  estimate_id  uuid not null references estimates(id) on delete cascade,
  position     integer not null default 0,
  name         text not null default '',
  approved     boolean not null default true,
  created_at   timestamptz not null default now()
);
create index estimate_groups_estimate_idx on estimate_groups (estimate_id, position);

alter table estimate_lines
  add column group_id uuid references estimate_groups(id) on delete set null;
create index estimate_lines_group_idx on estimate_lines (group_id);

-- Install at: defaults to the client's address. When different (designer billed,
-- install at the client's home), a site name and address.
alter table estimates
  add column install_same    boolean not null default true,
  add column install_name    text,
  add column install_address text,
  add column deposit_pct     numeric(5,2) not null default 50 check (deposit_pct between 0 and 100);

alter table estimate_groups enable row level security;
create policy estimate_groups_admin on estimate_groups for all to authenticated using (is_admin()) with check (is_admin());
revoke all on estimate_groups from anon;
