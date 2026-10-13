import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  flowRowLabel,
  insertFlowRow,
  isCustomFlowRow,
  materializeFlowRows,
  MAX_FLOW_ROWS,
} from '../app/(private)/dashboard/_views/questions/lib/flow-rows.ts';

test('legacy fixed periods gain stable indices without moving sparse answers', () => {
  const saved = [
    { id: 41, answers: {} },
    { id: -1, answers: { score: '2등급' } },
    { id: -2, answers: {} },
  ];
  const before = structuredClone(saved);
  const shown = materializeFlowRows(saved, 5);
  assert.deepEqual(
    shown.slice(0, 3).map((row) => row.id),
    [41, -1, -2],
  );
  assert.deepEqual(
    shown.map((row) => row.flowIndex),
    [1, 2, 3, 4, 5],
  );
  assert.equal(shown[1].answers.score, '2등급');
  assert.equal(new Set(shown.map((row) => row.id)).size, 5);
  assert.deepEqual(saved, before);
  assert.deepEqual(materializeFlowRows(saved, 5), shown);
});

test('new periods follow the last inserted period before the next fixed period', () => {
  let rows = materializeFlowRows(
    [{ id: 8, answers: { score: '기존 답변' } }],
    3,
  );
  const baseIds = rows.map((row) => row.id);
  rows = insertFlowRow(rows, 3, 1, 100);
  rows = rows.map((row) =>
    row.id === 100
      ? { ...row, label: '중간고사 직후', answers: { score: '2등급' } }
      : row,
  );
  rows = insertFlowRow(rows, 3, 1, 101);
  rows = insertFlowRow(rows, 3, 2, 102);
  rows = insertFlowRow(rows, 3, 3, 103);
  assert.deepEqual(
    rows.map((row) => row.id),
    [baseIds[0], 100, 101, baseIds[1], 102, baseIds[2], 103],
  );
  assert.equal(rows[1].label, '중간고사 직후');
  assert.equal(rows[1].answers.score, '2등급');
  assert.deepEqual(
    rows.filter((row) => !isCustomFlowRow(row)).map((row) => row.id),
    baseIds,
  );
  assert.equal(rows.at(-1).flowAfter, 3);
  assert.equal(rows.at(-1).label, '');
});

test('reopening keeps custom labels and fixed labels use their indices after insertions', () => {
  const labels = ['고1 1학기', '고1 2학기', '고2 1학기'];
  let rows = insertFlowRow([], 3, 1, 110);
  rows = rows.map((row) =>
    row.id === 110
      ? { ...row, label: '방학 시작', answers: { note: '대응 시작' } }
      : row,
  );
  const reopened = materializeFlowRows(JSON.parse(JSON.stringify(rows)), 3);
  assert.deepEqual(reopened, rows);
  assert.deepEqual(
    reopened.map((row) => flowRowLabel(row, labels)),
    ['고1 1학기', '방학 시작', '고1 2학기', '고2 1학기'],
  );
  assert.equal(reopened[2].flowIndex, 2);
  assert.equal(reopened[1].answers.note, '대응 시작');
});

test('slot permissions do not discard existing custom periods and deleting one preserves the other rows', () => {
  let rows = insertFlowRow([], 3, 2, 120);
  rows = rows.map((row) =>
    row.id === 120 ? { ...row, label: '여름 방학' } : row,
  );
  const shownWithSlotDisabled = materializeFlowRows(rows, 3);
  assert.deepEqual(shownWithSlotDisabled, rows);
  const next = materializeFlowRows(
    rows.filter((row) => row.id !== 120),
    3,
  );
  assert.deepEqual(
    next,
    rows.filter((row) => row.id !== 120),
  );
  assert.equal(next.length, 3);
});

test('total rows stop at twenty while preserving existing data and rejecting invalid insertion anchors or IDs', () => {
  let rows = materializeFlowRows([], 3);
  for (let index = 0; index < MAX_FLOW_ROWS - 3; index++)
    rows = insertFlowRow(rows, 3, 1, 200 + index);
  assert.equal(rows.length, 20);
  assert.deepEqual(insertFlowRow(rows, 3, 2, 300), rows);
  const small = materializeFlowRows([], 3);
  assert.deepEqual(insertFlowRow(small, 3, 0, 400), small);
  assert.deepEqual(insertFlowRow(small, 3, 4, 400), small);
  assert.deepEqual(insertFlowRow(small, 3, 1, small[0].id), small);
});

test('padding avoids IDs already used by custom periods and keeps all legacy out-of-range data visible', () => {
  const saved = [
    { id: -1, flowAfter: 1, label: '추가', answers: { note: '보존' } },
    {
      id: -2,
      flowAfter: 8,
      label: '구형 추가',
      answers: { note: '범위 밖 보존' },
    },
    { id: 10, flowIndex: 7, answers: { note: '구형 기본 보존' } },
  ];
  const shown = materializeFlowRows(saved, 2);
  assert.equal(new Set(shown.map((row) => row.id)).size, shown.length);
  for (const row of saved)
    assert.deepEqual(
      shown.find((item) => item.id === row.id),
      row,
    );
  assert.equal(shown[0].flowIndex, 1);
  assert.equal(shown[2].flowIndex, 2);
});
