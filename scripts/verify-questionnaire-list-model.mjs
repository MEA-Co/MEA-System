import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  questionnaireDetailHref,
  questionnaireListPath,
  readQuestionnaireListOptions as options,
} from '../app/(private)/dashboard/_views/questions/lib/questionnaire/list-model.ts';
const opt = (query = '') => options(new URLSearchParams(query));
test('invalid query options fall back safely', () => {
  assert.deepEqual(opt('qStage=invalid&qPage=-3&qOwner=other'), {
    status: 'all',
    query: '',
    response: 'pending',
    owner: 'all',
    page: 1,
  });
  assert.equal(opt('qPage=1.5').page, 1);
});
test('detail links retain filters and clear conflicting routes', () => {
  const p = new URLSearchParams(
    'qStage=published&qPage=2&qSearch=test&qOwner=mine&question=x&response=y&return=dashboard',
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
  const params = new URLSearchParams('qStage=draft&qSearch=test&qPage=2');
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

test('old status bookmarks retain meaning while v2 links use qStage', () => {
  assert.equal(opt('qStatus=published').status, 'in_review');
  assert.equal(opt('qStatus=distributed').status, 'published');
  assert.equal(opt('qStatus=published&qStage=published').status, 'published');
  assert.equal(opt('qStage=in_review').status, 'in_review');
});

test('list cache key includes filters but ignores editor route and overview page', () => {
  const params = new URLSearchParams(
    'draft=anything&qStage=published&qPage=2&qSearch=test&qOwner=mine',
  );
  assert.equal(
    questionnaireListPath(params),
    '?qStage=published&qSearch=test&qOwner=mine&qPage=2',
  );
  params.delete('qStage');
  assert.equal(questionnaireListPath(params), '?qSearch=test&qOwner=mine');
  assert.equal(
    questionnaireListPath(new URLSearchParams('draft=new&qPage=9')),
    '',
  );
  assert.equal(
    questionnaireListPath(
      new URLSearchParams('qResponse=complete&qPage=2'),
      false,
    ),
    '?qResponse=complete&qPage=2',
  );
  assert.equal(opt('qPage=100001').page, 1);
});
