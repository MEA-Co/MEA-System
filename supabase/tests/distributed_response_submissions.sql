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


-- A guide can keep a published example and a separate private distribution draft.
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare qid uuid:=(select (doc->>'questionnaireId')::uuid from publish_docs); x jsonb; payload jsonb; begin
 x:=public.open_question_response_session(qid);
 payload:=jsonb_build_object(x#>>'{questions,0,questionId}',jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(x#>>'{questions,0,definition,fields,0,id}','공개 가이드'))));
 perform public.save_question_response_session(qid,payload,0,gen_random_uuid(),false,x->>'definitionToken');
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;

-- A published-only guide is not available to ordinary consultants.
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 if public.read_guide_answers(array[(select source_id from publish_docs)]) <> '{}'::jsonb then raise exception 'Published-only guide leaked'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;

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


-- A consultant draft is private, submission publishes a separate copy, editing stays enabled.
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
create temp table submitted_fixture(sid uuid, payload jsonb, submission_id uuid, token text);
grant all on submitted_fixture to authenticated;
do $$ declare qid uuid:=(select (doc->>'questionnaireId')::uuid from publish_docs); x jsonb; payload jsonb; fid text; source text; rid uuid; begin
 x:=public.open_distributed_question_response_session(qid);
 if x->>'stage'<>'distributed' or x::text like '%비공개 비밀%' then raise exception 'Invalid source definition or private explanation exposed'; end if;
 if exists(select 1 from public.unread_distributed_questionnaires() where questionnaire_id=qid) then raise exception 'NEW not cleared'; end if;
 source:=x#>>'{questions,0,questionId}';fid:=x#>>'{questions,0,definition,fields,0,id}';
 payload:=jsonb_build_object(source,jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(fid,'최초 제출 답변')),jsonb_build_object('id',2,'answers',jsonb_build_object(fid,'둘째 답변'))));
 x:=public.save_distributed_question_response_session(qid,payload,(x->>'revision')::int,gen_random_uuid(),false,x->>'definitionToken');
 if x->>'status'<>'in_progress' or x->>'submittedAt' is not null then raise exception 'Draft marked submitted'; end if;
 if exists(select 1 from public.response_submissions where session_id=(x->>'id')::uuid) then raise exception 'Draft published'; end if;
 insert into submitted_fixture values((x->>'id')::uuid,payload,gen_random_uuid(),x->>'definitionToken');
 begin perform public.list_submitted_questionnaire_responses(qid);raise exception 'Consultant read staff submissions';exception when insufficient_privilege then null;end;
 begin perform public.save_distributed_question_response_session(qid,payload,0,gen_random_uuid(),true,x->>'definitionToken');raise exception 'Stale save accepted';exception when serialization_failure then null;end;
 begin perform public.save_distributed_question_response_session(qid,'{}',(x->>'revision')::int,gen_random_uuid(),true,x->>'definitionToken');raise exception 'Incomplete submission accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ begin
 if public.list_submitted_questionnaire_responses((select (doc->>'questionnaireId')::uuid from publish_docs))<>'[]' then raise exception 'Unsubmitted response leaked';end if;
 if exists(select 1 from public.question_responses where session_id=(select sid from submitted_fixture)) or exists(select 1 from public.response_sessions where id=(select sid from submitted_fixture)) then raise exception 'Draft RLS leaked to lead';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ declare qid uuid:=(select (doc->>'questionnaireId')::uuid from publish_docs);x jsonb; again jsonb; f record; begin
 select * into f from submitted_fixture;
 x:=public.read_distributed_question_response_session(qid);
 x:=public.save_distributed_question_response_session(qid,f.payload,(x->>'revision')::int,f.submission_id,true,f.token);
 again:=public.save_distributed_question_response_session(qid,f.payload,1,f.submission_id,true,f.token);
 if x<>again or x->>'status'<>'submitted' or x->>'submittedAt' is null then raise exception 'Submission retry failed';end if;
 update submitted_fixture set payload=replace(payload::text,'최초 제출 답변','비공개 수정 답변')::jsonb;
 x:=public.save_distributed_question_response_session(qid,(select payload from submitted_fixture),(x->>'revision')::int,gen_random_uuid(),false,f.token);
 if x->>'status'<>'submitted' or not (x->>'hasUnsubmittedChanges')::boolean or x::text not like '%비공개 수정 답변%' then raise exception 'Submitted answer not editable';end if;
 if (select answers::text from public.response_submissions where session_id=f.sid) like '%비공개 수정 답변%' then raise exception 'Private edit published';end if;
 begin update public.response_submissions set answers='{}' where session_id=f.sid;raise exception 'Direct submission write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare x jsonb; qid uuid:=(select (doc->>'questionnaireId')::uuid from publish_docs); begin
 x:=public.list_submitted_questionnaire_responses(qid);
 if jsonb_array_length(x)<>1 or x::text not like '%최초 제출 답변%' or x::text like '%비공개 수정 답변%' or x::text like '%비공개 비밀%' then raise exception 'Last submission isolation failed';end if;
 begin perform public.read_distributed_question_response_session(qid);raise exception 'Foreign draft read';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ declare qid uuid:=(select (doc->>'questionnaireId')::uuid from publish_docs);x jsonb; begin
 x:=public.read_distributed_question_response_session(qid);
 perform public.save_distributed_question_response_session(qid,(select payload from submitted_fixture),(x->>'revision')::int,gen_random_uuid(),true,x->>'definitionToken');
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare qid uuid:=(select (doc->>'questionnaireId')::uuid from publish_docs);x jsonb; begin
 x:=public.list_submitted_questionnaire_responses(qid);
 if x::text not like '%비공개 수정 답변%' or x::text like '%최초 제출 답변%' then raise exception 'Resubmission failed';end if;
 begin perform public.change_questionnaire_status(qid,3,'distributed',null,'published',gen_random_uuid());raise exception 'Answered distribution withdrawn';exception when object_not_in_prerequisite_state then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.list_submitted_questionnaire_responses(gen_random_uuid());raise exception 'Anon submissions read';exception when insufficient_privilege then null;end;
