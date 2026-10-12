import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
import { z } from 'zod';

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
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync('app/api/questions/[[...path]]/route.ts', 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      Response,
      URL,
      TextEncoder,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return {
    calls,
    save: () => {
      const id = randomUUID();
      return exports.PUT(
        new Request(`https://example.test/api/questions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document: { id, prompt: '보존할 원본 질문' },
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
