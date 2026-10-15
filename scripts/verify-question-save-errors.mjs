import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { z } from 'zod';

import { loadQuestionModule } from './helpers/load-question-module.mjs';

function setup(error) {
  const calls = [];
  const imports = {
    zod: { z },
    'next/headers': { cookies: async () => ({}) },
    '@/app/(private)/dashboard/_views/questions/lib/question-blocks': {
      questionBlockSchema: z.any(),
    },
    '@/app/(private)/dashboard/_views/questions/lib/question-usage': {},
    '@/lib/admin': { getViewRole: async () => 'consultant_lead' },
    '@/lib/auth': {
      getUserAccess: async () => ({
        user: { id: 'owner' },
        role: 'consultant_lead',
        isOnboarded: true,
      }),
    },
    '@/lib/supabase/server': {
      createClient: () => ({
        rpc: (name, args) => {
          calls.push({ name, args });
          return { overrideTypes: async () => ({ error, data: null }) };
        },
      }),
    },
  };
  const exports = loadQuestionModule(
    'app/api/questions/[[...path]]/route.ts',
    { Response, URL, TextEncoder },
    (name) => imports[name],
  );
  return {
    calls,
    save: (patch = {}) => {
      const id = randomUUID();
      return exports.PUT(
        new Request(`https://example.test/api/questions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document: {
              id,
              title: '',
              prompt: '보존할 원본 질문',
              fields: [{ id: randomUUID(), label: '답변', kind: 'text' }],
              rowMode: 'single',
              maxRows: null,
              sourceBlockId: null,
              sourceFieldId: null,
              afterBlockId: null,
              condition: null,
              ...patch,
            },
            expectedRevision: 3,
            saveId: randomUUID(),
          }),
        }),
        { params: Promise.resolve({ path: [id] }) },
      );
    },
  };
}

test('revision conflicts are identified independently from policy rejections', async () => {
  const app = setup({
    code: '40001',
    message: 'Question block revision conflict',
  });
  const response = await app.save();
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'revision_conflict');
  assert.equal(app.calls[0].name, 'save_question');
  assert.equal(app.calls[0].args.p_expected_revision, 3);
});

test('dependency rejections explain how to release the restriction and retry', async () => {
  const app = setup({
    code: '55000',
    message: 'Referenced answer fields or rows cannot change',
  });
  const response = await app.save();
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(result.code, 'question_edit_restricted');
  assert.match(result.error, /조건과 응답 참조를 해제하고 저장한 뒤/);
});

test('distribution restrictions stay explicit and are not revision conflicts', async () => {
  const app = setup({
    code: '55000',
    message: 'Distributed question is immutable',
  });
  const response = await app.save();
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(result.code, 'question_edit_restricted');
  assert.match(result.error, /배포된 질문지/);
});

test('guide answer deletion confirmation retains its dedicated code and field IDs', async () => {
  const fields = [randomUUID()];
  const app = setup({
    code: 'PGA01',
    message: 'Guide answer deletion confirmation required',
    details: JSON.stringify(fields),
  });
  const response = await app.save();
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(result.code, 'guide_answer_confirmation_required');
  assert.deepEqual(result.fieldIds, fields);
});

test('other save errors retain their status without claiming a revision conflict', async () => {
  for (const [code, status] of [
    ['22023', 400],
    ['42501', 403],
    ['23505', 409],
    ['XX000', 503],
  ]) {
    const response = await setup({ code, message: 'Save rejected' }).save();
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, 'question_save_failed');
  }
});

test('immutable card kinds and registration dependency restrictions explain the allowed actions', async () => {
  for (const [message, expected, status] of [
    ['Question purpose is immutable', /다른 종류는 새 카드로/, 409],
    [
      'Study registration cards cannot be answer dependencies',
      /답변 조건이나 참조 대상으로 사용할 수 없어요/,
      400,
    ],
  ]) {
    const response = await setup({
      code: status === 409 ? '55000' : '22023',
      message,
    }).save();
    const result = await response.json();
    assert.equal(response.status, status);
    assert.notEqual(result.code, 'revision_conflict');
    assert.match(result.error, expected);
  }
});

test('saved flow period protection remains a recoverable policy error with available edit guidance', async () => {
  const response = await setup({
    code: '55000',
    message:
      'Saved flow periods require their original layout and fixed period count',
  }).save();
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(result.code, 'question_edit_restricted');
  assert.match(result.error, /표시 방식이나 기본 시기 수를 바꿀 수 없어요/);
  assert.match(result.error, /시기 이름과 추가 허용 위치는 수정할 수/);
});

test('invalid question fields return a concrete path before database save', async () => {
  const app = setup(null);
  const response = await app.save({
    fields: [{ id: randomUUID(), label: 'x'.repeat(101), kind: 'text' }],
  });
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.equal(result.code, 'question_validation_failed');
  assert.deepEqual(result.fieldErrors[0].path, [
    'document',
    'fields',
    0,
    'label',
  ]);
  assert.match(result.error, /답변 열.*1번.*100/);
  assert.equal(app.calls.length, 0);
});

test('duplicate explanation IDs are rejected before any write', async () => {
  const app = setup(null);
  const detail = {
    id: randomUUID(),
    title: '예시',
    text: '',
    visibleToConsultants: true,
  };
  const response = await app.save({ details: [detail, detail] });
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.match(result.error, /설명 항목.*중복/);
  assert.deepEqual(result.fieldErrors[0].path, ['document', 'details']);
  assert.equal(app.calls.length, 0);
});

test('known database validation failures preserve the affected area', async () => {
  const app = setup({
    code: '22023',
    message: 'Detail belongs to another question',
  });
  const response = await app.save();
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.match(result.error, /다른 질문에 속한 설명/);
  assert.deepEqual(result.fieldErrors[0].path, ['document', 'details']);
});
