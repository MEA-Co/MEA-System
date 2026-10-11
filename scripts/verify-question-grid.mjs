import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
import { z } from 'zod';

import { displayAnswerRows } from '../app/(private)/dashboard/_views/questions/lib/reference-rows.ts';

function loadSource(path, dependencies = {}) {
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
        if (!(name in dependencies))
          throw new Error(`Unexpected import: ${name}`);
        return dependencies[name];
      },
    },
  );
  return exports;
}

const directory = 'app/(private)/dashboard/_views/questions/lib/';
const richText = loadSource(`${directory}rich-text.ts`);
const { questionBlockSchema, emptyQuestionBlock, documentFromRow } = loadSource(
  `${directory}question-blocks.ts`,
  { zod: { z }, './rich-text': richText },
);

test('minimum rows render even when initial display is lower; spare rows do not mutate saved answers', () => {
  const stored = [{ id: 17, answers: { subject: '수학' } }];
  const shown = displayAnswerRows(stored, {
    answerLayout: 'table',
    minRows: 5,
    initialRows: 2,
    maxRows: 8,
  });
  assert.equal(shown.length, 5);
  assert.equal(shown[0], stored[0]);
  assert.equal(new Set(shown.map((row) => row.id)).size, 5);
  assert.equal(stored.length, 1);
  assert.equal(
    displayAnswerRows([], {
      answerLayout: 'table',
      minRows: 1,
      initialRows: 5,
      maxRows: 20,
    }).length,
    5,
  );
});

test('deleting a spare row keeps it removed and never lowers the configured minimum', () => {
  const settings = {
    answerLayout: 'table',
    minRows: 2,
    initialRows: 5,
    maxRows: 10,
  };
  assert.equal(displayAnswerRows([], settings, 3).length, 3);
  assert.equal(displayAnswerRows([], settings, 1).length, 2);
  assert.equal(displayAnswerRows([], { ...settings, minRows: 4 }, 3).length, 4);
  assert.equal(
    displayAnswerRows([], { ...settings, initialRows: 7 }).length,
    7,
  );
});

test('flow retains blank period slots and original row IDs in their configured order', () => {
  const stored = [
    { id: 900, answers: {} },
    { id: -1, answers: { score: '2등급' } },
    { id: -2, answers: {} },
  ];
  const shown = displayAnswerRows(stored, {
    answerLayout: 'flow',
    minRows: 1,
    initialRows: 1,
    maxRows: 6,
  });
  assert.equal(shown.length, 6);
  assert.deepEqual(shown.slice(0, 3), stored);
  assert.equal(shown[1].answers.score, '2등급');
  assert.equal(new Set(shown.map((row) => row.id)).size, 6);
});

test('existing card questions retain minimum rendering and maximum limits', () => {
  const settings = { minRows: 1, initialRows: 5, maxRows: 3 };
  assert.equal(displayAnswerRows([], settings).length, 1);
  const rows = [
    { id: 1, answers: {} },
    { id: 2, answers: {} },
    { id: 3, answers: {} },
    { id: 4, answers: {} },
  ];
  assert.equal(displayAnswerRows(rows, settings).length, 3);
});

test('table settings and optional fields survive document serialization and validation', () => {
  const original = {
    ...emptyQuestionBlock(),
    prompt: '추천 문제집',
    rowMode: 'repeatable',
    maxRows: 20,
    minRows: 5,
    initialRows: 5,
    answerLayout: 'table',
  };
  original.fields[0].required = false;
  const parsed = questionBlockSchema.parse(original);
  assert.equal(parsed.answerLayout, 'table');
  assert.equal(parsed.fields[0].required, false);
  const loaded = documentFromRow({
    id: original.id,
    title: '',
    prompt: original.prompt,
    fields: parsed.fields,
    row_mode: 'repeatable',
    max_rows: 20,
    min_rows: 5,
    row_labels: [],
    answer_layout: 'table',
    initial_rows: 5,
    source_block_id: null,
    source_field_id: null,
    after_block_id: null,
    condition: null,
  });
  assert.equal(loaded.answerLayout, 'table');
  assert.equal(loaded.initialRows, 5);
  assert.equal(loaded.minRows, 5);
  assert.equal(loaded.fields[0].id, original.fields[0].id);
  assert.equal(loaded.fields[0].required, false);
});

test('invalid layouts, row bounds and optional-field types are rejected', () => {
  const original = { ...emptyQuestionBlock(), prompt: '성적 흐름' };
  assert.equal(
    questionBlockSchema.safeParse({ ...original, answerLayout: 'unknown' })
      .success,
    false,
  );
  assert.equal(
    questionBlockSchema.safeParse({ ...original, initialRows: 2 }).success,
    false,
  );
  assert.equal(
    questionBlockSchema.safeParse({
      ...original,
      rowMode: 'repeatable',
      maxRows: 3,
      minRows: 4,
    }).success,
    false,
  );
  assert.equal(
    questionBlockSchema.safeParse({
      ...original,
      fields: [{ ...original.fields[0], required: 'false' }],
    }).success,
    false,
  );
  const source = crypto.randomUUID();
  assert.equal(
    questionBlockSchema.safeParse({
      ...original,
      answerLayout: 'flow',
      rowMode: 'reference',
      sourceBlockId: source,
      condition: {
        mode: 'all',
        clauses: [{ blockId: source, op: 'answered' }],
      },
    }).success,
    false,
  );
});
