alter table public.questionnaire_review_requests
  drop constraint questionnaire_review_requests_title_check,
  add constraint questionnaire_review_requests_title_check check(length(title) <= 200),
  alter column title set default '';
-- Keep legacy titles for display with the body; new requests have no title.
create function private.request_questionnaire_review(
  p_id uuid, p_version_id uuid, p_question_id uuid, p_description text
) returns void language plpgsql security definer set search_path='' as $$
declare
  v public.questionnaire_versions%rowtype;
  actor public.profiles%rowtype;
  owner_id uuid;
begin
  select * into actor from public.profiles where id=auth.uid();
  if actor.id is null or actor.role not in ('admin','consultant_lead') then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_id is null or p_version_id is null or p_question_id is null
    or p_description is null or length(btrim(p_description)) not between 1 and 5000 then
    raise exception 'Question and description required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found or v.status not in ('published','distributed') then
    raise exception 'Review not allowed' using errcode='42501';
  end if;
  select created_by into owner_id from public.questionnaires
    where id=v.questionnaire_id and archived_at is null for update;
  if owner_id is null or owner_id=actor.id then
    raise exception 'Review not allowed' using errcode='42501';
  end if;
  if not exists(select 1 from public.questionnaire_questions
    where id=p_question_id and version_id=p_version_id) then raise exception 'Question not found in this version' using errcode='22023'; end if;
  insert into public.questionnaire_review_requests(
    id,version_id,question_id,title,requested_by,requester_name,description
  ) values(p_id,v.id,p_question_id,'',actor.id,actor.name,btrim(p_description))
  on conflict(id) do nothing;
  if not exists(select 1 from public.questionnaire_review_requests
    where id=p_id and version_id=v.id and question_id=p_question_id and title=''
      and requested_by=actor.id and description=btrim(p_description)) then
    raise exception 'Review conflict' using errcode='40001';
  end if;
end $$;

revoke all on function private.request_questionnaire_review(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.request_questionnaire_review(uuid,uuid,uuid,text) to authenticated;
create function public.request_questionnaire_review(p_id uuid,p_version_id uuid,p_question_id uuid,p_description text)
returns void language sql security invoker set search_path='' as $$
 select private.request_questionnaire_review(p_id,p_version_id,p_question_id,p_description);
$$;
revoke all on function public.request_questionnaire_review(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.request_questionnaire_review(uuid,uuid,uuid,text) to authenticated;
drop function public.request_questionnaire_review(uuid,uuid,uuid,text,text);
drop function private.request_questionnaire_review(uuid,uuid,uuid,text,text);

create function private.add_questionnaire_explanation(
 p_id uuid,p_version_id uuid,p_question_id uuid,p_title text,p_description text,p_visible boolean
) returns void language plpgsql security definer set search_path='' as $$
declare v public.questionnaire_versions%rowtype; existing public.questionnaire_question_details%rowtype;
begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
   raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_version_id is null or p_question_id is null or p_visible is null
   or p_title is null or length(btrim(p_title)) not between 1 and 500
   or p_description is null or length(btrim(p_description)) not between 1 and 20000 then
   raise exception 'Title and description required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
 select * into v from public.questionnaire_versions where id=p_version_id for update;
 if not found or v.status <> 'published' then raise exception 'Only published questionnaires accept explanations' using errcode='42501'; end if;
 perform 1 from public.questionnaires where id=v.questionnaire_id and archived_at is null for update;
 if not found then raise exception 'Questionnaire unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.questionnaire_questions where id=p_question_id and version_id=p_version_id) then
   raise exception 'Question not found in this version' using errcode='22023'; end if;
 select * into existing from public.questionnaire_question_details where id=p_id;
 if found then
   if existing.question_id=p_question_id and existing.title=btrim(p_title)
     and existing.body=btrim(p_description) and existing.visible_to_consultants=p_visible then return; end if;
   raise exception 'Explanation conflict' using errcode='40001';
 end if;
 if (select count(*) from public.questionnaire_question_details where question_id=p_question_id) >= 30 then
   raise exception 'Too many explanations' using errcode='22023'; end if;
 insert into public.questionnaire_question_details(id,question_id,title,body,visible_to_consultants,position)
 select p_id,p_question_id,btrim(p_title),btrim(p_description),p_visible,coalesce(max(position)+1,0)
 from public.questionnaire_question_details where question_id=p_question_id;
 -- Incrementing revision prevents an older open editor from erasing this addition.
 update public.questionnaire_versions set revision=revision+1,updated_at=clock_timestamp(),last_save_id=null,last_save_hash=null where id=p_version_id;
end $$;
revoke all on function private.add_questionnaire_explanation(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function private.add_questionnaire_explanation(uuid,uuid,uuid,text,text,boolean) to authenticated;
create function public.add_questionnaire_explanation(p_id uuid,p_version_id uuid,p_question_id uuid,p_title text,p_description text,p_visible boolean)
returns void language sql security invoker set search_path='' as $$
 select private.add_questionnaire_explanation(p_id,p_version_id,p_question_id,p_title,p_description,p_visible);
$$;
revoke all on function public.add_questionnaire_explanation(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.add_questionnaire_explanation(uuid,uuid,uuid,text,text,boolean) to authenticated;
