// Prepare SQL for an operator to review and execute; never connects to a database.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const outputDir =
  process.argv[2] ?? '/private/tmp/mea-question-grid-production-check';
const sourcePath = path.join(
  repo,
  'supabase/tests/question_answer_layouts.sql',
);
const source = await readFile(sourcePath, 'utf8');
const expectedGuideHash = process.argv[3] ?? '';
if (expectedGuideHash && !/^[0-9a-f]{32}$/.test(expectedGuideHash))
  throw new Error(
    'The production guide function hash must be 32 lowercase hex characters.',
  );

// Split only top-level SQL: semicolons in strings, DO blocks and comments stay put.
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
    throw new Error(
      'Regression must contain balanced, semicolon-terminated SQL.',
    );
  return result;
}

const command = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '')
    .trim();
const parsed = statements(source);
if (
  command(parsed[0]).toLowerCase() !== 'begin' ||
  command(parsed.at(-1)).toLowerCase() !== 'rollback'
)
  throw new Error('Regression must begin with BEGIN and end with ROLLBACK.');
const body = parsed.slice(1, -1);
if (
  body.some((sql) =>
    /^(?:begin|commit|end|rollback|abort|start\s+transaction|prepare\s+transaction)\b/i.test(
      command(sql),
    ),
  )
)
  throw new Error(
    'Internal transaction control would break rollback isolation.',
  );

const compatibilityAnchors = [
  [
    'private.question_editor_settings_valid(jsonb)',
    'field settings loop',
    'for v_field in select value from pg_catalog.jsonb_array_elements(p_fields) loop',
  ],
  [
    'private.save_question(jsonb,integer,uuid)',
    'row label update',
    "row_labels = coalesce(p_document->'rowLabels', '[]'::jsonb),",
  ],
  [
    'private.save_question(jsonb,integer,uuid)',
    'insert columns',
    'max_rows, min_rows, row_labels,',
  ],
  [
    'private.save_question(jsonb,integer,uuid)',
    'insert values',
    "coalesce((p_document->>'minRows')::integer, 1), coalesce(p_document->'rowLabels', '[]'::jsonb),",
  ],
  [
    'private.read_published_question_sources(uuid)',
    'published source projection',
    "'min_rows',q.min_rows,'row_labels',q.row_labels,",
  ],
  [
    'private.save_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'published active row selection',
    "ids:=ids||jsonb_build_array(row_data->'id'); source_ok:=false;",
  ],
  [
    'private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'distributed active row selection',
    "ids:=ids||jsonb_build_array(row_data->'id'); source_ok:=false;",
  ],
  [
    'private.save_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'published completion check',
    'if p_complete and not private.question_field_response_valid(f,val,true) then',
  ],
  [
    'private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'distributed completion check',
    'if p_complete and not is_career_flow and not private.question_field_response_valid(f,val,true) then',
  ],
  [
    'private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'submitted row projection',
    "(select jsonb_agg(x order by n) from jsonb_array_elements(answer.rows) with ordinality row(x,n) where answer.active_row_ids @> jsonb_build_array(x->'id'))",
  ],
];
const sqlLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
const compatibilityCte = `with anchors(signature,check_name,needle) as (values
${compatibilityAnchors.map((values) => `  (${values.map(sqlLiteral).join(',')})`).join(',\n')}
), checks as (
select signature,check_name,to_regprocedure(signature) is not null as function_exists,
  position(needle in coalesce(pg_get_functiondef(to_regprocedure(signature)),''))>0 as compatible
from anchors
 )`;
const compatibilityReport = `jsonb_build_object('totalChecks',count(*),
  'allCompatible',bool_and(function_exists and compatible),
  'checks',jsonb_agg(to_jsonb(checks) order by signature,check_name))`;
const compatibilitySql = `${compatibilityCte}\nselect ${compatibilityReport} as migration_compatibility from checks;`;

