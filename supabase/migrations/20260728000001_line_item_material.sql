-- Owner approval (2026-07-27): a line item can become a tracked material
-- (fabric yardage, nailheads…) instead of a task.
alter table er_line_items add column material_id uuid references materials(id) on delete set null;

-- Recreate with the extra arg (drop first: CREATE OR REPLACE with a new
-- signature would leave an ambiguous overload behind).
drop function set_line_item_status(uuid, text, uuid);
create or replace function set_line_item_status(
  p_line_item_id uuid,
  p_status text,
  p_task_id uuid default null,
  p_material_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_role user_role;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select role into v_role from users where id = uid;
  if v_role is distinct from 'admin' then raise exception 'not_eligible'; end if;
  if p_status not in ('suggested', 'accepted', 'dismissed') then raise exception 'bad_status'; end if;

  update er_line_items
     set status = p_status,
         task_id = case when p_status = 'accepted' then p_task_id else null end,
         material_id = case when p_status = 'accepted' then p_material_id else null end
   where id = p_line_item_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;
