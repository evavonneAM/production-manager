-- One estimate number for all three businesses (owner decision 2026-10-23).
-- AM10001 and HOV10001 can no longer both exist: every estimate takes the next
-- number from a single shared counter, whatever its business. The job code
-- still starts with the business letters (HOV10001, AM10002, …).
--
-- Nothing existing is renumbered. If two businesses already used the same
-- number, the unique constraint below fails and this migration stops, so the
-- duplicates can be looked at by hand first.

alter table estimates drop constraint estimates_store_number_key;
alter table estimates add constraint estimates_number_key unique (number);

-- The shared counter is a new row, store = 'ALL', starting after the highest
-- number already handed out. The old per-business rows stay but are unused.
alter table estimate_counters drop constraint estimate_counters_store_check;
alter table estimate_counters add constraint estimate_counters_store_check
  check (store in ('AM', 'HOV', 'RHU', 'ALL'));
insert into estimate_counters (store, next_number)
select 'ALL', greatest(
  10001,
  (select coalesce(max(number), 0) + 1 from estimates),
  (select coalesce(max(next_number), 0) from estimate_counters)
);

-- Number assignment: the shared counter, under a row lock, skipping any number
-- already used by an estimate or by a project job code in any business.
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
  select next_number into n from estimate_counters where store = 'ALL' for update;
  while exists (select 1 from projects where work_order_number in ('AM' || n, 'HOV' || n, 'RHU' || n))
     or exists (select 1 from estimates where number = n) loop
    n := n + 1;
  end loop;
  new.number := n;
  update estimate_counters set next_number = n + 1 where store = 'ALL';
  return new;
end $$;
revoke execute on function assign_estimate_number() from public, anon, authenticated;
