-- Run after question_answer_layouts. All fixtures and substitutions roll back.
begin;
create temporary table layout_users as
  select gen_random_uuid() id, role from unnest(array['consultant_lead','guide','consultant']) role;
insert into auth.users(id) select id from layout_users;
insert into public.profiles(id,role,name)
  select id,case when role='guide' then 'consultant_lead' else role end,'표형 응답 검증' from layout_users;
create or replace function private.guide_consultant_id() returns uuid
language sql stable set search_path='' as $$ select id from pg_temp.layout_users where role='guide'; $$;
create temporary table layout_docs(name text primary key, doc jsonb, questionnaire_id uuid);
grant select on layout_users to authenticated;
grant all on layout_docs to authenticated;

select set_config('request.jwt.claim.sub',(select id::text from layout_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare name text; q jsonb; saved jsonb; d jsonb; sid uuid; second jsonb;
begin
  foreach name in array array['table','flow','cards','flow_minimum'] loop
    q:=jsonb_build_object('id',gen_random_uuid(),'title',name,'prompt','표형 응답',
      'fields',jsonb_build_array(
        jsonb_build_object('id',gen_random_uuid(),'label','성적 또는 추천','kind','text'),
        jsonb_build_object('id',gen_random_uuid(),'label','선택 메모','kind','text','required',false),
        jsonb_build_object('id',gen_random_uuid(),'label','선택 점수','kind','scale','scaleMax',5,'required',false),
        jsonb_build_object('id',gen_random_uuid(),'label','선택 직접 입력','kind','single','required',false,
          'options',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','직접 입력','isOther',true),
            jsonb_build_object('id',gen_random_uuid(),'label','기타')))),
      'rowMode','repeatable','maxRows',5,'minRows',case when name in ('table','flow_minimum') then 2 else 1 end,
      'rowLabels',jsonb_build_array('고1 1학기','고1 2학기','고2 1학기','고2 2학기','고3'),
      'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
    if name <> 'cards' then
      q:=q||jsonb_build_object('answerLayout',case when name='flow_minimum' then 'flow' else name end,'initialRows',5);
    end if;
    sid:=gen_random_uuid();
    saved:=public.save_question(q,0,sid);
    if saved->>'answer_layout' <> (case when name='flow_minimum' then 'flow' else name end)
      or (saved->>'initial_rows')::int <> (case when name='cards' then 1 else 5 end) then
      raise exception 'Layout settings did not round trip';
    end if;
    if public.save_question(q,0,sid) <> saved then raise exception 'Question retry changed layout'; end if;
    begin
      perform public.save_question(jsonb_set(q||jsonb_build_object('answerLayout','invalid'),'{id}',to_jsonb(gen_random_uuid())),0,gen_random_uuid());
      raise exception 'Invalid layout accepted';
    exception when check_violation then null; end;
    begin
      perform public.save_question(jsonb_set(q||jsonb_build_object('initialRows',6),'{id}',to_jsonb(gen_random_uuid())),0,gen_random_uuid());
      raise exception 'Initial rows exceeded maximum';
    exception when check_violation then null; end;
    begin
      perform public.save_question(jsonb_set(jsonb_set(q,'{fields,1,required}','"false"'::jsonb),'{id}',to_jsonb(gen_random_uuid())),0,gen_random_uuid());
      raise exception 'Nonboolean required flag accepted';
    exception when check_violation then null; end;
    saved:=public.save_question(q,1,gen_random_uuid());
    if (saved->>'revision')::int <> 2 then raise exception 'Layout update failed'; end if;
    d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title',name,
      'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','표',
        'questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),
          'sourceQuestionId',q->'id','text','표형 응답','details','[]'::jsonb)))));
    perform public.save_questionnaire_draft(d,0,gen_random_uuid());
    perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
    if public.read_published_question_sources((d->>'questionnaireId')::uuid)#>>'{0,answer_layout}' <> saved->>'answer_layout'
      or public.read_published_question_sources((d->>'questionnaireId')::uuid)#>>'{0,initial_rows}' <> saved->>'initial_rows' then
      raise exception 'Published source omitted layout';
    end if;
    insert into layout_docs values(name,q,(d->>'questionnaireId')::uuid);
  end loop;

  -- Flow does not follow another question's changing row count.
  q:=(select doc from layout_docs where layout_docs.name='flow');
  second:=(select doc from layout_docs where layout_docs.name='table');
  q:=q||jsonb_build_object('id',gen_random_uuid(),'rowMode','reference','maxRows',null,'initialRows',1,
    'minRows',1,'sourceBlockId',second->'id','sourceFieldId',second#>'{fields,0,id}');
  begin
    perform public.save_question(q,0,gen_random_uuid());
    raise exception 'Reference flow accepted';
  exception when check_violation then null; end;
end $$;
reset role;

-- Published guide completion uses the same optional fields and spare-row rules.
select set_config('request.jwt.claim.sub',(select id::text from layout_users where role='guide'),true);
set local role authenticated;
do $$
declare fixture record; x jsonb; payload jsonb; filled jsonb; fid text; incomplete_other jsonb;
begin
  for fixture in select * from layout_docs where name in ('table','flow','cards') loop
    x:=public.open_question_response_session(fixture.questionnaire_id);
    fid:=fixture.doc#>>'{fields,0,id}';
    filled:=jsonb_build_array(jsonb_build_object('id',10,'answers',jsonb_build_object(fid,'첫 답변')));
    if fixture.name='table' then
      filled:=filled||jsonb_build_array(jsonb_build_object('id',20,'answers',jsonb_build_object(fid,'둘째 답변')));
    end if;
    if fixture.name<>'cards' then
      filled:=filled||jsonb_build_array(jsonb_build_object('id',-1,'answers','{}'::jsonb),jsonb_build_object('id',-2,'answers','{}'::jsonb));
    end if;
    payload:=jsonb_build_object(fixture.doc->>'id',filled);
    incomplete_other:=jsonb_build_object('id',404,'answers',jsonb_build_object(fixture.doc#>>'{fields,3,id}',
      jsonb_build_object('id',fixture.doc#>>'{fields,3,options,0,id}','text','')::text));
    begin
      perform public.save_question_response_session(fixture.questionnaire_id,
        jsonb_build_object(fixture.doc->>'id',filled||jsonb_build_array(incomplete_other)),0,gen_random_uuid(),true,x->>'definitionToken');
      raise exception 'Incomplete optional Other submitted as a blank guide spare row';
    exception when invalid_parameter_value then null; end;
    x:=public.save_question_response_session(fixture.questionnaire_id,payload,0,gen_random_uuid(),true,x->>'definitionToken');
    if jsonb_array_length(x#>'{questions,0,activeRowIds}') <> (case when fixture.name='table' then 2 else 1 end) then
      raise exception 'Published spare rows counted as active';
    end if;
    if x#>'{questions,0,rows}' <> filled then raise exception 'Raw guide row IDs or blanks changed'; end if;
  end loop;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from layout_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare fixture record; begin
  for fixture in select * from layout_docs loop
    perform public.change_questionnaire_status(fixture.questionnaire_id,2,'published',null,'distributed',gen_random_uuid());
  end loop;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from layout_users where role='consultant'),true);
set local role authenticated;
do $$
declare fixture record; x jsonb; payload jsonb; raw_rows jsonb; fid text; scale_id text; sid uuid; incomplete_other jsonb;
begin
  for fixture in select * from layout_docs loop
    x:=public.open_distributed_question_response_session(fixture.questionnaire_id);
    fid:=fixture.doc#>>'{fields,0,id}'; scale_id:=fixture.doc#>>'{fields,2,id}';
    raw_rows:=jsonb_build_array(
      jsonb_build_object('id',-8,'answers','{}'::jsonb),
      jsonb_build_object('id',101,'answers',jsonb_build_object(fid,'한 칸 답변')),
      jsonb_build_object('id',-9,'answers','{}'::jsonb),
      jsonb_build_object('id',202,'answers','{}'::jsonb),
      jsonb_build_object('id',-10,'answers','{}'::jsonb));
    payload:=jsonb_build_object(fixture.doc->>'id',raw_rows);
    if fixture.name in ('table','flow_minimum') then
      begin
        perform public.save_distributed_question_response_session(fixture.questionnaire_id,payload,0,gen_random_uuid(),true,x->>'definitionToken');
        raise exception 'Blank slots satisfied required row count';
      exception when invalid_parameter_value then null; end;
      raw_rows:=jsonb_set(raw_rows,'{3,answers}',jsonb_build_object(fid,'둘째 답변'));
      payload:=jsonb_build_object(fixture.doc->>'id',raw_rows);
    end if;
    if fixture.name='cards' then
      begin
        perform public.save_distributed_question_response_session(fixture.questionnaire_id,payload,0,gen_random_uuid(),true,x->>'definitionToken');
        raise exception 'Cards stopped requiring their blank rows';
      exception when invalid_parameter_value then null; end;
      raw_rows:=jsonb_build_array(raw_rows->1);
      payload:=jsonb_build_object(fixture.doc->>'id',raw_rows);
    end if;
    -- Optional and sparse fields still reject invalid nonempty typed values.
    begin
      perform public.save_distributed_question_response_session(fixture.questionnaire_id,
        jsonb_build_object(fixture.doc->>'id',jsonb_set(raw_rows,
          case when fixture.name='cards' then array['0','answers',scale_id] else array['1','answers',scale_id] end,
          '"99"'::jsonb)),0,gen_random_uuid(),true,x->>'definitionToken');
      raise exception 'Invalid optional scale value accepted';
    exception when invalid_parameter_value then null; end;
    incomplete_other:=jsonb_build_object(fixture.doc#>>'{fields,3,id}',
      jsonb_build_object('id',fixture.doc#>>'{fields,3,options,0,id}','text','')::text);
    begin
      perform public.save_distributed_question_response_session(fixture.questionnaire_id,
        jsonb_build_object(fixture.doc->>'id',case when fixture.name='cards' then
          raw_rows||jsonb_build_array(jsonb_build_object('id',404,'answers',incomplete_other))
          else jsonb_set(raw_rows,'{2,answers}',incomplete_other) end),
        0,gen_random_uuid(),true,x->>'definitionToken');
      raise exception 'Incomplete optional Other submitted as a blank spare row';
    exception when invalid_parameter_value then null; end;
    begin
      perform public.save_distributed_question_response_session(fixture.questionnaire_id,
        jsonb_build_object(fixture.doc->>'id',jsonb_build_array(jsonb_build_object('id',1,'answers','{}'::jsonb))),
        0,gen_random_uuid(),true,x->>'definitionToken');
      raise exception 'Entirely empty question submitted';
    exception when invalid_parameter_value then null; end;
    sid:=gen_random_uuid();
    x:=public.save_distributed_question_response_session(fixture.questionnaire_id,payload,0,sid,true,x->>'definitionToken');
    if public.save_distributed_question_response_session(fixture.questionnaire_id,payload,0,sid,true,x->>'definitionToken')<>x then
      raise exception 'Submission retry changed result';
    end if;
    if x#>'{questions,0,rows}' <> raw_rows then raise exception 'Raw row IDs or period slots changed'; end if;
    if jsonb_array_length(x#>'{questions,0,activeRowIds}') <> (case when fixture.name in ('table','flow_minimum') then 2 else 1 end) then
      raise exception 'Blank rows entered the active answer set';
    end if;
    if jsonb_array_length((select answers->(fixture.doc->>'id')->'rows' from public.response_submissions where session_id=(x->>'id')::uuid))
      <> (case when fixture.name in ('flow','flow_minimum') then 5 when fixture.name='table' then 2 else 1 end) then
      raise exception 'Submission lost flow slots or exposed table spare rows';
    end if;
  end loop;
end $$;
reset role;

-- Condition-hidden flow input must remain private while its period slots survive.
select set_config('request.jwt.claim.sub',(select id::text from layout_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare source jsonb; flow jsonb; d jsonb;
begin
  source:=jsonb_build_object('id',gen_random_uuid(),'title','조건 원본','prompt','조건 원본',
    'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','선택 답변','kind','text','required',false)),
    'rowMode','single','maxRows',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
  perform public.save_question(source,0,gen_random_uuid());
  flow:=(select doc from layout_docs where name='flow')||jsonb_build_object('id',gen_random_uuid(),
    'condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(jsonb_build_object('blockId',source->'id','op','answered'))));
  perform public.save_question(flow,0,gen_random_uuid());
  d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','조건부 흐름',
    'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','조건',
      'questions',jsonb_build_array(
        jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',source->'id','text','조건 원본','details','[]'::jsonb),
        jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',flow->'id','text','흐름','details','[]'::jsonb)))));
  perform public.save_questionnaire_draft(d,0,gen_random_uuid());
  perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
  perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,2,'published',null,'distributed',gen_random_uuid());
  insert into layout_docs values('conditional',jsonb_build_object('source',source,'flow',flow),(d->>'questionnaireId')::uuid);
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from layout_users where role='consultant'),true);
set local role authenticated;
do $$
declare fixture record; x jsonb; raw_rows jsonb; payload jsonb; submission jsonb;
begin
  select * into fixture from layout_docs where name='conditional';
  x:=public.open_distributed_question_response_session(fixture.questionnaire_id);
  raw_rows:=jsonb_build_array(jsonb_build_object('id',77,'answers',jsonb_build_object(fixture.doc#>>'{flow,fields,0,id}','비공개 조건 입력')),
    jsonb_build_object('id',-77,'answers','{}'::jsonb));
  payload:=jsonb_build_object(fixture.doc#>>'{source,id}',jsonb_build_array(jsonb_build_object('id',1,'answers','{}'::jsonb)),
    fixture.doc#>>'{flow,id}',raw_rows);
  x:=public.save_distributed_question_response_session(fixture.questionnaire_id,payload,0,gen_random_uuid(),true,x->>'definitionToken');
  select answers->(fixture.doc#>>'{flow,id}') into submission from public.response_submissions where session_id=(x->>'id')::uuid;
  if jsonb_array_length(submission->'rows')<>2 or submission->'activeRowIds'<>'[]'::jsonb
    or submission::text like '%비공개 조건 입력%' then raise exception 'Inactive flow answers leaked or periods disappeared'; end if;
end $$;
reset role;
rollback;
