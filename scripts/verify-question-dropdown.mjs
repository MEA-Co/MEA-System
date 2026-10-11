import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  choiceAnswerValue,
  encodeChoiceAnswerValue,
  selectedOptions,
  updateChoiceSelection,
  validTypedAnswer,
} from '../app/(private)/dashboard/_views/questions/lib/question-types.ts';

const options = [
  { id: 'math', label: '수학' },
  { id: 'english', label: '영어' },
  { id: 'other', label: '직접 입력', isOther: true },
];
const single = { kind: 'single', options };
const multiple = { kind: 'multiple', options };
const encode = (answers) => encodeChoiceAnswerValue(answers, true, false, '');

test('single dropdown answers use the existing option ID and clear to an empty draft', () => {
  const value = updateChoiceSelection(single, '', ['math']);
  assert.equal(value, 'math');
  assert.equal(validTypedAnswer(single, value, true), true);
  assert.equal(updateChoiceSelection(single, value, ['english']), 'english');
  const cleared = updateChoiceSelection(single, value, []);
  assert.equal(cleared, '');
  assert.equal(validTypedAnswer(single, cleared), true);
  assert.equal(validTypedAnswer(single, cleared, true), false);
});

test('multiple dropdown changes preserve every existing direct entry and its identity', () => {
  const direct = [
    { id: 'other', text: '물리', entryId: 'first' },
    { id: 'other', text: '화학', entryId: 'second' },
  ];
  const stored = encode(['math', ...direct]);
  const added = updateChoiceSelection(multiple, stored, [
    'other',
    'english',
    'math',
  ]);
  assert.deepEqual(choiceAnswerValue(added, true).choices, [
    'math',
    'english',
    ...direct,
  ]);
  assert.equal(validTypedAnswer(multiple, added, true), true);
  const removed = updateChoiceSelection(multiple, added, ['english', 'other']);
  assert.deepEqual(choiceAnswerValue(removed, true).choices, [
    'english',
    ...direct,
  ]);
  assert.equal(stored, encode(['math', ...direct]));
  assert.equal(updateChoiceSelection(multiple, added, ['math']), '["math"]');
});

test('single direct input survives reselection without acquiring a multiple-entry ID', () => {
  const created = updateChoiceSelection(single, '', ['other']);
  assert.deepEqual(choiceAnswerValue(created, false).choices, [
    { id: 'other', text: '' },
  ]);
  assert.equal(validTypedAnswer(single, created), true);
  assert.equal(validTypedAnswer(single, created, true), false);
  const saved = JSON.stringify({ id: 'other', text: '물리' });
  assert.equal(updateChoiceSelection(single, saved, ['other']), saved);
  assert.equal(validTypedAnswer(single, saved, true), true);
});

test('new multiple direct inputs have independent IDs in separate cells and remain stable', () => {
  const first = updateChoiceSelection(multiple, '', ['other']);
  const second = updateChoiceSelection(multiple, '', ['other']);
  const a = choiceAnswerValue(first, true).choices[0];
  const b = choiceAnswerValue(second, true).choices[0];
  assert.ok(a.entryId);
  assert.ok(b.entryId);
  assert.notEqual(a.entryId, b.entryId);
  assert.equal(validTypedAnswer(multiple, first), true);
  assert.equal(updateChoiceSelection(multiple, first, ['other']), first);
  assert.equal(updateChoiceSelection(multiple, first, []), '');
});

test('dropdown selection keeps legacy direct answers and ignores absent or duplicate option IDs', () => {
  const legacy = { id: 'other', text: '직접 입력한 과목' };
  const saved = encode([legacy]);
  const next = updateChoiceSelection(multiple, saved, [
    'deleted',
    'other',
    'math',
    'math',
  ]);
  assert.deepEqual(choiceAnswerValue(next, true).choices, ['math', legacy]);
  assert.equal(validTypedAnswer(multiple, next, true), true);
  assert.equal(updateChoiceSelection(single, '', ['deleted']), '');
});

test('existing multiple-selection readers continue to find the same option IDs', () => {
  const next = updateChoiceSelection(multiple, '', ['english', 'math']);
  assert.deepEqual(selectedOptions(next), ['math', 'english']);
  assert.equal(
    validTypedAnswer({ ...multiple, options: options.slice(0, 2) }, next, true),
    true,
  );
});
