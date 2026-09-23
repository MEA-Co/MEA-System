import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  matchingChoiceRows,
  supportsChoiceCondition,
} from '../app/(private)/dashboard/_views/questions/lib/choice-condition.ts';
import { referenceAnswerRows } from '../app/(private)/dashboard/_views/questions/lib/reference-rows.ts';

const single = {
  id: 'single',
  label: '전형',
  kind: 'single',
  options: [
    { id: 'a', label: '수시' },
    { id: 'b', label: '정시' },
  ],
};
const multiple = { ...single, id: 'multiple', kind: 'multiple' };
const rows = [
  { id: 1, answers: { single: 'a', multiple: '["a","b"]' } },
  { id: 2, answers: { single: 'b', multiple: '["b"]' } },
  { id: 3, answers: { single: 'a', multiple: '["a"]' } },
  { id: 4, answers: {} },
];
const clause = {
  blockId: 'source',
  fieldId: 'single',
  op: 'equals',
  value: 'a',
};

test('single exact match and multiple inclusion both filter only matching source rows', () => {
  assert.deepEqual(
    matchingChoiceRows(rows, clause, [single]).map((row) => row.id),
    [1, 3],
  );
  assert.deepEqual(
    matchingChoiceRows(
      rows,
      { ...clause, fieldId: 'multiple', op: 'includes' },
      [multiple],
    ).map((row) => row.id),
    [1, 3],
  );
});

test('disabled direct input fields, missing options and incompatible operators never match', () => {
  const direct = {
    ...single,
    options: [
      ...single.options,
      { id: 'other', label: '직접 입력', isOther: true },
    ],
  };
  assert.equal(supportsChoiceCondition(direct), false);
  assert.deepEqual(matchingChoiceRows(rows, clause, [direct]), []);
  assert.deepEqual(
    matchingChoiceRows(rows, { ...clause, value: 'deleted' }, [single]),
    [],
  );
  assert.deepEqual(
    matchingChoiceRows(rows, { ...clause, op: 'includes' }, [single]),
    [],
  );
  assert.deepEqual(
    matchingChoiceRows(rows, { ...clause, value: undefined }, [single]),
    [],
  );
});

test('changing an earlier selection hides only its associated row and restores its saved answer', () => {
  const saved = [
    { id: 1, answers: { reply: '첫 번째' } },
    { id: 3, answers: { reply: '세 번째' } },
  ];
  const changed = rows.map((row) =>
    row.id === 1 ? { ...row, answers: { ...row.answers, single: 'b' } } : row,
  );
  assert.deepEqual(
    referenceAnswerRows(matchingChoiceRows(changed, clause, [single]), saved),
    [saved[1]],
  );
  assert.deepEqual(
    referenceAnswerRows(matchingChoiceRows(rows, clause, [single]), saved),
    saved,
  );
  assert.deepEqual(
    matchingChoiceRows([{ id: 1, answers: { single: '["a","b"]' } }], clause, [
      single,
    ]),
    [],
  );
});
