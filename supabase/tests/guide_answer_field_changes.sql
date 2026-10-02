begin;
create temporary table publish_users as select gen_random_uuid() id, role from unnest(array['consultant_lead','other_lead','consultant']) role;
insert into auth.users(id) select id from publish_users;
insert into public.profiles(id,role,name) select id,case when role='other_lead' then 'consultant_lead' else role end,'게시 테스트' from publish_users;
create or replace function private.guide_consultant_id() returns uuid language sql stable set search_path='' as $$ select id from pg_temp.publish_users where role='other_lead'; $$;
create temporary table publish_docs(doc jsonb, source_id uuid);
grant all on publish_docs to authenticated;
grant select on publish_users to authenticated;
create function pg_temp.saved_guide_rows(qid uuid) returns jsonb language sql security definer set search_path='' as $$ select r.rows from public.question_responses r join public.response_sessions s on s.id=r.session_id where r.question_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' limit 1; $$;
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
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare q jsonb; qid uuid; rev integer; initial_field text; new_field text:=gen_random_uuid()::text; before_rows jsonb; after_rows jsonb; actor uuid:=auth.uid(); snap jsonb; payload jsonb;
begin
 select source_id into qid from publish_docs;
 select jsonb_build_object('id',id,'title',title,'prompt',prompt,'fields',fields,'rowMode',row_mode,'maxRows',max_rows,'minRows',min_rows,'rowLabels',row_labels,'sourceBlockId',source_block_id,'sourceFieldId',source_field_id,'afterBlockId',after_block_id,'condition',condition),revision into q,rev from public.questions where id=qid;
 initial_field:=q#>>'{fields,0,id}';
 before_rows:=pg_temp.saved_guide_rows(qid);
 if before_rows is null or jsonb_array_length(before_rows)<>2 then raise exception 'Missing fixture answers'; end if;
 q:=jsonb_set(q,'{prompt}','"질문 본문만 변경"');
 perform public.save_question(q,rev,gen_random_uuid());rev:=rev+1;
 after_rows:=pg_temp.saved_guide_rows(qid);
 if before_rows<>after_rows then raise exception 'Prompt edit lost answers'; end if;
 q:=jsonb_set(q,'{fields}',q->'fields'||jsonb_build_array(jsonb_build_object('id',new_field,'label','추가','kind','text')));
 perform public.save_question(q,rev,gen_random_uuid());rev:=rev+1;
 after_rows:=pg_temp.saved_guide_rows(qid);
 if before_rows<>after_rows then raise exception 'Addition lost answers'; end if;
 perform set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
 snap:=public.read_question_response_session((select (doc->>'questionnaireId')::uuid from publish_docs));
 if (snap#>>'{questions,0,needsReview}')::boolean then raise exception 'Addition requires full rewrite'; end if;
 select jsonb_agg(x||jsonb_build_object('answers',x->'answers'||jsonb_build_object(new_field,'유지할 답변'))) into payload from jsonb_array_elements(before_rows) x;
 perform public.save_question_response_session((select (doc->>'questionnaireId')::uuid from publish_docs),jsonb_build_object(qid::text,payload),(snap->>'revision')::int,gen_random_uuid(),false,snap->>'definitionToken');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 q:=jsonb_set(q,'{fields,0,kind}','"scale"') ;
 q:=jsonb_set(q,'{fields,0,scaleMax}','5');
 begin perform public.save_question(q,rev,gen_random_uuid());raise exception 'Destructive edit bypassed confirmation';exception when sqlstate 'PGA01' then null;end;
 if not (public.guide_answer_field_ids(qid) @> jsonb_build_array(initial_field,new_field)) then raise exception 'Incorrect occupied fields'; end if;
 perform public.save_question(q||jsonb_build_object('confirmedGuideAnswerFields',jsonb_build_array(initial_field)),rev,gen_random_uuid());rev:=rev+1;
 after_rows:=pg_temp.saved_guide_rows(qid);
 if exists(select 1 from jsonb_array_elements(after_rows) x where x->'answers' ? initial_field) then raise exception 'Type change retained answers'; end if;
 if jsonb_array_length(before_rows)<>jsonb_array_length(after_rows) then raise exception 'Rows lost'; end if;
 if exists(select 1 from jsonb_array_elements(after_rows) x where x->'answers'->>new_field is distinct from '유지할 답변') then raise exception 'Unrelated answer deleted'; end if;
 -- Deleting the other occupied field also requires confirmation.
 q:=jsonb_set(q,'{fields}',jsonb_build_array(q#>'{fields,0}'));
 begin perform public.save_question(q,rev,gen_random_uuid());raise exception 'Deletion bypassed confirmation';exception when sqlstate 'PGA01' then null;end;
 perform public.save_question(q||jsonb_build_object('confirmedGuideAnswerFields',jsonb_build_array(new_field)),rev,gen_random_uuid());
 if public.guide_answer_field_ids(qid)<>'[]' then raise exception 'Deleted field answer remains'; end if;
end $$;
reset role;
rollback;
