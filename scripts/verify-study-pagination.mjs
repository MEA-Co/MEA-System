import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    { exports, require: (id) => imports[id] ?? require(id), URLSearchParams },
  );
  return exports;
}
const query = load('lib/study/list-query.ts');
const api = load('app/api/study/list-page.ts', {
  '@/lib/study/list-query': query,
});
const user = '10000000-0000-4000-8000-000000000001';
const owner = '10000000-0000-4000-8000-000000000002';

test('page API validates inputs and passes bounded query metadata to one RPC', async () => {
  const calls = [];
  const client = {
    rpc: async (name, params) => {
      calls.push({ name, params });
      return {
        data: { activities: [], total: 3, page: 1, pageSize: 10 },
        error: null,
      };
    },
  };
  const result = await api.readStudyPage(
    client,
    new URLSearchParams({ q: ' %_* ', page: '2' }),
    user,
    true,
    { ids: [owner], count: 3 },
  );
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'read_study_page');
  assert.equal(calls[0].params.p_query, '%_*');
  assert.equal(calls[0].params.p_local_count, 3);
  assert.equal(calls[0].params.p_excluded[0], owner);
  for (const params of [
    { page: '0' },
    { scope: 'bad' },
    { owner: 'bad' },
    { q: 'a'.repeat(201) },
  ])
    assert.equal(
      (await api.readStudyPage(client, new URLSearchParams(params), user, true))
        .status,
      400,
    );
  assert.equal(
    (
      await api.readStudyPage(
        client,
        new URLSearchParams({ scope: 'others' }),
        user,
        true,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await api.readStudyPage(client, new URLSearchParams(), user, true, {
        ids: ['bad'],
      })
    ).status,
    400,
  );
  assert.equal(calls.length, 1);
});
test('other scope cannot receive local metadata and RPC failures propagate', async () => {
  let params;
  const client = {
    rpc: async (_, input) => {
      params = input;
      return { data: {}, error: null };
    },
  };
  await api.readStudyPage(
    client,
    new URLSearchParams({ scope: 'others' }),
    user,
    false,
    { ids: [owner], count: 4 },
  );
  assert.equal(params.p_local_count, 0);
  assert.equal(params.p_excluded.length, 0);
  await assert.rejects(() =>
    api.readStudyPage(
      { rpc: async () => ({ error: new Error('failed') }) },
      new URLSearchParams(),
      user,
      true,
    ),
  );
});
test('summary uses one aggregate RPC and disambiguates equal author names', async () => {
  let calls = 0;
  const result = await api.readStudySummary(
    {
      rpc: async () => {
        calls++;
        return {
          data: {
            mine: 1,
            others: 4,
            people: [
              { id: owner, label: '동명', count: 2 },
              { id: user, label: '동명', count: 2 },
            ],
          },
        };
      },
    },
    user,
    false,
  );
  assert.equal(calls, 1);
  assert.notEqual(result.people[0].label, result.people[1].label);
});
if (process.argv.includes('--local')) {
  test('local authenticated PostgREST accepts page/count/author/search queries under RLS', async () => {
    const env = require('@next/env');
    env.loadEnvConfig(process.cwd(), true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.equal(
      new URL(url).origin,
      'http://127.0.0.1:54321',
      'Local DB only',
    );
    for (const file of [
      '.env.local-consultant.json',
      '.env.local-consultant-lead.json',
    ]) {
      const credentials = JSON.parse(readFileSync(file, 'utf8'));
      const client = createClient(
        url,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const login = await client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      assert.equal(login.error, null);
      const id = login.data.user.id;
      const ownOnly = !file.includes('-lead');
      const summary = await api.readStudySummary(client, id, ownOnly);
      assert.ok(summary.mine >= 0);
      for (const q of [
        '',
        '수학',
        '%_*',
        'a"),owner_id.neq.x',
        '[x](a)+?^$|\\',
      ]) {
        const result = await api.readStudyPage(
          client,
          new URLSearchParams({
            page: '2',
            q,
            scope: ownOnly ? 'own' : 'others',
          }),
          id,
          ownOnly,
        );
        assert.equal(result.status, 200);
        assert.ok(result.body.activities.length <= 10);
      }
      const ownPage = await api.readStudyPage(
        client,
        new URLSearchParams({ scope: 'own' }),
        id,
        ownOnly,
      );
      assert.ok(ownPage.body.activities.every((row) => row.owner_id === id));
      if (ownPage.body.activities.length) {
        const sample = ownPage.body.activities[0];
        const text = (sample.values.title || sample.values.problem).slice(
          0,
          40,
        );
        const found = await api.readStudyPage(
          client,
          new URLSearchParams({ scope: 'own', q: text }),
          id,
          ownOnly,
        );
        assert.ok(found.body.total > 0);
      }
      if (summary.people.length) {
        const person = summary.people[0];
        const byAuthor = await api.readStudyPage(
          client,
          new URLSearchParams({ scope: 'others', owner: person.id }),
          id,
          ownOnly,
        );
        assert.equal(byAuthor.body.total, person.count);
        assert.ok(
          byAuthor.body.activities.every((row) => row.owner_id === person.id),
        );
      }
      await client.auth.signOut();
    }
  });
}
