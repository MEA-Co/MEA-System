-- Synthetic users and questions only. Keep the whole file on one connection.
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';
set local idle_in_transaction_session_timeout = '10s';

create temporary table condition_removal_users as
  select gen_random_uuid() id, role from unnest(array['consultant_lead','admin']) role;
insert into auth.users(id) select id from condition_removal_users;
insert into public.profiles(id,role,name)
  select id,role,'조건 해제 회귀 검증' from condition_removal_users;
grant select on condition_removal_users to authenticated;
create temporary table condition_removal_fixture(source_doc jsonb, source_revision integer, questionnaire_id uuid);
grant select,insert on condition_removal_fixture to authenticated;

select set_config('request.jwt.claim.sub',
  (select id::text from condition_removal_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare
  src jsonb; reference_doc jsonb; other_doc jsonb; chain_doc jsonb;
  changed jsonb; cleared jsonb; result jsonb; questionnaire jsonb;
  text_id uuid:=gen_random_uuid(); choice_id uuid:=gen_random_uuid();
  child_field_id uuid:=gen_random_uuid(); option_a uuid:=gen_random_uuid(); option_b uuid:=gen_random_uuid();
  source_revision integer:=1; reference_revision integer:=1;
begin
  src:=jsonb_build_object('id',gen_random_uuid(),'title','조건 원본','prompt','원본 질문',
    'fields',jsonb_build_array(
      jsonb_build_object('id',text_id,'label','설명','kind','text'),
      jsonb_build_object('id',choice_id,'label','선택','kind','single','options',jsonb_build_array(
        jsonb_build_object('id',option_a,'label','수시'),jsonb_build_object('id',option_b,'label','정시')))),
    'rowMode','repeatable','maxRows',5,'minRows',1,'initialRows',2,'answerLayout','cards','rowLabels','[]'::jsonb,
    'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
  perform public.save_question(src,0,gen_random_uuid());
  reference_doc:=jsonb_build_object('id',gen_random_uuid(),'title','참조 후속','prompt','후속 답변',
    'fields',jsonb_build_array(jsonb_build_object('id',child_field_id,'label','후속 답변','kind','text','required',false)),
    'rowMode','reference','maxRows',null,'minRows',1,'initialRows',1,'answerLayout','table','rowLabels','[]'::jsonb,
    'sourceBlockId',src->'id','sourceFieldId',null,'afterBlockId',src->'id',
    'condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(
      jsonb_build_object('blockId',src->'id','fieldId',choice_id,'op','equals','value',option_a))));
  perform public.save_question(reference_doc,0,gen_random_uuid());
  other_doc:=jsonb_build_object('id',gen_random_uuid(),'title','다른 조건','prompt','별도 후속 답변',
    'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),
    'rowMode','single','maxRows',null,'minRows',1,'initialRows',1,'answerLayout','cards','rowLabels','[]'::jsonb,
    'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,
    'condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(
      jsonb_build_object('blockId',src->'id','op','answered'))));
  perform public.save_question(other_doc,0,gen_random_uuid());

  -- Incoming conditions protect the entire field definition, even unused columns.
  for changed in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_set(src,'{fields,0,label}','"차단되는 이름"'::jsonb),
    jsonb_set(src,'{fields,1,options,0,label}','"차단되는 선택지"'::jsonb),
    jsonb_set(src,'{fields}',jsonb_build_array(src#>'{fields,1}')),
    jsonb_set(src,'{fields,0}',(src#>'{fields,0}')||jsonb_build_object('kind','scale','scaleMax',5))
  )) loop
    begin
      perform public.save_question(changed,source_revision,gen_random_uuid());
      raise exception 'Referenced source field change accepted';
    exception when object_not_in_prerequisite_state then
      if sqlerrm not like '%Referenced answer fields or rows cannot change%' then raise; end if;
    end;
  end loop;
  if (select revision from public.questions where id=(src->>'id')::uuid) is distinct from source_revision then
    raise exception 'Rejected source changes advanced revision';
  end if;

  cleared:=jsonb_build_object('condition',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,
    'rowMode','single','maxRows',null,'minRows',1,'initialRows',1);
  result:=public.save_question(reference_doc||cleared,reference_revision,gen_random_uuid());
  reference_revision:=(result->>'revision')::int;
  if result->'condition' is distinct from 'null'::jsonb or result->>'source_block_id' is not null
    or result->>'source_field_id' is not null or result->>'after_block_id' is not null
    or result->>'row_mode' is distinct from 'single' or result->'max_rows' is distinct from 'null'::jsonb
    or result->'fields' is distinct from reference_doc->'fields'
    or result#>>'{fields,0,id}' is distinct from child_field_id::text then
    raise exception 'Condition removal changed the follow-up field identity or left a dependency';
  end if;
  -- Removing one condition cannot unlock a source still used by another question.
  begin
    perform public.save_question(jsonb_set(src,'{fields,0,label}','"여전히 차단"'::jsonb),source_revision,gen_random_uuid());
    raise exception 'Other remaining condition did not protect source';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%Referenced answer fields or rows cannot change%' then raise; end if;
  end;
  perform public.save_question(other_doc||cleared,1,gen_random_uuid());
  src:=jsonb_set(src,'{fields,0,label}','"조건 해제 후 수정"'::jsonb);
  result:=public.save_question(src,source_revision,gen_random_uuid());
  source_revision:=(result->>'revision')::int;
  if result#>>'{fields,0,id}' is distinct from text_id::text
    or result#>>'{fields,1,id}' is distinct from choice_id::text
    or result#>>'{fields,0,label}' is distinct from '조건 해제 후 수정' then
    raise exception 'Source edit after removal lost its field identity';
  end if;

  -- C -> B -> A: converting B from reference to single still respects C's dependency.
  result:=public.save_question(reference_doc,reference_revision,gen_random_uuid());
  reference_revision:=(result->>'revision')::int;
  chain_doc:=other_doc||jsonb_build_object('id',gen_random_uuid(),'title','참조 체인',
    'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','체인 답변','kind','text')),
    'condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(
      jsonb_build_object('blockId',reference_doc->'id','fieldId',child_field_id,'op','answered'))));
  perform public.save_question(chain_doc,0,gen_random_uuid());
  begin
    perform public.save_question(reference_doc||cleared,reference_revision,gen_random_uuid());
    raise exception 'Incoming chain did not protect referenced row mode';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%Referenced answer fields or rows cannot change%' then raise; end if;
  end;
  if (select condition from public.questions where id=(reference_doc->>'id')::uuid)
    is distinct from reference_doc->'condition' then raise exception 'Failed chain removal partially cleared condition'; end if;
  perform public.save_question(chain_doc||cleared,1,gen_random_uuid());
  result:=public.save_question(reference_doc||cleared,reference_revision,gen_random_uuid());
  reference_revision:=(result->>'revision')::int;
  if result->'fields' is distinct from reference_doc->'fields' then raise exception 'Chain removal replaced child fields'; end if;
  src:=jsonb_set(src,'{fields,0,label}','"체인 해제 후 수정"'::jsonb);
  result:=public.save_question(src,source_revision,gen_random_uuid());
  source_revision:=(result->>'revision')::int;

  -- Placement in a draft/in_review questionnaire alone does not freeze source edits.
  questionnaire:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','조건 해제 배포 잠금',
    'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','검증',
      'questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),
        'sourceQuestionId',src->'id','text','원본 질문','details','[]'::jsonb)))));
  perform public.save_questionnaire_draft(questionnaire,0,gen_random_uuid());
  src:=jsonb_set(src,'{prompt}','"배치된 초안의 원본 수정"'::jsonb);
  result:=public.save_question(src,source_revision,gen_random_uuid());
  source_revision:=(result->>'revision')::int;
  perform public.change_questionnaire_status((questionnaire->>'questionnaireId')::uuid,1,'draft',null,'in_review',gen_random_uuid(),2);
  src:=jsonb_set(src,'{prompt}','"검토 중 원본 수정"'::jsonb);
  result:=public.save_question(src,source_revision,gen_random_uuid());
  source_revision:=(result->>'revision')::int;
  perform public.change_questionnaire_status((questionnaire->>'questionnaireId')::uuid,2,'in_review',null,'published',gen_random_uuid(),2);

  -- A separate editable dependent can clear its condition, but cannot lift A's publication lock.
  result:=public.save_question(reference_doc,reference_revision,gen_random_uuid());
  reference_revision:=(result->>'revision')::int;
  result:=public.save_question(reference_doc||cleared,reference_revision,gen_random_uuid());
  if result#>>'{fields,0,id}' is distinct from child_field_id::text then raise exception 'Published-source removal changed child field ID'; end if;
  begin
    perform public.save_question(jsonb_set(src,'{prompt}','"배포 후 차단"'::jsonb),source_revision,gen_random_uuid());
    raise exception 'Condition removal lifted publication lock';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%Published question is immutable%' then raise; end if;
  end;
  if (select publication_locked_at from public.questions where id=(src->>'id')::uuid) is null then
    raise exception 'Published original lost its lock';
  end if;
  insert into condition_removal_fixture values(src,source_revision,(questionnaire->>'questionnaireId')::uuid);
end $$;
reset role;

-- Administrators retain the same publication immutability after reference removal.
select set_config('request.jwt.claim.sub',
  (select id::text from condition_removal_users where role='admin'),true);
set local role authenticated;
do $$
declare fixture record;
begin
  select * into strict fixture from condition_removal_fixture;
  begin
    perform public.save_question(jsonb_set(fixture.source_doc,'{prompt}','"관리자 배포 수정 차단"'::jsonb),
      fixture.source_revision,gen_random_uuid());
    raise exception 'Administrator bypassed published source lock';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%Published question is immutable%' then raise; end if;
  end;
end $$;
reset role;
rollback;
select 'Question condition removal, stable field IDs, incoming references, chains and publication locks passed' as result;
