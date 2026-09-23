import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  answeredSourceRows,
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
