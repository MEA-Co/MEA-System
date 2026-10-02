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


-- A second questionnaire places the same source question.
create temporary table second_review_doc(doc jsonb);
grant all on second_review_doc to authenticated;
do $$ declare d jsonb; begin
 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','두 번째 질문지','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','내용','details','[]'::jsonb,'sourceQuestionId',(select source_id from publish_docs))))));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 perform public.change_questionnaire_status((d->>'versionId')::uuid,1,'draft',null,'published',gen_random_uuid());
 insert into second_review_doc values(d);
end $$;
reset role;
-- Administrator owns a questionnaire containing another creator's question.
update public.questionnaires set created_by=(select id from publish_users where role='admin') where id=(select (doc->>'questionnaireId')::uuid from second_review_doc);
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='admin'),true);
set local role authenticated;
do $$ declare qid uuid; vid uuid; begin
 select source_id into qid from publish_docs;
 select (doc->>'versionId')::uuid into vid from second_review_doc;
 if not public.can_request_question_review(qid,vid) then raise exception 'Non-source questionnaire owner blocked'; end if;
 begin
 perform public.request_question_review(gen_random_uuid(),qid,vid,'관리자 질문지에서 타인 원본 검토');
 raise exception 'rollback test insert' using errcode='P0002';
 exception when no_data_found then null; end;
 if jsonb_array_length(public.unread_question_review_ids(qid))<>0 then raise exception 'Questionnaire owner received source notification'; end if;
end $$;
reset role;
create temporary table review_fixture(id uuid default gen_random_uuid());
insert into review_fixture default values;
grant select on review_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ declare qid uuid; vid uuid; rid uuid; payload jsonb; begin
 select source_id,(doc->>'versionId')::uuid into qid,vid from publish_docs;
 select id into rid from review_fixture;
 perform public.request_question_review(rid,qid,vid,'검토해 주세요');
 perform public.request_question_review(rid,qid,vid,'검토해 주세요');
 perform public.mark_question_reviews_read(qid,array[rid]);
 if exists(select 1 from public.question_review_reads) then raise exception 'Requester marked creator receipt'; end if;
 payload:=public.read_question_reviews(qid);
 if jsonb_array_length(public.question_review_counts())<>2 then raise exception 'Shared question missing from questionnaire counts'; end if;
 if jsonb_array_length(payload->'reviews')<>1 or (payload->>'canResolve')::boolean then raise exception 'Review read/idempotency failure'; end if;
 begin perform public.resolve_question_review(rid,qid); raise exception 'Other lead resolved'; exception when insufficient_privilege then null; end;
 begin update public.question_review_requests set resolved_at=now() where id=rid; raise exception 'Direct write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.question_review_requests) then raise exception 'Consultant read leaked'; end if;
 begin perform public.read_question_reviews((select source_id from publish_docs)); raise exception 'Consultant RPC leaked'; exception when insufficient_privilege then null; end;
 begin perform public.request_question_review(gen_random_uuid(),(select source_id from publish_docs),null,'금지'); raise exception 'Consultant write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare qid uuid; rid uuid; begin
 select source_id into qid from publish_docs; select id into rid from review_fixture;
 if jsonb_array_length(public.unread_question_review_ids(qid))<>1 then raise exception 'Owner unread missing'; end if;
 perform public.mark_question_reviews_read(qid,array[rid]);
 perform public.mark_question_reviews_read(qid,array[rid]);
 if jsonb_array_length(public.unread_question_review_ids(qid))<>0 then raise exception 'Read receipt not applied'; end if;
 if exists(select 1 from public.question_review_requests where id=rid and resolved_at is not null) then raise exception 'Reading resolved review'; end if;
 if exists(select 1 from jsonb_array_elements(public.question_review_counts()) c where (c->>'unread_count')::integer<>0 or (c->>'count')::integer<>1) then raise exception 'Shared unread counts wrong'; end if;
 -- A later request must become unread even after the earlier one was seen.
 perform set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
 perform public.request_question_review('10000000-0000-4000-8000-000000000002',qid,(select (doc->>'versionId')::uuid from second_review_doc),'새 요청');
 perform set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
 if jsonb_array_length(public.unread_question_review_ids(qid))<>1 then raise exception 'Later request did not become unread'; end if;
 perform public.resolve_question_review('10000000-0000-4000-8000-000000000002',qid);
 if (public.read_question_reviews(qid)->>'canRequest')::boolean then raise exception 'Owner request enabled'; end if;
 begin perform public.request_question_review(gen_random_uuid(),qid,(select (doc->>'versionId')::uuid from publish_docs),'자기 검토'); raise exception 'Owner wrote review'; exception when insufficient_privilege then null; end;
 begin perform public.request_question_review(gen_random_uuid(),qid,null,'출처 생략'); raise exception 'Owner bypassed origin'; exception when insufficient_privilege then null; end;
 if not(public.read_question_reviews(qid)->>'canResolve')::boolean then raise exception 'Owner resolve flag absent'; end if;
 perform public.resolve_question_review(rid,qid);
 if not exists(select 1 from public.question_review_requests where id=rid and resolved_by=auth.uid() and resolved_at is not null) then raise exception 'Resolution missing'; end if;
end $$;
select public.delete_questionnaire((select (doc->>'versionId')::uuid from publish_docs),2);
do $$ begin
 if not exists(select 1 from public.question_review_requests where origin_version_id is null) then raise exception 'Questionnaire deletion removed review'; end if;
 if (public.read_question_reviews((select source_id from publish_docs))->>'canRequest')::boolean then raise exception 'Owner request flag enabled'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='admin'),true);
set local role authenticated;
select public.delete_questionnaire((select (doc->>'versionId')::uuid from second_review_doc),2);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$ begin
 if (public.read_question_reviews((select source_id from publish_docs))->>'canRequest')::boolean then raise exception 'Unpublished request allowed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ begin
 if jsonb_array_length(public.read_question_reviews((select source_id from publish_docs))->'reviews')<>2 then raise exception 'Requester lost review'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.read_question_reviews(null); raise exception 'Anonymous access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
