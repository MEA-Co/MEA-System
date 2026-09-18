create table public.questionnaire_publication_reads (
 user_id uuid not null references public.profiles(id) on delete cascade,
 version_id uuid not null references public.questionnaire_versions(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(user_id,version_id)
);
create index questionnaire_publication_reads_version_idx on public.questionnaire_publication_reads(version_id);
alter table public.questionnaire_publication_reads enable row level security;
revoke all on public.questionnaire_publication_reads from public,anon,authenticated;
grant select,insert on public.questionnaire_publication_reads to authenticated;
create policy "Read own publication receipts" on public.questionnaire_publication_reads for select to authenticated
 using(user_id=(select auth.uid()));
create policy "Record own visible publication" on public.questionnaire_publication_reads for insert to authenticated
 with check(user_id=(select auth.uid()) and ((select private.is_admin()) or (select private.is_consultant_lead()))
 and exists(select 1 from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id
 where v.id=version_id and v.status='published' and q.archived_at is null));
create function public.unread_questionnaire_publications()
returns table(version_id uuid) language sql stable security invoker set search_path='' as $$
 select v.id from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id
 where ((select private.is_admin()) or (select private.is_consultant_lead()))
 and v.status='published' and q.archived_at is null and q.created_by<>(select auth.uid())
 and not exists(select 1 from public.questionnaire_publication_reads r where r.user_id=(select auth.uid()) and r.version_id=v.id);
$$;
create function public.mark_questionnaire_publication_read(p_version_id uuid)
returns void language sql security invoker set search_path='' as $$
 insert into public.questionnaire_publication_reads(user_id,version_id)
 select (select auth.uid()),v.id from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id
 where v.id=p_version_id and v.status='published' and q.archived_at is null
 and ((select private.is_admin()) or (select private.is_consultant_lead()))
 on conflict(user_id,version_id) do nothing;
$$;
revoke all on function public.unread_questionnaire_publications() from public,anon,authenticated;
revoke all on function public.mark_questionnaire_publication_read(uuid) from public,anon,authenticated;
grant execute on function public.unread_questionnaire_publications() to authenticated;
grant execute on function public.mark_questionnaire_publication_read(uuid) to authenticated;
