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
 if r->>'questionnaireId' is distinct from d->>'questionnaireId' or r ? 'versionId' then raise exception 'Noncanonical document identifier'; end if;
 if r#>>'{sections,0,questions,0,text}'<>'최신 원본 내용' then raise exception 'Draft read stale placement body'; end if;

 insert into publish_docs values(d,(q->>'id')::uuid);
 begin
  perform public.read_published_question_sources((d->>'questionnaireId')::uuid);
  raise exception 'Draft source leaked';
 exception when insufficient_privilege then null; end;
 perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
end $$;

reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$
declare vid uuid; initial jsonb; result jsonb; again jsonb; qid text; fid text; payload jsonb; saveid uuid:=gen_random_uuid();
begin
 select (doc->>'questionnaireId')::uuid into vid from publish_docs;
 initial:=public.open_question_response_session(vid);
 again:=public.open_question_response_session(vid);
 if initial->>'id'<>again->>'id' then raise exception 'Duplicate session'; end if;
 qid:=initial#>>'{questions,0,definition,id}'; fid:=initial#>>'{questions,0,definition,fields,0,id}';
 payload:=jsonb_build_object(qid,jsonb_build_array(jsonb_build_object('id',-1,'answers',jsonb_build_object(fid,'::mea-rich-text:v1::{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"첫 답변","marks":[{"type":"highlight"}]}]}]}')),jsonb_build_object('id',2,'answers',jsonb_build_object(fid,'둘째 답변'))));
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

create temp table removal_docs(doc jsonb);
grant all on removal_docs to authenticated;
create function pg_temp.saved_guide_count(qid uuid) returns integer language sql security definer set search_path='' as $$ select count(*)::int from public.question_responses r join public.response_sessions s on s.id=r.session_id where s.origin_questionnaire_id=qid and s.respondent_id=private.guide_consultant_id(); $$;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare d jsonb; begin
 select doc into d from publish_docs;
 d:=jsonb_set(d,'{questionnaireId}',to_jsonb(gen_random_uuid()));
 d:=jsonb_set(d,'{sections,0,id}',to_jsonb(gen_random_uuid()));
 d:=jsonb_set(d,'{sections,0,questions,0,id}',to_jsonb(gen_random_uuid()));
 d:=jsonb_set(d,'{sections,0,questions,0,logicalKey}',to_jsonb(gen_random_uuid()));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
 insert into removal_docs values(d);
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare snap jsonb; id uuid; begin
 select (doc->>'questionnaireId')::uuid into id from removal_docs;
 snap:=public.open_question_response_session(id);
 perform public.save_question_response_session(id,jsonb_build_object((select source_id::text from publish_docs),jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(snap#>>'{questions,0,definition,fields,0,id}','다른 질문지 유지')))),0,gen_random_uuid(),false,snap->>'definitionToken');
 if snap#>'{questions,0}' ? 'previousResponses' or snap#>'{questions,0}' ? 'needsReview' then raise exception 'Old guide history contract'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare d jsonb; target_id uuid; other_id uuid; qid uuid; rev integer; begin
 select doc,(doc->>'questionnaireId')::uuid,source_id into d,target_id,qid from publish_docs;
 select (doc->>'questionnaireId')::uuid into other_id from removal_docs;
 select revision into rev from public.questionnaires where questionnaires.id=target_id;
 d:=jsonb_set(d,'{sections,0,questions}','[]');
 begin perform public.save_questionnaire_draft(d,rev,gen_random_uuid());raise exception 'Removal bypassed consent';exception when sqlstate 'PGA02' then null;end;
 if pg_temp.saved_guide_count(target_id)<>1 or pg_temp.saved_guide_count(other_id)<>1 then raise exception 'Failed removal mutated responses';end if;
 perform public.save_questionnaire_draft(d||jsonb_build_object('confirmedRemovedGuideQuestions',jsonb_build_array(qid)),rev,gen_random_uuid());
 if pg_temp.saved_guide_count(target_id)<>0 or pg_temp.saved_guide_count(other_id)<>1 then raise exception 'Wrong questionnaire answers removed';end if;
 -- Re-adding the original question cannot restore the deleted answer.
 select doc into d from publish_docs;
 perform public.save_questionnaire_draft(d,rev+1,gen_random_uuid());
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare snap jsonb; begin
 snap:=public.read_question_response_session((select (doc->>'questionnaireId')::uuid from publish_docs));
 if exists(select 1 from jsonb_array_elements(snap->'questions') q cross join lateral jsonb_array_elements(q->'rows') r where r->'answers'<>'{}') then raise exception 'Deleted answers resurrected';end if;
end $$;
reset role;
rollback;
