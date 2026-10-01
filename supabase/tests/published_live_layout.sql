begin;
create temporary table publish_users as select gen_random_uuid() id, role from unnest(array['consultant_lead','other_lead','consultant']) role;
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
create temp table layout_snapshots(stage text primary key, data jsonb);
grant all on layout_snapshots to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare x jsonb; payload jsonb; begin
 x:=public.open_question_response_session((select (doc->>'versionId')::uuid from publish_docs));
 payload:=jsonb_build_object(x#>>'{questions,0,definition,id}',jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(x#>>'{questions,0,definition,fields,0,id}','기존 답변 보존'))));
 payload:=jsonb_set(payload,array[x#>>'{questions,0,definition,id}'],(payload->(x#>>'{questions,0,definition,id}'))||jsonb_build_array(jsonb_build_object('id',2,'answers',jsonb_build_object(x#>>'{questions,0,definition,fields,0,id}','두 번째 답변'))));
 x:=public.save_question_response_session((x->>'id')::uuid,payload,0,gen_random_uuid(),true,x->>'definitionToken');
 insert into layout_snapshots values('initial',x);
 begin perform private.sync_published_response_layout((x->>'id')::uuid); raise exception 'Internal helper exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare d jsonb; q jsonb; vid uuid; begin
 select doc into d from publish_docs; vid:=(d->>'versionId')::uuid;
 q:=jsonb_build_object('id',gen_random_uuid(),'title','새 질문','prompt','추가 질문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','single','sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 perform public.save_question(q,0,gen_random_uuid());
 d:=jsonb_set(d,'{title}','"변경된 제목"');
 d:=jsonb_set(d,'{sections}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','추가 섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text','추가 질문','details','[]'::jsonb))))||(d->'sections'));
 perform public.save_questionnaire_draft(d,(public.read_questionnaire_draft(vid)->>'revision')::int,gen_random_uuid());
 update publish_docs set doc=d;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare x jsonb; old jsonb; payload jsonb; vid uuid; begin
 select data into old from layout_snapshots where stage='initial';
 select (doc->>'versionId')::uuid into vid from publish_docs;
 x:=public.read_question_response_session(vid);
 if x->>'title'<>'변경된 제목' or jsonb_array_length(x->'questions')<>2 or x#>>'{sections,0,title}'<>'추가 섹션' then raise exception 'Latest layout missing'; end if;
 if x->>'revision'<>old->>'revision' then raise exception 'Layout refresh changed answer revision'; end if;
 if x->>'definitionToken'=old->>'definitionToken' then raise exception 'Layout token unchanged'; end if;
 if not exists(select 1 from jsonb_array_elements(x->'questions') q where q->>'responseId'=old#>>'{questions,0,responseId}' and q->'rows'=old#>'{questions,0,rows}') then raise exception 'Old answer overwritten'; end if;
 select jsonb_object_agg(q#>>'{definition,id}',q->'rows') into payload from jsonb_array_elements(x->'questions') q;
 begin perform public.save_question_response_session(vid,payload,(x->>'revision')::int,gen_random_uuid(),false,old->>'definitionToken'); raise exception 'Old layout accepted'; exception when serialization_failure then null; end;
 x:=public.save_question_response_session(vid,payload,(x->>'revision')::int,gen_random_uuid(),false,x->>'definitionToken');
 insert into layout_snapshots values('added',x);
 if public.read_question_response_session(vid)<>public.read_question_response_session(vid) then raise exception 'Read not idempotent'; end if;
end $$;
reset role;
-- Remove the original source placement, retaining its response record.
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare d jsonb; vid uuid; begin
 select doc into d from publish_docs; vid:=(d->>'versionId')::uuid;
 d:=jsonb_set(d,'{sections}',jsonb_build_array(d#>'{sections,0}'));
 perform public.save_questionnaire_draft(d,(public.read_questionnaire_draft(vid)->>'revision')::int,gen_random_uuid());
 update publish_docs set doc=d;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare x jsonb; old jsonb; payload jsonb; begin
 select data into old from layout_snapshots where stage='initial';
 x:=public.read_question_response_session((old->>'id')::uuid);
 if jsonb_array_length(x->'questions')<>1 then raise exception 'Removed question visible'; end if;
 if not exists(select 1 from public.question_responses where id=(old#>>'{questions,0,responseId}')::uuid and rows=old#>'{questions,0,rows}') then raise exception 'Removed answer deleted'; end if;
 select jsonb_object_agg(q#>>'{definition,id}',q->'rows') into payload from jsonb_array_elements(x->'questions') q;
 perform public.save_question_response_session((x->>'id')::uuid,payload,(x->>'revision')::int,gen_random_uuid(),false,x->>'definitionToken');
end $$;
reset role;
-- Re-add using a new placement ID; restore the same response ID and rows.
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare d jsonb; vid uuid; begin
 select doc into d from publish_docs; vid:=(d->>'versionId')::uuid;
 d:=jsonb_set(d,'{sections,0,questions}',(d#>'{sections,0,questions}')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',(select source_id from publish_docs),'text','내용','details','[]'::jsonb)));
 perform public.save_questionnaire_draft(d,(public.read_questionnaire_draft(vid)->>'revision')::int,gen_random_uuid());
 update publish_docs set doc=d;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare x jsonb; old jsonb; begin
 select data into old from layout_snapshots where stage='initial';
 x:=public.open_question_response_session((select (doc->>'versionId')::uuid from publish_docs));
 if jsonb_array_length(x->'questions')<>2 then raise exception 'Re-added question missing'; end if;
 if not exists(select 1 from jsonb_array_elements(x->'questions') q where q->>'responseId'=old#>>'{questions,0,responseId}' and q->'rows'=old#>'{questions,0,rows}') then raise exception 'Re-added answer lost'; end if;
 insert into layout_snapshots values('readded',x);
end $$;
reset role;
-- Reordering without changing the question set must also invalidate stale saves.
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare d jsonb; vid uuid; begin
 select doc into d from publish_docs; vid:=(d->>'versionId')::uuid;
 d:=jsonb_set(d,'{sections,0,questions}',jsonb_build_array(d#>'{sections,0,questions,1}',d#>'{sections,0,questions,0}'));
 d:=jsonb_set(d,'{sections,0,title}','"순서 변경 섹션"');
 perform public.save_questionnaire_draft(d,(public.read_questionnaire_draft(vid)->>'revision')::int,gen_random_uuid());
 update publish_docs set doc=d;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare x jsonb; old jsonb; payload jsonb; begin
 select data into old from layout_snapshots where stage='readded';
 x:=public.read_question_response_session((old->>'id')::uuid);
 if x->>'definitionToken'=old->>'definitionToken' or x#>>'{sections,0,title}'<>'순서 변경 섹션' or x#>>'{sections,0,questions,0,sourceQuestionId}'<>(select source_id::text from publish_docs) then raise exception 'Reorder was not reflected'; end if;
 select jsonb_object_agg(q#>>'{definition,id}',q->'rows') into payload from jsonb_array_elements(x->'questions') q;
 begin perform public.save_question_response_session((x->>'id')::uuid,payload,(x->>'revision')::int,gen_random_uuid(),false,old->>'definitionToken'); raise exception 'Stale order accepted'; exception when serialization_failure then null; end;
end $$;
reset role;
-- An ordinary non-author lead sees the same latest published layout but cannot save.
insert into auth.users(id) values('ca000000-0000-4000-8000-000000000001');
insert into public.profiles(id,role,name) values('ca000000-0000-4000-8000-000000000001','consultant_lead','읽기 리드');
select set_config('request.jwt.claim.sub','ca000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare x jsonb; vid uuid; begin
 select (doc->>'versionId')::uuid into vid from publish_docs;
 x:=public.read_published_questionnaire(vid);
 if x->>'title'<>'변경된 제목' or jsonb_array_length(x#>'{sections,0,questions}')<>2 then raise exception 'Ordinary lead saw stale layout'; end if;
 if jsonb_array_length(public.read_published_question_sources(vid))<>2 then raise exception 'Ordinary lead saw stale sources'; end if;
 begin perform public.read_question_response_session(vid); raise exception 'Other response exposed'; exception when insufficient_privilege then null; end;
 begin perform public.open_question_response_session(vid); raise exception 'Other lead persisted answers'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
