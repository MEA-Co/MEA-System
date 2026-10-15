-- Run after ALL pending migrations on the synthetic pre-notice fixtures.
-- Prove existing users can read, retry, continue and submit without losing the
-- distinction between private working answers and their last submitted copy.
grant select on notice_test_before_sessions, notice_test_before_answers,
 notice_test_before_submissions to authenticated;
set local role authenticated;
do $$
declare u record; d record; prior record; x jsonb; again jsonb; submitted jsonb; payload jsonb;
begin
 for u in select * from notice_test_users where name not in ('owner','guide') loop
   perform set_config('request.jwt.claim.sub',u.id::text,true);
   for d in select * from notice_test_docs loop
     select * into strict prior from notice_test_before_sessions
       where respondent_id=u.id and origin_questionnaire_id=d.id and started_stage='distributed';
     x:=public.open_published_question_response_session(d.id);
     if x->>'id' is distinct from prior.id::text
       or (x->>'revision')::int is distinct from prior.revision
       or x->>'status' is distinct from prior.status
       or jsonb_array_length(x->'questions')<>1
       or x#>>'{questions,0,questionId}' is distinct from d.answer_id::text
       or x#>>'{questions,0,responseId}' is distinct from
         (select id::text from notice_test_before_answers where session_id=prior.id and question_id=d.answer_id)
     then raise exception 'Reopening changed response identity or state: % / %',u.name,d.name; end if;
     if d.name<>'unrelated' and x#>>'{startNotice,body}' is distinct from '원본 안내 본문'
     then raise exception 'Notice is missing from existing response'; end if;
     if x#>'{questions,0,rows}' is distinct from
       (select rows from notice_test_before_answers where session_id=prior.id and question_id=d.answer_id)
     then raise exception 'Reopening changed saved answers'; end if;
     if u.name='private_edit' and not (x->>'hasUnsubmittedChanges')::boolean
     then raise exception 'Private edits mistaken for submitted answers'; end if;
     if prior.last_save_id is not null then
       -- A retry of the same saved operation remains idempotent after dropping
       -- only the notice key. Stale revisions must not cause a second write.
       again:=public.save_published_question_response_session(d.id,
         (prior.last_payload->'answers')-d.notice_id::text,prior.revision-1,
         prior.last_save_id,(prior.last_payload->>'complete')::boolean,x->>'definitionToken');
       if again is distinct from x then raise exception 'Saved retry changed response'; end if;
     end if;
     if u.name='opened' then
       if (select last_save_id from public.response_sessions where id=prior.id) is not null
       then raise exception 'Opening created a save'; end if;
       continue;
     end if;
     select to_jsonb(s) into submitted from notice_test_before_submissions s where s.session_id=prior.id;
     payload:=jsonb_build_object(d.answer_id::text,x#>'{questions,0,rows}');
     payload:=jsonb_set(payload,array[d.answer_id::text,'0','answers',d.field_id::text],'"이전 이후 이어서 작성"');
     x:=public.save_published_question_response_session(d.id,payload,(x->>'revision')::int,
       gen_random_uuid(),false,x->>'definitionToken');
     if (select to_jsonb(s)||jsonb_build_object('answers',s.answers-d.notice_id::text)
         from public.response_submissions s where s.session_id=prior.id)
       is distinct from (case when submitted is null then null
         else submitted||jsonb_build_object('answers',(submitted->'answers')-d.notice_id::text) end)
     then raise exception 'Continuing draft rewrote the last submission'; end if;
     if u.name in ('draft','private_edit') then
       x:=public.save_published_question_response_session(d.id,payload,(x->>'revision')::int,
         gen_random_uuid(),true,x->>'definitionToken');
       if x->>'status'<>'submitted'
         or (select answers ? d.notice_id::text from public.response_submissions where session_id=prior.id)
         or (select answers#>>array[d.answer_id::text,'rows','0','answers',d.field_id::text]
           from public.response_submissions where session_id=prior.id) is distinct from '이전 이후 이어서 작성'
       then raise exception 'Submission after migration failed'; end if;
     end if;
   end loop;
 end loop;
 -- Staff reads remain limited to submitted contents, never the private edits.
 perform set_config('request.jwt.claim.sub',(select id::text from notice_test_users where name='owner'),true);
 for d in select * from notice_test_docs loop
   x:=public.list_submitted_questionnaire_responses(d.id);
   if jsonb_array_length(x)<>3 or x::text like '%'||d.notice_id::text||'%'
   then raise exception 'Invalid staff submission projection'; end if;
   x:=public.read_guide_answers(array[d.answer_id]);
   if x::text not like '%가이드 원문%' or x::text like '%이전 이후 이어서 작성%'
   then raise exception 'Guide answers changed or private answer exposed'; end if;
 end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
