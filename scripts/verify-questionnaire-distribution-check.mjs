import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
import { z } from 'zod';

const id = '10000000-0000-4000-8000-000000000001';
const actor = '10000000-0000-4000-8000-000000000002';
const source = readFileSync(
  new URL(
    '../app/(private)/dashboard/_views/questions/lib/questionnaire/server.ts',
    import.meta.url,
  ),
  'utf8',
);
function setup({
  role = 'consultant_lead',
  owner = actor,
  status = 'published',
  revision = 2,
  archived = null,
  counts = [],
  error = null,
} = {}) {
  const calls = [];
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      return {
        data: {
          revision,
          status,
          created_by: owner,
          archived_at: archived,
        },
        error: null,
      };
    },
  };
  const client = {
    from(table) {
      assert.equal(table, 'questionnaires');
      return query;
    },
    async rpc(name) {
      calls.push(name);
      if (name === 'question_review_counts') return { data: counts, error };
      assert.ok(
        ['distribute_questionnaire', 'change_questionnaire_status'].includes(
          name,
        ),
      );
      return { data: { questionnaireId: id }, error };
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports,
      require(name) {
        if (name === 'zod') return { z };
        if (name === 'next/headers') return { cookies: async () => ({}) };
        if (name === '@/lib/auth')
          return {
            getUserAccess: async () => ({
              user: { id: actor },
              role,
              isOnboarded: true,
            }),
          };
        if (name === '@/lib/supabase/server')
          return { createClient: () => client };
        return {};
      },
    },
  );
  return { api: exports, calls };
}
const input = { questionnaireId: id, revision: 2 };
test('pending reviews reject distribution even when already read', async () => {
  const { api } = setup({
    counts: [{ questionnaire_id: id, count: 2, unread_count: 0 }],
  });
  const result = await api.checkQuestionnaireDistribution(input);
  assert.equal(result.status, 409);
  assert.match(result.error, /2건/);
});
test('resolved or unrelated reviews allow check only', async () => {
  const { api, calls } = setup({
    counts: [{ questionnaire_id: actor, count: 4 }],
  });
  assert.equal(
    (await api.checkQuestionnaireDistribution(input)).distributionChecked,
    true,
  );
  assert.deepEqual(calls, ['question_review_counts']);
});
test('both distribution API paths call the actual database command', async () => {
  const { api, calls } = setup();
  assert.equal(
    (await api.publishQuestionnaireDraft(input, 'distribute')).error,
    undefined,
  );
  assert.equal(
    (
      await api.changeQuestionnaireStatus({
        ...input,
        expectedStatus: 'published',
        archivedAt: null,
        status: 'distributed',
        requestId: actor,
      })
    ).questionnaireId,
    id,
  );
  assert.deepEqual(calls, [
    'question_review_counts',
    'distribute_questionnaire',
    'change_questionnaire_status',
  ]);
});
test('database pending-review rejection is shown to the caller', async () => {
  const { api } = setup({
    error: {
      code: '55000',
      message: 'Unresolved question reviews prevent distribution',
    },
  });
  const result = await api.changeQuestionnaireStatus({
    ...input,
    expectedStatus: 'published',
    archivedAt: null,
    status: 'distributed',
    requestId: actor,
  });
  assert.equal(result.status, 409);
  assert.match(result.error, /미처리 검토 요청/);
});
test('consultant and non-owner staff cannot check', async () => {
  for (const options of [
    { role: 'consultant' },
    { owner: id },
    { role: 'admin', owner: id },
  ]) {
    const { api, calls } = setup(options);
    assert.equal((await api.checkQuestionnaireDistribution(input)).status, 403);
    assert.equal(calls.length, 0);
  }
});
test('stale, draft, distributed and archived questionnaires reject checks', async () => {
  for (const options of [
    { revision: 3 },
    { status: 'draft' },
    { status: 'distributed' },
    { archived: '2026-10-02' },
  ]) {
    const { api, calls } = setup(options);
    assert.equal((await api.checkQuestionnaireDistribution(input)).status, 409);
    assert.equal(calls.length, 0);
  }
});
test('review lookup errors and invalid responses fail closed', async () => {
  for (const options of [
    { error: { message: 'unavailable' } },
    { counts: null },
    { counts: [{ questionnaire_id: id, count: 'invalid' }] },
  ]) {
    const { api } = setup(options);
    assert.equal((await api.checkQuestionnaireDistribution(input)).status, 503);
  }
});

test('saved response prevents withdrawal with an actionable error', async () => {
  const { api } = setup({
    error: {
      code: '55000',
      message: 'Saved responses prevent distribution withdrawal',
    },
  });
  const result = await api.changeQuestionnaireStatus({
    ...input,
    expectedStatus: 'distributed',
    archivedAt: null,
    status: 'published',
    requestId: actor,
  });
  assert.equal(result.status, 409);
  assert.match(result.error, /저장된 응답/);
});
