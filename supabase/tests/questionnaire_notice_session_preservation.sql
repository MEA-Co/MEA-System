-- After the corrected notice migration, before the workflow rename. Independent
-- comparisons of complete rows, not just text snippets or migration fingerprints.
do $$
declare expected jsonb; actual jsonb; prior record; migrated_ids text[];
begin
 select array_agg(distinct notice_id::text) into migrated_ids from notice_test_docs where name<>'unrelated';
 if (select count(*) from public.response_sessions)<>(select count(*) from notice_test_before_sessions)
 then raise exception 'Session count changed'; end if;
 for prior in select * from notice_test_before_sessions loop
   select to_jsonb(s) into actual from public.response_sessions s where s.id=prior.id;
   expected:=to_jsonb(prior);
   if prior.origin_questionnaire_id in(select id from notice_test_docs where name<>'unrelated') then
     expected:=expected||jsonb_build_object('layout',(
       select jsonb_agg(sec||jsonb_build_object('questions',remaining) order by n)
       from jsonb_array_elements(prior.layout) with ordinality x(sec,n)
       cross join lateral (select coalesce(jsonb_agg(p order by i),'[]'::jsonb) remaining
         from jsonb_array_elements(sec->'questions') with ordinality y(p,i)
         where p->>'sourceQuestionId'<>all(migrated_ids)) rest where remaining<>'[]'::jsonb));
     if prior.last_payload ? 'answers' then
       expected:=jsonb_set(expected,'{last_payload,answers}',(prior.last_payload->'answers')-migrated_ids);
     end if;
   end if;
   if expected is distinct from actual then raise exception 'Session metadata/layout/retry changed unexpectedly: %',prior.id; end if;
 end loop;
 if exists((select * from notice_test_before_answers where question_id::text<>all(migrated_ids) except select * from public.question_responses)
   union all (select * from public.question_responses except select * from notice_test_before_answers where question_id::text<>all(migrated_ids)))
 then raise exception 'Actual answer identity/value/metadata changed'; end if;
 if (select count(*) from public.response_submissions)<>(select count(*) from notice_test_before_submissions)
 then raise exception 'Submission count changed'; end if;
 for prior in select * from notice_test_before_submissions loop
   select to_jsonb(s) into actual from public.response_submissions s where s.session_id=prior.session_id;
   expected:=to_jsonb(prior)||jsonb_build_object('answers',prior.answers-migrated_ids);
   if actual is distinct from expected then raise exception 'Submitted contents or timestamp changed'; end if;
 end loop;
 if exists((select to_jsonb(q) from public.questions q where q.purpose='response'
   except select to_jsonb(q) from notice_test_before_questions q where q.purpose='response')
   union all (select to_jsonb(q) from notice_test_before_questions q where q.purpose='response'
   except select to_jsonb(q) from public.questions q where q.purpose='response'))
 then raise exception 'Actual question changed'; end if;
 for prior in select * from notice_test_before_questionnaires loop
   select to_jsonb(q) into actual from public.questionnaires q where q.id=prior.id;
   if prior.id in(select id from notice_test_docs where name<>'unrelated') then
     if actual->'revision' is distinct from to_jsonb(prior.revision+1)
       or actual->>'last_save_id' is not distinct from prior.last_save_id::text
       or actual->>'last_save_hash' is distinct from ''
       or actual->'start_notice' is distinct from
         '{"title":"등록 안내","body":"원본 안내 본문","buttonLabel":"학습법 추가"}'::jsonb
       or actual-array['start_notice','revision','last_save_id','last_save_hash']
         is distinct from to_jsonb(prior)-array['revision','last_save_id','last_save_hash']
     then raise exception 'Unexpected notice document change'; end if;
   elsif actual-'start_notice' is distinct from to_jsonb(prior) or actual->'start_notice'<>'null'::jsonb then
     raise exception 'Unrelated questionnaire changed';
   end if;
 end loop;
 if exists((select * from notice_test_before_placements where source_question_id::text<>all(migrated_ids)
   except select * from public.questionnaire_questions)
   union all (select * from public.questionnaire_questions except
     select * from notice_test_before_placements where source_question_id::text<>all(migrated_ids)))
 then raise exception 'Non-notice placement changed'; end if;
 if exists((select s.* from notice_test_before_sections s where s.title<>'안내 섹션'
   except select * from public.questionnaire_sections)
   union all (select * from public.questionnaire_sections except
     select s.* from notice_test_before_sections s where s.title<>'안내 섹션'))
 then raise exception 'Non-empty section changed'; end if;
 if exists(select 1 from public.questionnaire_questions where source_question_id::text=any(migrated_ids))
   or exists(select 1 from public.questions where id::text=any(migrated_ids) and archived_at is null)
 then raise exception 'Registration still an active question'; end if;
 if exists((select tgrelid::regclass::text,tgname,tgenabled from pg_trigger where not tgisinternal and tgname not in ('guard_start_notice','reject_new_registration_question')
   except select * from notice_test_before_guards)
   union all (select * from notice_test_before_guards except select tgrelid::regclass::text,tgname,tgenabled from pg_trigger where not tgisinternal))
 then raise exception 'Existing trigger state changed'; end if;
end $$;
