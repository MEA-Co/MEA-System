-- Synthetic document IDs only. The configured guide is used only on fixture
-- origins; no guide function, profile or existing guide response is modified.
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';
set local idle_in_transaction_session_timeout = '10s';
create temporary table registration_users as
  select gen_random_uuid() id,role from unnest(array['consultant_lead','consultant','admin']) role;
insert into auth.users(id) select id from registration_users;
insert into public.profiles(id,role,name) select id,role,'학습법 등록 카드 검증' from registration_users;
grant select on registration_users to authenticated;
create temporary table registration_docs(name text primary key,doc jsonb,questionnaire_id uuid);
grant select,insert,update on registration_docs to authenticated;
create temporary table registration_guide_baseline as
  select md5(pg_get_functiondef('private.guide_consultant_id()'::regprocedure)) hash;

select set_config('request.jwt.claim.sub',(select id::text from registration_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare card jsonb; regular jsonb; invalid jsonb; result jsonb; retry uuid:=gen_random_uuid(); d jsonb; card_id uuid:=gen_random_uuid();
begin
  card:=jsonb_build_object('id',card_id,'title','학습법 등록 안내','prompt','활용한 학습법을 등록해 주세요.',
    'purpose','study_registration','buttonLabel','  학습법 등록하기  ','fields','[]'::jsonb,
    'rowMode','single','maxRows',null,'minRows',1,'initialRows',1,'answerLayout','cards','rowLabels','[]'::jsonb,
    'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
  result:=public.save_question(card,0,retry);
  if result->>'purpose' is distinct from 'study_registration'
    or result->>'button_label' is distinct from '학습법 등록하기'
    or result->'fields' is distinct from '[]'::jsonb then raise exception 'Registration settings not saved'; end if;
  if public.save_question(card,0,retry) is distinct from result then raise exception 'Registration retry changed identity'; end if;
  card:=card||jsonb_build_object('buttonLabel','학습법 추가하기','prompt','학습법 관리에 새 학습법을 등록해 주세요.');
  result:=public.save_question(card,1,gen_random_uuid());
  if result->>'button_label' is distinct from '학습법 추가하기' or result->>'id' is distinct from card_id::text then
    raise exception 'Editable registration content lost its identity';
  end if;
  regular:=jsonb_build_object('id',gen_random_uuid(),'title','일반 답변','prompt','등록한 학습법의 활용 경험을 적어 주세요.',
    'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','활용 경험','kind','text')),
    'rowMode','single','maxRows',null,'minRows',1,'initialRows',1,'answerLayout','cards','rowLabels','[]'::jsonb,
    'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
  result:=public.save_question(regular,0,gen_random_uuid());
  if result->>'purpose' is distinct from 'response' or result->>'button_label' is distinct from '학습법 추가' then
    raise exception 'Existing response defaults changed';
  end if;
  begin
    perform public.save_question(card||jsonb_build_object('purpose','response','fields',regular->'fields'),2,gen_random_uuid());
    raise exception 'Saved card converted to a response';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%Question purpose is immutable%' then raise; end if;
  end;
  begin
    perform public.save_question(regular||jsonb_build_object('purpose','study_registration','fields','[]'::jsonb),1,gen_random_uuid());
    raise exception 'Saved response converted to a card';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%Question purpose is immutable%' then raise; end if;
  end;

  for invalid in select value from jsonb_array_elements(jsonb_build_array(
    card||jsonb_build_object('fields',regular->'fields'),
    card||jsonb_build_object('answerLayout','table'),
    card||jsonb_build_object('rowMode','repeatable','maxRows',5,'initialRows',2),
    card||jsonb_build_object('rowLabels',jsonb_build_array('불필요한 행')),
    card||jsonb_build_object('buttonLabel','   '),
    card||jsonb_build_object('buttonLabel',repeat('가',101)),
    card||jsonb_build_object('purpose','unknown'),
    regular||jsonb_build_object('fields','[]'::jsonb),
    card||jsonb_build_object('condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(
      jsonb_build_object('blockId',regular->'id','op','answered'))))
  )) loop
    begin
      perform public.save_question(invalid||jsonb_build_object('id',gen_random_uuid()),0,gen_random_uuid());
      raise exception 'Invalid registration/response configuration accepted';
    exception when invalid_parameter_value or check_violation then null;
    end;
  end loop;
  for invalid in select value from jsonb_array_elements(jsonb_build_array(
    regular||jsonb_build_object('afterBlockId',card_id),
    regular||jsonb_build_object('condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(
      jsonb_build_object('blockId',card_id,'op','answered')))),
    regular||jsonb_build_object('rowMode','reference','sourceBlockId',card_id,
      'condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(
        jsonb_build_object('blockId',card_id,'op','answered'))))
  )) loop
    begin
      perform public.save_question(invalid||jsonb_build_object('id',gen_random_uuid()),0,gen_random_uuid());
      raise exception 'Registration card used as an answer dependency';
    exception when invalid_parameter_value then
      if sqlerrm not like '%Study registration cards cannot be answer dependencies%' then raise; end if;
    end;
  end loop;
  insert into registration_docs values('card',card,null),('regular',regular,null);
  d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','등록 안내와 질문',
    'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','학습법',
      'questions',jsonb_build_array(
        jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',card->'id','text',card->'prompt','details','[]'::jsonb),
        jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',regular->'id','text',regular->'prompt','details','[]'::jsonb)))));
  perform public.save_questionnaire_draft(d,0,gen_random_uuid());
  perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
  result:=public.read_published_question_sources((d->>'questionnaireId')::uuid);
  if not exists(select 1 from jsonb_array_elements(result) q where q->>'id'=card_id::text
    and q->>'purpose'='study_registration' and q->>'button_label'='학습법 추가하기' and q->'fields'='[]'::jsonb) then
    raise exception 'Published source reader omitted registration settings';
  end if;
  begin
    perform public.open_question_response_session((d->>'questionnaireId')::uuid);
    raise exception 'Registration card bypassed designated guide restriction';
  exception when insufficient_privilege then null; end;
  insert into registration_docs values('mixed',d,(d->>'questionnaireId')::uuid);
  d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','등록 안내만',
    'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','등록',
      'questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),
        'sourceQuestionId',card->'id','text',card->'prompt','details','[]'::jsonb)))));
  perform public.save_questionnaire_draft(d,0,gen_random_uuid());
  perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
  insert into registration_docs values('only_card',d,(d->>'questionnaireId')::uuid);
