-- Read-only preflight for the source shown in the production inventory.
with source as (
  select v.id,v.title,v.status,v.revision,p.archived_at,p.created_by,owner.role as owner_role,
    (select count(*) from public.questionnaire_sections s where s.version_id=v.id) as sections,
    (select count(*) from public.questionnaire_responses r where r.version_id=v.id) as responses,
    (select count(*) from public.questionnaire_answers a where a.version_id=v.id) as answers
  from public.questionnaire_versions v
  join public.questionnaires p on p.id=v.questionnaire_id
  join public.profiles owner on owner.id=p.created_by
  where v.id='dbc59647-e728-4d17-b312-b12fd2c8cd82'
), question_checks as (
  select count(*) as questions,
    count(*) filter(where q.kind<>'text' or q.source_question_id is not null or q.options<>'[]'::jsonb or q.choice_allow_text) as unsupported_questions,
    count(*) filter(where btrim(q.body)='' or char_length(q.body)>10000) as invalid_question_length,
    count(*) filter(where (select count(*) from public.questionnaire_question_details d where d.question_id=q.id)>20) as too_many_details
  from public.questionnaire_questions q join source s on s.id=q.version_id
), detail_checks as (
  select count(*) as details,
    count(*) filter(where char_length(d.title)>200 or char_length(d.body)>10000) as invalid_detail_length
  from public.questionnaire_question_details d
  join public.questionnaire_questions q on q.id=d.question_id
  join source s on s.id=q.version_id
)
select s.*,q.*,d.*,
  s.status='published' and s.archived_at is null
  and s.owner_role in ('admin','consultant_lead')
  and s.responses=0 and s.answers=0 and s.sections between 1 and 50
  and char_length(s.title || ' · 전환본')<=500
  and q.questions=16 and q.unsupported_questions=0 and q.invalid_question_length=0
  and q.too_many_details=0 and d.invalid_detail_length=0
  and not exists(select 1 from public.questionnaire_sections sec where sec.version_id=s.id
    and (select count(*) from public.questionnaire_questions x where x.section_id=sec.id)>100)
  as ready_to_import
from source s cross join question_checks q cross join detail_checks d;
