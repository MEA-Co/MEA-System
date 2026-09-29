import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
const require = createRequire(import.meta.url);
const base = 'app/(private)/dashboard/_views/questions/';
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
      crypto: { randomUUID },
      require: (id) => (id === 'zod' ? require('zod') : imports[id]),
    },
  );
  return exports;
}
const types = load(base + 'lib/question-types.ts');
const blocks = load(base + 'lib/question-blocks.ts', {
  './rich-text': { richTextPlainText: (s) => s },
});
test('exploration column round trips alongside text and repeated rows', () => {
  const document = blocks.emptyQuestionBlock();
  document.prompt = '활동을 첨부해 주세요';
  document.fields.unshift({
    id: randomUUID(),
    label: '탐구활동',
    kind: 'exploration',
  });
  document.rowMode = 'repeatable';
  document.minRows = 2;
  document.maxRows = 5;
  const parsed = blocks.questionBlockSchema.parse(document);
  assert.equal(parsed.fields[0].kind, 'exploration');
  assert.equal(parsed.fields[1].kind, 'text');
  assert.equal(parsed.minRows, 2);
  assert.equal(
    blocks.fieldSchema.safeParse({ ...parsed.fields[0], kind: 'unknown' })
      .success,
    false,
  );
});
test('exploration answers require an activity UUID and complete requires selection', () => {
  const question = { kind: 'exploration' };
  assert.equal(types.validTypedAnswer(question, randomUUID(), true), true);
  for (const value of [
    'topic',
    '[]',
    '{}',
    JSON.stringify({ id: randomUUID() }),
  ]) {
    assert.equal(types.validTypedAnswer(question, value, true), false);
  }
  assert.equal(types.validTypedAnswer(question, '', false), true);
  assert.equal(types.validTypedAnswer(question, '', true), false);
  assert.equal(
    types.validTypedAnswer({ kind: 'text' }, '기존 답변', true),
    true,
  );
});