end $$;
reset role;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare qid uuid:=(select (doc->>'questionnaireId')::uuid from publish_docs);x jsonb;payload jsonb;begin
 if not exists(select 1 from public.unread_distributed_questionnaires() where questionnaire_id=qid) then raise exception 'Guide session cleared distribution NEW';end if;
 x:=public.open_distributed_question_response_session(qid);
 payload:=jsonb_build_object(x#>>'{questions,0,questionId}',jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(x#>>'{questions,0,definition,fields,0,id}','가이드 계정 비공개 초안'))));
 perform public.save_distributed_question_response_session(qid,payload,0,gen_random_uuid(),false,x->>'definitionToken');
 if (select count(*) from public.response_sessions where origin_questionnaire_id=qid)<>2 then raise exception 'Guide and distribution sessions mixed';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare x jsonb;begin
 x:=public.read_guide_answers(array[(select source_id from publish_docs)]);
 if x::text not like '%공개 가이드%' or x::text like '%가이드 계정 비공개 초안%' then raise exception 'Private distribution draft leaked as guide';end if;
end $$;
reset role;
-- Unrelated consultants cannot read another consultant's private or submitted rows.
create temp table outside_user as select gen_random_uuid() id;
insert into auth.users(id) select id from outside_user;
insert into public.profiles(id,role,name) select id,'consultant','다른 컨설턴트' from outside_user;
select set_config('request.jwt.claim.sub',(select id::text from outside_user),true);
set local role authenticated;
do $$ begin
 begin
  perform public.distributed_submission_counts();
  raise exception 'Consultant accessed staff counts';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.response_submissions) or exists(select 1 from public.question_responses) or exists(select 1 from public.response_sessions) then raise exception 'Other consultant response leaked';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='admin'),true);
set local role authenticated;
do $$ begin
 if (select count from public.distributed_submission_counts() where questionnaire_id=(select (doc->>'questionnaireId')::uuid from publish_docs)) is distinct from 1::bigint then
   raise exception 'Submission count must exclude drafts and count resubmission once';
 end if;
end $$;
reset role;
-- Consultants see only published guide work on active distributions.
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ declare x jsonb; begin
 x:=public.read_guide_answers(array[(select source_id from publish_docs)]);
 if x::text not like '%공개 가이드%' or x::text like '%가이드 계정 비공개 초안%' then raise exception 'Consultant guide visibility incorrect'; end if;
