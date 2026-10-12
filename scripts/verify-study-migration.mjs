// Run before applying the migration to the local database. All fixture writes roll back.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20261012024650_study_solution_fields.sql',
  'utf8',
)
  .replace(/^BEGIN;\n/, '')
  .replace(/\nCOMMIT;\s*$/, '');
const input =
  readFileSync(
    'supabase/tests/fixtures/study_solution_legacy_before.sql',
    'utf8',
  ) +
  migration +
  readFileSync(
    'supabase/tests/fixtures/study_solution_legacy_after.sql',
    'utf8',
  );
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    'supabase_db_system',
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ],
  { input, encoding: 'utf8' },
);
if (result.error) throw result.error;
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
