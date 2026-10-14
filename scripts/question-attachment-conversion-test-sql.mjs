// Emits a rollback-only migration regression for a pre-conversion database.
// Never execute the migration's COMMIT from inside the test transaction.
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20261014082243_convert_question_attachments_to_mentions.sql', import.meta.url),
  'utf8',
);
if (!migration.startsWith('begin;\n') || !migration.endsWith('\ncommit;\n')) {
  throw new Error('Unexpected migration transaction wrapper');
}
const test = readFileSync(
  new URL('../supabase/tests/question_attachment_conversion.sql', import.meta.url),
  'utf8',
);
process.stdout.write(
  test.replace('-- CONVERSION_MIGRATION_BODY', migration.slice(7, -9)),
);