const preflight = `-- Read-only catalog inspection. Review trigger/event-trigger functions before the trial.
begin read only;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';
set local idle_in_transaction_session_timeout = '10s';
${compatibilityCte}
select jsonb_build_object(
  'database',current_database(),'databaseRole',current_user,'postgresVersion',current_setting('server_version'),
  'migrations',(select jsonb_agg(version order by version desc) from
    (select version from supabase_migrations.schema_migrations order by version desc limit 12) recent),
  'columns',(select coalesce(jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod))),'[]'::jsonb)
    from pg_attribute where attrelid='public.questions'::regclass
      and attname in ('answer_layout','initial_rows') and not attisdropped),
  'triggers',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,
      'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)) order by n.nspname,c.relname,t.tgname),'[]'::jsonb)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and t.tgenabled<>'D'
      and ((n.nspname='auth' and c.relname='users') or n.nspname in ('public','private','realtime'))),
  'eventTriggers',(select coalesce(jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'commands',e.evttags,
      'function',pg_get_functiondef(e.evtfoid)) order by e.evtname),'[]'::jsonb)
    from pg_event_trigger e where e.evtenabled<>'D'),
  'functions',(select coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text),'[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='realtime' and p.proname='send')
      or (n.nspname='private' and p.proname in ('guide_consultant_id','question_editor_settings_valid',
        'save_question','read_published_question_sources','save_question_response_session','save_distributed_question_response_session'))),
  'guideFunctionHash',md5(pg_get_functiondef(to_regprocedure('private.guide_consultant_id()'))),
  'compatibility',(select ${compatibilityReport} from checks)
) as preflight;
rollback;
`;

const regression = `-- RUN ONLY AFTER catalog preflight review and permanent migration application.
-- Single request/connection required. Do not split BEGIN, test, ROLLBACK into API calls.
-- Source: supabase/tests/question_answer_layouts.sql
-- SHA256: ${createHash('sha256').update(source).digest('hex')}
-- Temporary fixtures and guide function override are rolled back. No migration is applied here.
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '15s';
set local idle_in_transaction_session_timeout = '10s';
do $preflight$
declare signature text; definition text;
begin
  if (select count(*) from pg_attribute where attrelid='public.questions'::regclass
    and attname in ('answer_layout','initial_rows') and not attisdropped)<>2 then
    raise exception 'Apply question_answer_layouts before production regression';
  end if;
  foreach signature in array array[
    'private.question_editor_settings_valid(jsonb)', 'private.save_question(jsonb,integer,uuid)',
    'private.read_published_question_sources(uuid)', 'private.guide_consultant_id()',
    'public.open_question_response_session(uuid)', 'public.open_distributed_question_response_session(uuid)',
    'public.change_questionnaire_status(uuid,integer,text,timestamp with time zone,text,uuid)',
    'private.save_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)'
  ] loop
    if to_regprocedure(signature) is null then raise exception 'Required signature missing: %',signature; end if;
  end loop;
  foreach signature in array array[
    'private.save_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)'
  ] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    if position('answer_layout' in definition)=0 or position('required' in definition)=0
      or position('Complete nonempty typed answers' in definition)=0 then
      raise exception 'Question grid completion migration not present in %',signature;
    end if;
  end loop;
end $preflight$;
${body.join(';\n')};
rollback;
select 'question_answer_layouts regression passed and rolled back' as result;
`;

const migrationSource = await readFile(
  path.join(
    repo,
    'supabase/migrations/20261011143258_question_answer_layouts.sql',
  ),
  'utf8',
);
const migrationCommands = statements(migrationSource);
if (
  command(migrationCommands[0]).toLowerCase() !== 'begin' ||
  command(migrationCommands.at(-1)).toLowerCase() !== 'commit'
)
  throw new Error('Migration must have one outer BEGIN/COMMIT pair.');
const migrationBody = migrationCommands.slice(1, -1);
if (
  migrationBody.some((sql) =>
    /^(?:begin|commit|end|rollback|abort|start\s+transaction|prepare\s+transaction)\b/i.test(
      command(sql),
    ),
  )
)
  throw new Error(
    'Internal migration transaction control would break the trial.',
  );
