import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      TextEncoder,
      structuredClone,
      require: (name) => {
        if (name === 'zod') return require('zod');
        if (name === 'server-only') return {};
        if (name === './schema')
          return load('features/questionnaires/schema.ts');
        if (name === 'node:crypto') return { randomUUID };
        assert.ok(name in imports, `Unexpected import ${name}`);
        return imports[name];
      },
    },
  );
  return exports;
}
const { QuestionnaireSaveSession } = load(
  'features/questionnaires/save-session.ts',
);
const { saveQuestionnaireSchema } = load('features/questionnaires/schema.ts');
const document = () => ({
  questionnaireId: randomUUID(),
  versionId: randomUUID(),
  title: '',
  sections: [
    {
      id: randomUUID(),
      title: '',
      questions: [
        {
          id: randomUUID(),
          logicalKey: randomUUID(),
          text: '',
          details: [
            {
              id: randomUUID(),
              title: '',
              text: '',
              visibleToConsultants: false,
            },
          ],
        },
      ],
    },
  ],
});

test('saving a snapshot does not mark edits made during the request as saved; overlapping calls are excluded', async () => {
  const original = document();
  const session = new QuestionnaireSaveSession(original, 0);
  const first = { ...original, title: 'first' };
  let resolve;
  const pending = session.save(
    first,
    () =>
      new Promise((done) => {
        resolve = done;
      }),
    randomUUID,
  );
  assert.equal(
    await session.save(
      { ...first, title: 'second' },
      () => assert.fail('Overlapping save'),
      randomUUID,
    ),
    null,
  );
  resolve({ ok: true, revision: 1, savedAt: 'now' });
  await pending;
  assert.equal(session.hasChanges(first), false);
  assert.equal(session.hasChanges({ ...first, title: 'second' }), true);
  assert.equal(session.revision, 1);
});

test('a lost response retries the same request ID, revision and snapshot before saving newer changes', async () => {
  const original = document();
  const session = new QuestionnaireSaveSession(original, 0);
  let failedRequest;
  await assert.rejects(
    session.save(
      original,
      async (request) => {
        failedRequest = request;
        throw new Error('network');
      },
      randomUUID,
    ),
  );
  assert.equal(session.pending, false);
  assert.equal(session.hasChanges(original), true);
  const edited = { ...original, title: 'new input' };
  await session.save(
    edited,
    async (request) => {
      assert.deepEqual(request, failedRequest);
      return { ok: true, revision: 1, savedAt: 'now' };
    },
    randomUUID,
  );
  assert.equal(session.hasChanges(edited), true);
  await session.save(
    edited,
    async (request) => {
      assert.equal(request.expectedRevision, 1);
      assert.notEqual(request.saveId, failedRequest.saveId);
      assert.equal(request.document.title, 'new input');
      return { ok: true, revision: 2, savedAt: 'later' };
    },
    randomUUID,
  );
  assert.equal(session.hasChanges(edited), false);
});

test('conflicts stop automatic retries and preserve unsaved contents', async () => {
  const original = document();
  const session = new QuestionnaireSaveSession(original, 2);
  const edited = { ...original, title: 'my changes' };
  await session.save(
    edited,
    async () => ({ ok: false, code: 'conflict', error: 'changed elsewhere' }),
    randomUUID,
  );
  assert.equal(session.blocked, true);
  assert.equal(session.hasChanges(edited), true);
  assert.equal(session.revision, 2);
  assert.equal(
    await session.save(edited, () => assert.fail('Conflict retry'), randomUUID),
    null,
  );
});

test('input validation preserves UUID identities and rejects duplicates, invalid visibility and oversized payloads', () => {
  const request = {
    document: document(),
    expectedRevision: 0,
    saveId: randomUUID(),
  };
  assert.equal(saveQuestionnaireSchema.safeParse(request).success, true);
  const duplicate = structuredClone(request);
  duplicate.document.sections.push(duplicate.document.sections[0]);
  assert.equal(saveQuestionnaireSchema.safeParse(duplicate).success, false);
  const invalid = structuredClone(request);
  invalid.document.sections[0].questions[0].details[0].visibleToConsultants =
    'false';
  assert.equal(saveQuestionnaireSchema.safeParse(invalid).success, false);
  assert.equal(
    saveQuestionnaireSchema.safeParse({
      ...request,
      document: { ...request.document, title: 'a'.repeat(501) },
    }).success,
    false,
  );
});

test('server save checks actual role/onboarding and maps database conflicts without granting writes', async () => {
  for (const role of ['student', 'consultant', 'consultant_lead', 'admin']) {
    for (const isOnboarded of [false, true]) {
      const calls = [];
      const { saveQuestionnaireDraft } = load(
        'features/questionnaires/server.ts',
        {
          'next/headers': { cookies: async () => ({}) },
          '@/lib/auth': {
            getUserAccess: async () => ({
              user: { id: randomUUID() },
              role,
              isOnboarded,
            }),
          },
          '@/lib/supabase/server': {
            createClient: () => ({
              rpc: async (...args) => {
                calls.push(args);
                return { data: null, error: { code: '40001' } };
              },
            }),
          },
        },
      );
      const result = await saveQuestionnaireDraft({
        document: document(),
        expectedRevision: 1,
        saveId: randomUUID(),
      });
      const allowed =
        isOnboarded && ['consultant_lead', 'admin'].includes(role);
      assert.equal(calls.length, allowed ? 1 : 0);
      assert.equal(result.code, allowed ? 'conflict' : 'forbidden');
    }
  }
});
