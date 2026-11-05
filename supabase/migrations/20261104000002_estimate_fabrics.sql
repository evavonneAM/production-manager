-- Estimate fabric (owner workshop 2026-10-24, docs/estimate-items-plan.md).
-- Each job keeps a short list of its fabrics. Items say which fabric they use
-- and how many yards (each item rounded up on its own). Each room gets one
-- fabric line per fabric, adding up the yards of its items; the yards can be
-- typed over. Price per yard = wholesale × 2, minimum $75 (worked out in the app).
-- Admins only, like the other estimate tables.

create table estimate_fabrics (
  id           uuid primary key default gen_random_uuid(),
  estimate_id  uuid not null references estimates(id) on delete cascade,
  position     integer not null default 0,
  -- fabric = we supply it; com = client's own (yards shown, no charge);
  -- tbd = not chosen yet ("to be determined, not included", yards still counted)
  kind         text not null default 'fabric' check (kind in ('fabric', 'com', 'tbd')),
  name         text not null default '',
  vendor       text,          -- internal, carries to the fabric order
  sidemark     text,          -- internal, carries to the fabric order
  wholesale    numeric(10,2), -- per yard; never on the client PDF
  created_at   timestamptz not null default now()
);
create index estimate_fabrics_estimate_idx on estimate_fabrics (estimate_id, position);

alter table estimate_lines
  add column kind text not null default 'item' check (kind in ('item', 'fabric')),
  -- kind = 'fabric': the fabric this line charges for (one per room per fabric)
  add column fabric_id uuid references estimate_fabrics(id) on delete cascade,
  -- kind = 'item': [{ fabric_id, role, yards }] — yards this item needs of each fabric
  add column fabric_uses jsonb,
  -- kind = 'fabric': true when the yards were typed over instead of added up
  add column qty_override boolean not null default false;

alter table estimate_fabrics enable row level security;
create policy estimate_fabrics_admin on estimate_fabrics for all to authenticated using (is_admin()) with check (is_admin());
revoke all on estimate_fabrics from anon;
