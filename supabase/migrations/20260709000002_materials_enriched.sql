-- Sprint 9 (owner decision): enrich materials to match the shop's real workflow
-- (Fabric / COM / Insert categories, "client payment required" gate). Pricing
-- and payment details deliberately stay in the office spreadsheets.

create type material_category as enum ('fabric', 'com', 'insert', 'other');

alter table materials add column category material_category not null default 'other';
alter table materials add column payment_required boolean not null default false;

-- Extend the update guard: category and payment_required are procurement/admin
-- fields, like name/quantity — everyone else may still only flip ordered/arrived.
create or replace function enforce_material_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  urole     user_role;
  udept     uuid;
  proc_dept uuid;
begin
  if uid is null then
    return new;  -- service role / system: unrestricted
  end if;

  select role, department_id into urole, udept from public.users where id = uid;
  if urole = 'admin' then
    return new;
  end if;

  select id into proc_dept from public.departments where name = 'Procurement';
  if udept = proc_dept then
    return new;
  end if;

  -- Everyone else: only the ordered/arrived status fields may change.
  if new.name             is distinct from old.name
  or new.description      is distinct from old.description
  or new.quantity         is distinct from old.quantity
  or new.unit             is distinct from old.unit
  or new.supplier         is distinct from old.supplier
  or new.category         is distinct from old.category
  or new.payment_required is distinct from old.payment_required
  or new.qr_code_uuid     is distinct from old.qr_code_uuid
  or new.sheet_row_ref    is distinct from old.sheet_row_ref then
    raise exception 'Only Procurement or Admin may edit material details; others may only update ordered/arrived status';
  end if;

  return new;
end;
$$;
