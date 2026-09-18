begin;
create temporary table workflow_users(id uuid, role text);
insert into workflow_users select gen_random_uuid(),role from unnest(array['student','consultant','consultant_lead','admin','reviewer_lead']) role;
insert into auth.users(id) select id from workflow_users;
insert into public.profiles(id,role,name,student_period)
select id,case when role='reviewer_lead' then 'consultant_lead' else role end,'검증 '||role,case when role='student' then '1학년 1학기' end from workflow_users;
create temporary table workflow_data(doc jsonb);
insert into workflow_data values(jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','워크플로 검증','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','질문','details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','비공개 의도','text','비공개 설명','visibleToConsultants',false),jsonb_build_object('id',gen_random_uuid(),'title','공개 의도','text','공개 설명','visibleToConsultants',true))))))));
grant select on workflow_users,workflow_data to authenticated;
set local role authenticated;
do $$
declare doc jsonb; other_doc jsonb; vid uuid; qid uuid; rid uuid := gen_random_uuid(); resolved_id uuid := gen_random_uuid(); owner_id uuid; reviewer_id uuid;
begin
 select d.doc into doc from workflow_data d;
 vid := (doc->>'versionId')::uuid;
 qid := (doc#>>'{sections,0,questions,0,id}')::uuid;
 select id into owner_id from workflow_users where role='consultant_lead';
 select id into reviewer_id from workflow_users where role='admin';
 perform set_config('request.jwt.claim.sub', owner_id::text, true);
 perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
 perform public.publish_questionnaire(vid,1);
 other_doc := jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','다른 질문지',
   'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','다른 섹션','questions',jsonb_build_array(
   jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','다른 질문','details','[]'::jsonb)))));
 perform public.save_questionnaire_draft(other_doc,0,gen_random_uuid());
 perform public.publish_questionnaire((other_doc->>'versionId')::uuid,1);
 perform set_config('request.jwt.claim.sub', reviewer_id::text, true);
 perform public.request_questionnaire_review(rid,vid,qid,'  보완해 주세요  ');
 perform public.request_questionnaire_review(rid,vid,qid,'보완해 주세요');
 if (select count(*) from public.questionnaire_review_requests where id=rid) <> 1 then raise exception 'Retry duplicated review'; end if;
 if not exists(select 1 from public.questionnaire_review_requests where id=rid and question_id=qid
   and title='' and description='보완해 주세요') then
   raise exception 'Question review fields were not stored'; end if;
 begin
   perform public.request_questionnaire_review(rid,vid,qid,'다른 내용');
   raise exception 'Changed retry accepted'; exception when serialization_failure then null;
 end;
 begin
   perform public.request_questionnaire_review(gen_random_uuid(),vid,(other_doc#>>'{sections,0,questions,0,id}')::uuid,'본문');
   raise exception 'Cross-version question accepted'; exception when invalid_parameter_value then null;
 end;
 begin
   perform public.request_questionnaire_review(gen_random_uuid(),vid,qid,' ');
   raise exception 'Empty content accepted'; exception when invalid_parameter_value then null;
 end;
 begin
   perform public.request_questionnaire_review(gen_random_uuid(),vid,qid,repeat('x',5001));
   raise exception 'Oversize content accepted'; exception when invalid_parameter_value then null;
 end;
 perform set_config('request.jwt.claim.sub', (select id::text from workflow_users where role='consultant'), true);
 begin
   perform public.request_questionnaire_review(gen_random_uuid(),vid,qid,'본문');
   raise exception 'Consultant could review'; exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub', reviewer_id::text, true);
 perform public.request_questionnaire_review(resolved_id,vid,qid,'설명');
 perform public.request_questionnaire_review(gen_random_uuid(),(other_doc->>'versionId')::uuid,
   (other_doc#>>'{sections,0,questions,0,id}')::uuid,'설명');
 perform set_config('request.jwt.claim.sub', owner_id::text, true);
 perform public.resolve_questionnaire_review(resolved_id);
 -- Section removal also removes its questions, details and all attached reviews.
 perform public.save_questionnaire_draft(jsonb_set(doc,'{sections}','[]'::jsonb),1,gen_random_uuid());
end $$;
reset role;
-- Check as DB owner so RLS cannot disguise retained rows as deleted data.
do $$
declare doc jsonb;
begin
 select d.doc into doc from workflow_data d;
 if exists(select 1 from public.questionnaire_review_requests where version_id=(doc->>'versionId')::uuid) then
   raise exception 'Deleted question retained resolved or unresolved reviews'; end if;
 if exists(select 1 from public.questionnaire_questions where version_id=(doc->>'versionId')::uuid) then
   raise exception 'Question retained after section deletion'; end if;
 if exists(select 1 from public.questionnaire_question_details where question_id=(doc#>>'{sections,0,questions,0,id}')::uuid) then
   raise exception 'Question explanation retained'; end if;
 if (select count(*) from public.questionnaire_review_requests where requested_by in (select id from workflow_users)) <> 1 then
   raise exception 'Unrelated review was removed'; end if;
end $$;
select 'Question-level review validation, retries and cascading deletion passed'  as result;
rollback;
