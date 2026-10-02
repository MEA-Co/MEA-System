begin;
create temporary table publish_users as select gen_random_uuid() id, role from unnest(array['consultant_lead','other_lead','consultant','admin']) role;
insert into auth.users(id) select id from publish_users;
insert into public.profiles(id,role,name) select id,case when role='other_lead' then 'consultant_lead' else role end,'게시 테스트' from publish_users;
create or replace function private.guide_consultant_id() returns uuid language sql stable set search_path='' as $$ select id from pg_temp.publish_users where role='other_lead'; $$;
create temporary table publish_docs(doc jsonb, source_id uuid);
grant all on publish_docs to authenticated;
grant select on publish_users to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare q jsonb; d jsonb; r jsonb;
begin
 q:=jsonb_build_object('id',gen_random_uuid(),'title','공유 질문','prompt','내용','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','repeatable','maxRows',3,'minRows',2,'rowLabels',jsonb_build_array('첫째','둘째'),'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 q:=q||jsonb_build_object('details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','원본 설명','text','설명 본문','visibleToConsultants',true),jsonb_build_object('id',gen_random_uuid(),'title','비공개','text','비공개 비밀','visibleToConsultants',false)));
 perform public.save_question(q,0,gen_random_uuid());
 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','공유 질문지','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text','내용','details','[]'::jsonb)))));
 begin
  perform public.save_questionnaire_draft(jsonb_set(d,'{sections,0,questions,0,sourceQuestionId}','null'::jsonb),0,gen_random_uuid());
  raise exception 'Legacy inline save accepted';
 exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.questionnaires where id=(d->>'questionnaireId')::uuid) then raise exception 'Failed save left a partial document'; end if;
 begin
  perform public.save_questionnaire_draft(jsonb_set(d,'{sections,0,questions,0,details}',q->'details'),0,gen_random_uuid());
  raise exception 'Placement explanation accepted';
 exception when invalid_parameter_value then null; end;
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 q:=jsonb_set(q,'{prompt}','"최신 원본 내용"'::jsonb);
 perform public.save_question(q,1,gen_random_uuid());
 r:=public.read_questionnaire_draft((d->>'questionnaireId')::uuid);
 if r#>>'{sections,0,questions,0,text}'<>'최신 원본 내용' then raise exception 'Draft read stale placement body'; end if;

 insert into publish_docs values(d,(q->>'id')::uuid);
 begin
  perform public.read_published_question_sources((d->>'questionnaireId')::uuid);
  raise exception 'Draft source leaked';
 exception when insufficient_privilege then null; end;
 perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
end $$;


-- A second questionnaire places the same source question.
create temporary table second_review_doc(doc jsonb);
grant all on second_review_doc to authenticated;
do $$ declare d jsonb; begin
 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','두 번째 질문지','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','내용','details','[]'::jsonb,'sourceQuestionId',(select source_id from publish_docs))))));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
 insert into second_review_doc values(d);
end $$;

reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
select public.request_question_review('10000000-0000-4000-8000-000000000099',(select source_id from publish_docs),(select (doc->>'questionnaireId')::uuid from second_review_doc),'다른 질문지에서 들어온 검토');
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
do $$ declare vid uuid; qid uuid; retry uuid:=gen_random_uuid(); result jsonb; begin
 select (doc->>'questionnaireId')::uuid,source_id into vid,qid from publish_docs;
 perform public.mark_question_reviews_read(qid,array['10000000-0000-4000-8000-000000000099'::uuid]);
 begin
  perform public.change_questionnaire_status(vid,2,'published',null,'distributed',retry);
  raise exception 'Unresolved review accepted';
 exception when object_not_in_prerequisite_state then
  if sqlerrm not like '%Unresolved question reviews%' then raise; end if;
 end;
 if (select status from public.questionnaires where id=vid)<>'published' or (select revision from public.questionnaires where id=vid)<>2 or (select distribution_locked_at from public.questions where id=qid) is not null then raise exception 'Failed distribution left changes'; end if;
 perform public.resolve_question_review('10000000-0000-4000-8000-000000000099',qid);
 result:=public.change_questionnaire_status(vid,2,'published',null,'distributed',retry);
 if public.change_questionnaire_status(vid,2,'published',null,'distributed',retry)<>result then raise exception 'Retry failed'; end if;
 if (select distribution_locked_at from public.questions where id=qid) is null then raise exception 'Question not locked'; end if;
 if (select status from public.questionnaires where id=vid)<>'distributed' then raise exception 'Not distributed'; end if;
 -- A second questionnaire can reuse an already locked original.
 perform public.change_questionnaire_status((select (doc->>'questionnaireId')::uuid from second_review_doc),2,'published',null,'distributed',gen_random_uuid());
end $$;
reset role;
-- Trigger enforcement also protects privileged writers and descriptions.
do $$ declare qid uuid; vid uuid; begin
 select source_id,(doc->>'questionnaireId')::uuid into qid,vid from publish_docs;
 begin update public.questions set prompt='changed' where id=qid; raise exception 'Question mutated'; exception when object_not_in_prerequisite_state then null; end;
 begin update public.questions set distribution_locked_at=null where id=qid; raise exception 'Question unlocked'; exception when object_not_in_prerequisite_state then null; end;
 begin delete from public.questions where id=qid; raise exception 'Question deleted'; exception when object_not_in_prerequisite_state then null; end;
 begin update public.question_details set body='changed' where question_id=qid; raise exception 'Detail mutated'; exception when object_not_in_prerequisite_state then null; end;
 begin delete from public.question_details where question_id=qid; raise exception 'Detail deleted'; exception when object_not_in_prerequisite_state then null; end;
 begin update public.questionnaires set title='changed' where id=vid; raise exception 'Version mutated'; exception when object_not_in_prerequisite_state then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ declare vid uuid; sources jsonb; begin
 select (doc->>'questionnaireId')::uuid into vid from publish_docs;
 if not exists(select 1 from public.questionnaires where id=vid and status='distributed') then raise exception 'Consultant cannot see distribution'; end if;
 if public.read_published_questionnaire(vid)#>>'{sections,0,questions,0,text}'<>'최신 원본 내용' then raise exception 'Missing question content'; end if;
 sources:=public.read_published_question_sources(vid);
 if jsonb_array_length(sources->0->'details')<>1 then raise exception 'Private details leaked'; end if;
 if jsonb_array_length(sources)<>1 or sources#>>'{0,details,0,text}'<>'설명 본문' then raise exception 'Missing public source detail'; end if;
 if exists(select 1 from public.questions where id=(select source_id from publish_docs)) then raise exception 'Independent question access widened'; end if;
 begin perform public.distribute_questionnaire(vid,3); raise exception 'Consultant can distribute'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
