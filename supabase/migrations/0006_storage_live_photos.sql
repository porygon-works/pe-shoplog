-- Deleted photos must stop being readable: signed URLs need SELECT, so allow it
-- only while a live photos row (on a live visit) points at the object.
-- Uploading needs only INSERT (no read before addPhotoAction inserts the row).

drop policy if exists photos_select on storage.objects;

create policy photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1
        from public.photos p
        join public.visits v on v.id = p.visit_id
       where p.storage_path = storage.objects.name
         and p.deleted_at is null
         and v.deleted_at is null)
  );
