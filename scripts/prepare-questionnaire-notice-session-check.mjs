// Emit rollback-only SQL for an ISOLATED schema restored to production's
// 20261013033907 baseline. Never execute these synthetic fixtures in production.
import { readdirSync, readFileSync } from 'node:fs';

const testCase = process.argv[2] ?? 'preserve';
const emergencyPatched = process.argv.includes('--emergency-patched');
const mutations = {
  preserve: '',
  orphan_reference: `update public.response_sessions set last_payload=coalesce(last_payload,'{}'::jsonb)
    ||jsonb_build_object('orphanReference',(select id from notice_test_orphan));`,
  response: `update public.question_responses set body='unexpected saved answer'
    where question_id in(select notice_id from notice_test_docs);`,
  rows: `update public.question_responses set rows='[{"id":1,"answers":{"text":"inactive answer"}}]'
    where question_id in(select notice_id from notice_test_docs);`,
  history: `update public.question_responses set previous_responses='[{"body":"history"}]'
    where question_id in(select notice_id from notice_test_docs);`,
  submission: `update public.response_submissions s set answers=jsonb_set(answers,
    array[d.notice_id::text,'body'],'"unexpected submission"') from notice_test_docs d
    join public.response_sessions r on r.origin_questionnaire_id=d.id
    where s.session_id=r.id and d.name<>'unrelated';`,
  retry: `update public.response_sessions s set last_payload=jsonb_set(last_payload,
    array['answers',d.notice_id::text],'[{"answers":{"text":"unsaved retry"}}]')
    from notice_test_docs d where d.id=s.origin_questionnaire_id and d.name<>'unrelated';`,
  layout: `alter table public.response_sessions disable trigger response_session_identity;
    update public.response_sessions s set layout=jsonb_set(layout,
      '{0,questions,0,sourceQuestionId}',to_jsonb(gen_random_uuid()))
      from notice_test_docs d where s.origin_questionnaire_id=d.id and d.name='notice_section';
    alter table public.response_sessions enable trigger response_session_identity;`,
  reference: `alter table public.question_responses disable trigger question_response_identity;
    update public.question_responses r set referenced_response_id=n.id
      from public.question_responses n, notice_test_docs d
      where r.question_id=d.answer_id and n.question_id=d.notice_id and r.session_id=n.session_id;
    alter table public.question_responses enable trigger question_response_identity;`,
};
if (!Object.hasOwn(mutations, testCase)) throw new Error(`Unknown test case: ${testCase}`);

const directory = 'supabase/migrations';
const files = readdirSync(directory).filter((name) =>
  name > '20261013033907_question_flow_insertions.sql'
  && name <= '20261015105318_questionnaire_paged_list_reads.sql').sort();
if (files.length !== 15) throw new Error('Expected the reviewed 15-migration chain');
const sql = ['begin;', `do $$ begin
  if current_database()='postgres' or exists(select 1 from public.questions)
    or exists(select 1 from public.response_sessions) or exists(select 1 from auth.users)
  then raise exception 'Use an empty isolated verification database, never production or the development database'; end if;
end $$;`];
if (emergencyPatched) sql.push(readFileSync(`${directory}/20261016012233_prevent_business_conflict_retries.sql`, 'utf8')
  .replace(/^begin;\s*/im, '').replace(/commit;\s*$/i, ''));
for (const name of files) {
  if (name === '20261015034458_questionnaire_start_notice.sql') {
    sql.push(readFileSync('supabase/tests/fixtures/questionnaire_notice_sessions.sql', 'utf8'));
    sql.push(`select set_config('request.jwt.claim.sub',(select id::text from notice_test_users where name='owner'),true);
      set local role authenticated;
      select public.save_question(jsonb_build_object('id',gen_random_uuid(),'title','Unplaced notice',
        'prompt','Preserve this unplaced original','purpose','study_registration','buttonLabel','학습법 추가',
        'fields','[]'::jsonb,'rowMode','single','minRows',1,'initialRows',1,'answerLayout','cards',
        'rowLabels','[]'::jsonb),0,gen_random_uuid());
      reset role;
      -- Age persisted notices: now() is transaction-stable, so fresh fixtures hide timestamp mutations.
      alter table public.questions disable trigger a_distributed_question_lock;
      alter table public.questions disable trigger validate_question;
      alter table public.questions disable trigger reconcile_guide_question_update;
      update public.questions set updated_at=now()-interval '7 days' where purpose='study_registration';
      alter table public.questions enable trigger validate_question;
      alter table public.questions enable trigger reconcile_guide_question_update;
      alter table public.questions enable trigger a_distributed_question_lock;
      create temporary table notice_test_orphan as select * from public.questions where title='Unplaced notice';`);
    sql.push(mutations[testCase]);
    sql.push(`create temporary table before_notice_questions as select * from public.questions where purpose<>'study_registration';
      create temporary table before_notice_answers as select * from public.question_responses;
      create temporary table before_notice_submissions as select * from public.response_submissions;
      create temporary table before_notice_source as select * from public.questions where purpose='study_registration' and archived_at is null and id not in(select id from notice_test_orphan);`);
  }
  // Keep one outer transaction so fixtures and each migration are all rolled
  // back, including the synthetic guide account override.
  const migration = readFileSync(`${directory}/${name}`, 'utf8')
    .replace(/^begin;\s*/im, '').replace(/commit;\s*$/i, '');
  sql.push(`select 'Applying ${name}';`, migration);
  if (name === '20261015034458_questionnaire_start_notice.sql') {
    if (testCase !== 'preserve') {
      sql.push(`do $$ begin raise exception 'UNSAFE: invalid ${testCase} fixture was accepted'; end $$;`);
      break;
    }
    sql.push(readFileSync('supabase/tests/questionnaire_notice_session_preservation.sql', 'utf8'));
    sql.push(readFileSync('supabase/tests/questionnaire_start_notice.sql', 'utf8'));
    sql.push(`do $$ begin
      if not exists(select 1 from public.questions q join notice_test_orphan o using(id)
        where q.archived_at is not null and to_jsonb(q)-'archived_at'=to_jsonb(o)-'archived_at')
      then raise exception 'Unplaced notice original was not preserved'; end if;
    end $$;`);
  }
}
if (testCase === 'preserve') sql.push(readFileSync('supabase/tests/questionnaire_notice_session_resume.sql', 'utf8'));
if (testCase === 'preserve' && emergencyPatched) {
  for (const name of readdirSync(directory).filter((name) => name > '20261015105318_questionnaire_paged_list_reads.sql' && name <= '20261016014123_response_poll_versions.sql').sort()) {
    sql.push(readFileSync(`${directory}/${name}`, 'utf8').replace(/^begin;\s*/im, '').replace(/commit;\s*$/i, ''));
  }
  sql.push(`do $$ begin
    if exists(select 1 from pg_proc where pronamespace='private'::regnamespace
      and prosrc ~ $pattern$errcode\\s*=\\s*'40001'$pattern$)
    then raise exception 'Retryable business conflict remains'; end if;
  end $$;`);
}
sql.push('rollback;');
process.stdout.write(`${sql.join('\n')}\n`);
