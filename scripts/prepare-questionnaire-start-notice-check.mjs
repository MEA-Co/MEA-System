// Emits rollback-only SQL for a database BEFORE the start-notice migration.
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261015034458_questionnaire_start_notice.sql', 'utf8');
const regression = readFileSync('supabase/tests/questionnaire_start_notice.sql', 'utf8');
if (!migration.startsWith('begin;') || !migration.trimEnd().endsWith('commit;')) {
  throw new Error('Unexpected transaction boundaries');
}
const before = `
create temporary table before_notice_questions as select * from public.questions where purpose <> 'study_registration';
create temporary table before_notice_answers as select * from public.question_responses;
create temporary table before_notice_submissions as select * from public.response_submissions;
create temporary table before_notice_source as select * from public.questions where purpose='study_registration' and archived_at is null;
`;
process.stdout.write(migration.replace('begin;', 'begin;\n' + before).replace(/commit;\s*$/, regression + '\nrollback;\n'));
