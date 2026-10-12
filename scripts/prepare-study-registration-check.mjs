// Prepares reviewable SQL; never connects to or applies changes to a database.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const outputDir =
  process.argv[2] ?? '/private/tmp/mea-study-registration-check';
const migrationPath =
  'supabase/migrations/20261012050319_study_registration_cards.sql';
const regressionPath = 'supabase/tests/study_registration_cards.sql';
const migration = await readFile(path.join(repo, migrationPath), 'utf8');
const regression = await readFile(path.join(repo, regressionPath), 'utf8');

function statements(sql) {
  const result = [];
  let start = 0;
  let quote = null;
  let commentDepth = 0;
  for (let i = 0; i < sql.length; i++) {
    if (commentDepth) {
      if (sql.slice(i, i + 2) === '/*') {
        commentDepth++;
        i++;
      } else if (sql.slice(i, i + 2) === '*/') {
        commentDepth--;
        i++;
      }
      continue;
    }
    if (quote) {
      if (quote === "'" && sql[i] === "'") {
        if (sql[i + 1] === "'") i++;
        else quote = null;
      } else if (quote !== "'" && sql.startsWith(quote, i)) {
        i += quote.length - 1;
        quote = null;
      }
      continue;
    }
    if (sql.slice(i, i + 2) === '--') {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end;
    } else if (sql.slice(i, i + 2) === '/*') {
      commentDepth = 1;
      i++;
    } else if (sql[i] === "'") quote = "'";
    else if (sql[i] === '$') {
      const delimiter = sql.slice(i).match(/^\$(?:[a-zA-Z_][\w]*)?\$/)?.[0];
      if (delimiter) {
        quote = delimiter;
        i += delimiter.length - 1;
      }
    } else if (sql[i] === ';') {
      result.push(sql.slice(start, i));
      start = i + 1;
    }
  }
  if (quote || commentDepth || sql.slice(start).trim())
    throw new Error('SQL must be balanced and semicolon-terminated.');
  return result;
}
const command = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '')
    .trim();
function body(sql, ending) {
  const parsed = statements(sql);
  if (
    command(parsed[0]).toLowerCase() !== 'begin' ||
    command(parsed.at(-1)).toLowerCase() !== ending
  )
    throw new Error(`Expected BEGIN and ${ending.toUpperCase()} boundaries.`);
  const inner = parsed.slice(1, -1);
  if (
    inner.some((item) =>
      /^(?:begin|commit|end|rollback|abort|start\s+transaction|prepare\s+transaction)\b/i.test(
        command(item),
      ),
    )
  )
    throw new Error('Internal transaction controls are not allowed.');
  return inner.map((item) => `${item};`).join('\n');
}
const migrationBody = body(migration, 'commit').replace(
  "set local lock_timeout = '10s';",
  "set local lock_timeout = '500ms';",
);
const regressionBody = body(regression, 'rollback');
const signatures = [
  'private.validate_question()',
  'private.save_question(jsonb,integer,uuid)',
  'private.read_published_question_sources(uuid)',
  'private.save_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
  'private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
];
const quoted = (value) => `'${value.replaceAll("'", "''")}'`;
const signatureValues = signatures.map(quoted).join(',');
const outbound = `select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.prokind='f'
 and p.prosrc ~* '(net[.]http_|http_request|http_post|http_get|supabase_functions[.]http)'`;
const baseline = `create temporary table registration_function_baseline as
 select oid,proowner,proacl from pg_proc where oid in (select signature::regprocedure from unnest(array[${signatureValues}]) signature);
 create temporary table registration_existing_rows as
 select 'questions' name,count(*) amount,md5(coalesce(jsonb_agg(to_jsonb(q)-'purpose'-'button_label' order by q.id)::text,'')) hash from public.questions q
 union all select 'responses',count(*),md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'')) from public.question_responses r
 union all select 'sessions',count(*),md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'')) from public.response_sessions s
 union all select 'submissions',count(*),md5(coalesce(jsonb_agg(to_jsonb(s) order by s.session_id)::text,'')) from public.response_submissions s
 union all select 'study',count(*),md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'')) from public.study s;
 create temporary table registration_guide_hash as select md5(pg_get_functiondef('private.guide_consultant_id()'::regprocedure)) hash;`;
const compare = `do $$ begin
 if exists(select 1 from registration_function_baseline b join pg_proc p on p.oid=b.oid
  where p.proowner is distinct from b.proowner or p.proacl is distinct from b.proacl) then raise exception 'Function privileges changed'; end if;
 if (select hash from registration_guide_hash) is distinct from md5(pg_get_functiondef('private.guide_consultant_id()'::regprocedure)) then raise exception 'Configured guide changed'; end if;
end $$;
create temporary table registration_after_rows as
 select 'questions' name,count(*) amount,md5(coalesce(jsonb_agg(to_jsonb(q)-'purpose'-'button_label' order by q.id)::text,'')) hash from public.questions q
 union all select 'responses',count(*),md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'')) from public.question_responses r
 union all select 'sessions',count(*),md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'')) from public.response_sessions s
 union all select 'submissions',count(*),md5(coalesce(jsonb_agg(to_jsonb(s) order by s.session_id)::text,'')) from public.response_submissions s
 union all select 'study',count(*),md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'')) from public.study s;
do $$ begin
 if exists(select 1 from registration_existing_rows b full join registration_after_rows a using(name)
  where a.amount is distinct from b.amount or a.hash is distinct from b.hash) then raise exception 'Existing data changed'; end if;
end $$;`;
const preflight = `begin read only;
select jsonb_build_object(
 'columns', (select coalesce(jsonb_agg(column_name),'[]') from information_schema.columns where table_schema='public' and table_name='questions' and column_name in ('purpose','button_label')),
 'guideHash',md5(pg_get_functiondef('private.guide_consultant_id()'::regprocedure)),
 'functions',(select jsonb_agg(jsonb_build_object('signature',signature,'exists',to_regprocedure(signature) is not null)) from unnest(array[${signatureValues}]) signature),
 'outboundFunctions',(select coalesce(jsonb_agg(row_to_json(x)),'[]') from (${outbound}) x)
) as preflight;
rollback;`;
const trial = `begin isolation level repeatable read;
set local statement_timeout='20s';
set local lock_timeout='500ms';
${baseline}
do $$ begin if exists(${outbound}) then raise exception 'Outbound functions require review'; end if; end $$;
${migrationBody}
savepoint registration_fixture;
${regressionBody}
reset role;
rollback to savepoint registration_fixture;
${compare}
rollback;
select 'Temporary migration, registration regression, existing data and privileges passed; all changes rolled back' as result;`;
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'preflight.sql'), preflight);
await writeFile(path.join(outputDir, 'migration-trial.sql'), trial);
const manifest = {
  migration: migrationPath,
  regression: regressionPath,
  migrationSha256: createHash('sha256').update(migration).digest('hex'),
  regressionSha256: createHash('sha256').update(regression).digest('hex'),
  outputDir,
  connectsToDatabase: false,
};
await writeFile(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(manifest)}\n`);
