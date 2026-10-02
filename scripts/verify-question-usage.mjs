import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      'app/(private)/dashboard/_views/questions/lib/question-usage.ts',
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports },
);
const { withQuestionnaireUsage } = exports;
const row = (
  id,
  status = 'draft',
  owner = 'me',
  archived = null,
  updated = '2026-09-28',
) => ({
  source_question_id: 'q',
  questionnaire: {
    id,

    title: id,
    status,
    updated_at: updated,
    created_by: owner,
    archived_at: archived,
  },
});
function client(rows, fail = false, references = []) {
  const query = {
    is() {
      return this;
    },
    select() {
      return this;
    },
    in(column, ids) {
      assert.equal(column, 'source_question_id');
      assert.deepEqual(Array.from(ids), ['q']);
      return this;
    },
    order() {
      return this;
    },
    range(start, end) {
      this.start = start;
      this.end = end;
      return this;
    },
    async overrideTypes() {
      return {
        data: (this.table === 'questions' ? references : rows).slice(
          this.start,
          this.end + 1,
        ),
        error: fail ? new Error('offline') : null,
      };
    },
  };
  return {
    from(table) {
      assert.ok(['questions', 'questionnaire_questions'].includes(table));
      query.table = table;
      return query;
    },
  };
}
test('deduplicates repeated placements of one questionnaire and includes archived state', async () => {
  const result = await withQuestionnaireUsage(
    client([
      row('new', 'draft', 'me', 'archived'),
      row('new', 'draft', 'me', 'archived'),
    ]),
    [{ id: 'q' }],
    'me',
    false,
  );
  assert.equal(result[0].questionnaire_usage.length, 1);
  assert.equal(result[0].questionnaire_usage[0].title, 'new');
  assert.equal(result[0].questionnaire_usage[0].status, 'archived');
});
test('lead preview excludes another author draft but retains visible published questionnaire', async () => {
  const result = await withQuestionnaireUsage(
    client([
      row('private', 'draft', 'other'),
      row('public', 'published', 'other'),
    ]),
    [{ id: 'q' }],
    'me',
    true,
  );
  assert.equal(result[0].questionnaire_usage.length, 1);
  assert.equal(result[0].questionnaire_usage[0].title, 'public');
});
test('distinguishes no usage from failed lookup', async () => {
  assert.equal(
    (await withQuestionnaireUsage(client([]), [{ id: 'q' }], 'me', true))[0]
      .questionnaire_usage.length,
    0,
  );
  assert.equal(
    (
      await withQuestionnaireUsage(client([], true), [{ id: 'q' }], 'me', true)
    )[0].questionnaire_usage,
    null,
  );
});
test('reads past per-response limits', async () => {
  const rows = Array.from({ length: 501 }, (_, i) => {
    const r = row(String(i));
    r.questionnaire.id = String(i);
    return r;
  });
  assert.equal(
    (await withQuestionnaireUsage(client(rows), [{ id: 'q' }], 'me', false))[0]
      .questionnaire_usage.length,
    501,
  );
});

test('detects source, ordering and condition references outside the current page', async () => {
  for (const reference of [
    { id: 'other', source_block_id: 'q' },
    { id: 'other', after_block_id: 'q' },
    { id: 'other', condition: { clauses: [{ blockId: 'q' }] } },
  ]) {
    const result = await withQuestionnaireUsage(
      client([], false, [reference]),
      [{ id: 'q' }],
      'me',
      true,
    );
    assert.equal(result[0].referenced_by_question, true);
  }
  const result = await withQuestionnaireUsage(
    client([]),
    [{ id: 'q' }],
    'me',
    true,
  );
  assert.equal(result[0].referenced_by_question, false);
});

test('reference list counts each visible question once across multiple dependency types', async () => {
  const references = [
    {
      id: 'other',
      title: '후속 질문',
      created_by: 'me',
      source_block_id: 'q',
      after_block_id: 'q',
      condition: { clauses: [{ blockId: 'q' }, { blockId: 'q' }] },
    },
    {
      id: 'private',
      title: '비공개 질문',
      created_by: 'someone',
      source_block_id: 'q',
    },
  ];
  const lead = (
    await withQuestionnaireUsage(
      client([], false, references),
      [{ id: 'q' }],
      'me',
      true,
    )
  )[0];
  assert.equal(lead.referencing_questions.length, 1);
  assert.equal(lead.referencing_questions[0].title, '후속 질문');
  const admin = (
    await withQuestionnaireUsage(
      client([], false, references),
      [{ id: 'q' }],
      'me',
      false,
    )
  )[0];
  assert.equal(admin.referencing_questions.length, 2);
});
