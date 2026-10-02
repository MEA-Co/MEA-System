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
          questionnaires: { created_by: owner, archived_at: archived },
        },
        error: null,
      };
    },
  };
  const client = {
    from(table) {
      assert.equal(table, 'questionnaire_versions');
      return query;
    },
    async rpc(name) {
      calls.push(name);
      assert.equal(name, 'question_review_counts', 'No mutation RPC may run');
      return { data: counts, error };
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
const input = { versionId: id, revision: 2 };
test('pending reviews reject distribution even when already read', async () => {
  const { api } = setup({
    counts: [{ version_id: id, count: 2, unread_count: 0 }],
  });
  const result = await api.checkQuestionnaireDistribution(input);
  assert.equal(result.status, 409);
  assert.match(result.error, /2건/);
});
test('resolved or unrelated reviews allow check only', async () => {
  const { api, calls } = setup({ counts: [{ version_id: actor, count: 4 }] });
  assert.equal(
    (await api.checkQuestionnaireDistribution(input)).distributionChecked,
    true,
  );
  assert.deepEqual(calls, ['question_review_counts']);
});
test('both existing distribution API paths perform only the check', async () => {
  const { api, calls } = setup();
  assert.equal(
    (await api.publishQuestionnaireDraft(input, 'distribute'))
      .distributionChecked,
    true,
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
    ).distributionChecked,
    true,
  );
  assert.deepEqual(calls, ['question_review_counts', 'question_review_counts']);
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
test('stale, draft, distributed and archived versions reject checks', async () => {
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
    { counts: [{ version_id: id, count: 'invalid' }] },
  ]) {
    const { api } = setup(options);
    assert.equal((await api.checkQuestionnaireDistribution(input)).status, 503);
  }
});
