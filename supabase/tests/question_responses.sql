begin;
create temporary table publish_users as select gen_random_uuid() id, role from unnest(array['consultant_lead','other_lead','consultant']) role;
insert into auth.users(id) select id from publish_users;
insert into public.profiles(id,role,name) select id,case when role='other_lead' then 'consultant_lead' else role end,'게시 테스트' from publish_users;
create temporary table publish_docs(doc jsonb, source_id uuid);
grant all on publish_docs to authenticated;
grant select on publish_users to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare q jsonb; d jsonb; r jsonb;
begin
 q:=jsonb_build_object('id',gen_random_uuid(),'title','공유 질문','prompt','내용','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','repeatable','maxRows',3,'minRows',2,'rowLabels',jsonb_build_array('첫째','둘째'),'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 q:=q||jsonb_build_object('details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','원본 설명','text','설명 본문','visibleToConsultants',true)));
 perform public.save_question(q,0,gen_random_uuid());
 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','공유 질문지','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text','내용','details','[]'::jsonb)))));
 begin
  perform public.save_questionnaire_draft(jsonb_set(d,'{sections,0,questions,0,sourceQuestionId}','null'::jsonb),0,gen_random_uuid());
  raise exception 'Legacy inline save accepted';
 exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.questionnaire_versions where id=(d->>'versionId')::uuid) then raise exception 'Failed save left a partial document'; end if;
 begin
  perform public.save_questionnaire_draft(jsonb_set(d,'{sections,0,questions,0,details}',q->'details'),0,gen_random_uuid());
  raise exception 'Placement explanation accepted';
 exception when invalid_parameter_value then null; end;
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 q:=jsonb_set(q,'{prompt}','"최신 원본 내용"'::jsonb);
 perform public.save_question(q,1,gen_random_uuid());
 r:=public.read_questionnaire_draft((d->>'versionId')::uuid);
 if r#>>'{sections,0,questions,0,text}'<>'최신 원본 내용' then raise exception 'Draft read stale placement body'; end if;

 insert into publish_docs values(d,(q->>'id')::uuid);
 begin
  perform public.read_published_question_sources((d->>'versionId')::uuid);
  raise exception 'Draft source leaked';
 exception when insufficient_privilege then null; end;
 perform public.change_questionnaire_status((d->>'versionId')::uuid,1,'draft',null,'published',gen_random_uuid());
end $$;

reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$
declare vid uuid; initial jsonb; result jsonb; again jsonb; qid text; fid text; payload jsonb; saveid uuid:=gen_random_uuid();
begin
 select (doc->>'versionId')::uuid into vid from publish_docs;
 initial:=public.open_question_response_session(vid);
 again:=public.open_question_response_session(vid);
 if initial->>'id'<>again->>'id' then raise exception 'Duplicate session'; end if;
 qid:=initial#>>'{questions,0,definition,id}'; fid:=initial#>>'{questions,0,definition,fields,0,id}';
 payload:=jsonb_build_object(qid,jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(fid,'첫 답변')),jsonb_build_object('id',2,'answers',jsonb_build_object(fid,'둘째 답변'))));
 result:=public.save_question_response_session(vid,payload,0,saveid,false,public.read_question_response_session(vid)->>'definitionToken');
 if result->>'revision'<>'1' or result#>>'{questions,0,rows,0,answers}' is null then raise exception 'Not saved'; end if;
 again:=public.save_question_response_session(vid,payload,0,saveid,false,public.read_question_response_session(vid)->>'definitionToken');
 if again->>'revision'<>'1' then raise exception 'Retry duplicated'; end if;
 begin perform public.save_question_response_session(vid,payload,0,gen_random_uuid(),false,public.read_question_response_session(vid)->>'definitionToken'); raise exception 'Accepted stale'; exception when serialization_failure then null; end;
 begin perform public.save_question_response_session(vid,jsonb_build_object(qid,jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(gen_random_uuid()::text,'foreign')))),1,gen_random_uuid(),false,public.read_question_response_session(vid)->>'definitionToken'); raise exception 'Accepted foreign field'; exception when invalid_parameter_value then null; end;
 begin update public.question_responses set body='tamper'; raise exception 'Direct write accepted'; exception when insufficient_privilege then null; end;
 perform public.save_question_response_session(vid,payload,1,gen_random_uuid(),true,public.read_question_response_session(vid)->>'definitionToken');
 perform public.save_question_response_session(vid,payload,2,gen_random_uuid(),false,public.read_question_response_session(vid)->>'definitionToken');
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare vid uuid; x jsonb; begin
 select (doc->>'versionId')::uuid into vid from publish_docs;
 if exists(select 1 from public.response_sessions) or exists(select 1 from public.question_responses) or exists(select 1 from public.question_versions) then raise exception 'Other user responses leaked'; end if;
 x:=public.open_question_response_session(vid);
 if x->>'revision'<>'0' then raise exception 'Shared answers'; end if;
