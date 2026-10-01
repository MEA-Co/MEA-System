import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeLiveResponseRows } from '../app/(private)/dashboard/_views/questions/lib/question-responses.ts';

const answer = (value) => [{ id: 1, answers: { field: value } }];

test('new questions and reordered questions preserve typing that is not saved yet', () => {
  const local = { a: answer('작성 중'), b: answer('두 번째 작성 중') };
  const remote = { b: answer('이전 저장'), added: [], a: answer('이전 저장') };
  assert.deepEqual(mergeLiveResponseRows(local, remote, []), {
    b: local.b,
    added: [],
    a: local.a,
  });
});

test('removed questions leave the save payload; re-adding restores server answers', () => {
  const local = { a: answer('보존할 입력'), b: answer('계속 작성') };
  const removed = mergeLiveResponseRows(local, { b: [] }, []);
  assert.deepEqual(removed, { b: local.b });
  assert.deepEqual(local.a, answer('보존할 입력'));
  assert.deepEqual(
    mergeLiveResponseRows(
      removed,
      { a: answer('저장된 이전 답변'), b: [] },
      [],
    ),
    {
      a: answer('저장된 이전 답변'),
      b: local.b,
    },
  );
});

test('schema change clears only the affected input; intentional empty inputs survive refresh', () => {
  const local = { a: answer('이전 구조 입력'), b: [] };
  assert.deepEqual(
    mergeLiveResponseRows(
      local,
      { a: answer('이전 저장'), b: answer('지운 값') },
      ['a'],
    ),
    {
      a: [],
      b: [],
    },
  );
  assert.deepEqual(local.a, answer('이전 구조 입력'));
});
