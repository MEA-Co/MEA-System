-- Remove only reviews left behind by deletion of their question.
-- Older document-level reviews have no question snapshot and remain unchanged.
delete from public.questionnaire_review_requests
where question_id is null and question_text is not null;

alter table public.questionnaire_review_requests
  drop constraint questionnaire_review_requests_question_id_fkey,
  add constraint questionnaire_review_requests_question_id_fkey
    foreign key (question_id) references public.questionnaire_questions(id) on delete cascade;

create or replace function private.request_questionnaire_review(
  p_id uuid, p_version_id uuid, p_question_id uuid, p_title text, p_description text
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
    or p_title is null or length(btrim(p_title)) not between 1 and 200
    or p_description is null or length(btrim(p_description)) not between 1 and 5000 then
    raise exception 'Question, title and description required' using errcode='22023';
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
  ) values(p_id,v.id,p_question_id,btrim(p_title),actor.id,actor.name,btrim(p_description))
  on conflict(id) do nothing;
  if not exists(select 1 from public.questionnaire_review_requests
    where id=p_id and version_id=v.id and question_id=p_question_id and title=btrim(p_title)
      and requested_by=actor.id and description=btrim(p_description)) then
    raise exception 'Review conflict' using errcode='40001';
  end if;
end $$;

alter table public.questionnaire_review_requests drop column question_text;
