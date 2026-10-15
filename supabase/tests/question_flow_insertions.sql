-- Synthetic question/questionnaire IDs only. The configured guide is used on
-- fixture origins; its function, profile and pre-existing responses stay intact.
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';
set local idle_in_transaction_session_timeout = '10s';
create temporary table flow_users as
  select gen_random_uuid() id,role from unnest(array['consultant_lead','consultant','admin']) role;
insert into auth.users(id) select id from flow_users;
insert into public.profiles(id,role,name) select id,role,'중간 시기 추가 검증' from flow_users;
grant select on flow_users to authenticated;
create temporary table flow_cases(name text primary key,doc jsonb,questionnaire_id uuid,rows jsonb);
grant select,insert,update on flow_cases to authenticated;
create temporary table flow_guide_baseline as
  select md5(pg_get_functiondef('private.guide_consultant_id()'::regprocedure)) hash;
do $$ begin
  if has_table_privilege('authenticated','public.questions','UPDATE')
    or has_any_column_privilege('authenticated','public.questions','UPDATE') then
    raise exception 'Question writes must use the existing security-definer save RPC';
  end if;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from flow_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare case_name text; q jsonb; d jsonb; saved jsonb; bad jsonb; source jsonb; conditional jsonb; compatibility jsonb;
begin
  foreach case_name in array array['flow','legacy','single','table'] loop
    q:=jsonb_build_object('id',gen_random_uuid(),'title',case_name,'prompt','학업 흐름을 기록해 주세요.',
      'fields',jsonb_build_array(
        jsonb_build_object('id',gen_random_uuid(),'label','성적','kind','text'),
        jsonb_build_object('id',gen_random_uuid(),'label','특이사항','kind','text','required',false)),
      'rowMode',case when case_name='single' then 'single' else 'repeatable' end,
      'maxRows',case when case_name='single' then null else 3 end,'minRows',1,
      'initialRows',case when case_name='single' then 1 else 3 end,
      'answerLayout',case when case_name='table' then 'table' else 'flow' end,
      'rowLabels',case when case_name='single' then jsonb_build_array('고1') else jsonb_build_array('고1','고2','고3') end,
      'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
    if case_name='flow' then q:=q||jsonb_build_object('flowInsertAfter',jsonb_build_array(1,2));
    elsif case_name='single' then q:=q||jsonb_build_object('flowInsertAfter',jsonb_build_array(1)); end if;
    saved:=public.save_question(q,0,gen_random_uuid());
    if saved->'flow_insert_after' is distinct from coalesce(q->'flowInsertAfter','[]'::jsonb) then
      raise exception 'Flow insertion settings did not round trip';
    end if;
    d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','중간 시기 '||case_name,
      'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','흐름',
        'questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),
          'sourceQuestionId',q->'id','text',q->'prompt','details','[]'::jsonb)))));
    perform public.save_questionnaire_draft(d,0,gen_random_uuid());
    perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'in_review',gen_random_uuid(),2);
    if public.read_shared_question_sources((d->>'questionnaireId')::uuid)#>'{0,flow_insert_after}'
      is distinct from saved->'flow_insert_after' then raise exception 'Review source omitted insertion slots'; end if;
    insert into flow_cases values(case_name,q,(d->>'questionnaireId')::uuid,null);
  end loop;
  q:=(select doc from flow_cases where name='flow');
  compatibility:=q||jsonb_build_object('id',gen_random_uuid(),'title','구형 제작기 설정 보존');
  perform public.save_question(compatibility,0,gen_random_uuid());
  compatibility:=(compatibility-'flowInsertAfter')||jsonb_build_object('prompt','기존 추가 위치를 유지하는 내용 수정');
  saved:=public.save_question(compatibility,1,gen_random_uuid());
  if saved->'flow_insert_after' is distinct from jsonb_build_array(1,2)
    or saved->>'prompt' is distinct from compatibility->>'prompt'
    or saved->>'id' is distinct from compatibility->>'id' then
    raise exception 'Omitted insertion settings cleared configured slots during a flow content edit';
  end if;
  saved:=public.save_question(compatibility||jsonb_build_object('flowInsertAfter','[]'::jsonb),2,gen_random_uuid());
  if saved->'flow_insert_after' is distinct from '[]'::jsonb then raise exception 'Explicit empty slots failed to disable insertions'; end if;
  for bad in select value from jsonb_array_elements(jsonb_build_array(
    q||jsonb_build_object('flowInsertAfter','{}'::jsonb),
    q||jsonb_build_object('flowInsertAfter',jsonb_build_array('1')),
    q||jsonb_build_object('flowInsertAfter',jsonb_build_array(0)),
    q||jsonb_build_object('flowInsertAfter',jsonb_build_array(4)),
    q||jsonb_build_object('flowInsertAfter',jsonb_build_array(1,1)),
    q||jsonb_build_object('flowInsertAfter',jsonb_build_array(1.5)),
    q||jsonb_build_object('answerLayout','table'),
    q||jsonb_build_object('maxRows',20,'flowInsertAfter',jsonb_build_array(1)),
    q||jsonb_build_object('rowMode','single','maxRows',null,'initialRows',1,'flowInsertAfter',jsonb_build_array(2))
  )) loop
    begin
      perform public.save_question(bad||jsonb_build_object('id',gen_random_uuid()),0,gen_random_uuid());
      raise exception 'Invalid insertion settings accepted';
    exception when invalid_parameter_value or check_violation then null; end;
  end loop;

  source:=jsonb_build_object('id',gen_random_uuid(),'title','조건 원본','prompt','선택적으로 시작 시기를 적어 주세요.',
    'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','시작','kind','text','required',false)),
    'rowMode','single','maxRows',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
  perform public.save_question(source,0,gen_random_uuid());
  conditional:=q||jsonb_build_object('id',gen_random_uuid(),
    'condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(jsonb_build_object('blockId',source->'id','op','answered'))));
  perform public.save_question(conditional,0,gen_random_uuid());
  d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','조건부 중간 시기',
    'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','조건',
      'questions',jsonb_build_array(
        jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',source->'id','text',source->'prompt','details','[]'::jsonb),
        jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',conditional->'id','text',conditional->'prompt','details','[]'::jsonb)))));
  perform public.save_questionnaire_draft(d,0,gen_random_uuid());
  perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'in_review',gen_random_uuid(),2);
  insert into flow_cases values('conditional',jsonb_build_object('source',source,'flow',conditional),(d->>'questionnaireId')::uuid,null);
end $$;
reset role;

do $$ begin
  if not exists(select 1 from public.profiles where id=private.guide_consultant_id() and role in ('admin','consultant_lead')) then
    raise exception 'Configured guide must have an existing staff profile for in_review regression';
  end if;
end $$;
select set_config('request.jwt.claim.sub',private.guide_consultant_id()::text,true);
set local role authenticated;
do $$
declare fixture record; x jsonb; raw_rows jsonb; mixed_rows jsonb; bad jsonb; payload jsonb; retry uuid;
  fid text; second_fid text; shown jsonb; save_revision integer;
begin
  select * into fixture from flow_cases where name='flow';
  fid:=fixture.doc#>>'{fields,0,id}'; second_fid:=fixture.doc#>>'{fields,1,id}';
  x:=public.open_review_response_session(fixture.questionnaire_id);
  raw_rows:=jsonb_build_array(
    jsonb_build_object('id',101,'answers',jsonb_build_object(fid,'고1 답변',second_fid,'기존 특이사항')),
    jsonb_build_object('id',102,'answers',jsonb_build_object(fid,'고2 답변')),
    jsonb_build_object('id',103,'answers','{}'::jsonb));
  x:=public.save_review_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',raw_rows),
    (x->>'revision')::integer,gen_random_uuid(),false,x->>'definitionToken');
  -- Deliberately unordered input is stored canonically without changing IDs/answers.
  mixed_rows:=jsonb_build_array(
    raw_rows->2||jsonb_build_object('flowIndex',3),
    jsonb_build_object('id',501,'flowAfter',1,'label','고1 여름','answers',jsonb_build_object(second_fid,'방학 준비')),
    raw_rows->1||jsonb_build_object('flowIndex',2),
    raw_rows->0||jsonb_build_object('flowIndex',1),
    jsonb_build_object('id',502,'flowAfter',2,'label','이름만 추가','answers','{}'::jsonb),
    jsonb_build_object('id',503,'flowAfter',2,'label','','answers','{}'::jsonb));
  for bad in select value from jsonb_array_elements(jsonb_build_array(
    mixed_rows-0,
    jsonb_set(mixed_rows,'{0,flowIndex}','2'::jsonb),
    jsonb_set(mixed_rows,'{3,id}','999'::jsonb),
    jsonb_set(mixed_rows,'{1,flowAfter}','3'::jsonb),
    jsonb_set(mixed_rows,'{0,flowIndex}','"3"'::jsonb),
    jsonb_set(mixed_rows,'{1,label}',to_jsonb(repeat('가',101))),
    mixed_rows||jsonb_build_array(jsonb_build_object('id',504,'flowAfter',1,'flowIndex',2,'answers','{}'::jsonb)),
    mixed_rows||jsonb_build_array(jsonb_build_object('id',505,'label','anchor 없음','answers','{}'::jsonb))
  )) loop
    begin
      perform public.save_review_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',bad),
        (x->>'revision')::integer,gen_random_uuid(),false,x->>'definitionToken');
      raise exception 'Invalid in_review flow metadata accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  bad:=jsonb_set(mixed_rows,'{1,label}','""'::jsonb);
  x:=public.save_review_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',bad),
    (x->>'revision')::integer,gen_random_uuid(),false,x->>'definitionToken');
  for bad in select value from jsonb_array_elements(jsonb_build_array(
    bad,jsonb_set(mixed_rows,'{1,label}',to_jsonb(E' \n\t '::text))
  )) loop
    begin
      perform public.save_review_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',bad),
        (x->>'revision')::integer,gen_random_uuid(),true,x->>'definitionToken');
      raise exception 'Unnamed answered in_review period completed';
    exception when invalid_parameter_value then
      if sqlerrm not like '%Name every answered inserted flow period%' then raise; end if;
    end;
  end loop;
  payload:=jsonb_build_object(fixture.doc->>'id',mixed_rows); retry:=gen_random_uuid(); save_revision:=(x->>'revision')::integer;
  x:=public.save_review_response_session(fixture.questionnaire_id,payload,save_revision,retry,true,x->>'definitionToken');
  if public.save_review_response_session(fixture.questionnaire_id,payload,save_revision,retry,true,x->>'definitionToken') is distinct from x then
    raise exception 'Flow response retry changed the snapshot';
  end if;
  if (select jsonb_agg(row->'id' order by n) from jsonb_array_elements(x#>'{questions,0,rows}') with ordinality r(row,n))
    is distinct from '[101,501,102,502,503,103]'::jsonb
    or x#>'{questions,0,activeRowIds}' is distinct from '[101,501,102]'::jsonb
    or x#>>array['questions','0','rows','0','answers',second_fid] is distinct from '기존 특이사항' then
    raise exception 'Insertion moved fixed periods or lost existing answers';
  end if;
  if public.open_review_response_session(fixture.questionnaire_id)#>'{questions,0,rows}' is distinct from x#>'{questions,0,rows}' then
    raise exception 'Reopening flow lost insertion metadata';
  end if;
  shown:=public.read_guide_answers(array[(fixture.doc->>'id')::uuid])->(fixture.doc->>'id')->'rows';
  if shown#>>'{0,label}' is distinct from '고1' or shown#>>'{1,label}' is distinct from '고1 여름'
    or shown#>>'{2,label}' is distinct from '고2' or jsonb_array_length(shown)<>3 then
    raise exception 'Guide labels shifted after insertion or included label-only periods';
  end if;
  update flow_cases set rows=x#>'{questions,0,rows}' where name='flow';

  for fixture in select * from flow_cases where name in ('legacy','single','table') loop
    x:=public.open_review_response_session(fixture.questionnaire_id); fid:=fixture.doc#>>'{fields,0,id}';
    if fixture.name='single' then
      raw_rows:=jsonb_build_array(jsonb_build_object('id',201,'flowIndex',1,'answers','{}'::jsonb),
        jsonb_build_object('id',202,'flowAfter',1,'label','고1 방학','answers',jsonb_build_object(fid,'단일 기본 시기 뒤 추가')));
    else
      raw_rows:=jsonb_build_array(jsonb_build_object('id',77,'answers',jsonb_build_object(fid,'기존 답변')));
    end if;
    if fixture.name='table' then
      begin
        perform public.save_review_response_session(fixture.questionnaire_id,
          jsonb_build_object(fixture.doc->>'id',jsonb_set(raw_rows,'{0,flowIndex}','1'::jsonb)),
          (x->>'revision')::integer,gen_random_uuid(),false,x->>'definitionToken');
        raise exception 'Nonflow in_review question accepted flow metadata';
      exception when invalid_parameter_value then null; end;
    end if;
    x:=public.save_review_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',raw_rows),
      (x->>'revision')::integer,gen_random_uuid(),true,x->>'definitionToken');
    if x#>'{questions,0,rows}' is distinct from raw_rows then raise exception 'Legacy/single flow changed saved row IDs'; end if;
    update flow_cases set rows=raw_rows where name=fixture.name;
  end loop;
end $$;
reset role;

-- Removing slots changes future insertions, never the identities of saved periods.
select set_config('request.jwt.claim.sub',(select id::text from flow_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare fixture record; q jsonb; bad jsonb;
begin
  select * into fixture from flow_cases where name='flow';
  q:=fixture.doc||jsonb_build_object('flowInsertAfter','[]'::jsonb);
  perform public.save_question(q,1,gen_random_uuid());
  update flow_cases set doc=q where name='flow';
  begin
    update public.questions set max_rows=4 where id=(q->>'id')::uuid;
    raise exception 'Direct question UPDATE bypassed response metadata protection';
  exception when insufficient_privilege then null; end;
  for bad in select value from jsonb_array_elements(jsonb_build_array(
    q||jsonb_build_object('maxRows',2,'initialRows',2),
    q||jsonb_build_object('maxRows',4),
    q||jsonb_build_object('answerLayout','table')
  )) loop
    begin
      perform public.save_question(bad,2,gen_random_uuid());
      raise exception 'Saved flow period structure changed';
    exception when object_not_in_prerequisite_state then
      if sqlerrm not like '%Saved flow periods require their original layout and fixed period count%' then raise; end if;
    end;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub',private.guide_consultant_id()::text,true);
set local role authenticated;
do $$
declare fixture record; x jsonb; raw_rows jsonb; bad jsonb;
begin
  select * into fixture from flow_cases where name='flow'; x:=public.open_review_response_session(fixture.questionnaire_id);
  raw_rows:=jsonb_set(fixture.rows,'{1,label}','"고1 여름 수정"'::jsonb)-3;
  for bad in select value from jsonb_array_elements(jsonb_build_array(
    raw_rows||jsonb_build_array(jsonb_build_object('id',601,'flowAfter',1,'label','새 시기','answers','{}'::jsonb)),
    jsonb_set(raw_rows,'{1,flowAfter}','2'::jsonb),
    jsonb_build_array(jsonb_build_object('id',101,'answers','{}'::jsonb))
  )) loop
    begin
      perform public.save_review_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',bad),
        (x->>'revision')::integer,gen_random_uuid(),false,x->>'definitionToken');
      raise exception 'Disabled slot accepted new/moved periods or metadata downgrade';
    exception when invalid_parameter_value then null; end;
  end loop;
  x:=public.save_review_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',raw_rows),
    (x->>'revision')::integer,gen_random_uuid(),true,x->>'definitionToken');
  if x#>'{questions,0,rows}' is distinct from raw_rows then raise exception 'Existing periods were lost after disabling a slot'; end if;
  update flow_cases set rows=raw_rows where name='flow';
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from flow_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare fixture record; q jsonb;
begin
  q:=(select doc from flow_cases where name='flow')||jsonb_build_object('flowInsertAfter',jsonb_build_array(1,2));
  perform public.save_question(q,2,gen_random_uuid()); update flow_cases set doc=q where name='flow';
  for fixture in select * from flow_cases loop
    perform public.change_questionnaire_status(fixture.questionnaire_id,2,'in_review',null,'published',gen_random_uuid(),2);
  end loop;
  begin
    perform public.save_question(q||jsonb_build_object('flowInsertAfter','[]'::jsonb),3,gen_random_uuid());
    raise exception 'Publication lock allowed slot editing';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from flow_users where role='consultant'),true);
