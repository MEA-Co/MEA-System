import assert from 'node:assert/strict';
import test from 'node:test';

import { loadQuestionModule } from './helpers/load-question-module.mjs';
const root = 'app/(private)/dashboard/_views/questions/lib/responses/';
const mock = (name) =>
  name.endsWith('rich-text')
    ? { richTextPlainText: (s) => s.replace(/<[^>]*>/g, '') }
    : undefined;
const {
  validateQuestionSubmission: validate,
  validateResponseSubmission: all,
} = loadQuestionModule(root + 'submission-validation.ts', {}, mock);
const field = (id, extra = {}) => ({ id, label: id, kind: 'text', ...extra });
const question = (extra = {}) => ({
  id: 'q',
  fields: [field('a'), field('b', { required: false })],
  row_mode: 'repeatable',
  min_rows: 1,
  max_rows: 5,
  ...extra,
});
const row = (answers, id = 1, extra = {}) => ({ id, answers, ...extra });
test('required card fields identify exact row and column; optional blanks remain valid', () => {
  const issues = validate(question(), [row({ a: '<p> </p>' }, 9)]).issues;
  assert.equal(issues.length, 1);
  assert.equal(issues[0].rowId, 9);
  assert.equal(issues[0].fieldId, 'a');
  assert.match(issues[0].message, /항목 1.*a/);
  assert.equal(validate(question(), [row({ a: '답변' })]).issues.length, 0);
});
test('spare table rows are skipped but partial rows require mandatory columns', () => {
  const q = question({ answer_layout: 'table' });
  assert.equal(validate(q, [row({ a: '답변' }), row({}, 2)]).issues.length, 0);
  const partial = validate(q, [row({ b: 'optional only' })]).issues;
  assert.equal(partial[0].fieldId, 'a');
  const blank = validate(q, [row({})]).issues;
  assert.equal(blank.length, 1);
  assert.match(blank[0].message, /1개 이상/);
});
test('nonempty incomplete choice/scale values are rejected even in optional columns', () => {
  const q = question({
    fields: [
      field('a', {
        kind: 'single',
        required: false,
        options: [{ id: 'custom', label: '직접', isOther: true }],
      }),
    ],
  });
  const value = JSON.stringify({ id: 'custom', text: '', entryId: 'entry' });
  assert.ok(validate(q, [row({ a: value })]).issues.length);
  const scale = question({
    fields: [field('a', { kind: 'scale', scaleMax: 5 })],
  });
  assert.ok(validate(scale, [row({ a: '7' })]).issues.length);
  assert.equal(validate(scale, [row({ a: '5' })]).issues.length, 0);
});
test('flow requires answered periods rather than every field and names only answered additions', () => {
  const q = question({
    answer_layout: 'flow',
    min_rows: 2,
    row_labels: ['1학년', '2학년'],
  });
  assert.equal(
    validate(q, [
      row({ a: '첫째' }, 1, { flowIndex: 1 }),
      row({ b: '둘째' }, 2, { flowIndex: 2 }),
      row({}, 3, { flowAfter: 1 }),
    ]).issues.length,
    0,
  );
  assert.match(
    validate(q, [row({ a: '첫째' }, 1, { flowIndex: 1 })]).issues[0].message,
    /시기를 2개/,
  );
  assert.ok(
    validate(q, [row({ a: '추가' }, 3, { flowAfter: 1 })]).issues.some((i) =>
      /이름/.test(i.message),
    ),
  );
});
test('career groups produce individual period messages and allow partial optional fields', () => {
  const q = question({
    fields: [field('start'), field('pre'), field('end'), field('optional')],
    response_requirements: {
      kind: 'career_flow',
      startFieldIds: ['start', 'pre'],
      admissionFieldId: 'end',
    },
  });
  assert.equal(validate(q, [row({ optional: '입력' })]).issues.length, 2);
  assert.equal(
    validate(q, [row({ pre: '입력', end: '입력' })]).issues.length,
    0,
  );
});
test('hidden retained answers never activate downstream conditions', () => {
  const a = question({ id: 'a', fields: [field('text')] });
  const b = question({ id: 'b', after_block_id: 'a' });
  const c = question({ id: 'c', after_block_id: 'b' });
  const issues = all(
    { questions: [a, b, c].map((definition) => ({ definition })) },
    { a: [], b: [row({ a: 'retained' })], c: [] },
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].questionId, 'a');
});
test('reference answers follow matched stable source IDs and report missing matches', () => {
  const q = question({ row_mode: 'reference' });
  const source = [row({}, 7), row({}, 9)];
  const issues = validate(
    q,
    [row({ a: 'kept' }, 7), row({ a: 'inactive' }, 8)],
    source,
  ).issues;
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /2개 이상.*1개/);
});
test('old supplementary scale text remains valid', () => {
  const q = question({
    fields: [
      field('a', { kind: 'scale', scaleConfig: { max: 7, allowText: true } }),
    ],
  });
  assert.equal(
    validate(q, [row({ a: JSON.stringify({ score: 5, text: '이유' }) })]).issues
      .length,
    0,
  );
});
test('navigation focuses and scrolls only the matching question in this editor, respecting reduced motion', () => {
  const { focusResponseQuestion } = loadQuestionModule(
    root + 'submission-navigation.ts',
    {},
    () => undefined,
  );
  const calls = [];
  const target = {
    dataset: { responseQuestion: 'q' },
    focus: (opts) => calls.push(['focus', opts.preventScroll]),
    scrollIntoView: (opts) => calls.push(['scroll', opts.behavior, opts.block]),
  };
  focusResponseQuestion({ querySelectorAll: () => [target] }, 'q', true);
  assert.deepEqual(calls, [
    ['focus', true],
    ['scroll', 'instant', 'start'],
  ]);
  focusResponseQuestion(null, 'q', false);
  focusResponseQuestion({ querySelectorAll: () => [target] }, 'other', false);
  assert.equal(calls.length, 2);
});

