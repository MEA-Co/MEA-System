import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { z } from 'zod';

import { loadQuestionModule } from './helpers/load-question-module.mjs';
const root = 'app/(private)/dashboard/_views/questions/lib/';
const copy = loadQuestionModule(
  root + 'question-copy.ts',
  { crypto: { randomUUID }, structuredClone },
  (name) =>
    name === 'zod'
      ? { z }
      : name.endsWith('rich-text')
        ? { richTextPlainText: (s) => s }
        : undefined,
).copyQuestionContent;
function source() {
  return {
    id: randomUUID(),
    title: '원본',
    prompt: '질문 본문',
    purpose: 'response',
    fields: [
      {
        id: randomUUID(),
        label: '선택',
        kind: 'single',
        required: true,
        options: [
          { id: randomUUID(), label: 'A' },
          { id: randomUUID(), label: 'B', isOther: true },
        ],
      },
      {
        id: randomUUID(),
        label: '척도',
        kind: 'scale',
        scaleMax: 7,
        scaleConfig: {
          max: 7,
          allowText: true,
          low: '낮음',
          middle: '',
          high: '높음',
        },
      },
    ],
    details: [
      {
        id: randomUUID(),
        title: '설명',
        text: '내용',
        visibleToConsultants: false,
        position: 1,
      },
    ],
    answer_layout: 'flow',
    flow_insert_after: [1],
    row_mode: 'repeatable',
    max_rows: 3,
    min_rows: 2,
    initial_rows: 3,
    row_labels: ['1학년', '2학년', '3학년'],
    source_block_id: null,
    source_field_id: null,
    after_block_id: randomUUID(),
    condition: { mode: 'all', clauses: [] },
    revision: 10,
    created_by: randomUUID(),
    publication_locked_at: '2026-01-01',
    answers: ['개인 답변'],
    reviews: ['검토'],
  };
}
test('content import creates independent identities and preserves configuration without answers or history', () => {
  const original = source();
  const before = structuredClone(original);
  const id = randomUUID();
  const doc = copy(original, id);
  assert.equal(doc.id, id);
  assert.equal(doc.prompt, original.prompt);
  assert.equal(doc.title, original.title);
  assert.notEqual(doc.fields[0].id, original.fields[0].id);
  assert.notEqual(
    doc.fields[0].options[0].id,
    original.fields[0].options[0].id,
  );
  assert.notEqual(doc.details[0].id, original.details[0].id);
  assert.equal(doc.details[0].visibleToConsultants, false);
  assert.equal(doc.fields[1].scaleMax, 7);
  assert.equal(doc.rowMode, 'repeatable');
  assert.equal(doc.answerLayout, 'flow');
  assert.equal(doc.maxRows, 3);
  assert.equal(doc.minRows, 2);
  assert.deepEqual(Array.from(doc.rowLabels), original.row_labels);
  assert.deepEqual(Array.from(doc.flowInsertAfter), [1]);
  for (const key of [
    'answers',
    'reviews',
    'revision',
    'created_by',
    'publication_locked_at',
  ])
    assert.equal(key in doc, false);
  assert.equal(doc.condition, null);
  assert.equal(doc.afterBlockId, null);
  doc.fields[0].options[0].label = '수정';
  doc.rowLabels[0] = '바뀜';
  assert.deepEqual(original, before);
});
test('reference rows become independent single rows and external relationships are cleared', () => {
  const original = {
    ...source(),
    answer_layout: 'table',
    row_mode: 'reference',
    source_block_id: randomUUID(),
    source_field_id: randomUUID(),
  };
  const doc = copy(original, randomUUID());
  assert.equal(doc.rowMode, 'single');
  assert.equal(doc.maxRows, null);
  assert.equal(doc.minRows, 1);
  assert.equal(doc.initialRows, 1);
  assert.equal(doc.sourceBlockId, null);
  assert.equal(doc.sourceFieldId, null);
  assert.equal(doc.rowLabels.length, 0);
  assert.equal(doc.flowInsertAfter.length, 0);
  assert.equal(doc.answerLayout, 'table');
});
test('retired registration notice is not imported as a question', () => {
  assert.throws(() =>
    copy({ ...source(), purpose: 'study_registration' }, randomUUID()),
  );
});

test('career flow required groups follow the copied field IDs, not the original question', () => {
  const original = source();
  original.fields = [0, 1, 2].map((i) => ({
    id: randomUUID(),
    kind: 'text',
    label: `시기 ${i}`,
  }));
  original.response_requirements = {
    kind: 'career_flow',
    startFieldIds: original.fields.slice(0, 2).map((f) => f.id),
    admissionFieldId: original.fields[2].id,
  };
  const imported = copy(original, randomUUID());
  assert.equal(
    JSON.stringify(imported.responseRequirements.startFieldIds),
    JSON.stringify(imported.fields.slice(0, 2).map((f) => f.id)),
  );
  assert.equal(
    imported.responseRequirements.admissionFieldId,
    imported.fields[2].id,
  );
  assert.notEqual(imported.fields[0].id, original.fields[0].id);
});
