import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeGuideResponseRows } from '../app/(private)/dashboard/_views/questions/lib/question-responses.ts';

const answer = (value) => [{ id: 1, answers: { field: value } }];
const snapshot = (rows, kind = 'text') => ({
  questions: Object.entries(rows).map(([id, value]) => ({
    definition: { id, row_mode: 'single', fields: [{ id: 'field', kind }] },
    rows: value,
  })),
});

test('new questions and reordered questions preserve compatible unsaved typing', () => {
  const local = { a: answer('작성 중'), b: answer('두 번째 작성 중') };
  const next = { b: answer('이전 저장'), added: [], a: answer('이전 저장') };
  assert.deepEqual(
    mergeGuideResponseRows(local, snapshot(local), snapshot(next)),
    { b: local.b, added: [], a: local.a },
  );
});
test('removed questions leave the save payload and re-added questions start with empty server rows', () => {
  const local = { a: answer('제거할 입력'), b: answer('계속 작성') };
  const removed = mergeGuideResponseRows(
    local,
    snapshot(local),
    snapshot({ b: [] }),
  );
  assert.deepEqual(removed, { b: local.b });
  assert.deepEqual(
    mergeGuideResponseRows(
      removed,
      snapshot({ b: [] }),
      snapshot({ a: [], b: [] }),
    ),
    { a: [], b: local.b },
  );
});
test('type changes remove the affected field and deliberate empty rows stay empty', () => {
  const local = { a: answer('이전 유형 입력'), b: [] };
  assert.deepEqual(
    mergeGuideResponseRows(
      local,
      snapshot(local),
      snapshot({ a: [], b: answer('지운 값') }, 'scale'),
    ),
    { a: [{ id: 1, answers: {} }], b: [] },
  );
});
