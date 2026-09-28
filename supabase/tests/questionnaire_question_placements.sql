begin;
create temporary table placement_users as select gen_random_uuid() id, role from unnest(array['consultant_lead','other_lead','consultant','student','admin']) role;
insert into auth.users(id) select id from placement_users;
insert into public.profiles(id,role,name,student_period) select id, case when role='other_lead' then 'consultant_lead' else role end, '배치 테스트',case when role='student' then '1학년 1학기' end from placement_users;
grant select on placement_users to authenticated;
create temporary table placement_test(doc jsonb, first_block jsonb, second_block jsonb, save_id uuid);
grant all on placement_test to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from placement_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare a jsonb; b jsonb; d jsonb; r jsonb; read_back jsonb; changed jsonb; sid uuid:=gen_random_uuid();
begin
 a:=jsonb_build_object('id',gen_random_uuid(),'title','첫 질문','prompt','첫 질문 원문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','이름','kind','text'),jsonb_build_object('id',gen_random_uuid(),'label','내용','kind','text')),'rowMode','repeatable','maxRows',5,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null,'details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','공개 설명','text','안내','visibleToConsultants',true),jsonb_build_object('id',gen_random_uuid(),'title','비공개 설명','text','의도','visibleToConsultants',false)));
 perform public.save_question(a,0,gen_random_uuid());
 b:=jsonb_build_object('id',gen_random_uuid(),'title','후속 질문','prompt','후속 원문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','reference','maxRows',null,'sourceBlockId',a->'id','sourceFieldId',null,'afterBlockId',null,'condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(jsonb_build_object('blockId',a->'id','op','answered'))));
 perform public.save_question(b,0,gen_random_uuid());
 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','배치 질문지','sections',jsonb_build_array(
   jsonb_build_object('id',gen_random_uuid(),'title','섹션 하나','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',a->'id','text','위조 텍스트','details','[]'::jsonb))),
   jsonb_build_object('id',gen_random_uuid(),'title','섹션 둘','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',b->'id','text','위조 텍스트','details','[]'::jsonb)))));
 r:=public.save_questionnaire_draft(d,0,sid);
 if r->>'revision'<>'1' then raise exception 'Initial revision failed'; end if;
 if public.save_questionnaire_draft(d,0,sid)<>r then raise exception 'Retry failed'; end if;
 read_back:=public.read_questionnaire_draft((d->>'versionId')::uuid);
 if read_back#>>'{sections,0,questions,0,sourceQuestionId}'<>a->>'id' or read_back#>>'{sections,1,questions,0,sourceQuestionId}'<>b->>'id' then raise exception 'Placement round trip failed'; end if;
 if read_back#>>'{sections,0,questions,0,text}'<>'첫 질문 원문' then raise exception 'Source text was substituted'; end if;
 if read_back#>>'{sections,0,questions,0,id}'<>d#>>'{sections,0,questions,0,id}' then raise exception 'Placement identity lost'; end if;
 if (select fields from public.questions where id=(a->>'id')::uuid)<>a->'fields' then raise exception 'Source fields changed'; end if;
 -- The source revision changes without creating a different question or placement.
 a:=jsonb_set(a,'{prompt}','"수정한 첫 질문 원문"');
 perform public.save_question(a,1,gen_random_uuid());
 if public.save_questionnaire_draft(d,0,sid)<>r then raise exception 'Retry after source edit failed'; end if;
 begin
   perform public.archive_question((a->>'id')::uuid,2);
   raise exception 'Used source was archived';
 exception when object_not_in_prerequisite_state then null; end;
 -- Reversing prerequisite sections must roll back the entire save.
 changed:=jsonb_set(d,'{sections}',jsonb_build_array(d#>'{sections,1}',d#>'{sections,0}'));
 begin
   perform public.save_questionnaire_draft(changed,1,gen_random_uuid());
   raise exception 'Invalid order accepted';
 exception when invalid_parameter_value then null; end;
 if public.read_questionnaire_draft((d->>'versionId')::uuid)<>read_back then raise exception 'Invalid save partially committed'; end if;
 begin
   perform public.save_questionnaire_draft(jsonb_set(d,'{sections}',jsonb_build_array(d#>'{sections,1}')),1,gen_random_uuid());
   raise exception 'Missing prerequisite accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.save_questionnaire_draft(jsonb_set(d,'{sections,1,questions,0,sourceQuestionId}',a->'id'),1,gen_random_uuid());
   raise exception 'Duplicate source accepted';
 exception when unique_violation then null; end;
 begin
   perform public.save_questionnaire_draft(jsonb_set(d,'{sections,0,questions,0,sourceQuestionId}',to_jsonb(gen_random_uuid())),1,gen_random_uuid());
   raise exception 'Missing source accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.save_questionnaire_draft(d #- '{sections,0,questions,0,sourceQuestionId}',1,gen_random_uuid());
   raise exception 'Old client detached source';
 exception when invalid_parameter_value then null; end;
 begin
   update public.questionnaire_questions set source_question_id=null where version_id=(d->>'versionId')::uuid;
   raise exception 'Direct write allowed';
 exception when insufficient_privilege then null; end;
 perform public.publish_questionnaire((d->>'versionId')::uuid,1);
 if public.read_published_questionnaire((d->>'versionId')::uuid)#>>'{sections,1,questions,0,sourceQuestionId}'<>b->>'id' then raise exception 'Published placement lost'; end if;
 begin
   perform public.distribute_questionnaire((d->>'versionId')::uuid,1);
   raise exception 'Block sent to legacy response writer';
 exception when object_not_in_prerequisite_state then null; end;
 insert into placement_test values(d,a,b,sid);
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from placement_users where role='other_lead'),true);
set local role authenticated;
do $$ begin
 begin
   perform public.save_questionnaire_draft((select doc from placement_test),1,gen_random_uuid());
   raise exception 'Other lead changed placements';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from placement_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.questionnaire_questions where version_id=(select (doc->>'versionId')::uuid from placement_test)) then raise exception 'Consultant read staff placement'; end if;
 if public.read_published_questionnaire((select (doc->>'versionId')::uuid from placement_test)) is not null then raise exception 'Consultant read unpublished block document'; end if;
 begin
   perform public.save_questionnaire_draft((select doc from placement_test),1,gen_random_uuid());
   raise exception 'Consultant changed placements';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from placement_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare d jsonb; a jsonb; b jsonb; begin
 select doc,first_block,second_block into d,a,b from placement_test;
 -- Removing a dependent first and then its source preserves original questions.
 perform public.save_questionnaire_draft(jsonb_set(d,'{sections}',jsonb_build_array(d#>'{sections,0}')),1,gen_random_uuid());
 d:=jsonb_set(d,'{sections}',jsonb_build_array(d#>'{sections,0}'));
 d:=jsonb_set(d,'{sections,0,questions,0,id}',to_jsonb(gen_random_uuid()));
 d:=jsonb_set(d,'{sections,0,questions,0,logicalKey}',to_jsonb(gen_random_uuid()));
 perform public.save_questionnaire_draft(d,2,gen_random_uuid());
 if public.read_questionnaire_draft((d->>'versionId')::uuid)#>>'{sections,0,questions,0,id}'<>d#>>'{sections,0,questions,0,id}' then raise exception 'Remove and re-add before autosave failed'; end if;
 perform public.save_questionnaire_draft(jsonb_set(d,'{sections}','[]'),3,gen_random_uuid());
 if not exists(select 1 from public.questions where id=(a->>'id')::uuid) then raise exception 'Removal deleted source'; end if;
 perform public.archive_question((b->>'id')::uuid,1);
 perform public.archive_question((a->>'id')::uuid,2);
end $$;
reset role;
rollback;
