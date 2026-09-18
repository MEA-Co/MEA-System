import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function compile(path, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (n) => (Object.hasOwn(imports, n) ? imports[n] : require(n)),
      Date,
      JSON,
      Buffer,
      ...globals,
    },
  );
  return exports;
}
const userId = '11111111-1111-4111-8111-111111111111',
  sessionId = '22222222-2222-4222-8222-222222222222',
  majorId = '33333333-3333-4333-8333-333333333333',
  requestId = '44444444-4444-4444-8444-444444444444';
const domain = compile('../features/keywords/major-search/domain.ts');
function fixture() {
  const state = { writes: [], calls: 0, error: false };
  const catalog = [
    {
      id: majorId,
      name: '컴퓨터공학',
      field_name: '공학',
      sort_order: 1,
      aliases: [{ name: '컴공', alias_type: 'abbreviation' }],
    },
  ];
  const api = compile('../features/keywords/major-search/handlers.ts', {
    'server-only': {},
    'next/headers': { cookies: async () => ({}) },
    'next/server': {
      NextResponse: { json: (data, init) => Response.json(data, init) },
    },
    '@/lib/auth': {
      getUserAccess: async () => ({ user: { id: userId } }),
      hasRole: () => true,
    },
    '@/lib/profile': { MEMBER_ROLES: ['student'] },
    '@/lib/supabase/server': { createClient: () => ({}) },
    './domain': domain,
    './catalog': {
      loadCatalog: async () => {
        if (state.error) throw Error('DB error');
        return { catalog, version: 'v1' };
      },
    },
    './server': {
      majorSearchDb: () => ({
        rpc: async (name, args) => {
          state.writes.push({ name, args });
          return {
            data:
              name === 'record_major_no_match'
                ? { requestId }
                : { id: majorId, name: '컴퓨터공학', requestId },
            error: null,
          };
        },
      }),
    },
  });
  return { state, api };
}
test('catalog reads do not write and removed model requests are rejected', async () => {
  const { state, api } = fixture();
  assert.equal((await api.handleMajorCatalog()).status, 200);
  assert.equal(
    (
      await api.handleMajorSearch({
        op: 'model',
        sessionId,
        input: '소프트웨어',
      })
    ).status,
    400,
  );
  assert.equal(state.writes.length, 0);
});
test('only confirmed input reaches atomic RPC; intermediate legacy operations are rejected', async () => {
  const { state, api } = fixture();
  for (const op of ['search', 'feedback', 'supersede'])
    assert.equal((await api.handleMajorSearch({ op, requestId })).status, 400);
  const r = await api.handleMajorSearch({
    op: 'confirm',
    requestId,
    sessionId,
    input: ' 컴 공 ',
    majorId,
    catalogVersion: 'v1',
  });
  assert.equal(r.status, 200);
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].name, 'confirm_major_search');
  assert.equal(state.writes[0].args.p_input_text, ' 컴 공 ');
  assert.equal(state.writes[0].args.p_normalized_input, '컴공');
});
test('catalog mismatch, unoffered major and DB failures never write', async () => {
  const { state, api } = fixture();
  const body = {
    op: 'confirm',
    requestId,
    sessionId,
    input: '컴공',
    majorId,
    catalogVersion: 'old',
  };
  assert.equal((await api.handleMajorSearch(body)).status, 409);
  assert.equal(
    (
      await api.handleMajorSearch({
        ...body,
        catalogVersion: 'v1',
        majorId: requestId,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await api.handleMajorSearch({
        ...body,
        catalogVersion: 'v1',
        ticket: 'forged',
      })
    ).status,
    400,
  );
  state.error = true;
  assert.equal(
    (await api.handleMajorSearch({ ...body, catalogVersion: 'v1' })).status,
    503,
  );
  assert.equal(state.writes.length, 0);
  assert.equal(state.calls, 0);
});

test('explicit no_match records server-computed candidates and accepts empty results', async () => {
  const { state, api } = fixture();
  for (const input of [' 컴 공 ', '없는전공']) {
    const response = await api.handleMajorSearch({
      op: 'no_match',
      requestId,
      sessionId,
      input,
      catalogVersion: 'v1',
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).noMatch.requestId, requestId);
  }
  assert.equal(state.writes.length, 2);
  assert.equal(state.writes[0].name, 'record_major_no_match');
  assert.equal(state.writes[0].args.p_input_text, ' 컴 공 ');
  assert.equal(state.writes[0].args.p_candidates.length, 1);
  assert.equal(state.writes[1].args.p_candidates.length, 0);
  assert.equal(state.writes[1].args.p_user_id, userId);
  for (const extra of [
    { majorId },
    { userId },
    { review_status: 'verified' },
    { candidates: [] },
  ]) {
    assert.equal(
      (
        await api.handleMajorSearch({
          op: 'no_match',
          requestId,
          sessionId,
          input: '컴공',
          catalogVersion: 'v1',
          ...extra,
        })
      ).status,
      400,
    );
  }
  assert.equal(state.writes.length, 2);
});
