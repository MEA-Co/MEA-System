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
declare q jsonb; d jsonb; r jsonb; followup jsonb;
begin
 q:=jsonb_build_object('id',gen_random_uuid(),'title','공유 질문','prompt','내용','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','repeatable','maxRows',3,'minRows',2,'rowLabels',jsonb_build_array('첫째','둘째'),'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 q:=q||jsonb_build_object('details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','원본 설명','text','설명 본문','visibleToConsultants',true)));
 perform public.save_question(q,0,gen_random_uuid());
 followup:=jsonb_build_object('id',gen_random_uuid(),'title','후속 질문','prompt','선택 이유','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','이유','kind','text')),'rowMode','reference','maxRows',null,'sourceBlockId',q->'id','sourceFieldId',null,'afterBlockId',q->'id','condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(jsonb_build_object('blockId',q->'id','op','answered'))));
 perform public.save_question(followup,0,gen_random_uuid());
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
 d:=jsonb_set(d,'{sections,0,questions}',(d#>'{sections,0,questions}')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',followup->'id','text','선택 이유','details','[]'::jsonb)));
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
declare vid uuid; snap jsonb; qid text; fid text; followid text; followfield text; payload jsonb; result jsonb; ref jsonb;
begin
 select (doc->>'versionId')::uuid into vid from publish_docs;
 snap:=public.open_question_response_session(vid);
 select value->'definition' into ref from jsonb_array_elements(snap->'questions') where value#>>'{definition,row_mode}'='reference';
 followid:=ref->>'id'; followfield:=ref#>>'{fields,0,id}';
 select value->'definition' into ref from jsonb_array_elements(snap->'questions') where value#>>'{definition,row_mode}'='repeatable';
 qid:=ref->>'id'; fid:=ref#>>'{fields,0,id}';
 payload:=jsonb_build_object(qid,jsonb_build_array(jsonb_build_object('id',1234567890123,'answers',jsonb_build_object(fid,'응답'))),followid,jsonb_build_array(jsonb_build_object('id',1234567890123,'answers',jsonb_build_object(followfield,'이유'))));
 result:=public.save_question_response_session(vid,payload,0,gen_random_uuid(),false,public.read_question_response_session(vid)->>'definitionToken');
 select value into ref from jsonb_array_elements(result->'questions') where value#>>'{definition,id}'=followid;
 if ref->'activeRowIds'<>'[1234567890123]'::jsonb then raise exception 'Reference row not activated: %',ref; end if;
 if not exists(select 1 from public.question_responses where id=(ref->>'responseId')::uuid and referenced_response_id is not null) then raise exception 'Reference response not linked'; end if;
 payload:=jsonb_set(payload,array[qid,'0','answers',fid],'""');
 result:=public.save_question_response_session(vid,payload,1,gen_random_uuid(),false,public.read_question_response_session(vid)->>'definitionToken');
 select value into ref from jsonb_array_elements(result->'questions') where value#>>'{definition,id}'=followid;
 if ref->'activeRowIds'<>'[]'::jsonb or ref#>>array['rows','0','answers',followfield]<>'이유' then raise exception 'Inactive answer lost or active'; end if;
 -- Completion must require minimum rows and all visible fields.
 begin perform public.save_question_response_session(vid,payload,2,gen_random_uuid(),true,public.read_question_response_session(vid)->>'definitionToken'); raise exception 'Incomplete submitted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
-- Delete the questionnaire: answers and frozen questions must survive.
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
select public.delete_questionnaire((select (doc->>'versionId')::uuid from publish_docs),2);
reset role;
do $$ begin
 if not exists(select 1 from public.question_responses) or not exists(select 1 from public.response_sessions where origin_version_id is null) then raise exception 'Question answers deleted with questionnaire'; end if;
end $$;
rollback;
