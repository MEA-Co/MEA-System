import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      for (const extension of ['.ts', '.tsx']) {
        if (existsSync(fileURLToPath(url) + extension))
          return { url: url.href + extension, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (/\.tsx?$/.test(url) && !url.includes('/node_modules/'))
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
      };
    return next(url, context);
  },
});
const {
  submittedAnswerText,
  submittedResponseSections,
  submissionFileName,
  exportFileName,
} =
  await import('../app/(private)/dashboard/_views/questions/lib/submitted-response-export.ts');
const { RICH_TEXT_PREFIX } =
  await import('../app/(private)/dashboard/_views/questions/lib/rich-text.ts');
const fields = [
  { id: 'text', label: '경험과 변화', kind: 'text' },
  {
    id: 'choice',
    label: '선택한 활동',
    kind: 'multiple',
    options: [
      { id: 'a', label: '독서' },
      { id: 'b', label: '직접 입력', isOther: true },
    ],
  },
  { id: 'scale', label: '만족도', kind: 'scale', scaleMax: 5 },
];
const rich =
  RICH_TEXT_PREFIX +
  JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '한글 강조 표시와 여러 줄 응답을 확인합니다.',
            marks: [{ type: 'highlight' }],
          },
        ],
      },
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '첫 번째 계획과 실천 경험' }],
              },
            ],
          },
        ],
      },
    ],
  });
const submission = {
  id: 'sample',
  title: '진로 탐색 질문지',
  respondentName: '가상 응답자',
  submittedAt: '2026-10-13T01:20:00Z',
  sections: [
    {
      id: 's',
      title: '경험 돌아보기',
      questions: [{ id: 'p', sourceQuestionId: 'q' }],
    },
  ],
  questions: [
    {
      questionId: 'q',
      definition: {
        id: 'q',
        title: '나의 변화',
        prompt: '시기별 경험과 배운 점을 알려 주세요.',
        fields,
        answer_layout: 'flow',
        row_mode: 'repeatable',
        max_rows: 2,
        row_labels: ['처음', '현재'],
      },
      activeRowIds: [1, 3, 2],
      rows: [
        {
          id: 1,
          flowIndex: 1,
          answers: {
            text: rich,
            choice: JSON.stringify([
              'a',
              { id: 'b', text: '과학 탐구', entryId: 'one' },
              { id: 'b', text: '토론', entryId: 'two' },
            ]),
            scale: '4',
          },
        },
        {
          id: 3,
          flowAfter: 1,
          label: '방학 중',
          answers: { text: '중간 시기에 새롭게 도전했습니다.' },
        },
        {
          id: 2,
          flowIndex: 2,
          answers: {
            text: Array.from(
              { length: 65 },
              (_, index) =>
                `${index + 1}. 긴 답변도 잘리지 않고 다음 페이지에 이어져야 합니다. 경험을 돌아보며 다음 목표를 세웠습니다.`,
            ).join('\n'),
          },
        },
        { id: 4, answers: { text: 'INACTIVE_SECRET' } },
      ],
    },
  ],
};
test('active rows only, flow insertion order and saved period names', () => {
  const rows = submittedResponseSections(submission)[0].questions[0].rows;
  assert.deepEqual(
    rows.map((row) => row.label),
    ['처음', '방학 중', '현재'],
  );
  assert.ok(!JSON.stringify(rows).includes('INACTIVE_SECRET'));
});
test('choices preserve duplicate direct entries, scale comments and rich text', () => {
  assert.equal(
    submittedAnswerText(
      fields[1],
      submission.questions[0].rows[0].answers.choice,
    ),
    '독서\n직접 입력: 과학 탐구\n직접 입력: 토론',
  );
  assert.equal(
    submittedAnswerText(fields[2], '{"score":3,"text":"보충 설명"}'),
    '3점 / 5점 만점\n보충 설명',
  );
  assert.equal(submittedAnswerText(fields[0], rich), rich);
  assert.equal(submittedAnswerText(fields[0], ''), '미응답');
});
test('section placement order and registration cards', () => {
  const copy = structuredClone(submission);
  copy.questions.push({
    ...copy.questions[0],
    questionId: 'notice',
    definition: {
      ...copy.questions[0].definition,
      purpose: 'study_registration',
    },
  });
  copy.sections[0].questions.unshift({
    id: 'notice',
    sourceQuestionId: 'notice',
  });
  assert.equal(submittedResponseSections(copy)[0].questions.length, 1);
});
test('archive file names remain distinct for same names and remove path separators', () => {
  assert.notEqual(
    submissionFileName(submission, 0),
    submissionFileName(submission, 1),
  );
  assert.ok(!exportFileName('../한글/\\파일:*?').match(/[\\/:*?]/));
});
if (process.env.SUBMISSION_PDF_SAMPLE) {
  const React = await import('react');
  const { renderToFile } = await import('@react-pdf/renderer');
  const { SubmittedResponseDocument } =
    await import('../app/(private)/dashboard/_views/questions/components/questionnaire/export/SubmittedResponseDocument.tsx');
  await renderToFile(
    React.createElement(SubmittedResponseDocument, { submission }),
    process.env.SUBMISSION_PDF_SAMPLE,
  );
}

test('PDF named non-flow rows use submitted names after an empty row is omitted', () => {
  const copy = structuredClone(submission);
  const question = copy.questions[0];
  question.definition.answer_layout = 'table';
  question.definition.row_labels = ['첫 항목', '둘째 항목', '셋째 항목'];
  question.rows = [
    { id: 500, label: '첫 항목', answers: { text: '첫째 답변' } },
    { id: -17, label: '셋째 항목', answers: { text: '셋째 답변' } },
  ];
  question.activeRowIds = [500, -17];
  assert.deepEqual(
    submittedResponseSections(copy)[0].questions[0].rows.map(
      (row) => row.label,
    ),
    ['첫 항목', '셋째 항목'],
  );
  question.rows.forEach((row) => delete row.label);
  assert.deepEqual(
    submittedResponseSections(copy)[0].questions[0].rows.map(
      (row) => row.label,
    ),
    ['항목 1 · 원래 이름 미확인', '항목 2 · 원래 이름 미확인'],
  );
});
