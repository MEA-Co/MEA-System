import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  answeredSourceRows,
  minimumAnswerRows,
  referenceAnswerRows,
} from '../app/(private)/dashboard/_views/questions/lib/reference-rows.ts';

test('reference rows follow source IDs instead of source count or array positions', () => {
  const saved = [
    { id: 1, answers: { response: '첫 응답' } },
    { id: 3, answers: { response: '세 번째 응답' } },
  ];
  const sources = [
    { id: 3, answers: {} },
    { id: 4, answers: {} },
  ];
  assert.deepEqual(referenceAnswerRows(sources, saved), [
    saved[1],
    { id: 4, answers: {} },
  ]);
  assert.deepEqual(referenceAnswerRows([], saved), []);
  assert.deepEqual(referenceAnswerRows([{ id: 1, answers: {} }], saved), [
    saved[0],
  ]);
  assert.equal(saved.length, 2);
});

test('all columns must be answered in the same row; a specific column only checks itself', () => {
  const rows = [
    { id: 1, answers: { a: '첫 응답', b: '' } },
    { id: 2, answers: { a: '', b: '둘째 응답' } },
    { id: 3, answers: { a: '전체', b: '완료' } },
  ];
  const hasAnswer = (_id, value) => !!value.trim();
  assert.deepEqual(
    answeredSourceRows(rows, ['a', 'b'], hasAnswer).map((row) => row.id),
    [3],
  );
  assert.deepEqual(
    answeredSourceRows(rows, ['a'], hasAnswer).map((row) => row.id),
    [1, 3],
  );
  assert.deepEqual(answeredSourceRows(rows, ['missing'], hasAnswer), []);
  assert.deepEqual(answeredSourceRows(rows, [], hasAnswer), []);
});

test('minimum preview rows preserve answers, keep unique stable IDs and respect maximum', () => {
  const saved = [
    { id: 1, answers: { a: 'keep' } },
    { id: -1, answers: { a: 'also keep' } },
  ];
  const rows = minimumAnswerRows(saved, 4, 5);
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map((row) => row.id)).size, 4);
  assert.equal(rows[0], saved[0]);
  assert.equal(rows[1], saved[1]);
  assert.deepEqual(minimumAnswerRows(rows, 4, 5), rows);
  assert.equal(minimumAnswerRows(rows, 4, 2).length, 2);
  assert.equal(saved.length, 2);
});
