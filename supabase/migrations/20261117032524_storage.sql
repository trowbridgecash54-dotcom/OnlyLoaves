-- OnlyLoafs — photo storage
-- ---------------------------------------------------------------------
-- One public bucket for bread and site photos. Anyone can view a photo
-- by its URL (that's what a public website needs). Only administrators
-- can upload, replace or delete. The bucket itself rejects anything
-- that isn't a JPEG, PNG or WebP, and anything over 5 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins list photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()));

create policy "Admins upload photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (select public.is_admin()));

create policy "Admins replace photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()))
  with check (bucket_id = 'photos' and (select public.is_admin()));

create policy "Admins delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()));
