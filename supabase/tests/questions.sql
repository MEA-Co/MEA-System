begin;

create temporary table block_test_users(id uuid, role text);
insert into block_test_users
select gen_random_uuid(), role
from unnest(array['student', 'consultant', 'consultant_lead', 'other_lead', 'admin']) role;
insert into auth.users(id) select id from block_test_users;
insert into public.profiles(id, role, name, student_period)
select id, case when role='other_lead' then 'consultant_lead' else role end,
  '질문 블록 검증', case when role='student' then '1학년 1학기' end
from block_test_users;
grant select on block_test_users to authenticated;

create temporary table block_test_docs(base jsonb, dependent jsonb);
insert into block_test_docs
select
  jsonb_build_object(
    'id', block_id,
    'title', '',
    'prompt', '학교의 특징을 적어 주세요.',
    'fields', jsonb_build_array(
      jsonb_build_object('id', field_id, 'label', '특징', 'kind', 'text')
    ),
    'rowMode', 'repeatable', 'maxRows', 10,
    'sourceBlockId', null, 'sourceFieldId', null,
    'afterBlockId', null, 'condition', null
  ),
  jsonb_build_object(
    'id', dependent_id,
    'title', '대응 방식',
    'prompt', '각 특징에 어떻게 대응했나요?',
    'fields', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'label', '본인의 대응', 'kind', 'text')
    ),
    'rowMode', 'reference', 'maxRows', null,
    'sourceBlockId', block_id, 'sourceFieldId', field_id,
    'afterBlockId', block_id,
    'condition', jsonb_build_object('mode', 'all', 'clauses', jsonb_build_array(
      jsonb_build_object('blockId', block_id, 'fieldId', field_id, 'op', 'answered')
    ))
  )
from (select gen_random_uuid() block_id, gen_random_uuid() dependent_id, gen_random_uuid() field_id) ids;
grant select on block_test_docs to authenticated;

select set_config('request.jwt.claim.sub',
  (select id::text from block_test_users where role='consultant_lead'), true);
set local role authenticated;
do $$
declare base jsonb; dependent jsonb; result jsonb; save_id uuid := gen_random_uuid();
begin
  select d.base, d.dependent into base, dependent from block_test_docs d;
  result := public.save_question(base, 0, save_id);
  if (result->>'revision')::int <> 1 then raise exception 'Initial save failed'; end if;
  if result->>'title' <> '' or result->>'prompt' <> base->>'prompt' then
    raise exception 'Optional management name or question text was changed';
  end if;
  if public.save_question(base, 0, save_id) <> result then
    raise exception 'Idempotent retry changed block';
  end if;
  begin
    perform public.save_question(base, 0, gen_random_uuid());
    raise exception 'Stale revision was accepted';
  exception when serialization_failure then null;
  end;
  result := public.save_question(dependent, 0, gen_random_uuid());
  if (result->>'revision')::int <> 1 then raise exception 'Dependent save failed'; end if;
  if (select count(*) from public.questions where created_by in (select id from block_test_users)) <> 2 then
    raise exception 'Lead cannot read its blocks';
  end if;
  begin
    update public.questions set title='직접 변경' where id=(base->>'id')::uuid;
    raise exception 'Direct write was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_question(jsonb_set(base, '{afterBlockId}', dependent->'id'), 1, gen_random_uuid());
    raise exception 'Circular dependency was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_question(jsonb_set(dependent, '{sourceFieldId}', to_jsonb(gen_random_uuid()::text)), 1, gen_random_uuid());
    raise exception 'Missing source field was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_question(jsonb_set(dependent, '{condition,clauses,0,fieldId}', to_jsonb(gen_random_uuid()::text)), 1, gen_random_uuid());
    raise exception 'Missing condition field was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_question(jsonb_set(base, '{fields,0,label}', '"변경"'), 1, gen_random_uuid());
    raise exception 'Referenced field changed';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    perform public.archive_question((base->>'id')::uuid, 1);
    raise exception 'Referenced block was archived';
  exception when object_not_in_prerequisite_state then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',
  (select id::text from block_test_users where role='other_lead'), true);
set local role authenticated;
do $$
declare doc jsonb;
begin
  select base into doc from block_test_docs;
  if (select count(*) from public.questions where created_by in (select id from block_test_users)) <> 2 then
    raise exception 'Other lead cannot read shared blocks';
  end if;
  begin
    perform public.save_question(doc, 1, gen_random_uuid());
    raise exception 'Other lead edited author block';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',
  (select id::text from block_test_users where role='consultant'), true);
