import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { z } from 'zod';

import { loadQuestionModule } from './helpers/load-question-module.mjs';
const root = 'app/(private)/dashboard/_views/questions/lib/';
const load = (name) =>
  loadQuestionModule(root + name + '.ts', { TextEncoder }, (name) =>
    name === 'zod' ? { z } : undefined,
  );
const { questionDetailSchema, hasQuestionDetailContent } =
  load('question-details');
const { serializeRichText } = load('rich-text');
const { questionnaireDocumentSchema, savedDraftSchema } = load(
  'questionnaire/schema',
);
const detail = (patch = {}) => ({
  id: randomUUID(),
  title: '',
  text: '',
  visibleToConsultants: false,
  ...patch,
});
test('empty plain and rich explanations are hidden without mutating drafts', () => {
  for (const text of [
    '',
    '  \n',
    serializeRichText({ type: 'doc', content: [{ type: 'paragraph' }] }),
  ]) {
    const value = detail({ text });
    const original = JSON.stringify(value);
    assert.equal(hasQuestionDetailContent(value), false);
    assert.equal(JSON.stringify(value), original);
    assert.equal(questionDetailSchema.safeParse(value).success, true);
  }
});
test('title-only, body-only and formatted explanations remain visible', () => {
  for (const value of [
    detail({ title: '제목' }),
    detail({ text: '내용' }),
    detail({
      text: serializeRichText({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '안내', marks: [{ type: 'highlight' }] },
            ],
          },
        ],
      }),
    }),
  ])
    assert.equal(hasQuestionDetailContent(value), true);
});
test('canonical limits reject oversized details while legacy draft reads remain compatible', () => {
  assert.equal(
    questionDetailSchema.safeParse(
      detail({ title: 'x'.repeat(200), text: 'x'.repeat(10000) }),
    ).success,
    true,
  );
  for (const value of [
    detail({ title: 'x'.repeat(201) }),
    detail({ text: 'x'.repeat(10001) }),
  ]) {
    assert.equal(questionDetailSchema.safeParse(value).success, false);
    const doc = {
      questionnaireId: randomUUID(),
      title: '',
      sections: [
        {
          id: randomUUID(),
          title: '',
          questions: [
            {
              id: randomUUID(),
              logicalKey: randomUUID(),
              text: '',
              details: [value],
            },
          ],
        },
      ],
    };
    assert.equal(questionnaireDocumentSchema.safeParse(doc).success, false);
    assert.equal(
      savedDraftSchema.safeParse({ ...doc, revision: 1, savedAt: '2026-10-15' })
        .success,
      true,
    );
  }
});
