-- Run inside the rollback-only migration trial, after before_notice_* snapshots.
do $$
declare notice_ids uuid[]; before_submission record; begin
 select array_agg(id) into notice_ids from before_notice_source;
 if exists((select * from before_notice_questions except select * from public.questions)
 union all (select * from public.questions where purpose<>'study_registration' except select * from before_notice_questions))
 then raise exception 'Unrelated questions changed'; end if;
 if exists((select * from before_notice_answers where not coalesce(question_id=any(notice_ids),false)
   except select * from public.question_responses)
 union all (select * from public.question_responses except
   select * from before_notice_answers where not coalesce(question_id=any(notice_ids),false)))
 then raise exception 'Responses changed'; end if;
 if (select count(*) from before_notice_submissions)<>(select count(*) from public.response_submissions)
 then raise exception 'Submission count changed'; end if;
 for before_submission in select * from before_notice_submissions loop
   if (select to_jsonb(s) from public.response_submissions s where s.session_id=before_submission.session_id)
     is distinct from (to_jsonb(before_submission)||jsonb_build_object('answers',
       before_submission.answers-array(select id::text from before_notice_source)))
   then raise exception 'Actual submission contents or metadata changed'; end if;
 end loop;
 if exists(select 1 from before_notice_source q where not exists(
 select 1 from public.questionnaires v where v.start_notice=jsonb_build_object('title',q.title,'body',q.prompt,'buttonLabel',q.button_label)))
 then raise exception 'Notice content not preserved'; end if;
 if exists(select 1 from public.questionnaire_questions p join before_notice_source q on q.id=p.source_question_id)
 then raise exception 'Notice still placed as question'; end if;
 if exists(select 1 from pg_trigger where tgname in ('guard_published_version','guard_published_question','guard_published_section','a_distributed_question_lock','response_session_identity','question_response_identity') and tgenabled<>'O')
 then raise exception 'Guard not restored'; end if;
end $$;