test('preview row reporting and submission agree for legacy supplementary text, including downstream conditions', () => {
  const { answeredResponseRows } = loadQuestionModule(
    root + 'field-validation.ts',
    {},
    mock,
  );
  const { placementPreviewState } = loadQuestionModule(
    root + '../questionnaire/placement-preview.ts',
    {},
    mock,
  );
  for (const kind of ['scale', 'single', 'multiple']) {
    const q = question({
      id: 'source',
      fields: [
        field('a', {
          kind,
          choiceAllowText: true,
          options: [{ id: 'yes', label: '선택' }],
          scaleConfig: { max: 7, allowText: true },
        }),
      ],
    });
    const value = JSON.stringify(
      kind === 'scale'
        ? { score: 5, text: '기존 설명' }
        : { choices: ['yes'], text: '기존 설명' },
    );
    const rows = [row({ a: value }, 8)];
    const reported = answeredResponseRows(q.fields, rows);
    assert.equal(reported.length, 1);
    assert.equal(reported[0].id, 8);
    const follow = question({
      id: 'follow',
      after_block_id: q.id,
      condition: {
        mode: 'all',
        clauses: [{ blockId: q.id, fieldId: 'a', op: 'answered' }],
      },
    });
    assert.equal(
      placementPreviewState(follow, [q, follow], { [q.id]: reported }).waiting,
      false,
    );
    assert.equal(validate(q, rows).issues.length, 0);
    const issues = all(
      { questions: [q, follow].map((definition) => ({ definition })) },
      { source: rows, follow: [row({})] },
    );
    assert.equal(issues[0].questionId, 'follow');
    assert.equal(answeredResponseRows(q.fields, [row({})]).length, 0);
    const invalid =
      kind === 'scale'
        ? JSON.stringify({ score: 9, text: '이유' })
        : JSON.stringify({ choices: ['missing'], text: '이유' });
    assert.equal(
      answeredResponseRows(q.fields, [row({ a: invalid })]).length,
      0,
    );
    assert.ok(validate(q, [row({ a: invalid })]).issues.length);
  }
});
