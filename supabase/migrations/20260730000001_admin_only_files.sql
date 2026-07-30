-- No-prices rule: the auto-attached ER work-order PDF is the priced client
-- document, so it must be visible to admins only. Enforced by RLS, not UI.
alter table files add column admin_only boolean not null default false;

drop policy files_select on files;
create policy files_select on files
  for select to authenticated using (not admin_only or is_admin());

-- The three PDFs attached before this rule existed.
update files set admin_only = true where storage_path like 'projects/%/wo-%.pdf';
