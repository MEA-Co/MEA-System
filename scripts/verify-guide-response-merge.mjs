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
