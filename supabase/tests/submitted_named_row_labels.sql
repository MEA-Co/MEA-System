\set ON_ERROR_STOP on
begin;
create temp table label_users(id uuid default gen_random_uuid(),role text);
insert into label_users(role) values('consultant_lead'),('consultant');
insert into auth.users(id) select id from label_users;
insert into public.profiles(id,role,name) select id,role,'행 이름 회귀' from label_users;
create temp table label_fixture(qid uuid,source_id uuid,sid uuid,expected jsonb,submitted_at timestamptz,revision int);
grant all on label_users,label_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from label_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare q jsonb; d jsonb; begin
 q:=jsonb_build_object('id',gen_random_uuid(),'title','이름 있는 항목','prompt','기억나는 항목만 작성','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','repeatable','minRows',1,'maxRows',3,'rowLabels',jsonb_build_array('첫 항목','둘째 항목','셋째 항목'),'answerLayout','table','initialRows',1,'flowInsertAfter','[]'::jsonb,'details','[]'::jsonb);
 perform public.save_question(q,0,gen_random_uuid());
 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','행 이름 보존','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','구역','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text',q->>'prompt','details','[]'::jsonb)))));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
 perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,2,'published',null,'distributed',gen_random_uuid());
 insert into label_fixture(qid,source_id) values((d->>'questionnaireId')::uuid,(q->>'id')::uuid);
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from label_users where role='consultant'),true);
set local role authenticated;
do $$ declare x jsonb; payload jsonb; source text; field text; begin
 x:=public.open_distributed_question_response_session((select qid from label_fixture));
 source:=x#>>'{questions,0,questionId}';field:=x#>>'{questions,0,definition,fields,0,id}';
 -- Nonsequential and negative IDs are identities, not original ordinals.
 payload:=jsonb_build_object(source,jsonb_build_array(
   jsonb_build_object('id',500,'answers',jsonb_build_object(field,'첫째 내용')),
   jsonb_build_object('id',-17,'answers','{}'::jsonb),
   jsonb_build_object('id',900,'answers',jsonb_build_object(field,'셋째 내용'))));
 x:=public.save_distributed_question_response_session((select qid from label_fixture),payload,0,gen_random_uuid(),true,x->>'definitionToken');
 update label_fixture set sid=(x->>'id')::uuid;
end $$;
reset role;
do $$ declare snapshot jsonb; source text:=(select source_id::text from label_fixture); begin
 select sub.answers into snapshot from response_submissions sub join label_fixture f on f.sid=sub.session_id;
 if snapshot#>>array[source,'rows','0','label']<>'첫 항목' or snapshot#>>array[source,'rows','1','label']<>'셋째 항목'
   or jsonb_array_length(snapshot#>array[source,'rows'])<>2 then raise exception 'Sparse row labels lost: %',snapshot; end if;
 if exists(select 1 from question_responses r join label_fixture f on f.sid=r.session_id cross join lateral jsonb_array_elements(r.rows) row where row ? 'label') then raise exception 'Editable rows contaminated'; end if;
 update label_fixture f set expected=sub.answers,submitted_at=sub.submitted_at,revision=sub.revision from response_submissions sub where sub.session_id=f.sid;
 -- Recreate an old snapshot that lacks metadata, retaining content and timestamps.
 update response_submissions sub set answers=jsonb_set(sub.answers,array[source,'rows'],(select jsonb_agg(row-'label') from jsonb_array_elements(sub.answers#>array[source,'rows']) row)) where sub.session_id=(select sid from label_fixture);
end $$;
\ir ../migrations/20261014075610_submitted_named_row_labels.sql
do $$ begin
 if exists(select 1 from response_submissions sub join label_fixture f on f.sid=sub.session_id where sub.answers<>f.expected or sub.submitted_at<>f.submitted_at or sub.revision<>f.revision) then raise exception 'Safe historical restoration changed content/time or failed'; end if;
end $$;
-- A subsequent private edit makes the old snapshot ineligible for restoration.
do $$ declare source text:=(select source_id::text from label_fixture); begin
 update response_submissions sub set answers=jsonb_set(sub.answers,array[source,'rows'],(select jsonb_agg(row-'label') from jsonb_array_elements(sub.answers#>array[source,'rows']) row)) where sub.session_id=(select sid from label_fixture);
 update response_sessions set revision=revision+1 where id=(select sid from label_fixture);
 update label_fixture f set expected=sub.answers from response_submissions sub where sub.session_id=f.sid;
end $$;
\ir ../migrations/20261014075610_submitted_named_row_labels.sql
do $$ begin
 if exists(select 1 from response_submissions sub join label_fixture f on f.sid=sub.session_id where sub.answers<>f.expected or sub.submitted_at<>f.submitted_at or sub.revision<>f.revision) then raise exception 'Historical snapshot guessed from a later private edit'; end if;
 raise notice 'Sparse names, negative IDs, editable isolation, safe backfill and private-edit preservation passed';
end $$;
rollback;
