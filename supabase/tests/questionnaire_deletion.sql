begin;
create temporary table questionnaire_delete_users(id uuid, role text);
insert into questionnaire_delete_users select gen_random_uuid(), role from unnest(array['student','consultant','consultant_lead','admin']) role;
insert into auth.users(id) select id from questionnaire_delete_users;
insert into public.profiles(id,role,name,student_period)
select id,role,'질문지 삭제 검증',case when role='student' then '1학년 1학기' end from questionnaire_delete_users;
create temporary table questionnaire_delete_data(doc jsonb);
insert into questionnaire_delete_data values(jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','삭제 검증','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','질문','details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','의도','text','설명','visibleToConsultants',false))))))));
grant select on questionnaire_delete_users, questionnaire_delete_data to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_delete_users where role='consultant_lead'),true);
set local role authenticated;
select public.save_questionnaire_draft(doc,0,gen_random_uuid()) from questionnaire_delete_data;
do $$ begin
  begin
    perform public.delete_questionnaire((select (doc->>'versionId')::uuid from questionnaire_delete_data),0);
    raise exception 'Stale revision deleted a newer questionnaire';
  exception when serialization_failure then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_delete_users where role='consultant'),true);
set local role authenticated;
do $$ begin
  begin
    perform public.delete_questionnaire((select (doc->>'versionId')::uuid from questionnaire_delete_data),1);
    raise exception 'Consultant deleted questionnaire';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_delete_users where role='student'),true);
set local role authenticated;
do $$ begin
  begin
    perform public.delete_questionnaire((select (doc->>'versionId')::uuid from questionnaire_delete_data),1);
    raise exception 'Student deleted questionnaire';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_delete_users where role='consultant_lead'),true);
set local role authenticated;
select public.delete_questionnaire((doc->>'versionId')::uuid,1) from questionnaire_delete_data;
do $$
declare document jsonb;
begin
  select doc into document from questionnaire_delete_data;
  if exists(select 1 from public.questionnaires where id=(document->>'questionnaireId')::uuid) then raise exception 'Questionnaire retained'; end if;
  if exists(select 1 from public.questionnaire_versions where id=(document->>'versionId')::uuid) then raise exception 'Draft version retained'; end if;
  if exists(select 1 from public.questionnaire_sections where id=(document#>>'{sections,0,id}')::uuid) then raise exception 'Section retained'; end if;
  if exists(select 1 from public.questionnaire_questions where id=(document#>>'{sections,0,questions,0,id}')::uuid) then raise exception 'Question retained'; end if;
  if exists(select 1 from public.questionnaire_question_details where id=(document#>>'{sections,0,questions,0,details,0,id}')::uuid) then raise exception 'Explanation retained'; end if;
  begin
    perform public.save_questionnaire_draft(document,1,gen_random_uuid());
    raise exception 'Autosave revived deleted questionnaire';
  exception when serialization_failure then null; end;
  begin
    perform public.save_questionnaire_draft(document,0,gen_random_uuid());
    raise exception 'Delayed first save revived deleted questionnaire';
  exception when sqlstate '55000' then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_delete_users where role='admin'),true);
set local role authenticated;
-- Retrying deletion after a lost response succeeds without changing unrelated rows.
select public.delete_questionnaire((doc->>'versionId')::uuid,1) from questionnaire_delete_data;
reset role;
do $$ begin
  if has_function_privilege('anon','public.delete_questionnaire(uuid,integer)','execute') then raise exception 'Anonymous delete access'; end if;
end $$;
-- New fixture with published content, a response, and a later editable draft.
update questionnaire_delete_data set doc=jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','발행 검증','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','발행 질문','details','[]'::jsonb)))));
set local role authenticated;
select public.save_questionnaire_draft(doc,0,gen_random_uuid()) from questionnaire_delete_data;
reset role;
update public.questionnaire_versions set status='published',published_at=now() where id=(select (doc->>'versionId')::uuid from questionnaire_delete_data);
insert into public.questionnaire_responses(version_id,respondent_id,assigned_by)
select (doc->>'versionId')::uuid,(select id from questionnaire_delete_users where role='consultant'),(select id from questionnaire_delete_users where role='admin') from questionnaire_delete_data;
insert into public.questionnaire_answers(response_id,version_id,question_id,body)
select r.id,r.version_id,(d.doc#>>'{sections,0,questions,0,id}')::uuid,'보존할 답변' from public.questionnaire_responses r join questionnaire_delete_data d on r.version_id=(d.doc->>'versionId')::uuid;
insert into public.questionnaire_versions(id,questionnaire_id,version_number,title)
select gen_random_uuid(),(doc->>'questionnaireId')::uuid,2,'발행 후 초안' from questionnaire_delete_data;
set local role authenticated;
do $$
declare qid uuid; draft_id uuid;
begin
  select (doc->>'questionnaireId')::uuid into qid from questionnaire_delete_data;
  select id into draft_id from public.questionnaire_versions where questionnaire_id=qid and status='draft';
  if public.delete_questionnaire(draft_id,0) <> 'archived' then raise exception 'Published history must archive even when deleting later draft'; end if;
  if (select count(*) from public.questionnaire_versions where questionnaire_id=qid) <> 2 then raise exception 'Versions destroyed'; end if;
  if not exists(select 1 from public.questionnaires where id=qid and archived_at is not null) then raise exception 'Published questionnaire not archived'; end if;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.questionnaire_answers where question_id=(select (doc#>>'{sections,0,questions,0,id}')::uuid from questionnaire_delete_data) and body='보존할 답변') then raise exception 'Answer destroyed'; end if;
end $$;
set constraints all immediate;
select 'Questionnaire deletion checks passed' as result;
rollback;
