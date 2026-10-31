-- Private photo bucket. Path: shops/{shop_id}/visits/{visit_id}/{uuid}.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Signed URLs need SELECT: signed-in users may read any photo.
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos');

-- Upload only into the path of one of your own visits.
create policy photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'shops'
    and (storage.foldername(name))[3] = 'visits'
    and exists (
      select 1 from public.visits v
       where v.id::text = (storage.foldername(name))[4]
         and v.shop_id::text = (storage.foldername(name))[2]
         and v.user_id = (select auth.uid()))
  );

-- Delete files under your own visits (admins: any).
create policy photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.visits v
         where v.id::text = (storage.foldername(name))[4]
           and v.user_id = (select auth.uid()))
    )
  );
