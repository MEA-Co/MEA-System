begin;
create temp table response_test_users as select gen_random_uuid() id,n,case when n=0 then 'consultant_lead' when n=12 then 'admin' else 'consultant' end role from generate_series(0,12) n;
insert into auth.users(id) select id from response_test_users;
insert into public.profiles(id,role,name) select id,role,'응답 검증 가상 사용자 '||n from response_test_users;
create temp table response_test_docs(qid uuid,other_qid uuid,question_id uuid,fields jsonb);
create temp table response_test_sessions(sid uuid,revision integer);
grant select on response_test_users,response_test_docs,response_test_sessions to authenticated;
grant insert,update on response_test_docs,response_test_sessions to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from response_test_users where n=0),true);
set local role authenticated;
do $$ declare q jsonb; d jsonb; qid uuid:=gen_random_uuid(); other_qid uuid:=gen_random_uuid(); fields jsonb; rule jsonb; begin
 select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'label','시기 '||n,'kind','text')) into fields from generate_series(1,4) n;
 rule:=jsonb_build_object('kind','career_flow','startFieldIds',jsonb_build_array(fields#>>'{0,id}',fields#>>'{1,id}'),'admissionFieldId',fields#>>'{2,id}');
 q:=jsonb_build_object('id',gen_random_uuid(),'title','필수 시기 검사','prompt','진로 흐름','fields',fields,'responseRequirements',rule,'rowMode','repeatable','maxRows',20,'minRows',1,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 begin
  perform public.save_question(jsonb_set(q,'{responseRequirements,admissionFieldId}',to_jsonb(gen_random_uuid())),0,gen_random_uuid());
  raise exception 'Foreign required field accepted';
 exception when check_violation then null; end;
 perform public.save_question(q,0,gen_random_uuid());
 -- Older clients omitting the additive property must preserve it.
 perform public.save_question(q-'responseRequirements',1,gen_random_uuid());
 if (select response_requirements from public.questions where id=(q->>'id')::uuid)<>rule then raise exception 'Omission lost requirements'; end if;
 d:=jsonb_build_object('questionnaireId',qid,'title','응답 검사 질문지','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text','진로 흐름','details','[]'::jsonb)))));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 perform public.change_questionnaire_status(qid,1,'draft',null,'in_review',gen_random_uuid(),2);
 perform public.change_questionnaire_status(qid,2,'in_review',null,'published',gen_random_uuid(),2);
 d:=jsonb_set(d,'{questionnaireId}',to_jsonb(other_qid));
 d:=jsonb_set(d,'{sections,0,id}',to_jsonb(gen_random_uuid()));
 d:=jsonb_set(d,'{sections,0,questions,0,id}',to_jsonb(gen_random_uuid()));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 perform public.change_questionnaire_status(other_qid,1,'draft',null,'in_review',gen_random_uuid(),2);
 perform public.change_questionnaire_status(other_qid,2,'in_review',null,'published',gen_random_uuid(),2);
 insert into response_test_docs values(qid,other_qid,(q->>'id')::uuid,fields);
 begin
  perform public.save_question(q,2,gen_random_uuid()); raise exception 'Released question edited';
 exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
-- Every consultant can still answer the release; only the submit boundary checks requirements.
do $$ declare u record; x jsonb; payload jsonb; d record; f jsonb; sid uuid; begin
 select * into d from response_test_docs;
 for u in select * from response_test_users where n between 1 and 11 loop
  perform set_config('request.jwt.claim.sub',u.id::text,true);
  set local role authenticated;
  x:=public.open_published_question_response_session(d.qid);
  payload:=jsonb_build_object(d.question_id::text,jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(d.fields#>>'{3,id}','선택 시기만 답변'))));
  x:=public.save_published_question_response_session(d.qid,payload,0,gen_random_uuid(),false,x->>'definitionToken');
  begin
   perform public.save_published_question_response_session(d.qid,payload,1,gen_random_uuid(),true,x->>'definitionToken'); raise exception 'Only optional period submitted';
  exception when invalid_parameter_value then if sqlerrm<>'Missing career flow required periods' then raise; end if; end;
  payload:=jsonb_set(payload,array[d.question_id::text,'0','answers',d.fields#>>'{0,id}'],'"중등 답변"');
  begin
   perform public.save_published_question_response_session(d.qid,payload,1,gen_random_uuid(),true,x->>'definitionToken'); raise exception 'Missing admission accepted';
  exception when invalid_parameter_value then null; end;
  payload:=jsonb_set(payload,array[d.question_id::text,'0','answers',d.fields#>>'{2,id}'],'"원서 답변"');
  x:=public.save_published_question_response_session(d.qid,payload,1,gen_random_uuid(),true,x->>'definitionToken');
  insert into response_test_sessions values((x->>'id')::uuid,2);
  -- Save a private change after submission: list/detail must still use submission.
  payload:=jsonb_set(payload,array[d.question_id::text,'0','answers',d.fields#>>'{2,id}'],'"미제출 수정"');
  perform public.save_published_question_response_session(d.qid,payload,2,gen_random_uuid(),false,x->>'definitionToken');
  begin
   perform public.read_submitted_response_page(d.qid,1); raise exception 'Consultant read staff list';
  exception when insufficient_privilege then null; end;
  reset role;
 end loop;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from response_test_users where n=0),true);
set local role authenticated;
do $$ declare d record; page1 jsonb; page2 jsonb; detail jsonb; sid uuid; begin
 select * into d from response_test_docs;
 page1:=public.read_submitted_response_page(d.qid,1); page2:=public.read_submitted_response_page(d.qid,2);
 if (page1->>'total')::int<>11 or jsonb_array_length(page1->'items')<>10 or jsonb_array_length(page2->'items')<>1 then raise exception 'Wrong page size/count'; end if;
 if exists(select 1 from jsonb_array_elements(page1->'items') item where item ? 'questions' or item ? 'sections' or item ? 'answers') then raise exception 'List loaded answer bodies'; end if;
 if public.read_submitted_response_page(d.qid,100)->>'page'<>'2' then raise exception 'Page not clamped'; end if;
 sid:=(page1#>>'{items,0,id}')::uuid;
 detail:=public.read_submitted_response(d.qid,sid,2);
 if detail::text like '%미제출 수정%' or detail::text not like '%원서 답변%' then raise exception 'Unsubmitted draft leaked'; end if;
 if jsonb_array_length(public.read_submitted_response_manifest(d.qid))<>11 then raise exception 'Incomplete manifest'; end if;
 begin
  perform public.read_submitted_response(d.other_qid,sid,null); raise exception 'Cross-questionnaire detail leaked';
 exception when no_data_found then null; end;
 begin
  perform public.read_submitted_response(d.qid,sid,1); raise exception 'Export revision mismatch accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.read_submitted_response_page(d.qid,0); raise exception 'Invalid page accepted';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from response_test_users where n=12),true);
set local role authenticated;
do $$ begin
 if public.read_submitted_response_page((select qid from response_test_docs),1)->>'total'<>'11' then raise exception 'Admin access changed'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.read_submitted_response(uuid,uuid,integer)','execute') or
 has_function_privilege('anon','public.read_submitted_response_page(uuid,integer)','execute') or
 has_function_privilege('anon','public.read_submitted_response_manifest(uuid)','execute') then raise exception 'Anonymous access granted'; end if;
 if has_table_privilege('authenticated','public.response_submissions','update') then raise exception 'Direct writes granted'; end if;
end $$;
rollback;