set local role authenticated;
do $$
declare doc jsonb;
begin
  select base into doc from block_test_docs;
  if exists(select 1 from public.questions) then
    raise exception 'Consultant can read author blocks';
  end if;
  begin
    perform public.save_question(doc, 0, gen_random_uuid());
    raise exception 'Consultant created a block';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',
  (select id::text from block_test_users where role='admin'), true);
set local role authenticated;
do $$
declare base jsonb; dependent jsonb; choice jsonb; invalid_doc jsonb; choice_field uuid := gen_random_uuid();
  first_option uuid := gen_random_uuid(); result jsonb;
begin
  select d.base, d.dependent into base, dependent from block_test_docs d;
  result := public.save_question(
    jsonb_set(dependent, '{title}', '"관리자가 수정한 대응 방식"'), 1, gen_random_uuid());
  if (result->>'revision')::integer <> 2 then
    raise exception 'Admin cannot edit lead block';
  end if;
  choice := jsonb_set(base, '{id}', to_jsonb(gen_random_uuid()::text));
  choice := jsonb_set(choice, '{rowMode}', '"single"');
  choice := jsonb_set(choice, '{maxRows}', 'null');
  choice := jsonb_set(choice, '{fields}', jsonb_build_array(
    jsonb_build_object(
      'id', choice_field, 'label', '지원 전략', 'kind', 'single',
      'choiceStyle', 'chip', 'choiceAllowText', true,
      'options', jsonb_build_array(
        jsonb_build_object('id', first_option, 'label', repeat('긴 선택지', 20)),
        jsonb_build_object('id', gen_random_uuid(), 'label', '정시'),
        jsonb_build_object('id', gen_random_uuid(), 'label', '직접 입력', 'isOther', true)
      )
    ),
    jsonb_build_object(
      'id', gen_random_uuid(), 'label', '중요도', 'kind', 'scale', 'scaleMax', 7,
      'scaleConfig', jsonb_build_object('max', 7, 'low', '낮음', 'middle', '보통',
        'high', '높음', 'allowText', true)
    )
  ));
  result := public.save_question(choice, 0, gen_random_uuid());
  if (result->>'revision')::integer <> 1 then
    raise exception 'Admin cannot create a choice block';
  end if;
  invalid_doc := jsonb_set(choice, '{id}', to_jsonb(gen_random_uuid()::text));
  invalid_doc := jsonb_set(invalid_doc, '{fields,0,options,1,label}', to_jsonb(repeat('긴 선택지', 20)));
  begin
    perform public.save_question(invalid_doc, 0, gen_random_uuid());
    raise exception 'Duplicate choice labels were accepted';
  exception when invalid_parameter_value then null;
  end;
  invalid_doc := jsonb_set(choice, '{id}', to_jsonb(gen_random_uuid()::text));
  invalid_doc := jsonb_set(invalid_doc, '{fields,0,options,1,isOther}', 'true', true);
  begin
    perform public.save_question(invalid_doc, 0, gen_random_uuid());
    raise exception 'Multiple direct inputs were accepted for a single choice';
  exception when check_violation then null;
  end;
  invalid_doc := jsonb_set(choice, '{id}', to_jsonb(gen_random_uuid()::text));
  invalid_doc := jsonb_set(invalid_doc, '{fields,1,scaleConfig,max}', '5');
  begin
    perform public.save_question(invalid_doc, 0, gen_random_uuid());
    raise exception 'Mismatched scale settings were accepted';
  exception when check_violation then null;
  end;
  invalid_doc := jsonb_set(base, '{id}', to_jsonb(gen_random_uuid()::text));
  invalid_doc := jsonb_set(invalid_doc, '{condition}', jsonb_build_object(
    'mode', 'all', 'clauses', jsonb_build_array(jsonb_build_object(
      'blockId', choice->>'id', 'fieldId', choice_field, 'op', 'equals',
      'value', gen_random_uuid()::text
    ))
  ));
  begin
    perform public.save_question(invalid_doc, 0, gen_random_uuid());
    raise exception 'Unknown choice was accepted in condition';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',
  (select id::text from block_test_users where role='consultant_lead'), true);
set local role authenticated;
do $$
declare base jsonb; dependent jsonb; result jsonb;
begin
  select d.base, d.dependent into base, dependent from block_test_docs d;
  result := public.archive_question((dependent->>'id')::uuid, 2);
  if result->>'archived_at' is null then raise exception 'Archive failed'; end if;
  perform public.archive_question((base->>'id')::uuid, 1);
  if (select count(*) from public.questions where archived_at is null and created_by in (select id from block_test_users)) <> 1 then
    raise exception 'Archive visibility failed';
  end if;
end $$;
reset role;

select 'Question block storage, roles, references and cycles passed' as result;
rollback;
