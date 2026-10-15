-- Estimates inside the app (step 1 of the plan to retire Estimate Rocket).
--
-- Owner decision 2026-10-15: prices ARE stored in the app now, but only for
-- Admins. This replaces the 2026-07-27 "no prices anywhere" rule for these
-- tables only. Every table below is Admins-only through RLS — staff and leads
-- cannot read a single row (not just hidden in the UI). er_line_items stays
-- price-free.

-- clients ---------------------------------------------------------------------
create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- person or company to address
  company     text,
  email       text,
  phone       text,
  address     text,                          -- multi-line street / city / zip
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index clients_name_idx on clients (lower(name));
create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();

-- per-business estimate number counter -----------------------------------------
-- Estimate Rocket numbers are random (e.g. 2606-2217-8655), so there is no
-- sequence to continue. Estimates here count up per business from 10001, so
-- their job codes (HOV10001) can never clash with an ER code (HOV + 4 digits).
-- Admins can move the next number in the app.
create table estimate_counters (
  store        text primary key check (store in ('AM', 'HOV', 'RHU')),
  next_number  integer not null check (next_number > 0)
);
insert into estimate_counters (store, next_number) values ('AM', 10001), ('HOV', 10001), ('RHU', 10001);

-- estimates ---------------------------------------------------------------------
create table estimates (
  id             uuid primary key default gen_random_uuid(),
  store          text not null check (store in ('AM', 'HOV', 'RHU')),
  number         integer not null default 0,  -- assigned on insert from estimate_counters
  client_id      uuid references clients(id) on delete restrict,
  title          text not null default '',    -- project name / sidemark
  status         text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  estimate_date  date not null default current_date,
  notes          text,                         -- shown to the client on the PDF
  terms          text,                         -- shown to the client on the PDF
  created_by     uuid references users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (store, number)
);
create index estimates_client_idx on estimates (client_id);
create trigger estimates_updated_at before update on estimates
  for each row execute function set_updated_at();

-- line items (money lives here) ------------------------------------------------
create table estimate_lines (
  id           uuid primary key default gen_random_uuid(),
  estimate_id  uuid not null references estimates(id) on delete cascade,
  position     integer not null default 0,
  section      text,                          -- groups lines on the PDF, e.g. "Sofa"
  name         text not null default '',
  description  text,
  quantity     numeric(12,4) not null default 1,
  unit         text,                          -- ea, in, yd, ft, hr…
  unit_price   numeric(12,2) not null default 0,
  -- Rounded to the cent per line, like the pricing tools' totals.
  total        numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  source       text,                          -- cushionPricing / upholstery / null = typed in
  created_at   timestamptz not null default now()
);
create index estimate_lines_estimate_idx on estimate_lines (estimate_id, position);

-- Number assignment ----------------------------------------------------------------
-- Takes the business's next number under a row lock, skipping any number whose
-- job code is already used by a project (e.g. typed in by hand).
create or replace function assign_estimate_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not is_admin() then raise exception 'not_authorized'; end if;
  if tg_op = 'UPDATE' then
    if new.store is distinct from old.store or new.number is distinct from old.number then
      raise exception 'estimate_number_locked';
    end if;
    return new;
  end if;
  select next_number into n from estimate_counters where store = new.store for update;
  while exists (select 1 from projects where work_order_number = new.store || n)
     or exists (select 1 from estimates where store = new.store and number = n) loop
    n := n + 1;
  end loop;
  new.number := n;
  update estimate_counters set next_number = n + 1 where store = new.store;
  return new;
end $$;

create trigger estimates_number before insert or update on estimates
  for each row execute function assign_estimate_number();
revoke execute on function assign_estimate_number() from public, anon, authenticated;

-- RLS: Admins only, everything ----------------------------------------------------
alter table clients           enable row level security;
alter table estimate_counters enable row level security;
alter table estimates         enable row level security;
alter table estimate_lines    enable row level security;

create policy clients_admin           on clients           for all to authenticated using (is_admin()) with check (is_admin());
create policy estimate_counters_admin on estimate_counters for all to authenticated using (is_admin()) with check (is_admin());
create policy estimates_admin         on estimates         for all to authenticated using (is_admin()) with check (is_admin());
create policy estimate_lines_admin    on estimate_lines    for all to authenticated using (is_admin()) with check (is_admin());

revoke all on clients, estimate_counters, estimates, estimate_lines from anon;
