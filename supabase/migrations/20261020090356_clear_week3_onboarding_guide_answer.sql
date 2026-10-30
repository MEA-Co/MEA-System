-- One-time removal requested for week 3, section 2 question 1.
-- Keep the question, response identity, other answers, and submission metadata.
begin;

set local lock_timeout = '5s';

set local statement_timeout = '30s';

do $migration$
declare
  target_question constant uuid := '41894bd3-f2b0-4a29-b8d8-395b1de5dab6';
  target_questionnaire constant uuid := '01832b27-3408-409d-a635-bd4a913562f2';
  guide_id uuid := private.guide_consultant_id();
  session_row record;
  changed integer;
begin
  -- Match the questionnaire -> question -> session order used by response saving.
  perform pg_advisory_xact_lock(hashtextextended(target_questionnaire::text, 0));
  perform 1 from public.questions where id = target_question for share;
  if not found then
    return; -- Fresh/local installations need not contain this questionnaire.
  end if;
  if not exists (
    select 1 from public.questions q
    join public.questionnaire_questions p on p.source_question_id = q.id
    where q.id = target_question
      and q.title = '재료함 온보딩 확인'
      and p.questionnaire_id = target_questionnaire
      and q.fields @> '[{"id":"1f14abc9-4626-481d-9e03-4fc2abe79b2c","kind":"single"}]'::jsonb
  ) then
    raise exception 'Week 3 onboarding question no longer matches the intended target';
  end if;

  for session_row in
    select s.id from public.response_sessions s
    where s.origin_questionnaire_id = target_questionnaire
      and s.respondent_id = guide_id
      and s.started_stage = 'in_review'
    order by s.id for update
  loop
    update public.question_responses
    set rows = '[]'::jsonb, active_row_ids = '[]'::jsonb,
        body = '', updated_at = now()
    where session_id = session_row.id and question_id = target_question
      and (rows is distinct from '[]'::jsonb
        or active_row_ids is distinct from '[]'::jsonb
        or body is distinct from '');
    get diagnostics changed = row_count;
    if changed > 0 then
      -- Reject stale saves and discard their retry payload without changing
      -- completion status, submission time, layout, or any other answer.
      update public.response_sessions
      set revision = revision + 1, last_save_id = null, last_payload = null,
          updated_at = now()
      where id = session_row.id;
    end if;
  end loop;
end
$migration$;

commit;
