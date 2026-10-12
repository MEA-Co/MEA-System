import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
import { z } from 'zod';

function loadSource(path, imports = {}) {
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
      crypto: globalThis.crypto,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return exports;
}

const base = 'app/(private)/dashboard/_views/questions/lib/';
const richText = loadSource(`${base}rich-text.ts`);
const { emptyQuestionBlock, questionBlockSchema, documentFromRow } = loadSource(
  `${base}question-blocks.ts`,
  { zod: { z }, './rich-text': richText },
);

function registration() {
  return {
    ...emptyQuestionBlock(),
    purpose: 'study_registration',
    prompt: '학습법을 등록해 주세요.',
    title: '학습법 기록',
    buttonLabel: ' 학습법 추가 ',
    fields: [],
  };
}

test('registration guidance stores no answer fields and keeps customizable content', () => {
  const document = registration();
  const parsed = questionBlockSchema.parse(document);
  assert.equal(parsed.id, document.id);
  assert.equal(parsed.purpose, 'study_registration');
  assert.equal(parsed.title, '학습법 기록');
  assert.equal(parsed.prompt, '학습법을 등록해 주세요.');
  assert.equal(parsed.buttonLabel, '학습법 추가');
  assert.deepEqual(parsed.fields, []);
});

test('response questions still require at least one answer field, including legacy documents', () => {
  const document = { ...emptyQuestionBlock(), prompt: '질문' };
  assert.equal(questionBlockSchema.safeParse(document).success, true);
  assert.equal(
    questionBlockSchema.safeParse({ ...document, fields: [] }).success,
    false,
  );
  const { purpose: _purpose, ...legacy } = document;
  assert.equal(questionBlockSchema.safeParse(legacy).success, true);
  assert.equal(
    questionBlockSchema.safeParse({ ...legacy, fields: [] }).success,
    false,
  );
});

test('registration guidance rejects answer, layout and dependency settings', () => {
  const document = registration();
  const source = crypto.randomUUID();
  const invalidPatches = [
    { fields: emptyQuestionBlock().fields },
    { rowMode: 'repeatable', maxRows: 2 },
    { rowMode: 'reference', sourceBlockId: source },
    { answerLayout: 'table' },
    { answerLayout: 'flow' },
    { minRows: 2 },
    { initialRows: 2 },
    { maxRows: 2 },
    { rowLabels: ['고1'] },
    { sourceBlockId: source },
    { sourceFieldId: source },
    { afterBlockId: source },
    {
      condition: {
        mode: 'all',
        clauses: [{ blockId: source, op: 'answered' }],
      },
    },
  ];
  for (const patch of invalidPatches) {
    assert.equal(
      questionBlockSchema.safeParse({ ...document, ...patch }).success,
      false,
      JSON.stringify(patch),
    );
  }
});

test('registration text and button label cannot be blank or exceed limits', () => {
  const document = registration();
  for (const buttonLabel of ['', '   ', '가'.repeat(101)]) {
    assert.equal(
      questionBlockSchema.safeParse({ ...document, buttonLabel }).success,
      false,
    );
  }
  for (const prompt of ['', '   ']) {
    assert.equal(
      questionBlockSchema.safeParse({ ...document, prompt }).success,
      false,
    );
  }
  assert.equal(
    questionBlockSchema.safeParse({ ...document, buttonLabel: undefined })
      .success,
    true,
  );
  assert.equal(
    questionBlockSchema.safeParse({ ...document, purpose: 'unknown' }).success,
    false,
  );
});

test('database rows roundtrip card role and button label while legacy rows default to response', () => {
  const document = registration();
  const row = {
    id: document.id,
    title: document.title,
    prompt: document.prompt,
    purpose: 'study_registration',
    button_label: '학습법 작성하기',
    fields: [],
    row_mode: 'single',
    max_rows: null,
    min_rows: 1,
    initial_rows: 1,
    answer_layout: 'cards',
    row_labels: [],
    source_block_id: null,
    source_field_id: null,
    after_block_id: null,
    condition: null,
  };
  const loaded = documentFromRow(row);
  assert.equal(loaded.purpose, 'study_registration');
  assert.equal(loaded.buttonLabel, '학습법 작성하기');
  assert.equal(loaded.id, document.id);
  assert.equal(questionBlockSchema.safeParse(loaded).success, true);
  assert.equal(
    documentFromRow({ ...row, button_label: null }).buttonLabel,
    '학습법 추가',
  );
  const { purpose: _purpose, button_label: _buttonLabel, ...legacy } = row;
  const response = documentFromRow({
    ...legacy,
    fields: emptyQuestionBlock().fields,
  });
  assert.equal(response.purpose, 'response');
  assert.equal(response.buttonLabel, undefined);
  assert.equal(questionBlockSchema.safeParse(response).success, true);
});
