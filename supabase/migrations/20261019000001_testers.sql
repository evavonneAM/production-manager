-- Testers see every page; everyone else sees only the pages opened in
-- src/lib/openPages.ts while the rest of the app is still being built.
alter table users add column is_tester boolean not null default false;

-- Same guard as before, now also covering is_tester: only an admin may change it.
create or replace function enforce_user_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    return new;  -- service role / admin: unrestricted
  end if;
  if new.role is distinct from old.role or new.department_id is distinct from old.department_id then
    raise exception 'Only an admin may change a user''s role or department';
  end if;
  if new.is_tester is distinct from old.is_tester then
    raise exception 'Only an admin may change who is a tester';
  end if;
  return new;
end;
$$;
