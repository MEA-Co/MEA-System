-- Staff can read confirmed activities; all write RPCs remain owner-only.
create policy exploration_staff_read on public.exploration
for select to authenticated
using (deleted_at is null and ((select private.is_admin()) or (select private.is_consultant_lead())));

-- Only reports referenced by a live confirmed activity are shared, not unfinished uploads.
create policy exploration_report_staff_read on storage.objects
for select to authenticated
using (
  bucket_id = 'exploration-reports'
  and ((select private.is_admin()) or (select private.is_consultant_lead()))
  and exists (
    select 1 from public.exploration e
    where e.id::text = (storage.foldername(name))[2]
      and e.owner_id::text = (storage.foldername(name))[1]
      and e.deleted_at is null
      and e.reports @> jsonb_build_array(jsonb_build_object('path', name))
  )
);

create index exploration_updated_idx on public.exploration(updated_at desc, id) where deleted_at is null;
