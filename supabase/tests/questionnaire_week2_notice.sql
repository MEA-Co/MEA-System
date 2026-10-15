-- Read-only post-migration check for the existing week-2 questionnaire.
-- Does not convert arbitrary first questions or rewrite response data.
begin read only;
do $$
declare doc public.questionnaires%rowtype; source public.questions%rowtype;
begin
 select * into strict doc from public.questionnaires
 where id='6e67447a-1c1b-4e09-aab9-7c3dd1e702cf';
 if doc.start_notice is null then raise exception 'Week 2 start notice missing'; end if;
 select * into strict source from public.questions
 where purpose='study_registration'
 and title=doc.start_notice->>'title'
 and prompt=doc.start_notice->>'body'
 and button_label=doc.start_notice->>'buttonLabel';
 if source.archived_at is null then raise exception 'Original registration card not archived'; end if;
 if exists(select 1 from public.questionnaire_questions where questionnaire_id=doc.id and source_question_id=source.id)
 then raise exception 'Registration notice still counted as a question'; end if;
 if not exists(select 1 from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id where p.questionnaire_id=doc.id and q.purpose='response')
 then raise exception 'Week 2 response questions missing'; end if;
end $$;
rollback;
