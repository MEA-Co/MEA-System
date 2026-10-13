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
const query = load('app/(private)/dashboard/_views/study/lib/list-query.ts');
const api = load('app/api/study/list-page.ts', {
  '@/app/(private)/dashboard/_views/study/lib/list-query': query,
});
const user = '10000000-0000-4000-8000-000000000001';
const owner = '10000000-0000-4000-8000-000000000002';
function clientWith(total = 23, fail = false) {
  const requests = [];
  const client = createClient('http://localhost:54321', 'test-key', {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(input);
        requests.push({ url, init });
        if (fail)
          return new Response(JSON.stringify({ message: 'failed' }), {
            status: 500,
          });
        if (init.method === 'HEAD')
          return new Response(null, {
            status: 200,
            headers: { 'content-range': `*/${total}` },
          });
        const offset = Number(url.searchParams.get('offset'));
        const limit = Number(url.searchParams.get('limit'));
        const rows = Array.from(
          { length: Math.min(limit, Math.max(0, total - offset)) },
          (_, index) => ({ id: offset + index }),
        );
        return new Response(JSON.stringify(rows), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  });
  return { client, requests };
}
test('server caps a page at ten, counts with identical filters, and orders ties by id', async () => {
  const { client, requests } = clientWith();
  const result = await api.readStudyPage(
    client,
    new URLSearchParams({
      scope: 'others',
      owner,
      q: '수학',
      page: '2',
      pageSize: '5000',
    }),
    user,
    false,
  );
  assert.equal(result.body.activities.length, 10);
  assert.equal(result.body.total, 23);
  assert.equal(result.body.page, 2);
  const [count, rows] = requests.map((r) => r.url.searchParams);
  assert.equal(rows.get('limit'), '10');
  assert.equal(rows.get('offset'), '10');
  assert.equal(rows.get('order'), 'updated_at.desc,id.asc');
  for (const key of ['owner_id', 'deleted_at', 'or'])
    assert.deepEqual(rows.getAll(key), count.getAll(key));
  assert.deepEqual(rows.getAll('owner_id'), [`neq.${user}`, `eq.${owner}`]);
});
test('own scope cannot be changed by author, and inaccessible other scope is rejected', async () => {
  const { client, requests } = clientWith();
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
  assert.equal(requests.length, 0);
  await api.readStudyPage(
    client,
    new URLSearchParams({ scope: 'own', owner }),
    user,
    true,
  );
  assert.deepEqual(requests[1].url.searchParams.getAll('owner_id'), [
    `eq.${user}`,
  ]);
});
test('deletion beyond the last page clamps to a valid page; empty lists use page one', async () => {
  for (const [total, page, count] of [
    [23, 3, 3],
    [0, 1, 0],
  ]) {
    const { client } = clientWith(total);
    const result = await api.readStudyPage(
      client,
      new URLSearchParams({ page: '9' }),
      user,
      false,
    );
    assert.equal(result.body.page, page);
    assert.equal(result.body.activities.length, count);
  }
});
test('invalid page, scope, owner, and excessive search are rejected before querying', async () => {
  const { client, requests } = clientWith();
  for (const params of [
    { page: '-1' },
    { page: '1.5' },
    { page: '100001' },
    { owner: 'invalid' },
    { scope: 'all' },
    { q: 'x'.repeat(201) },
  ]) {
    assert.equal(
      (
        await api.readStudyPage(
          client,
          new URLSearchParams(params),
          user,
          false,
        )
      ).status,
      400,
    );
  }
  assert.equal(requests.length, 0);
});
test('search punctuation remains a literal substring, including wildcards and quotes', () => {
  for (const text of [
    '수학',
    '%_*',
    'a.b',
    'a"),owner_id.neq.x',
    '[x](a)+?^$|\\',
    'a\nb',
  ]) {
    const clause = query.studySearchFilter(text).split('.imatch.')[1];
    const match = clause.match(/^"((?:\\.|[^"\\])*)"/s);
    assert.ok(match);
    const pattern = match[1].replace(/\\(.)/gs, '$1');
    const regex = new RegExp(pattern, 'i');
    assert.ok(regex.test(`prefix${text}suffix`));
    if (text !== '수학') assert.equal(regex.test('unrelated'), false);
    assert.ok(
      query.matchesStudySearch({ problem: `prefix${text}suffix` }, text),
    );
  }
});
test('query failures propagate instead of displaying an empty result', async () => {
  const { client } = clientWith(0, true);
  await assert.rejects(
    api.readStudyPage(client, new URLSearchParams(), user, false),
  );
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

test('combined pagination reserves local rows and fetches only the remaining server rows', async () => {
  for (const count of [0, 5, 10, 12]) {
    for (const page of [1, 2, 4]) {
      const { client, requests } = clientWith(23);
      const result = await api.readStudyPage(
        client,
        new URLSearchParams({ page: String(page) }),
        user,
        true,
        { count, ids: [] },
      );
      assert.equal(result.body.total, 23 + count);
      const start = (result.body.page - 1) * 10;
      const locals = Math.min(10, Math.max(0, count - start));
      assert.ok(result.body.activities.length + locals <= 10);
      const get = requests.find(({ init }) => init.method !== 'HEAD');
      if (locals === 10) assert.equal(get, undefined);
      else {
        assert.equal(
          Number(get.url.searchParams.get('offset')),
          Math.max(0, start - count),
        );
        assert.equal(Number(get.url.searchParams.get('limit')), 10 - locals);
      }
    }
  }
});

test('local replacement IDs are excluded before pagination and matching contents stay local', async () => {
  const saved = [user, owner];
  const requests = [];
  const client = createClient('http://localhost:54321', 'test-key', {
    auth: { persistSession: false },
    global: {
      fetch: async (input) => {
        const url = new URL(input);
        requests.push(url);
        return new Response(
          JSON.stringify(
            url.searchParams.get('select') === 'id'
              ? saved.map((id) => ({ id }))
              : [{ id: owner }],
          ),
          { headers: { 'content-type': 'application/json' } },
        );
      },
    },
  });
  const result = await api.readStudyPage(
    client,
    new URLSearchParams(),
    user,
    true,
    { ids: [user], count: 1 },
  );
  assert.equal(result.body.total, 2);
  assert.equal(result.body.activities.length, 1);
  assert.equal(requests[1].searchParams.get('id'), `in.(${owner})`);
  const invalid = await api.readStudyPage(
    client,
    new URLSearchParams(),
    user,
    true,
    { ids: ['bad-id'], count: -1 },
  );
  assert.equal(invalid.status, 400);
});
