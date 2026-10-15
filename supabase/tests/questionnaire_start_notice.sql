-- Run inside the rollback-only migration trial, after before_notice_* snapshots.
do $$
begin
 if exists((select * from before_notice_questions except select * from public.questions)
 union all (select * from public.questions where purpose<>'study_registration' except select * from before_notice_questions))
 then raise exception 'Unrelated questions changed'; end if;
 if exists((select * from before_notice_answers except select * from public.question_responses)
 union all (select * from public.question_responses except select * from before_notice_answers))
 then raise exception 'Responses changed'; end if;
 if exists((select * from before_notice_submissions except select * from public.response_submissions)
 union all (select * from public.response_submissions except select * from before_notice_submissions))
 then raise exception 'Submissions changed'; end if;
 if exists(select 1 from before_notice_source q where not exists(
 select 1 from public.questionnaires v where v.start_notice=jsonb_build_object('title',q.title,'body',q.prompt,'buttonLabel',q.button_label)))
 then raise exception 'Notice content not preserved'; end if;
 if exists(select 1 from public.questionnaire_questions p join before_notice_source q on q.id=p.source_question_id)
 then raise exception 'Notice still placed as question'; end if;
 if exists(select 1 from pg_trigger where tgname in ('guard_published_version','guard_published_question','guard_published_section','a_distributed_question_lock') and tgenabled<>'O')
 then raise exception 'Guard not restored'; end if;
end $$;
