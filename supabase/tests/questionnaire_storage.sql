begin;
create temporary table questionnaire_test_users(id uuid, role text);
insert into questionnaire_test_users select gen_random_uuid(), role from unnest(array['student','consultant','consultant_lead','admin']) role;
insert into auth.users(id) select id from questionnaire_test_users;
insert into public.profiles(id,role,name,student_period)
select id,role,'질문지 저장 검증',case when role='student' then '1학년 1학기' end from questionnaire_test_users;
create temporary table questionnaire_test_data(document jsonb, save_id uuid);
insert into questionnaire_test_data values(jsonb_build_object(
  'questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','검증 질문지',
  'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션',
    'questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'kind','text','options','[]'::jsonb,'text','질문',
      'details',jsonb_build_array(
        jsonb_build_object('id',gen_random_uuid(),'title','공개 의도','text','공개 설명','visibleToConsultants',true),
        jsonb_build_object('id',gen_random_uuid(),'title','비공개 의도','text','비공개 설명','visibleToConsultants',false)
      )))))),gen_random_uuid());
grant select on questionnaire_test_users, questionnaire_test_data to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_test_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare doc jsonb; sid uuid; result jsonb; loaded jsonb;
begin
  select document,save_id into doc,sid from questionnaire_test_data;
  result := public.save_questionnaire_draft(doc,0,sid);
  if (result->>'revision')::int <> 1 then raise exception 'First save revision failed'; end if;
  if public.save_questionnaire_draft(doc,0,sid) <> result then raise exception 'Idempotent retry changed revision/time'; end if;
  loaded := public.read_questionnaire_draft((doc->>'versionId')::uuid);
  if loaded - 'revision' - 'savedAt' <> doc then raise exception 'Round trip changed IDs or content'; end if;
  begin
    perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
    raise exception 'Stale revision was accepted';
  exception when serialization_failure then null; end;
  begin
    update public.questionnaire_questions set body='Direct write' where id=(doc#>>'{sections,0,questions,0,id}')::uuid;
    raise exception 'Direct writes must be denied';
  exception when insufficient_privilege then null; end;
  -- Changing content preserves question IDs, prunes a removed explanation, and saves visibility.
  doc := jsonb_set(doc,'{sections,0,questions,0,text}','"수정 질문"');
  doc := jsonb_set(doc,'{sections,0,questions,0,details}',jsonb_build_array(doc#>'{sections,0,questions,0,details,1}'));
  result := public.save_questionnaire_draft(doc,1,gen_random_uuid());
  if (result->>'revision')::int <> 2 then raise exception 'Second save failed'; end if;
  if public.read_questionnaire_draft((doc->>'versionId')::uuid) - 'revision' - 'savedAt' <> doc then raise exception 'Update/prune failed'; end if;
  -- Re-add original details, then test malformed/duplicate IDs roll back everything.
  select document into doc from questionnaire_test_data;
  perform public.save_questionnaire_draft(doc,2,gen_random_uuid());
  begin
    perform public.save_questionnaire_draft(jsonb_set(doc,'{sections}',(doc->'sections') || (doc->'sections')),3,gen_random_uuid());
    raise exception 'Duplicate IDs were accepted';
  exception when invalid_parameter_value then null; end;
  if (public.read_questionnaire_draft((doc->>'versionId')::uuid)->>'revision')::int <> 3 then raise exception 'Failure was not atomic'; end if;
end $$;
reset role;
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_test_users where role='consultant'),true);
set local role authenticated;
do $$
declare doc jsonb;
begin
  select document into doc from questionnaire_test_data;
  if public.read_questionnaire_draft((doc->>'versionId')::uuid) is not null then raise exception 'Consultant read draft'; end if;
  if exists(select 1 from public.questionnaire_question_details where question_id=(doc#>>'{sections,0,questions,0,id}')::uuid) then raise exception 'Unassigned consultant read details'; end if;
  begin
    perform public.save_questionnaire_draft(doc,3,gen_random_uuid());
    raise exception 'Consultant wrote draft';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_test_users where role='admin'),true);
set local role authenticated;
do $$ begin
  begin
    perform public.save_questionnaire_draft((select document from questionnaire_test_data),3,gen_random_uuid());
    raise exception 'Non-owner edited draft';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Simulate future publication/assignment without exposing client mutation paths.
update public.questionnaire_versions set status='distributed',published_at=now(),distributed_at=now()
where id=(select (document->>'versionId')::uuid from questionnaire_test_data);
insert into public.questionnaire_responses(version_id,respondent_id,assigned_by)
select (document->>'versionId')::uuid,(select id from questionnaire_test_users where role='consultant'),(select id from questionnaire_test_users where role='admin') from questionnaire_test_data;
insert into public.questionnaire_answers(response_id,version_id,question_id,body)
select r.id,r.version_id,(d.document#>>'{sections,0,questions,0,id}')::uuid,'답변' from public.questionnaire_responses r
join questionnaire_test_data d on r.version_id=(d.document->>'versionId')::uuid;
do $$ begin
  begin
    update public.questionnaire_questions set body='배포 후 수정' where id=(select (document#>>'{sections,0,questions,0,id}')::uuid from questionnaire_test_data);
    raise exception 'Published content changed';
  exception when sqlstate '55000' then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_test_users where role='consultant'),true);
set local role authenticated;
do $$
declare qid uuid;
begin
  select (document#>>'{sections,0,questions,0,id}')::uuid into qid from questionnaire_test_data;
  if (select count(*) from public.questionnaire_questions where id=qid) <> 1 then raise exception 'Consultant cannot read distributed question'; end if;
  if (select count(*) from public.questionnaire_question_details where question_id=qid) <> 1 then raise exception 'Consultant public explanation visibility failed'; end if;
  if exists(select 1 from public.questionnaire_question_details where question_id=qid and not visible_to_consultants) then raise exception 'Private explanation leaked'; end if;
  if (select count(*) from public.questionnaire_answers where question_id=qid) <> 1 then raise exception 'Own answer missing'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_test_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare doc jsonb;
begin
  select document into doc from questionnaire_test_data;
  if (select count(*) from public.questionnaire_question_details where question_id=(doc#>>'{sections,0,questions,0,id}')::uuid) <> 2 then raise exception 'Lead cannot read all explanations'; end if;
  if exists(select 1 from public.questionnaire_answers where question_id=(doc#>>'{sections,0,questions,0,id}')::uuid) then raise exception 'Other users answer leaked'; end if;
  begin
    perform public.save_questionnaire_draft(doc,4,gen_random_uuid());
    raise exception 'Published save accepted';
  exception when sqlstate '55000' then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_test_users where role='student'),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.questionnaire_questions where id=(select (document#>>'{sections,0,questions,0,id}')::uuid from questionnaire_test_data)) then raise exception 'Student read questions'; end if;
  begin
    perform public.save_questionnaire_draft((select document from questionnaire_test_data),4,gen_random_uuid());
    raise exception 'Student wrote draft';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.save_questionnaire_draft(jsonb,integer,uuid)','execute') then raise exception 'Anonymous RPC access'; end if;
  if has_table_privilege('anon','public.questionnaire_question_details','select') then raise exception 'Anonymous explanation access'; end if;
end $$;
set constraints all immediate;
select 'Questionnaire storage and access checks passed' as result;
rollback;