set local role authenticated;
do $$
declare fixture record; x jsonb; raw_rows jsonb; bad jsonb; payload jsonb; saved_rows jsonb; submission jsonb; fid text;
begin
  for fixture in select * from flow_cases where name in ('flow','legacy','single','table') loop
    x:=public.open_published_question_response_session(fixture.questionnaire_id); fid:=fixture.doc#>>'{fields,0,id}';
    raw_rows:=fixture.rows;
    if fixture.name='flow' then
      raw_rows:=raw_rows||jsonb_build_array(jsonb_build_object('id',504,'flowAfter',2,'label','이름만 추가','answers','{}'::jsonb));
      for bad in select value from jsonb_array_elements(jsonb_build_array(
        raw_rows-4,
        jsonb_set(raw_rows,'{1,flowAfter}','3'::jsonb),
        jsonb_set(raw_rows,'{0,flowIndex}','"1"'::jsonb),
        jsonb_set(raw_rows,'{1,label}',to_jsonb(repeat('가',101))),
        (select jsonb_agg(jsonb_set(row,'{answers}','{}'::jsonb) order by n) from jsonb_array_elements(raw_rows) with ordinality r(row,n)),
        jsonb_build_array(raw_rows->0,raw_rows->2,raw_rows->4)||
          (select jsonb_agg(jsonb_build_object('id',1000+i,'flowAfter',1,'label','빈 시기','answers','{}'::jsonb)) from generate_series(1,18) i)
      )) loop
        begin
          perform public.save_published_question_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',bad),
            (x->>'revision')::integer,gen_random_uuid(),true,x->>'definitionToken');
          raise exception 'Invalid published flow metadata/completion accepted';
        exception when invalid_parameter_value then null; end;
      end loop;
      bad:=jsonb_set(raw_rows,'{1,label}','""'::jsonb);
      x:=public.save_published_question_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',bad),
        (x->>'revision')::integer,gen_random_uuid(),false,x->>'definitionToken');
      begin
        perform public.save_published_question_response_session(fixture.questionnaire_id,jsonb_build_object(fixture.doc->>'id',bad),
          (x->>'revision')::integer,gen_random_uuid(),true,x->>'definitionToken');
        raise exception 'Unnamed answered published period completed';
      exception when invalid_parameter_value then
        if sqlerrm not like '%Name every answered inserted flow period%' then raise; end if;
      end;
    elsif fixture.name='single' then
      -- One fixed period plus nineteen custom periods is the shared twenty-row limit.
      raw_rows:=raw_rows||(select jsonb_agg(jsonb_build_object('id',202+i,'flowAfter',1,'label','추가 '||i,'answers','{}'::jsonb)) from generate_series(1,18) i);
    elsif fixture.name='table' then
      begin
        perform public.save_published_question_response_session(fixture.questionnaire_id,
          jsonb_build_object(fixture.doc->>'id',jsonb_set(raw_rows,'{0,flowIndex}','1'::jsonb)),
          (x->>'revision')::integer,gen_random_uuid(),false,x->>'definitionToken');
        raise exception 'Nonflow published question accepted flow metadata';
      exception when invalid_parameter_value then null; end;
    end if;
    payload:=jsonb_build_object(fixture.doc->>'id',raw_rows);
    x:=public.save_published_question_response_session(fixture.questionnaire_id,payload,(x->>'revision')::integer,
      gen_random_uuid(),true,x->>'definitionToken');
    saved_rows:=x#>'{questions,0,rows}';
    if public.open_published_question_response_session(fixture.questionnaire_id)#>'{questions,0,rows}' is distinct from saved_rows then
      raise exception 'Published reopening lost periods';
    end if;
    select answers->(fixture.doc->>'id') into submission from public.response_submissions where session_id=(x->>'id')::uuid;
    if fixture.name in ('flow','single') and (jsonb_array_length(submission->'rows')<>jsonb_array_length(saved_rows)
      or exists(select 1 from jsonb_array_elements(saved_rows) r where not exists(select 1 from jsonb_array_elements(submission->'rows') s
        where s->'id'=r->'id' and s->'flowIndex' is not distinct from r->'flowIndex'
          and s->'flowAfter' is not distinct from r->'flowAfter' and s->'label' is not distinct from r->'label'))) then
      raise exception 'Submitted flow dropped blank period metadata';
    end if;
    if fixture.name='flow' and not exists(select 1 from jsonb_array_elements(submission->'rows') r
      where r->>'id'='504' and r->>'label'='이름만 추가' and r->'answers'='{}'::jsonb) then
      raise exception 'Label-only period was lost from an active flow submission';
    end if;
  end loop;

  select * into fixture from flow_cases where name='conditional';
  x:=public.open_published_question_response_session(fixture.questionnaire_id);
  raw_rows:=jsonb_build_array(
    jsonb_build_object('id',301,'flowIndex',1,'answers','{}'::jsonb),
    jsonb_build_object('id',302,'flowIndex',2,'answers','{}'::jsonb),
    jsonb_build_object('id',303,'flowIndex',3,'answers','{}'::jsonb),
    jsonb_build_object('id',304,'flowAfter',1,'label','비공개 시기 이름',
      'answers',jsonb_build_object(fixture.doc#>>'{flow,fields,0,id}','비공개 입력')));
  payload:=jsonb_build_object(fixture.doc#>>'{source,id}',jsonb_build_array(jsonb_build_object('id',1,'answers','{}'::jsonb)),
    fixture.doc#>>'{flow,id}',raw_rows);
  x:=public.save_published_question_response_session(fixture.questionnaire_id,payload,(x->>'revision')::integer,gen_random_uuid(),true,x->>'definitionToken');
  select answers->(fixture.doc#>>'{flow,id}') into submission from public.response_submissions where session_id=(x->>'id')::uuid;
  if submission->'activeRowIds' is distinct from '[]'::jsonb or jsonb_array_length(submission->'rows')<>4
    or exists(select 1 from jsonb_array_elements(submission->'rows') r where r->'answers'<>'{}'::jsonb or coalesce(r->>'label','')<>'')
    or not exists(select 1 from jsonb_array_elements(submission->'rows') r where r->>'id'='304' and r->>'flowAfter'='1')
    or not exists(select 1 from jsonb_array_elements(x->'questions') q where q->>'questionId'=fixture.doc#>>'{flow,id}'
      and exists(select 1 from jsonb_array_elements(q->'rows') r where r->>'label'='비공개 시기 이름'
        and r#>>array['answers',fixture.doc#>>'{flow,fields,0,id}']='비공개 입력')) then
    raise exception 'Inactive flow exposed labels/answers or lost private draft metadata';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from flow_users where role='admin'),true);
set local role authenticated;
do $$
declare fixture record; shown jsonb;
begin
  select * into fixture from flow_cases where name='flow';
  shown:=public.list_submitted_questionnaire_responses(fixture.questionnaire_id);
  if jsonb_array_length(shown)<>1 or not exists(select 1 from jsonb_array_elements(shown#>'{0,questions,0,rows}') r
    where r->>'id'='501' and r->>'flowAfter'='1' and r->>'label'='고1 여름 수정') then
    raise exception 'Staff submitted view lost inserted period names';
  end if;
  begin
    perform public.save_question(fixture.doc||jsonb_build_object('flowInsertAfter','[]'::jsonb),3,gen_random_uuid());
    raise exception 'Admin bypassed the published source lock';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
do $$ begin
  if md5(pg_get_functiondef('private.guide_consultant_id()'::regprocedure)) is distinct from (select hash from flow_guide_baseline) then
    raise exception 'Configured guide function changed';
  end if;
end $$;
select jsonb_build_object('test','question_flow_insertions','passed',true,'syntheticOrigins',5,'guideFunctionUnchanged',true) result;
rollback;
