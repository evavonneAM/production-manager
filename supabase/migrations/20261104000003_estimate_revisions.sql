-- Revised copies (owner workshop 2026-10-24): once an estimate is Sent, changes
-- go on a revised copy that keeps the number (HOV10001-R1, -R2…) and says what
-- it replaces; the sent version is kept as the client saw it.

alter table estimates
  add column revision    integer not null default 0 check (revision >= 0),
  add column replaces_id uuid references estimates(id) on delete set null;

-- A number is shared by an estimate and its revisions.
alter table estimates drop constraint estimates_number_key;
alter table estimates add constraint estimates_number_revision_key unique (number, revision);

-- Same as 20261023000001, except a revision keeps the number it was copied with.
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
    if new.store is distinct from old.store or new.number is distinct from old.number
       or new.revision is distinct from old.revision then
      raise exception 'estimate_number_locked';
    end if;
    return new;
  end if;
  if new.revision > 0 then
    -- A revision must copy an existing estimate's business and number.
    if not exists (select 1 from estimates where id = new.replaces_id and store = new.store and number = new.number) then
      raise exception 'revision_needs_original';
    end if;
    return new;
  end if;
  select next_number into n from estimate_counters where store = 'ALL' for update;
  while exists (select 1 from projects where work_order_number in ('AM' || n, 'HOV' || n, 'RHU' || n))
     or exists (select 1 from estimates where number = n) loop
    n := n + 1;
  end loop;
  new.number := n;
  new.revision := 0;
  update estimate_counters set next_number = n + 1 where store = 'ALL';
  return new;
end $$;
revoke execute on function assign_estimate_number() from public, anon, authenticated;
