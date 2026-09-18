begin;
create temporary table workflow_users(id uuid, role text);
insert into workflow_users select gen_random_uuid(),role from unnest(array['student','consultant','consultant_lead','admin','reviewer_lead']) role;
insert into auth.users(id) select id from workflow_users;
insert into public.profiles(id,role,name,student_period)
select id,case when role='reviewer_lead' then 'consultant_lead' else role end,'검증 '||role,case when role='student' then '1학년 1학기' end from workflow_users;
create temporary table workflow_data(doc jsonb);
insert into workflow_data values(jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','워크플로 검증','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','질문','details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','비공개 의도','text','비공개 설명','visibleToConsultants',false),jsonb_build_object('id',gen_random_uuid(),'title','공개 의도','text','공개 설명','visibleToConsultants',true))))))));
grant select on workflow_users,workflow_data to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='consultant_lead'),true);
set local role authenticated;
select public.save_questionnaire_draft(doc,0,gen_random_uuid()) from workflow_data;
select public.publish_questionnaire((doc->>'versionId')::uuid,1) from workflow_data;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='admin'),true);
set local role authenticated;
select public.request_questionnaire_review(gen_random_uuid(),(doc->>'versionId')::uuid,(doc#>>'{sections,0,questions,0,id}')::uuid,'미확인 검토 요청') from workflow_data;
select public.request_questionnaire_review(gen_random_uuid(),(doc->>'versionId')::uuid,(doc#>>'{sections,0,questions,0,id}')::uuid,'확인된 검토 요청') from workflow_data;
select public.mark_questionnaire_publication_read((doc->>'versionId')::uuid) from workflow_data;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='consultant_lead'),true);
set local role authenticated;
select public.resolve_questionnaire_review(id) from public.questionnaire_review_requests where description='확인된 검토 요청';
reset role;
-- Include all currently related tables, even reserved response/answer rows.
insert into public.questionnaire_responses(version_id,respondent_id,assigned_by)
select (doc->>'versionId')::uuid,(select id from workflow_users where role='consultant'),(select id from workflow_users where role='admin') from workflow_data;
insert into public.questionnaire_answers(response_id,version_id,question_id,body)
select r.id,r.version_id,(d.doc#>>'{sections,0,questions,0,id}')::uuid,'삭제 검증 답변' from public.questionnaire_responses r join workflow_data d on r.version_id=(d.doc->>'versionId')::uuid;
insert into public.questionnaire_versions(id,questionnaire_id,version_number,title)
select gen_random_uuid(),(doc->>'questionnaireId')::uuid,2,'추가 초안' from workflow_data;
create temporary table deleted_versions as select id from public.questionnaire_versions where questionnaire_id=(select (doc->>'questionnaireId')::uuid from workflow_data);
select set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='reviewer_lead'),true);
set local role authenticated;
do $$ begin
 begin perform public.delete_questionnaire((select (doc->>'versionId')::uuid from workflow_data),1); raise exception 'Other lead deleted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='admin'),true);
set local role authenticated;
do $$ begin
 begin perform public.delete_questionnaire((select (doc->>'versionId')::uuid from workflow_data),0); raise exception 'Stale delete'; exception when serialization_failure then null; end;
 if public.delete_questionnaire((select (doc->>'versionId')::uuid from workflow_data),1)<>'deleted' then raise exception 'Admin did not hard delete'; end if;
 if public.delete_questionnaire((select (doc->>'versionId')::uuid from workflow_data),1)<>'deleted' then raise exception 'Delete retry failed'; end if;
end $$;
reset role;
-- Check as database owner: RLS must not hide undeleted rows from these assertions.
do $$
declare doc jsonb; qid uuid; vid uuid;
begin
 select d.doc into doc from workflow_data d; qid:=(doc->>'questionnaireId')::uuid; vid:=(doc->>'versionId')::uuid;
 if exists(select 1 from public.questionnaires where id=qid) then raise exception 'Parent remains'; end if;
 if exists(select 1 from public.questionnaire_versions where questionnaire_id=qid) then raise exception 'Version remains'; end if;
 if exists(select 1 from public.questionnaire_sections where version_id in (select id from deleted_versions)) then raise exception 'Section remains'; end if;
 if exists(select 1 from public.questionnaire_questions where version_id in (select id from deleted_versions)) then raise exception 'Question remains'; end if;
 if exists(select 1 from public.questionnaire_question_details where question_id=(doc#>>'{sections,0,questions,0,id}')::uuid) then raise exception 'Explanation remains'; end if;
 if exists(select 1 from public.questionnaire_review_requests where version_id in (select id from deleted_versions)) then raise exception 'Review remains'; end if;
 if exists(select 1 from public.questionnaire_publication_reads where version_id in (select id from deleted_versions)) then raise exception 'Read receipt remains'; end if;
 if exists(select 1 from public.questionnaire_responses where version_id in (select id from deleted_versions)) then raise exception 'Response remains'; end if;
 if exists(select 1 from public.questionnaire_answers where version_id in (select id from deleted_versions)) then raise exception 'Answer remains'; end if;
 if (select count(*) from private.deleted_questionnaire_versions where version_id in (select id from deleted_versions))<>2 then raise exception 'Anti-resurrection receipts missing'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='consultant_lead'),true);
set local role authenticated;
do $$ begin
 begin perform public.save_questionnaire_draft((select doc from workflow_data),0,gen_random_uuid()); raise exception 'Deleted publication recreated'; exception when sqlstate '55000' then null; end;
end $$;
reset role;
set constraints all immediate;
select 'Hard deletion through publication checks passed' as result;
rollback;