end $$;
reset role;
-- A source edit must not rewrite a question version already used by an answer.
update public.questions set prompt='수정된 질문', revision=revision+1 where id=(select source_id from publish_docs);
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare x jsonb; begin
 x:=public.read_question_response_session((select (doc->>'versionId')::uuid from publish_docs));
 if not exists(select 1 from jsonb_array_elements(x->'questions') q where q#>>'{definition,prompt}'='수정된 질문') then raise exception 'Live source not reflected'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 begin perform public.open_question_response_session((select (doc->>'versionId')::uuid from publish_docs)); raise exception 'Consultant allowed'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.response_sessions) or exists(select 1 from public.question_versions) then raise exception 'Consultant leaked'; end if;
end $$;
reset role;
-- Removing a published container preserves both completed and unfinished answers.
create temp table preserved_sessions as select to_jsonb(s)-'origin_version_id' data from public.response_sessions s where origin_version_id=(select (doc->>'versionId')::uuid from publish_docs);
create temp table preserved_answers as select to_jsonb(r) data from public.question_responses r join public.response_sessions s on s.id=r.session_id where s.origin_version_id=(select (doc->>'versionId')::uuid from publish_docs);
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
select public.delete_questionnaire((select (doc->>'versionId')::uuid from publish_docs),2);
reset role;
do $$ begin
 if exists(select 1 from public.questionnaire_versions where id=(select (doc->>'versionId')::uuid from publish_docs)) then raise exception 'Questionnaire not deleted'; end if;
 if exists(select data from preserved_sessions except select to_jsonb(s)-'origin_version_id' from public.response_sessions s where origin_version_id is null) then raise exception 'Session history lost'; end if;
 if exists(select data from preserved_answers except select to_jsonb(r) from public.question_responses r) then raise exception 'Answers lost'; end if;
 if not exists(select 1 from public.questions where id=(select source_id from publish_docs)) then raise exception 'Source deleted'; end if;
end $$;

-- Deleted questionnaire remains accessible only to its response owner.
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
create temp table my_saved_response as select id from public.list_my_published_responses();
do $$ declare x jsonb; payload jsonb; begin
 x:=public.open_question_response_session((select id from my_saved_response));
 if not (x->>'sourceDeleted')::boolean then raise exception 'Deleted origin not reported'; end if;
 select jsonb_object_agg(q#>>'{definition,id}',q->'rows') into payload from jsonb_array_elements(x->'questions') q;
 perform public.save_question_response_session((x->>'id')::uuid,payload,(x->>'revision')::int,gen_random_uuid(),false,x->>'definitionToken');
end $$;
reset role;
create temp table stale_snapshot as select private.read_question_response_session((select id from my_saved_response)) value;
grant select on stale_snapshot to authenticated;
-- Change the answer schema without touching the existing response rows.
update public.questions set fields=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','text','label','새 열')),revision=revision+1 where id=(select source_id from publish_docs);
set local role authenticated;
do $$ declare x jsonb; old jsonb; payload jsonb; q jsonb; begin
 select value into old from stale_snapshot;
 x:=public.read_question_response_session((old->>'id')::uuid);
 q:=x#>'{questions,0}';
 if not (q->>'needsReview')::boolean or jsonb_array_length(q->'rows')<>2 then raise exception 'Old input was lost or review missing'; end if;
 payload:=jsonb_build_object(q#>>'{definition,id}',jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(q#>>'{definition,fields,0,id}','새 응답'))));
 begin perform public.save_question_response_session((x->>'id')::uuid,payload,(x->>'revision')::int,gen_random_uuid(),false,old->>'definitionToken'); raise exception 'Stale definition accepted'; exception when serialization_failure then null; end;
 x:=public.save_question_response_session((x->>'id')::uuid,payload,(x->>'revision')::int,gen_random_uuid(),false,x->>'definitionToken');
 if (x#>>'{questions,0,needsReview}')::boolean or jsonb_array_length(x#>'{questions,0,previousResponses}')<>1 or x#>>'{questions,0,previousResponses,0,body}' not like '%첫 답변%' then raise exception 'Previous answer not preserved'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ begin
 begin perform public.read_question_response_session((select (value->>'id')::uuid from stale_snapshot)); raise exception 'Foreign session exposed'; exception when insufficient_privilege then null; end;
end $$;
-- Source deletion is still subject to existing placement/reference checks.
select public.archive_question(id,revision) from public.questions where id=(select source_id from publish_docs);
reset role;
do $$ begin
 if exists(select 1 from public.question_responses r join public.question_versions v on v.id=r.question_version_id where v.question_id=(select source_id from publish_docs)) then raise exception 'Published answers survived source deletion'; end if;
 if exists(select 1 from public.response_sessions where id in (select (data->>'id')::uuid from preserved_sessions) and last_payload is not null) then raise exception 'Deleted answers retained in retry payload'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare x jsonb; begin
 x:=public.read_question_response_session((select id from my_saved_response));
 if jsonb_array_length(x->'questions')<>0 or jsonb_array_length(x#>'{sections,0,questions}')<>0 then raise exception 'Deleted source still rendered'; end if;
end $$;
reset role;
rollback;