end $$;
reset role;
-- Guide-linked activity and report reads must not expose unrelated activities.
reset role;
create temp table guide_activity_fixture as
select gen_random_uuid() id, (select id from publish_users where role='other_lead') owner_id;
grant select on guide_activity_fixture to authenticated;
insert into public.exploration(id,owner_id,values,save_id,reports)
select id,owner_id,'{"topic":"공개 첨부 활동"}',gen_random_uuid(),jsonb_build_array(jsonb_build_object('path',owner_id||'/'||id||'/report.pdf')) from guide_activity_fixture;
insert into public.exploration(id,owner_id,values,save_id)
select gen_random_uuid(),owner_id,'{"topic":"참조 없는 활동"}',gen_random_uuid() from guide_activity_fixture;
insert into storage.objects(bucket_id,name,owner_id)
select 'exploration-reports',owner_id||'/'||id||'/report.pdf',owner_id::text from guide_activity_fixture;
insert into storage.objects(bucket_id,name,owner_id)
select 'exploration-reports',owner_id||'/'||id||'/unattached.pdf',owner_id::text from guide_activity_fixture;
create temp table original_guide_rows as
select r.id,r.rows from public.question_responses r join public.response_sessions s on s.id=r.session_id
where s.respondent_id=(select owner_id from guide_activity_fixture) and s.started_stage='published' and r.question_id=(select source_id from publish_docs);
update public.question_responses r set rows=jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(
 (select fields->0->>'id' from public.questions where id=r.question_id),
 '::mea-rich-text:v1::'||jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','@공개 첨부 활동','marks',jsonb_build_array(jsonb_build_object('type','explorationReference','attrs',jsonb_build_object('id',(select id from guide_activity_fixture)))))))))::text
))) where r.id in (select id from original_guide_rows);
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.exploration where id=(select id from guide_activity_fixture)) then raise exception 'Guide attachment not readable'; end if;
 if exists(select 1 from public.exploration where owner_id=(select owner_id from guide_activity_fixture) and id<>(select id from guide_activity_fixture)) then raise exception 'Unrelated activity leaked'; end if;
 if not exists(select 1 from storage.objects where bucket_id='exploration-reports' and name=(select owner_id||'/'||id||'/report.pdf' from guide_activity_fixture)) then raise exception 'Guide report not readable'; end if;
 if exists(select 1 from storage.objects where bucket_id='exploration-reports' and name=(select owner_id||'/'||id||'/unattached.pdf' from guide_activity_fixture)) then raise exception 'Unattached report leaked'; end if;
 begin
  perform public.delete_exploration((select id from guide_activity_fixture),1);
  raise exception 'Guide activity deletion allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Removing the link immediately revokes reads without modifying the activity.
update public.question_responses r set rows=o.rows from original_guide_rows o where r.id=o.id;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.exploration where id=(select id from guide_activity_fixture)) then raise exception 'Removed reference remained readable'; end if;
 if exists(select 1 from storage.objects where name=(select owner_id||'/'||id||'/report.pdf' from guide_activity_fixture)) then raise exception 'Removed reference report remained readable'; end if;
end $$;
reset role;
-- Guide-linked activity and report reads must not expose unrelated activities.
reset role;
create temp table guide_study_fixture as
select gen_random_uuid() id, (select id from publish_users where role='other_lead') owner_id;
grant select on guide_study_fixture to authenticated;
insert into public.study(id,owner_id,values,save_id,reports)
select id,owner_id,'{"strategy":"공개 첨부 활동"}',gen_random_uuid(),jsonb_build_array(jsonb_build_object('path',owner_id||'/'||id||'/report.pdf')) from guide_study_fixture;
insert into public.study(id,owner_id,values,save_id)
select gen_random_uuid(),owner_id,'{"strategy":"참조 없는 활동"}',gen_random_uuid() from guide_study_fixture;
insert into storage.objects(bucket_id,name,owner_id)
select 'study-reports',owner_id||'/'||id||'/report.pdf',owner_id::text from guide_study_fixture;
insert into storage.objects(bucket_id,name,owner_id)
select 'study-reports',owner_id||'/'||id||'/unattached.pdf',owner_id::text from guide_study_fixture;
create temp table original_study_guide_rows as
select r.id,r.rows from public.question_responses r join public.response_sessions s on s.id=r.session_id
where s.respondent_id=(select owner_id from guide_study_fixture) and s.started_stage='published' and r.question_id=(select source_id from publish_docs);
update public.question_responses r set rows=jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(
 (select fields->0->>'id' from public.questions where id=r.question_id),
 '::mea-rich-text:v1::'||jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','@공개 첨부 활동','marks',jsonb_build_array(jsonb_build_object('type','studyReference','attrs',jsonb_build_object('id',(select id from guide_study_fixture)))))))))::text
))) where r.id in (select id from original_study_guide_rows);
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.study where id=(select id from guide_study_fixture)) then raise exception 'Guide attachment not readable'; end if;
 if exists(select 1 from public.study where owner_id=(select owner_id from guide_study_fixture) and id<>(select id from guide_study_fixture)) then raise exception 'Unrelated activity leaked'; end if;
 if not exists(select 1 from storage.objects where bucket_id='study-reports' and name=(select owner_id||'/'||id||'/report.pdf' from guide_study_fixture)) then raise exception 'Guide report not readable'; end if;
 if exists(select 1 from storage.objects where bucket_id='study-reports' and name=(select owner_id||'/'||id||'/unattached.pdf' from guide_study_fixture)) then raise exception 'Unattached report leaked'; end if;
 begin
  perform public.delete_study((select id from guide_study_fixture),1);
  raise exception 'Guide activity deletion allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Removing the link immediately revokes reads without modifying the activity.
