import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  questionnaireDetailHref,
  questionnaireListModel as model,
  readQuestionnaireListOptions as options,
} from '../app/(private)/dashboard/_views/questions/lib/questionnaire/list-model.ts';
const rows = (status, count, extra = {}) =>
  Array.from({ length: count }, (_, n) => ({
    id: `${status}-${n}`,
    title: `질문지 ${n}`,
    status,
    updatedAt: new Date(2026, 0, n + 1).toISOString(),
    distributedAt: null,
    isOwner: true,
    ...extra,
  }));
const source = {
  drafts: rows('draft', 5),
  published: rows('published', 4),
  distributed: rows('distributed', 23),
};
const opt = (query = '') => options(new URLSearchParams(query));
test('overview limits 2/2/10 while totals include all matching rows', () => {
  const result = model(source, opt());
  assert.deepEqual(
    result.groups.map((g) => g.items.length),
    [2, 2, 10],
  );
  assert.deepEqual(
    result.groups.map((g) => g.total),
    [5, 4, 23],
  );
  assert.equal(result.total, 32);
  assert.equal(result.groups[0].items[0].id, 'draft-4');
});
test('status lists paginate independently and clamp after deletion', () => {
  assert.equal(
    model(source, opt('qStatus=distributed&qPage=2')).items.length,
    10,
  );
  const last = model(source, opt('qStatus=distributed&qPage=99'));
  assert.equal(last.page, 3);
  assert.equal(last.items.length, 3);
});
test('search and ownership apply before counts and limits', () => {
  const mixed = {
    ...source,
    published: rows('published', 4, { isOwner: false }),
  };
  const result = model(mixed, opt('qSearch=질문지+1&qOwner=mine'));
  assert.deepEqual(
    result.groups.map((g) => g.total),
    [1, 0, 11],
  );
});
test('private drafts and archives stay owner-only; archives excluded from overview', () => {
  const mixed = {
    drafts: rows('draft', 2, { isOwner: false }),
    published: [],
    distributed: [],
    archived: [
      ...rows('published', 2, { archivedAt: '2026-01-01' }),
      ...rows('draft', 2, { archivedAt: '2026-01-01', isOwner: false }),
    ],
  };
  assert.equal(model(mixed, opt()).total, 0);
  assert.equal(model(mixed, opt('qStatus=archived')).total, 2);
});
test('distribution date takes precedence and duplicate IDs occur once', () => {
  const a = rows('distributed', 2);
  a[0].distributedAt = '2027-01-01';
  const result = model(
    { drafts: [], published: [], distributed: [...a, a[0]] },
    opt(),
  );
  assert.equal(result.total, 2);
  assert.equal(result.groups[2].items[0].id, a[0].id);
});
test('invalid query options fall back safely', () => {
  assert.deepEqual(opt('qStatus=invalid&qPage=-3&qOwner=other'), {
    status: 'all',
    query: '',
    owner: 'all',
    page: 1,
  });
  assert.equal(opt('qPage=1.5').page, 1);
});
test('detail links retain filters and clear conflicting routes', () => {
  const p = new URLSearchParams(
    'qStatus=distributed&qPage=2&qSearch=test&qOwner=mine&question=x&response=y&return=dashboard',
  );
  const href = questionnaireDetailHref(p, 'abc', true);
  const result = new URL(href, 'https://local.test').searchParams;
  assert.equal(result.get('qPage'), '2');
  assert.equal(result.get('qSearch'), 'test');
  assert.equal(result.get('qOwner'), 'mine');
  assert.equal(result.get('draft'), 'abc');
  assert.equal(result.get('questionnairePanel'), 'responses');
  assert.equal(result.has('question'), false);
  assert.equal(result.has('response'), false);
  assert.equal(
    new URL(
      questionnaireDetailHref(result, 'abc'),
      'https://local.test',
    ).searchParams.has('questionnairePanel'),
    false,
  );
});

test('questionnaire links preserve draft and filters without drawer presentation', () => {
  const params = new URLSearchParams('qStatus=draft&qSearch=test&qPage=2');
  const href = questionnaireDetailHref(params, 'new');
  const next = new URL(href, 'https://example.test').searchParams;
  assert.equal(next.has('questionnaireEditor'), false);
  assert.equal(next.get('qSearch'), 'test');
  assert.equal(next.get('qPage'), '2');
  const other = new URL(
    questionnaireDetailHref(next, 'other'),
    'https://example.test',
  ).searchParams;
  assert.equal(other.has('questionnaireEditor'), false);
});

 test('administrator can see editable drafts without becoming their owner', () => {
 const shared = { drafts: rows('draft', 1, { isOwner: false, canEditDraft: true }), published: [], distributed: [] };
 assert.equal(model(shared, opt()).total, 1);
 assert.equal(model(shared, opt('qOwner=mine')).total, 0);
 });