end $$;
reset role;

-- Existing guide identity is unchanged; every opened origin below is a newly
-- generated fixture UUID. Never read the guide's other sessions or answers.
do $$ begin
  if not exists(select 1 from public.profiles where id=private.guide_consultant_id() and role in ('admin','consultant_lead')) then
    raise exception 'Configured guide must have an existing staff profile for published regression';
  end if;
end $$;
select set_config('request.jwt.claim.sub',private.guide_consultant_id()::text,true);
set local role authenticated;
do $$
declare mixed_id uuid:=(select questionnaire_id from registration_docs where name='mixed');
  only_id uuid:=(select questionnaire_id from registration_docs where name='only_card');
  card jsonb:=(select doc from registration_docs where name='card');
  regular jsonb:=(select doc from registration_docs where name='regular');
  x jsonb; payload jsonb;
begin
  x:=public.open_question_response_session(mixed_id);
  payload:=jsonb_build_object(card->>'id','[]'::jsonb,regular->>'id',
    jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(regular#>>'{fields,0,id}','가상 게시 가이드 답변'))));
  begin
    perform public.save_question_response_session(mixed_id,
      jsonb_set(payload,array[card->>'id'],jsonb_build_array(jsonb_build_object('id',1,'answers','{}'::jsonb))),
      0,gen_random_uuid(),false,x->>'definitionToken');
    raise exception 'Published card accepted an answer row';
  exception when invalid_parameter_value then
    if sqlerrm not like '%Study registration cards accept no answer rows%' then raise; end if;
  end;
  x:=public.save_question_response_session(mixed_id,payload,0,gen_random_uuid(),true,x->>'definitionToken');
  if not exists(select 1 from jsonb_array_elements(x->'questions') q where q->>'questionId'=card->>'id'
    and q->'rows'='[]'::jsonb and q->'activeRowIds'='[]'::jsonb and q->>'responseId' is not null) then
    raise exception 'Published card metadata disappeared or gained an answer';
  end if;
  x:=public.open_question_response_session(only_id);
  begin
    perform public.save_question_response_session(only_id,jsonb_build_object(card->>'id','[]'::jsonb),
      0,gen_random_uuid(),true,x->>'definitionToken');
    raise exception 'Card-only published questionnaire completed';
  exception when invalid_parameter_value then
    if sqlerrm not like '%Answer questions are required for completion%' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from registration_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare fixture record; card jsonb:=(select doc from registration_docs where name='card');
begin
  for fixture in select questionnaire_id from registration_docs where name in ('mixed','only_card') loop
    perform public.change_questionnaire_status(fixture.questionnaire_id,2,'published',null,'distributed',gen_random_uuid());
  end loop;
  begin
    perform public.save_question(card||jsonb_build_object('buttonLabel','배포 후 변경'),2,gen_random_uuid());
    raise exception 'Distributed registration card was editable';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%Distributed question is immutable%' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from registration_users where role='consultant'),true);
set local role authenticated;
do $$
declare mixed_id uuid:=(select questionnaire_id from registration_docs where name='mixed');
  only_id uuid:=(select questionnaire_id from registration_docs where name='only_card');
  card jsonb:=(select doc from registration_docs where name='card');
  regular jsonb:=(select doc from registration_docs where name='regular');
  x jsonb; q jsonb; payload jsonb; invalid jsonb; sub jsonb; retry uuid:=gen_random_uuid(); submitted jsonb;
begin
  x:=public.open_distributed_question_response_session(mixed_id);
  if (x->>'revision')::int<>0 or x->>'savedAt' is not null then raise exception 'Opening a card autosaved an answer'; end if;
  select value into strict q from jsonb_array_elements(x->'questions') where value->>'questionId'=card->>'id';
  if q#>>'{definition,purpose}' is distinct from 'study_registration'
    or q->'rows' is distinct from '[]'::jsonb or q->'activeRowIds' is distinct from '[]'::jsonb
    or q->>'responseId' is null then raise exception 'Card identity metadata or empty rows missing'; end if;
  if exists(select 1 from public.questions where id=(card->>'id')::uuid) then raise exception 'Independent card RLS widened'; end if;
  payload:=jsonb_build_object(card->>'id','[]'::jsonb,regular->>'id',
    jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(regular#>>'{fields,0,id}','활용 경험'))));
  for invalid in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_set(payload,array[card->>'id'],jsonb_build_array(jsonb_build_object('id',1,'answers','{}'::jsonb))),
    jsonb_set(payload,array[card->>'id'],jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(regular#>>'{fields,0,id}','악성 답변')))),
    jsonb_set(payload,array[card->>'id'],'{}'::jsonb),
    payload-(card->>'id')
  )) loop
    begin
      perform public.save_distributed_question_response_session(mixed_id,invalid,0,gen_random_uuid(),false,x->>'definitionToken');
      raise exception 'Card accepted rows, object or omitted metadata';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.save_distributed_question_response_session(mixed_id,
      jsonb_set(payload,array[regular->>'id'],'[]'::jsonb),0,gen_random_uuid(),true,x->>'definitionToken');
    raise exception 'Registration card bypassed regular answer completion';
  exception when invalid_parameter_value then null; end;
  x:=public.save_distributed_question_response_session(mixed_id,payload,0,retry,true,x->>'definitionToken');
  if public.save_distributed_question_response_session(mixed_id,payload,0,retry,true,x->>'definitionToken') is distinct from x then
    raise exception 'Card submission retry changed result';
  end if;
  select answers->(card->>'id') into sub from public.response_submissions where session_id=(x->>'id')::uuid;
  if sub is null or sub->'rows' is distinct from '[]'::jsonb
    or sub->'activeRowIds' is distinct from '[]'::jsonb or sub->>'body' is distinct from '' then
    raise exception 'Submitted card metadata included an answer or disappeared';
  end if;
  if exists(select 1 from public.question_responses where session_id=(x->>'id')::uuid and question_id=(card->>'id')::uuid
    and (rows<>'[]'::jsonb or active_row_ids<>'[]'::jsonb or body<>'')) then raise exception 'Card stored response content'; end if;
  if public.read_guide_answers(array[(card->>'id')::uuid]) is distinct from '{}'::jsonb then
    raise exception 'Registration card exposed a guide answer';
  end if;
  x:=public.open_distributed_question_response_session(only_id);
  begin
    perform public.save_distributed_question_response_session(only_id,jsonb_build_object(card->>'id','[]'::jsonb),
      0,gen_random_uuid(),true,x->>'definitionToken');
    raise exception 'Card-only questionnaire completed';
  exception when invalid_parameter_value then
    if sqlerrm not like '%Answer questions are required for completion%' then raise; end if;
  end;
  if exists(select 1 from public.response_submissions where session_id=(x->>'id')::uuid) then
    raise exception 'Rejected card-only completion published a submission';
  end if;
  if (select revision from public.response_sessions where id=(x->>'id')::uuid) is distinct from 0 then
    raise exception 'Rejected card-only completion advanced revision';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from registration_users where role='admin'),true);
set local role authenticated;
do $$
declare mixed_id uuid:=(select questionnaire_id from registration_docs where name='mixed');
  card jsonb:=(select doc from registration_docs where name='card'); x jsonb;
begin
  x:=public.list_submitted_questionnaire_responses(mixed_id);
  if jsonb_array_length(x)<>1 or not exists(select 1 from jsonb_array_elements(x#>'{0,questions}') q
    where q#>>'{definition,id}'=card->>'id' and q#>>'{definition,purpose}'='study_registration'
      and q->'rows'='[]'::jsonb and q->'activeRowIds'='[]'::jsonb) then
    raise exception 'Read-only submitted view lost registration card definition';
  end if;
  if (select count from public.distributed_submission_counts() where questionnaire_id=mixed_id) is distinct from 1::bigint then
    raise exception 'Registration metadata changed respondent submission count';
  end if;
  begin
    perform public.save_question(card||jsonb_build_object('buttonLabel','관리자 변경'),2,gen_random_uuid());
    raise exception 'Administrator bypassed distributed card lock';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%Distributed question is immutable%' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if md5(pg_get_functiondef('private.guide_consultant_id()'::regprocedure))
    is distinct from (select hash from registration_guide_baseline) then raise exception 'Guide definition changed'; end if;
end $$;
select 'Study registration cards, empty metadata, dependencies, immutable purposes, completion and permissions passed' as result;
rollback;
