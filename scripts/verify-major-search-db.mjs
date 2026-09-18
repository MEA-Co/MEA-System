/* eslint-disable no-console -- Standalone verification output. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table majors(id uuid primary key,name text not null);grant usage on schema public to service_role;grant select on majors to service_role;`,
);
for (const path of [
  '20260915042403_create_major_search.sql',
  '20260915053905_confirm_major_search_only.sql',
  '20260915062408_record_major_no_match.sql',
])
  await db.exec(
    readFileSync(
      new URL('../supabase/migrations/' + path, import.meta.url),
      'utf8',
    ),
  );
const user = '11111111-1111-4111-8111-111111111111',
  major = '22222222-2222-4222-8222-222222222222',
  id = '33333333-3333-4333-8333-333333333333',
  bad = '44444444-4444-4444-8444-444444444444';
await db.exec(
  `insert into auth.users values('${user}');insert into majors values('${major}','컴퓨터공학');set role service_role;`,
);
const confirm = (req = id, who = user, chosen = major) =>
  db.query(
    'select confirm_major_search($1,$2,$1,$3,$4,$5,$6,$7,null,null,null) result',
    [
      req,
      who,
      ' 컴 공 ',
      '컴공',
      JSON.stringify([{ id: major, rank: 1 }]),
      'v1',
      chosen,
    ],
  );
const count = async (table) =>
  (await db.query('select count(*)::int n from ' + table)).rows[0].n;
assert.equal(await count('major_search_requests'), 0);
await assert.rejects(confirm(id, user, bad), /Major was not offered/);
assert.equal(await count('major_search_requests'), 0);
// Force the second insert to fail: the first insert must roll back as well.
await db.exec(
  "reset role;alter table major_search_feedback add constraint test_failure check(action <> 'confirmed');set role service_role;",
);
await assert.rejects(confirm(), /test_failure/);
assert.equal(await count('major_search_requests'), 0);
assert.equal(await count('major_search_feedback'), 0);
await db.exec(
  'reset role;alter table major_search_feedback drop constraint test_failure;set role service_role;',
);
await confirm();
await confirm();
assert.equal(await count('major_search_requests'), 1);
assert.equal(await count('major_search_feedback'), 1);
const row = (
  await db.query('select action,review_status from major_search_feedback')
).rows[0];
assert.equal(row.action, 'confirmed');
assert.equal(row.review_status, 'unreviewed');
await assert.rejects(confirm(id, bad), /foreign key|Confirmation conflict/);
const noMatch = (req = bad, who = user, input = '없는전공', candidates = []) =>
  db.query('select record_major_no_match($1,$2,$1,$3,$3,$4,$5)', [
    req,
    who,
    input,
    JSON.stringify(candidates),
    'v1',
  ]);
await db.exec(
  "reset role;alter table major_search_feedback add constraint fail_no_match check(action <> 'no_match');set role service_role;",
);
await assert.rejects(noMatch(), /fail_no_match/);
assert.equal(await count('major_search_requests'), 1);
await db.exec(
  'reset role;alter table major_search_feedback drop constraint fail_no_match;set role service_role;',
);
await noMatch();
await noMatch();
assert.equal(await count('major_search_requests'), 2);
assert.equal(await count('major_search_feedback'), 2);
const missing = (
  await db.query("select * from major_search_feedback where action='no_match'")
).rows[0];
assert.equal(missing.major_id, null);
assert.equal(missing.review_status, 'unreviewed');
await assert.rejects(noMatch(bad, user, 'changed'), /No-match conflict/);
await assert.rejects(noMatch(bad, major), /foreign key|No-match conflict/);
await assert.rejects(
  noMatch(id, user, ' 컴 공 ', [{ id: major, rank: 1 }]),
  /No-match conflict|Request already used/,
);
const offeredId = '55555555-5555-4555-8555-555555555555';
// Matching candidates can exist even when none is the student's intended major.
await db.query('select record_major_no_match($1,$2,$1,$3,$4,$5,$6)', [
  offeredId,
  user,
  ' 컴 공 ',
  '컴공',
  JSON.stringify([{ id: major, rank: 1 }]),
  'v1',
]);
await assert.rejects(confirm(offeredId), /Request already used/);
for (const role of ['anon', 'authenticated']) {
  await db.exec('reset role;set role ' + role);
  await assert.rejects(confirm(), /permission denied/);
  await assert.rejects(noMatch(), /permission denied/);
}
console.log(
  'PASS: atomic request+confirmation, rollback on feedback failure, idempotency, ownership, unreviewed status, restricted privileges',
);
await db.close();
