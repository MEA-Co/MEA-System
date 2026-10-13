import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      'app/(private)/dashboard/_views/questions/lib/question-responses.ts',
      'utf8',
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports },
);
const snap = (fields, extra = []) => ({
  questions: [
    {
      definition: { id: 'q', row_mode: 'repeatable', max_rows: 3, fields },
      rows: [],
    },
    ...extra,
  ],
});
test('guide inputs retain compatible fields without archiving removed or changed fields', () => {
  const old = snap([
    { id: 'a', kind: 'text' },
    { id: 'b', kind: 'text' },
    { id: 'c', kind: 'text' },
  ]);
  const next = snap([
    { id: 'a', kind: 'text' },
    { id: 'b', kind: 'scale' },
    { id: 'd', kind: 'text' },
  ]);
  const result = exports.mergeGuideResponseRows(
    { q: [{ id: 7, answers: { a: 'keep', b: 'discard', c: 'remove' } }] },
    old,
    next,
  );
  assert.equal(
    JSON.stringify(result),
    JSON.stringify({ q: [{ id: 7, answers: { a: 'keep' } }] }),
  );
});
test('removed questions have no local recovery copy and new questions use server rows', () => {
  const old = snap([{ id: 'a', kind: 'text' }]);
  const next = {
    questions: [
      { definition: { id: 'new', fields: [] }, rows: [{ id: 1, answers: {} }] },
    ],
  };
  const result = exports.mergeGuideResponseRows(
    { q: [{ id: 1, answers: { a: 'old' } }] },
    old,
    next,
  );
  assert.equal(Object.hasOwn(result, 'q'), false);
  assert.equal(result.new.length, 1);
});

test('a re-created response cannot revive locally cached answers for the same source question', () => {
  const old = snap([{ id: 'a', kind: 'text' }]);
  old.questions[0].responseId = 'deleted';
  const next = snap([{ id: 'a', kind: 'text' }]);
  next.questions[0].responseId = 'new';
  const merged = exports.mergeGuideResponseRows(
    { q: [{ id: 1, answers: { a: 'must not return' } }] },
    old,
    next,
  );
  assert.equal(JSON.stringify(merged), JSON.stringify({ q: [] }));
});

test('flow synchronization keeps inserted period identity and labels beyond the base count', () => {
  const before = snap([{ id: 'a', kind: 'text' }]);
  const after = snap([{ id: 'a', kind: 'text' }]);
  for (const value of [before, after]) {
    value.questions[0].definition.answer_layout = 'flow';
    value.questions[0].definition.max_rows = 2;
    value.questions[0].responseId = 'same-response';
  }
  const rows = [
    { id: 90, flowIndex: 1, answers: { a: 'original first' } },
    { id: 91, flowAfter: 1, label: '고2 여름', answers: { a: 'inserted' } },
    { id: 92, flowAfter: 1, label: '고2 겨울', answers: {} },
    { id: -1, flowIndex: 2, answers: { a: 'original second' } },
  ];
  const merged = exports.mergeGuideResponseRows({ q: rows }, before, after);
  assert.equal(JSON.stringify(merged.q), JSON.stringify(rows));
});

test('an incompatible remote flow change preserves the unsaved periods before adoption', () => {
  const before = snap([{ id: 'a', kind: 'text' }]);
  before.questions[0].definition.answer_layout = 'flow';
  before.questions[0].definition.max_rows = 2;
  before.questions[0].responseId = 'same-response';
  const rows = [
    { id: 1, flowIndex: 1, answers: { a: 'first' } },
    { id: 77, flowAfter: 1, label: '고2 여름', answers: { a: 'custom' } },
    { id: 2, flowIndex: 2, answers: { a: 'last fixed answer' } },
  ];
  const next = structuredClone(before);
  next.questions[0].definition.answer_layout = 'cards';
  assert.equal(
    exports.hasIncompatibleFlowDraft({ q: rows }, before, next),
    true,
  );
  assert.equal(
    JSON.stringify(exports.mergeGuideResponseRows({ q: rows }, before, next).q),
    JSON.stringify(rows),
  );
  next.questions[0].definition.answer_layout = 'flow';
  next.questions[0].definition.max_rows = 1;
  assert.equal(
    exports.hasIncompatibleFlowDraft({ q: rows }, before, next),
    true,
  );
  next.questions[0].definition.max_rows = 2;
  next.questions[0].definition.flow_insert_after = [];
  assert.equal(
    exports.hasIncompatibleFlowDraft({ q: rows }, before, next),
    false,
  );
  next.questions[0].definition.answer_layout = 'table';
  assert.equal(
    exports.hasIncompatibleFlowDraft(
      { q: before.questions[0].rows },
      before,
      next,
    ),
    false,
  );
  next.questions[0].responseId = 'new-response';
  assert.equal(
    exports.hasIncompatibleFlowDraft({ q: rows }, before, next),
    false,
  );
});