update public.question_responses r set rows=o.rows from original_study_guide_rows o where r.id=o.id;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.study where id=(select id from guide_study_fixture)) then raise exception 'Removed reference remained readable'; end if;
 if exists(select 1 from storage.objects where name=(select owner_id||'/'||id||'/report.pdf' from guide_study_fixture)) then raise exception 'Removed reference report remained readable'; end if;
end $$;
reset role;
-- Exercise archive/restore through the same RPC as the status menu.
create temporary table archive_snapshot as
 select id, to_jsonb(s) value from public.response_sessions s
 where origin_questionnaire_id=(select (doc->>'questionnaireId')::uuid from publish_docs);
create temporary table archive_answers as
 select r.id,to_jsonb(r) value from public.question_responses r
 where session_id in(select id from archive_snapshot);
create temporary table archive_submissions as
 select session_id,to_jsonb(r) value from public.response_submissions r
 where session_id in(select id from archive_snapshot);
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare q public.questionnaires%rowtype; begin
 select * into q from public.questionnaires where id=(select (doc->>'questionnaireId')::uuid from publish_docs);
 perform public.change_questionnaire_status(q.id,q.revision,q.status,null,'archived',gen_random_uuid());
 if not exists(select 1 from public.questionnaires where id=q.id and archived_at is not null and status='distributed') then raise exception 'Archive failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
do $$ declare qid uuid:=(select (doc->>'questionnaireId')::uuid from publish_docs); begin
 if exists(select 1 from public.questionnaires where id=qid) then raise exception 'Archived questionnaire visible'; end if;
 begin perform public.read_published_question_sources(qid); raise exception 'Archived sources readable'; exception when insufficient_privilege then null; end;
 begin perform public.open_distributed_question_response_session(qid); raise exception 'Archived session opened'; exception when insufficient_privilege then null; end;
 begin perform public.read_distributed_question_response_session(qid); raise exception 'Archived session readable'; exception when insufficient_privilege then null; end;
 begin perform public.save_distributed_question_response_session(qid,'{}',0,gen_random_uuid(),false,null); raise exception 'Archived save accepted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
do $$ declare q public.questionnaires%rowtype; begin
 select * into q from public.questionnaires where id=(select (doc->>'questionnaireId')::uuid from publish_docs);
 perform public.change_questionnaire_status(q.id,q.revision,q.status,q.archived_at,q.status,gen_random_uuid());
 if not exists(select 1 from public.questions where id=(select source_id from publish_docs) and distribution_locked_at is not null) then raise exception 'Archive removed source lock'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
do $$ begin
 perform public.read_distributed_question_response_session((select (doc->>'questionnaireId')::uuid from publish_docs));
 if not exists(select 1 from public.questionnaires where id=(select (doc->>'questionnaireId')::uuid from publish_docs)) then raise exception 'Restored questionnaire hidden'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from archive_snapshot a left join public.response_sessions s on s.id=a.id where to_jsonb(s) is distinct from a.value)
 or exists(select 1 from archive_answers a left join public.question_responses r on r.id=a.id where to_jsonb(r) is distinct from a.value)
 or exists(select 1 from archive_submissions a left join public.response_submissions r on r.session_id=a.session_id where to_jsonb(r) is distinct from a.value)
 then raise exception 'Archive/restore changed responses'; end if;
end $$;
update public.questionnaires set archived_at=now() where id in (select (doc->>'questionnaireId')::uuid from publish_docs union all select (doc->>'questionnaireId')::uuid from second_review_doc);
set local role authenticated;
do $$ begin
 if public.read_guide_answers(array[(select source_id from publish_docs)]) <> '{}'::jsonb then raise exception 'Archived guide leaked'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $$ begin
 begin
  perform public.read_guide_answers(array[(select source_id from publish_docs)]);
  raise exception 'Unauthenticated guide read accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
