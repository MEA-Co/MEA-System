-- Rename the existing empty table in place; do not drop/recreate it.
begin;
lock table public.questionnaire_review_requests in access exclusive mode;
do $$ begin
 if exists(select 1 from public.questionnaire_review_requests) then
 raise exception 'Review table must be empty before question review conversion'; end if;
end $$;
alter table public.questionnaire_review_requests rename to question_review_requests;
alter table public.question_review_requests drop constraint questionnaire_review_requests_question_id_fkey;
alter table public.question_review_requests drop constraint questionnaire_review_requests_version_id_fkey;
alter table public.question_review_requests rename column version_id to origin_version_id;
alter table public.question_review_requests alter column origin_version_id drop not null;
alter table public.question_review_requests alter column question_id set not null;
alter table public.question_review_requests add constraint question_reviews_question_fkey foreign key(question_id) references public.questions(id) on delete cascade;
alter table public.question_review_requests add constraint question_reviews_origin_fkey foreign key(origin_version_id) references public.questionnaire_versions(id) on delete set null;
alter table public.question_review_requests add column resolved_by uuid references public.profiles(id) on delete set null;
alter table public.question_review_requests add column question_revision integer not null;
alter index public.questionnaire_reviews_question_idx rename to question_reviews_question_idx;
alter index public.questionnaire_reviews_version_idx rename to question_reviews_origin_idx;
alter index public.questionnaire_reviews_requester_idx rename to question_reviews_requester_idx;
create index question_reviews_resolver_idx on public.question_review_requests(resolved_by);
drop policy "Read own or received reviews" on public.question_review_requests;
create function private.can_read_question_reviews(qid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists (
 select 1 from public.questions q where q.id=qid and (q.created_by=auth.uid() or private.is_admin() or exists(
 select 1 from public.question_review_requests r where r.question_id=qid and r.requested_by=auth.uid()) or (q.archived_at is null and exists (
 select 1 from public.questionnaire_questions p join public.questionnaire_versions v on v.id=p.version_id join public.questionnaires d on d.id=v.questionnaire_id where p.source_question_id=qid and v.status='published' and d.archived_at is null))));
$$;
revoke all on function private.can_read_question_reviews(uuid) from public,anon;
grant execute on function private.can_read_question_reviews(uuid) to authenticated;
create policy "Read accessible question reviews" on public.question_review_requests for select to authenticated using(private.can_read_question_reviews(question_id));
revoke all on public.question_review_requests from public,anon,authenticated;
grant select on public.question_review_requests to authenticated;
create function private.read_question_reviews(qid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid; published boolean; begin
 if not private.can_read_question_reviews(qid) then raise exception 'Review access denied' using errcode='42501'; end if;
 select created_by into owner_id from public.questions where id=qid;
 select exists(select 1 from public.questionnaire_questions p join public.questionnaire_versions v on v.id=p.version_id join public.questionnaires d on d.id=v.questionnaire_id join public.questions q on q.id=p.source_question_id where q.id=qid and q.archived_at is null and v.status='published' and d.archived_at is null) into published;
 return jsonb_build_object('canResolve',owner_id=auth.uid() or private.is_admin(),'canRequest',published,'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.question_review_requests r where r.question_id=qid),'[]'::jsonb));
end $$;
create function private.request_question_review(p_id uuid,p_question_id uuid,p_origin_version_id uuid,p_description text) returns void language plpgsql security definer set search_path='' as $$
declare actor public.profiles%rowtype; rev integer; begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or actor.role not in ('admin','consultant_lead') then raise exception 'Staff required' using errcode='42501'; end if;
 if p_id is null or p_description is null or length(btrim(p_description)) not between 1 and 5000 then raise exception 'Invalid review' using errcode='22023'; end if;
 select revision into rev from public.questions where id=p_question_id and archived_at is null for share;
 if not found then raise exception 'Question unavailable' using errcode='42501'; end if;
 perform 1 from public.questionnaire_questions p join public.questionnaire_versions v on v.id=p.version_id join public.questionnaires d on d.id=v.questionnaire_id where p.source_question_id=p_question_id and v.status='published' and d.archived_at is null and (p_origin_version_id is null or v.id=p_origin_version_id) for share of p,v,d;
 if not found then raise exception 'Published question required' using errcode='42501'; end if;
 insert into public.question_review_requests(id,question_id,origin_version_id,question_revision,requested_by,requester_name,description,title) values(p_id,p_question_id,p_origin_version_id,rev,actor.id,actor.name,btrim(p_description),'') on conflict(id) do nothing;
 if not exists(select 1 from public.question_review_requests where id=p_id and question_id=p_question_id and requested_by=actor.id and description=btrim(p_description) and origin_version_id is not distinct from p_origin_version_id) then raise exception 'Review conflict' using errcode='40001'; end if;
end $$;
create function private.resolve_question_review(p_id uuid,p_question_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not(private.is_admin() or private.is_consultant_lead()) or not exists(select 1 from public.questions where id=p_question_id and (created_by=auth.uid() or private.is_admin())) then raise exception 'Question owner required' using errcode='42501'; end if;
 update public.question_review_requests set resolved_by=coalesce(resolved_by,auth.uid()),resolved_at=coalesce(resolved_at,now()) where id=p_id and question_id=p_question_id;
 if not found then raise exception 'Review not found' using errcode='22023'; end if;
end $$;
create function public.read_question_reviews(qid uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_question_reviews(qid); $$;
create function public.request_question_review(p_id uuid,p_question_id uuid,p_origin_version_id uuid,p_description text) returns void language sql security invoker set search_path='' as $$ select private.request_question_review(p_id,p_question_id,p_origin_version_id,p_description); $$;
create function public.resolve_question_review(p_id uuid,p_question_id uuid) returns void language sql security invoker set search_path='' as $$ select private.resolve_question_review(p_id,p_question_id); $$;
revoke all on function private.read_question_reviews(uuid),private.request_question_review(uuid,uuid,uuid,text),private.resolve_question_review(uuid,uuid),public.read_question_reviews(uuid),public.request_question_review(uuid,uuid,uuid,text),public.resolve_question_review(uuid,uuid) from public,anon;
grant execute on function private.read_question_reviews(uuid),private.request_question_review(uuid,uuid,uuid,text),private.resolve_question_review(uuid,uuid),public.read_question_reviews(uuid),public.request_question_review(uuid,uuid,uuid,text),public.resolve_question_review(uuid,uuid) to authenticated;
drop function public.request_questionnaire_review(uuid,uuid,uuid,text);
drop function public.resolve_questionnaire_review(uuid);
drop function private.request_questionnaire_review(uuid,uuid,uuid,text);
drop function private.resolve_questionnaire_review(uuid);
do $$ declare f record; src text; begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('delete_questionnaire','notify_questionnaire_change') loop
 src:=pg_get_functiondef(f.oid);
 if f.proname='delete_questionnaire' then
 src:=replace(src,'delete from public.questionnaire_review_requests where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);','');
 else src:=replace(src,'questionnaire_review_requests','question_review_requests'); end if;
 execute src;
 end loop;
end $$;
create or replace function private.question_review_counts() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if auth.uid() is null or not(private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)) from (
 select p.version_id,count(distinct r.id) as count from public.questionnaire_questions p join public.question_review_requests r on r.question_id=p.source_question_id and r.resolved_at is null where private.can_read_question_reviews(r.question_id) and exists(select 1 from public.questionnaire_versions v join public.questionnaires d on d.id=v.questionnaire_id where v.id=p.version_id and (d.created_by=auth.uid() or private.is_admin() or (v.status='published' and d.archived_at is null))) group by p.version_id
 ) c),'[]'::jsonb);
end $$;
create or replace function public.question_review_counts() returns jsonb language sql stable security invoker set search_path='' as $$ select private.question_review_counts(); $$;
revoke all on function private.question_review_counts(),public.question_review_counts() from public,anon;
grant execute on function private.question_review_counts(),public.question_review_counts() to authenticated;

notify pgrst,'reload schema';
commit;