const locks = migrationBody.filter((sql) =>
  /^set\s+local\s+lock_timeout\s*=/i.test(command(sql)),
);
if (locks.length !== 1 || !/['"]10s['"]/i.test(locks[0]))
  throw new Error(
    'Unexpected migration lock timeout; review before generating a trial.',
  );
const trialMigration = migrationBody.filter((sql) => !locks.includes(sql));
const migrationTrial = `-- One request/connection: temporary migration + regression + full rollback.
-- Review live event/row triggers first. The questions table is locked until rollback.
-- Regenerate with the guideFunctionHash returned by preflight as the third argument.
-- Migration SHA256: ${createHash('sha256').update(migrationSource).digest('hex')}
-- Regression SHA256: ${createHash('sha256').update(source).digest('hex')}
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';
set local idle_in_transaction_session_timeout = '10s';
do $trial_preflight$
declare all_compatible boolean;
begin
  if ${sqlLiteral(expectedGuideHash)} !~ '^[0-9a-f]{32}$' then
    raise exception 'Regenerate trial with the production guideFunctionHash from preflight';
  end if;
  if exists(select 1 from pg_attribute where attrelid='public.questions'::regclass
    and attname in ('answer_layout','initial_rows') and not attisdropped) then
    raise exception 'Grid columns already exist; use regression.sql after migration application';
  end if;
  if exists(select 1 from supabase_migrations.schema_migrations where version='20261011143258') then
    raise exception 'Grid migration already recorded; use regression.sql';
  end if;
  if md5(pg_get_functiondef(to_regprocedure('private.guide_consultant_id()'))) is distinct from ${sqlLiteral(expectedGuideHash)} then
    raise exception 'Production guide function changed since preflight';
  end if;
  ${compatibilityCte}
  select bool_and(function_exists and compatible) into all_compatible from checks;
  if not coalesce(all_compatible,false) then raise exception 'Migration function replacements are incompatible'; end if;
end $trial_preflight$;
${trialMigration.join(';\n')};
${body.join(';\n')};
rollback;
do $trial_restored$
begin
  if exists(select 1 from pg_attribute where attrelid='public.questions'::regclass
    and attname in ('answer_layout','initial_rows') and not attisdropped) then
    raise exception 'Trial rollback did not restore the question columns';
  end if;
  if md5(pg_get_functiondef(to_regprocedure('private.guide_consultant_id()'))) is distinct from ${sqlLiteral(expectedGuideHash)} then
    raise exception 'Trial rollback did not restore the guide function';
  end if;
  if exists(select 1 from supabase_migrations.schema_migrations where version='20261011143258') then
    raise exception 'Trial unexpectedly persisted migration history';
  end if;
end $trial_restored$;
select jsonb_build_object('result','temporary grid migration regression passed and rolled back',
  'columnsAbsent',true,'guideHashRestored',true,'migrationHistoryAbsent',true,
  'guideFunctionHash',md5(pg_get_functiondef(to_regprocedure('private.guide_consultant_id()')))) as trial_result;
`;

await mkdir(outputDir, { recursive: true });
const preflightPath = path.resolve(outputDir, 'preflight.sql');
const regressionPath = path.resolve(outputDir, 'regression.sql');
const compatibilityPath = path.resolve(outputDir, 'compatibility.sql');
const migrationTrialPath = path.resolve(outputDir, 'migration-trial.sql');
await writeFile(preflightPath, preflight, { mode: 0o600 });
await writeFile(regressionPath, regression, { mode: 0o600 });
await writeFile(compatibilityPath, compatibilitySql + '\n', { mode: 0o600 });
await writeFile(migrationTrialPath, migrationTrial, { mode: 0o600 });
process.stdout.write(
  JSON.stringify(
    {
      preflightPath,
      compatibilityPath,
      regressionPath,
      migrationTrialPath,
      trialNeedsGuideHash: !expectedGuideHash,
      databaseExecuted: false,
    },
    null,
    2,
  ) + '\n',
);
