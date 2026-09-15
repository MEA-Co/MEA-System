import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const id = '11111111-1111-4111-8111-111111111111';
function fixture({ fail, authenticated = true, empty = false } = {}) {
  const tables = {
    majors: [{ id, name: '전공' }],
    major_keywords: empty
      ? []
      : [{ id: 'keyword', major_id: id, name: '대표', description: '설명' }],
    keyword_examples: [{ id: 'example', keyword_id: 'keyword', label: '보조' }],
    major_university_sources: empty
      ? []
      : [
          { major_id: id, university_source_id: 'site' },
          { major_id: id, university_source_id: 'bad' },
          { major_id: id, university_source_id: 'directory' },
        ],
    university_sources: [
      {
        id: 'directory',
        title: '서울대학교 대학 및 학과 안내',
        institution: '서울대학교',
        url: 'https://www.snu.ac.kr/academics/undergraduate/colleges',
      },
      {
        id: 'site',
        title: '학과',
        institution: '대학',
        url: 'https://example.edu',
      },
      { id: 'bad', title: '잘못된 링크', url: 'javascript:alert(1)' },
    ],
  };
  const calls = [];
  const db = {
    from(table) {
      calls.push(table);
      const q = {
        select() {
          return q;
        },
        in() {
          return q;
        },
        order() {
          return q;
        },
        then(resolve) {
          return Promise.resolve({
            data: tables[table],
            error: fail === table ? {} : null,
          }).then(resolve);
        },
      };
      return q;
    },
  };
  const imports = {
    'next/headers': { cookies: async () => ({}) },
    '@/lib/auth': {
      getUserAccess: async () => ({ user: authenticated ? { id } : null }),
      hasRole: () => true,
    },
    '@/lib/profile': { MEMBER_ROLES: [] },
    '@/lib/supabase/server': { createClient: () => db },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync('features/keywords/major-overview/actions.ts', 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports, URL, require: (n) => imports[n] ?? require(n) },
  );
  return { load: exports.getMajorOverviews, calls, tables };
}
test('joins examples and sites to canonical ID and filters unsafe URLs', async () => {
  const { load } = fixture();
  const result = await load([id]);
  assert.equal(result.data[0].keywords[0].examples[0].label, '보조');
  assert.equal(result.data[0].sites.length, 1);
  assert.equal(result.data[0].sites[0].url, 'https://example.edu');
});
test('empty keyword and site collections are successful empty states', async () => {
  const { load, calls } = fixture({ empty: true });
  const r = await load([id]);
  assert.equal(r.data[0].keywords.length, 0);
  assert.equal(r.data[0].sites.length, 0);
  assert.equal(calls.includes('keyword_examples'), false);
});
test('DB errors are not treated as missing data; unauthorized and invalid requests do not query', async () => {
  assert.ok((await fixture({ fail: 'keyword_examples' }).load([id])).error);
  const f = fixture({ authenticated: false });
  assert.ok((await f.load([id])).error);
  assert.equal(f.calls.length, 0);
  const g = fixture();
  assert.ok((await g.load(['not-id'])).error);
  assert.equal(g.calls.length, 0);
});

test('department homepage precedes curriculum and institution is not repeated', async () => {
  const { load, tables } = fixture();
  tables.major_university_sources.push({
    major_id: id,
    university_source_id: 'homepage',
    purpose: 'major_info',
  });
  tables.university_sources.push({
    id: 'homepage',
    title: '대학 전공학과',
    institution: '대학',
    url: 'https://department.example.edu/',
  });
  const result = await load([id]);
  assert.equal(result.data[0].sites[0].url, 'https://department.example.edu/');
  assert.equal(result.data[0].sites[0].department, '대학 전공학과');
  assert.equal(result.data[0].sites.length, 2);
});
