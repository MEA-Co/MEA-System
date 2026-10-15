import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
import { z } from 'zod';

import { loadQuestionModule } from './helpers/load-question-module.mjs';

function command(error = null) {
  const calls = [];
  const exports = {};
  class HttpError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const imports = {
    'next/headers': { cookies: async () => ({}) },
    zod: { z },
    '@/lib/admin': { getViewRole: async () => 'consultant_lead' },
    '@/lib/auth': {
      requireUserAccess: async () => ({ role: 'consultant_lead' }),
    },
    '@/lib/supabase/server': {
      createClient: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: { saved: true }, error };
        },
      }),
    },
    './questionnaire/http-error': { QuestionnaireHttpError: HttpError },
    'server-only': {},
    './responses/schema': loadQuestionModule(
      'app/(private)/dashboard/_views/questions/lib/responses/schema.ts',
      {},
      (name) => (name === 'zod' ? { z } : undefined),
    ),
    './responses/requirements': {
      CAREER_FLOW_REQUIREMENTS_MESSAGE: '진로 흐름 필수 시기',
    },
    './responses/submissions-server': {},
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        'app/(private)/dashboard/_views/questions/lib/question-response-server.ts',
        'utf8',
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return { calls, save: exports.questionResponseCommand };
}

const question = randomUUID();
const field = randomUUID();
function input(rows) {
  return {
    answers: { [question]: rows },
    revision: 0,
    saveId: randomUUID(),
    complete: false,
    definitionToken: 'a'.repeat(32),
  };
}

test('guide and published saves retain flow positions, custom labels and original answers', async () => {
  for (const published of [false, true]) {
    const api = command();
    const rows = [
      { id: 901, flowIndex: 1, answers: { [field]: '고1 성적' } },
      {
        id: 902,
        flowAfter: 1,
        label: '고2 여름방학',
        answers: { [field]: '특이사항' },
      },
      { id: -1, flowIndex: 2, answers: {} },
    ];
    await api.save(randomUUID(), 'save', input(rows), published);
    assert.equal(api.calls.length, 1);
    assert.equal(
      api.calls[0].name,
      published
        ? 'save_published_question_response_session'
        : 'save_review_response_session',
    );
    assert.deepEqual(api.calls[0].args.p_answers[question], rows);
  }
});

test('invalid flow metadata is rejected before sending a database command', async () => {
  const invalid = [
    { flowIndex: 0 },
    { flowIndex: 21 },
    { flowAfter: 1.5 },
    { flowAfter: -1 },
    { flowIndex: 1, flowAfter: 1 },
    { label: '이름만 주입' },
    { flowIndex: 1, label: '기본 시기 이름 변경' },
    { flowAfter: 1, label: '가'.repeat(101) },
    { flowAfter: 1, label: null },
    { flowAfter: 1, unexpected: true },
  ];
  for (const metadata of invalid) {
    const api = command();
    await assert.rejects(
      api.save(
        randomUUID(),
        'save',
        input([{ id: 1, answers: {}, ...metadata }]),
        true,
      ),
      (error) => error.status === 400,
    );
    assert.equal(api.calls.length, 0);
  }
});

test('an unnamed answered added period produces an actionable validation message', async () => {
  const api = command({
    code: '22023',
    message: 'Name every answered inserted flow period',
  });
  await assert.rejects(
    api.save(
      randomUUID(),
      'save',
      input([{ id: 1, flowAfter: 1, label: '', answers: { [field]: '응답' } }]),
      true,
    ),
    (error) =>
      error.status === 400 &&
      error.message === '답변을 작성한 추가 시기의 이름을 입력해 주세요.',
  );
});
