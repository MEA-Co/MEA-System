import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  choiceAnswerValue,
  encodeChoiceAnswerValue,
  validTypedAnswer,
} from '../app/(private)/dashboard/_views/questions/lib/question-types.ts';

const options = [
  { id: 'regular', label: '기본' },
  { id: 'other', label: '직접 입력', isOther: true },
];
const multiple = { kind: 'multiple', options };
const entries = [
  'regular',
  { id: 'other', text: '첫 답변', entryId: 'entry-a' },
  { id: 'other', text: '둘째 답변', entryId: 'entry-b' },
];
const encode = (values) => encodeChoiceAnswerValue(values, true, false, '');

test('multiple direct entries survive serialization and editing/removing a sibling', () => {
  const value = encode(entries);
  assert.deepEqual(choiceAnswerValue(value, true).choices, entries);
  assert.equal(validTypedAnswer(multiple, value, true), true);
  const updated = [...entries];
  updated[1] = { ...updated[1], text: '수정한 답변' };
  const remaining = choiceAnswerValue(
    encode(updated.filter((_, index) => index !== 1)),
    true,
  ).choices;
  assert.deepEqual(remaining, [entries[0], entries[2]]);
  assert.equal(validTypedAnswer(multiple, encode(remaining), true), true);
});

test('duplicate entry IDs, duplicate ordinary choices and incomplete submitted entries are rejected', () => {
  assert.equal(
    validTypedAnswer(multiple, encode([entries[1], entries[1]])),
    false,
  );
  assert.equal(
    validTypedAnswer(multiple, encode(['regular', 'regular'])),
    false,
  );
  const blank = encode([{ ...entries[1], text: '' }]);
  assert.equal(validTypedAnswer(multiple, blank), true);
  assert.equal(validTypedAnswer(multiple, blank, true), false);
});

test('single choices keep one legacy direct entry and reject multiple entries', () => {
  const single = { ...multiple, kind: 'single' };
  const legacy = { id: 'other', text: '한 답변' };
  const value = encodeChoiceAnswerValue([legacy], false, false, '');
  assert.equal(validTypedAnswer(single, value, true), true);
  assert.deepEqual(choiceAnswerValue(value, false).choices, [legacy]);
  assert.equal(validTypedAnswer(single, encode(entries), true), false);
  assert.equal(validTypedAnswer(multiple, encode([legacy]), true), true);
});
