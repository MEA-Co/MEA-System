import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}, globals = {}) {
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
      ...globals,
      require: (name) => {
        if (name === 'zod') return require('zod');
        if (name === 'server-only') return {};
        if (name === './schema')
          return load(
            'app/(private)/dashboard/_views/questionnaire/lib/schema.ts',
          );
        if (name === 'node:crypto') return { randomUUID };
        assert.ok(name in imports, `Unexpected import ${name}`);
        return imports[name];
      },
    },
  );
  return exports;
}
const { QuestionnaireSaveSession } = load(
  'app/(private)/dashboard/_views/questionnaire/lib/save-session.ts',
);
const { saveQuestionnaireSchema } = load(
  'app/(private)/dashboard/_views/questionnaire/lib/schema.ts',
);

test('first autosave synchronizes the saved URL without refresh and retains later edits for the next tick', async () => {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let tick;
  let finishSave;
  const requests = [];
  const historyWrites = [];
  const windowMock = {
    location: {
      href: 'https://example.test/dashboard?view=questionnaire&draft=new',
    },
    history: {
      state: { __NA: true },
      replaceState(state, _, url) {
        assert.equal(
          state,
          null,
          'Next must synchronize the URL instead of treating it as an internal history write',
        );
        historyWrites.push(url.toString());
        windowMock.location.href = url.toString();
      },
    },
    setInterval(callback, delay) {
      assert.equal(delay, 10000);
      tick = callback;
      return 1;
    },
    clearInterval() {},
    addEventListener() {},
    removeEventListener() {},
    document: { addEventListener() {}, removeEventListener() {} },
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[index],
        (value) => {
          slots[index] = value;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (
        !slots[index] ||
        dependencies.some((value, i) => !Object.is(value, slots[index][i]))
      ) {
        slots[index] = dependencies;
        effects.push(callback);
      }
    },
    useEffectEvent(callback) {
      const ref = react.useRef(callback);
      ref.current = callback;
      return (...args) => ref.current(...args);
    },
  };
  const { useQuestionnaireSave: runSaveHook } = load(
    'app/(private)/dashboard/_views/questionnaire/hooks/useQuestionnaireSave.ts',
    {
      react,
      'next/navigation': {
        useRouter: () => ({
          refresh: () => assert.fail('Saving must not refresh the editor'),
        }),
      },
      '@/components/ui/toast': {
        toast: { add: () => 'toast', update() {}, close() {} },
      },
      '@/app/(private)/dashboard/_views/questionnaire/lib/save-session': {
        QuestionnaireSaveSession,
      },
      '../actions/save-questionnaire': {
        saveQuestionnaire: (request) => {
          requests.push(request);
          return new Promise((resolve) => {
            finishSave = resolve;
          });
        },
      },
    },
    { window: windowMock, URL, crypto: { randomUUID } },
  );
  const blank = document();
  const initialDraft = { ...blank, revision: 0, savedAt: null };
  function render(current) {
    cursor = 0;
    effects = [];
    const result = runSaveHook(current, initialDraft);
    for (const effect of effects) effect();
    return result;
  }
  render(blank);
  tick();
  assert.equal(requests.length, 0);
  const first = { ...blank, title: '작성한 제목' };
  render(first);
  tick();
  assert.equal(requests.length, 1);
  const latest = structuredClone(first);
  latest.sections[0].questions[0].text = '저장 중 추가로 입력한 질문';
  render(latest);
  finishSave({ ok: true, revision: 1, savedAt: 'first save' });
  await new Promise(setImmediate);
  assert.equal(
    new URL(historyWrites[0]).searchParams.get('draft'),
    blank.versionId,
  );
  assert.equal(
    render(latest).dirty,
    true,
    'Newer edits must remain unsaved, not be replaced',
  );
  tick();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].expectedRevision, 1);
  assert.equal(
    requests[1].document.sections[0].questions[0].text,
    latest.sections[0].questions[0].text,
  );
  finishSave({ ok: true, revision: 2, savedAt: 'second save' });
  await new Promise(setImmediate);
  assert.equal(render(latest).dirty, false);
  assert.equal(historyWrites.length, 1);
});

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
        'app/(private)/dashboard/_views/questionnaire/lib/server.ts',
        {
          '@/lib/admin': { getViewRole: async (role) => role },
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

test('questionnaire loader selects owner editing, reviewer reading, and safe consultant presentation', async () => {
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const doc = document();
  for (const scenario of [
    {
      actual: 'consultant_lead',
      visible: 'consultant_lead',
      user: ownerId,
      status: 'published',
      editable: true,
      details: 1,
    },
    {
      actual: 'admin',
      visible: 'admin',
      user: otherId,
      status: 'published',
      editable: false,
      details: 1,
    },
    {
      actual: 'consultant',
      visible: 'consultant',
      user: otherId,
      status: 'distributed',
      editable: false,
      details: 0,
    },
    {
      actual: 'admin',
      visible: 'consultant',
      user: ownerId,
      status: 'distributed',
      editable: false,
      details: 0,
    },
  ]) {
    const calls = [];
    const row = {
      id: doc.versionId,
      questionnaire_id: doc.questionnaireId,
      title: doc.title,
      status: scenario.status,
      revision: 2,
      updated_at: '2026-09-18T00:00:00Z',
      published_at: '2026-09-18T00:00:00Z',
      distributed_at: null,
      questionnaires: { created_by: ownerId, archived_at: null },
    };
    const { loadQuestionnaireView } = load(
      'app/(private)/dashboard/_views/questionnaire/lib/server.ts',
      {
        'next/headers': { cookies: async () => ({}) },
        '@/lib/admin': { getViewRole: async () => scenario.visible },
        '@/lib/auth': {
          requireUserAccess: async () => ({
            role: scenario.actual,
            user: { id: scenario.user },
          }),
        },
        '@/lib/supabase/server': {
          createClient: () => ({
            from: (table) => {
              const builder = {
                select: () => builder,
                is: () => builder,
                eq: () => builder,
                order: async () => ({
                  data: table === 'questionnaire_versions' ? [row] : [],
                  error: null,
                }),
              };
              return builder;
            },
            rpc: async (name) => {
              calls.push(name);
              return {
                data: {
                  ...structuredClone(doc),
                  revision: 2,
                  savedAt: '2026-09-18T00:00:00Z',
                },
                error: null,
              };
            },
          }),
        },
      },
    );
    const result = await loadQuestionnaireView(doc.versionId);
    assert.equal(!!result.initialDraft, scenario.editable);
    assert.equal(
      result.selected.canDelete,
      ['admin', 'consultant_lead'].includes(scenario.visible) &&
        (scenario.user === ownerId || scenario.visible === 'admin'),
    );
    assert.equal(
      calls[0],
      scenario.editable
        ? 'read_questionnaire_draft'
        : 'read_published_questionnaire',
    );
    const loaded = result.initialDraft ?? result.publishedDocument;
    assert.equal(
      loaded.sections[0].questions[0].details.length,
      scenario.details,
    );
    if (scenario.visible === 'consultant') {
      assert.equal(result.staff, false);
      assert.equal(result.selected.isOwner, false);
      await assert.rejects(loadQuestionnaireView('new'));
    }
  }
});

test('review server actions reject consultants and incomplete descriptions before RPC', async () => {
  for (const role of ['student', 'consultant', 'consultant_lead', 'admin']) {
    const calls = [];
    const { manageQuestionnaireReview } = load(
      'app/(private)/dashboard/_views/questionnaire/lib/server.ts',
      {
        'next/headers': { cookies: async () => ({}) },
        '@/lib/admin': { getViewRole: async (value) => value },
        '@/lib/auth': {
          getUserAccess: async () => ({
            user: { id: randomUUID() },
            isOnboarded: true,
            role,
          }),
        },
        '@/lib/supabase/server': {
          createClient: () => ({
            rpc: async (...args) => {
              calls.push(args);
              return { error: null };
            },
          }),
        },
      },
    );
    const input = {
      id: randomUUID(),
      versionId: randomUUID(),
      description: '검토해 주세요',
    };
    const result = await manageQuestionnaireReview(input, 'request');
    const allowed = ['consultant_lead', 'admin'].includes(role);
    assert.equal(!!result.error, !allowed);
    assert.equal(calls.length, allowed ? 1 : 0);
    assert.ok(
      (
        await manageQuestionnaireReview(
          { ...input, description: ' ' },
          'request',
        )
      ).error,
    );
    assert.equal(calls.length, allowed ? 1 : 0);
  }
});
