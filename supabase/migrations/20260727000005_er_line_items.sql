-- Sprint 12 — line items parsed from the ER customer-portal proposal document
-- (owner request 2026-07-27: "admin reviews and selects which become tasks").
-- Written by er-intake; admins accept (→ task) or dismiss each suggestion.
create table er_line_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  proposal_id text not null,                    -- ER proposal the item came from
  position    integer not null default 0,
  name        text not null,
  description text,                             -- the spec bullets, as plain text
  quantity    numeric,
  unit_price  numeric,
  total       numeric,
  status      text not null default 'suggested'
              check (status in ('suggested', 'accepted', 'dismissed')),
  task_id     uuid references tasks(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (proposal_id, position)
);

create index idx_er_line_items_project on er_line_items (project_id, status);

alter table er_line_items enable row level security;
create policy er_line_items_select on er_line_items
  for select to authenticated using (true);
-- No direct write policies: er-intake (service role) inserts; the RPC below is
-- the only way users change rows.

create or replace function set_line_item_status(
  p_line_item_id uuid,
  p_status text,
  p_task_id uuid default null
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
         task_id = case when p_status = 'accepted' then p_task_id else null end
   where id = p_line_item_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;
