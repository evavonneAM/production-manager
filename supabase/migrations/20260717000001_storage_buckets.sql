-- Sprint 10 — file storage (SPEC §13).
-- `files`: private bucket for job/project photos + PDFs; access only via
--   short-lived signed URLs. Paths: projects/<project_id>/<file_id>.<ext>,
--   thumbs at projects/<project_id>/thumbs/<file_id>.jpg (client-generated).
-- `avatars`: small PUBLIC bucket for profile photos — avatar URLs are stored in
--   users.avatar_url and rendered everywhere, so they can't expire (deliberate,
--   low-sensitivity deviation from all-private storage).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('files', 'files', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']),
  ('avatars', 'avatars', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- files bucket: any authenticated user may view (matches files-table RLS) and
-- upload; delete only the uploader or an admin.
create policy "files_read" on storage.objects
  for select to authenticated using (bucket_id = 'files');
create policy "files_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'files');
create policy "files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'files' and (owner = auth.uid() or public.is_admin()));

-- avatars bucket: world-readable (public bucket); users manage their own file.
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');
create policy "avatars_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
create policy "avatars_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (owner = auth.uid() or public.is_admin()));
