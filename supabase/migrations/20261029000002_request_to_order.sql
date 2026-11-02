-- Supply requests become orders (owner, 2026-10-29). "Add to order" turns a
-- request into a material; the request remembers which one, shows "On order",
-- and turns Done when that material is marked arrived.

alter table supply_requests add column material_id uuid references materials(id) on delete set null;
create index idx_supply_requests_material on supply_requests (material_id);

-- Shop-stock items have no client job, but every material belongs to a job,
-- so they live under one standing "Shop stock" job (STOCK in the sheet).
insert into projects (name, client_name, work_order_number, status, description)
values ('Shop stock', 'Shop stock', 'STOCK', 'in_progress',
        'Supplies kept on hand for the workroom, not tied to a client job.')
on conflict (work_order_number) do nothing;

insert into jobs (project_id, job_code, name)
select id, 'STOCK', 'Shop stock' from projects where work_order_number = 'STOCK'
on conflict (job_code) do nothing;

-- Arrived material → its request is done.
create or replace function close_supply_request_on_arrival()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_arrived and not old.is_arrived then
    update supply_requests
       set status = 'done', status_at = now()
     where material_id = new.id and status <> 'done';
  end if;
  return new;
end;
$$;

create trigger materials_close_supply_request
  after update of is_arrived on materials
  for each row execute function close_supply_request_on_arrival();
