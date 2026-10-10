begin;
create temporary table study_guide_users as select gen_random_uuid() id, role from unnest(array['consultant_lead','consultant']) role;
insert into auth.users(id) select id from study_guide_users;
insert into public.profiles(id,role,name) select id,role,'학습법 가이드 검사' from study_guide_users;
grant select on study_guide_users to authenticated;
create or replace function private.guide_consultant_id() returns uuid language sql stable set search_path='' as $$ select id from pg_temp.study_guide_users where role='consultant_lead'; $$;
create temporary table study_guide_doc(qid uuid, sid uuid, study_id uuid);
grant all on study_guide_doc to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from study_guide_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare q jsonb; d jsonb; x jsonb; payload jsonb; sid uuid:=gen_random_uuid(); begin
 perform public.save_study(sid,jsonb_build_object('category','내신','problemSource','self','subject','수학','customSubject','','problem','시간 부족','strategy','오답 분석','practiceGuide','다시 풀이','practicePeriod','2주','checklist','오답률 확인','followup','추가 연습','resultDiagnosis','','references','[]'::jsonb),'[]',0,gen_random_uuid());
 q:=jsonb_build_object('id',gen_random_uuid(),'title','학습법 참조','prompt','학습법을 첨부하세요','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','학습법','kind','study')),'rowMode','single','sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 perform public.save_question(q,0,gen_random_uuid());
 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','학습법 가이드','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text','학습법','details','[]'::jsonb)))));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
 x:=public.open_question_response_session((d->>'questionnaireId')::uuid);
 payload:=jsonb_build_object(x#>>'{questions,0,questionId}',jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(x#>>'{questions,0,definition,fields,0,id}',sid::text))));
 perform public.save_question_response_session((d->>'questionnaireId')::uuid,payload,0,gen_random_uuid(),false,x->>'definitionToken');
 perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,2,'published',null,'distributed',gen_random_uuid());
 insert into study_guide_doc values((q->>'id')::uuid,(d->>'questionnaireId')::uuid,sid);
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from study_guide_users where role='consultant'),true);
set local role authenticated;
do $$ declare x jsonb; begin
 if not exists(select 1 from public.study where id=(select study_id from study_guide_doc)) then raise exception 'Study UUID guide not readable'; end if;
 x:=public.open_distributed_question_response_session((select sid from study_guide_doc));
 -- Direct typed-answer validation is also exercised by saving the guide above.
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from study_guide_users where role='consultant_lead'),true);
set local role authenticated;
select public.delete_study(study_id,1) from study_guide_doc;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from study_guide_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.study where id=(select study_id from study_guide_doc)) then raise exception 'Deleted study remained readable'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 if has_table_privilege('anon','public.study','select') or has_table_privilege('anon','public.study','insert') or has_function_privilege('anon','public.save_study(uuid,jsonb,jsonb,integer,uuid)','execute') then raise exception 'Anonymous access granted'; end if;
end $$;
rollback;
