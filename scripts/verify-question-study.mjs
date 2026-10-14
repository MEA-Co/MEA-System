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
test('retired study field and stored UUID answer are rejected', () => {
  const document = blocks.emptyQuestionBlock();
  document.prompt = '참조는 서술형 본문으로 작성';
  document.fields[0].kind = 'study';
  assert.equal(blocks.questionBlockSchema.safeParse(document).success, false);
  for (const value of ['', randomUUID(), '본문']) {
    assert.equal(types.validTypedAnswer({ kind: 'study' }, value, false), false);
  }
  assert.equal(types.validTypedAnswer({ kind: 'text' }, '기존 답변', true), true);
});

const fieldQuestions = load(base + 'lib/field-question.ts', {
  './question-types': types,
});
test('text study recommendation survives save validation and editor/readback conversions', () => {
  const document = blocks.emptyQuestionBlock();
  document.prompt = '학습법을 참고해 작성해 주세요';
  for (const enabled of [true, false]) {
    document.fields[0].studyRecommended = enabled;
    const parsed = blocks.questionBlockSchema.parse(document);
    assert.equal(parsed.fields[0].studyRecommended, enabled);
    assert.equal(
      fieldQuestions.questionFromField(parsed.fields[0]).studyRecommended,
      enabled,
    );
    const row = {
      id: document.id,
      title: document.title,
      prompt: document.prompt,
      fields: parsed.fields,
      row_mode: document.rowMode,
      max_rows: document.maxRows,
      source_block_id: null,
      source_field_id: null,
      after_block_id: null,
      condition: null,
    };
    assert.equal(
      blocks.documentFromRow(row).fields[0].studyRecommended,
      enabled,
    );
  }
  delete document.fields[0].studyRecommended;
  assert.equal(
    blocks.questionBlockSchema.parse(document).fields[0].studyRecommended,
    undefined,
  );
});
test('recommendation accepts only text-field boolean settings', () => {
  const field = { id: randomUUID(), label: '답변', kind: 'text' };
  for (const value of ['true', 1, null]) {
    assert.equal(
      blocks.fieldSchema.safeParse({ ...field, studyRecommended: value })
        .success,
      false,
    );
  }
  for (const kind of ['study', 'scale', 'single', 'multiple']) {
    const other = {
      ...field,
      kind,
      studyRecommended: true,
      scaleMax: 5,
      options: [
        { id: randomUUID(), label: 'A' },
        { id: randomUUID(), label: 'B' },
      ],
    };
    assert.equal(blocks.fieldSchema.safeParse(other).success, false);
  }
});
