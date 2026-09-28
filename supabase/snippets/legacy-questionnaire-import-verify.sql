-- Read-only post-import verification. All *_match / *_unchanged columns should be true.
select
  l.source_version_id,
  l.target_version_id,
  v.title as imported_title,
  v.status as imported_status,
  l.question_count as expected_questions,
  (select count(*) from public.questionnaire_questions where version_id=l.target_version_id) as placed_questions,
  (select count(*) from public.question_details d join public.questionnaire_questions p on p.source_question_id=d.question_id where p.version_id=l.target_version_id) as copied_details,
  (select status='published' and revision=l.source_revision from public.questionnaire_versions where id=l.source_version_id) as source_status_unchanged,
  not exists(select 1 from public.questionnaire_questions where version_id=l.source_version_id and source_question_id is not null) as source_placements_unchanged,
  not exists(select 1 from public.questionnaire_responses where version_id in (l.source_version_id,l.target_version_id)) as responses_unchanged,
  not exists(select 1 from public.questionnaire_answers where version_id in (l.source_version_id,l.target_version_id)) as answers_unchanged,
  not exists(
    select 1 from jsonb_array_elements(l.mappings->'questions') m
    left join public.questionnaire_questions original on original.id=(m->>'sourceQuestionId')::uuid
    left join public.questions q on q.id=(m->>'targetQuestionId')::uuid
    left join public.questionnaire_questions placement on placement.id=(m->>'targetPlacementId')::uuid
    where original.id is null or q.id is null or placement.id is null
      or original.body is distinct from q.prompt or q.prompt is distinct from placement.body
      or placement.source_question_id is distinct from q.id
      or q.created_by is distinct from l.source_owner_id
      or q.fields is distinct from jsonb_build_array(jsonb_build_object('id',m->>'targetFieldId','label','답변','kind','text'))
      or q.row_mode<>'single' or q.condition is not null
      or placement.position is distinct from original.position
  ) as questions_match,
  not exists(
    select 1 from jsonb_array_elements(l.mappings->'sections') m
    left join public.questionnaire_sections original on original.id=(m->>'sourceSectionId')::uuid
    left join public.questionnaire_sections target on target.id=(m->>'targetSectionId')::uuid
    where original.id is null or target.id is null
      or original.title is distinct from target.title or original.position is distinct from target.position
  ) as sections_match,
  not exists(
    select 1 from jsonb_array_elements(l.mappings->'details') m
    left join public.questionnaire_question_details original on original.id=(m->>'sourceDetailId')::uuid
    left join public.question_details target on target.id=(m->>'targetDetailId')::uuid
    where original.id is null or target.id is null
      or original.title is distinct from target.title or original.body is distinct from target.body
      or original.visible_to_consultants is distinct from target.visible_to_consultants
  ) as details_match
from private.legacy_questionnaire_imports l
join public.questionnaire_versions v on v.id=l.target_version_id
where l.source_version_id='dbc59647-e728-4d17-b312-b12fd2c8cd82';
