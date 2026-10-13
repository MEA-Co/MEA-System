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
const { questionBlockSchema, emptyQuestionBlock, documentFromRow } = loadSource(
  `${base}question-blocks.ts`,
  { zod: { z }, './rich-text': richText },
);

function flow() {
  return {
    ...emptyQuestionBlock(),
    prompt: '내신 흐름을 작성해 주세요.',
    answerLayout: 'flow',
    rowMode: 'repeatable',
    maxRows: 6,
    minRows: 1,
    initialRows: 6,
    rowLabels: [
      '고1 1학기',
      '고1 2학기',
      '고2 1학기',
      '고2 2학기',
      '고3 1학기',
      '고3 2학기',
    ],
  };
}

function row(document) {
  return {
    id: document.id,
    title: document.title,
    prompt: document.prompt,
    fields: document.fields,
    purpose: document.purpose,
    row_mode: document.rowMode,
    answer_layout: document.answerLayout,
    max_rows: document.maxRows,
    min_rows: document.minRows,
    initial_rows: document.initialRows,
    row_labels: document.rowLabels,
    source_block_id: document.sourceBlockId,
    source_field_id: document.sourceFieldId,
    after_block_id: document.afterBlockId,
    condition: document.condition,
  };
}

test('flow insertion positions roundtrip without replacing the fixed periods or answer field IDs', () => {
  const document = { ...flow(), flowInsertAfter: [1, 3, 6] };
  const parsed = questionBlockSchema.parse(document);
  const loaded = documentFromRow({
    ...row(parsed),
    flow_insert_after: parsed.flowInsertAfter,
  });
  assert.deepEqual(Array.from(loaded.flowInsertAfter), [1, 3, 6]);
  assert.equal(loaded.maxRows, 6);
  assert.deepEqual(
    Array.from(loaded.rowLabels),
    Array.from(document.rowLabels),
  );
  assert.equal(loaded.id, document.id);
  assert.equal(loaded.fields[0].id, document.fields[0].id);
  assert.equal(questionBlockSchema.safeParse(loaded).success, true);
});

test('insertion positions must be unique integers within the fixed period count', () => {
  for (const positions of [
    [0],
    [-1],
    [7],
    [21],
    [1.5],
    [1, 1],
    ['1'],
    null,
    Array(21).fill(1),
  ]) {
    assert.equal(
      questionBlockSchema.safeParse({ ...flow(), flowInsertAfter: positions })
        .success,
      false,
      JSON.stringify(positions),
    );
  }
  assert.equal(
    questionBlockSchema.safeParse({ ...flow(), flowInsertAfter: [6] }).success,
    true,
  );
  assert.equal(
    questionBlockSchema.safeParse({
      ...flow(),
      maxRows: 20,
      flowInsertAfter: [6],
    }).success,
    false,
  );
  assert.equal(
    questionBlockSchema.safeParse({
      ...flow(),
      maxRows: 20,
      flowInsertAfter: [],
    }).success,
    true,
  );
});

test('insertion permissions are rejected for cards, normal tables, references and registration guidance', () => {
  const single = {
    ...emptyQuestionBlock(),
    prompt: '질문',
    flowInsertAfter: [1],
  };
  assert.equal(questionBlockSchema.safeParse(single).success, false);
  assert.equal(
    questionBlockSchema.safeParse({
      ...flow(),
      answerLayout: 'table',
      flowInsertAfter: [1],
    }).success,
    false,
  );
  assert.equal(
    questionBlockSchema.safeParse({
      ...flow(),
      rowMode: 'reference',
      maxRows: null,
      initialRows: 1,
      flowInsertAfter: [1],
      sourceBlockId: crypto.randomUUID(),
    }).success,
    false,
  );
  assert.equal(
    questionBlockSchema.safeParse({
      ...single,
      purpose: 'study_registration',
      fields: [],
    }).success,
    false,
  );
});

test('existing questions default to no insertion permissions and single-period flow uses position one', () => {
  const document = flow();
  const { flowInsertAfter: _permissions, ...legacy } = document;
  assert.equal(questionBlockSchema.safeParse(legacy).success, true);
  assert.equal(documentFromRow(row(legacy)).flowInsertAfter.length, 0);
  assert.equal(emptyQuestionBlock().flowInsertAfter.length, 0);
  const single = {
    ...emptyQuestionBlock(),
    prompt: '흐름',
    answerLayout: 'flow',
    flowInsertAfter: [1],
  };
  assert.equal(questionBlockSchema.safeParse(single).success, true);
  assert.equal(
    questionBlockSchema.safeParse({ ...single, flowInsertAfter: [2] }).success,
    false,
  );
});
