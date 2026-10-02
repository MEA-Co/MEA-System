import { z } from 'zod';

import { normalizeRichTextValue } from './rich-text';

const detailSchema = z.object({
  id: z.uuid(),
  title: z.string().max(500),
  text: z.string().max(20000).transform(normalizeRichTextValue),
  visibleToConsultants: z.boolean(),
});
const questionSchema = z
  .object({
    sourceQuestionId: z
      .uuid()
      .nullish()
      .transform((id) => id ?? undefined),
    kind: z.enum(['text', 'scale', 'single', 'multiple']).optional(),
    choiceStyle: z.enum(['list', 'chip']).optional(),
    choiceAllowText: z.boolean().optional(),
    scaleConfig: z
      .object({
        max: z.number().int().min(2).max(9),
        low: z.string().max(500),
        middle: z.string().max(500),
        high: z.string().max(500),
        allowText: z.boolean(),
      })
      .optional(),
    options: z
      .array(
        z.object({
          id: z.uuid(),
          label: z.string().max(500),
          isOther: z.boolean().optional(),
        }),
      )
      .max(20)
      .refine(
        (options) => new Set(options.map((o) => o.id)).size === options.length,
        'Duplicate option IDs',
      )
      .optional(),
    id: z.uuid(),
    logicalKey: z.uuid(),
    text: z.string().max(20000).transform(normalizeRichTextValue),
    details: z.array(detailSchema).max(30),
  })
  .refine(
    (question) =>
      question.kind === 'multiple' ||
      (question.options ?? []).filter((option) => option.isOther).length <= 1,
    {
      path: ['options'],
      message: 'Only one direct-input option is allowed for single choice',
    },
  );
const sectionSchema = z.object({
  id: z.uuid(),
  title: z.string().max(500),
  questions: z.array(questionSchema).max(100),
});
export const questionnaireDocumentSchema = z
  .object({
    questionnaireId: z.uuid(),
    title: z.string().max(500),
    sections: z.array(sectionSchema).max(50),
  })
  .superRefine((document, context) => {
    const ids = document.sections.flatMap((section) => [
      section.id,
      ...section.questions.flatMap((question) => [
        question.id,
        ...question.details.map((detail) => detail.id),
      ]),
    ]);
    const keys = document.sections.flatMap((section) =>
      section.questions.map((question) => question.logicalKey),
    );
    if (
      new Set(ids).size !== ids.length ||
      new Set(keys).size !== keys.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate questionnaire item IDs',
      });
    }
    if (new TextEncoder().encode(JSON.stringify(document)).length > 600000) {
      context.addIssue({
        code: 'custom',
        message: 'Questionnaire is too large',
      });
    }
  });

export const saveQuestionnaireSchema = z.object({
  confirmedRemovedGuideQuestions: z.array(z.uuid()).max(5000).optional(),
  document: questionnaireDocumentSchema.superRefine((document, context) => {
    document.sections.forEach((section, si) =>
      section.questions.forEach((question, qi) => {
        if (question.details.length)
          context.addIssue({
            code: 'custom',
            path: ['sections', si, 'questions', qi, 'details'],
            message: '설명은 원본 질문에서 수정해 주세요.',
          });
        if (!question.sourceQuestionId)
          context.addIssue({
            code: 'custom',
            path: ['sections', si, 'questions', qi, 'sourceQuestionId'],
            message: '원본 질문을 먼저 저장한 뒤 배치해 주세요.',
          });
      }),
    );
  }),
  expectedRevision: z.number().int().nonnegative().max(2147483646),
  saveId: z.uuid(),
});
export const savedDraftSchema = questionnaireDocumentSchema.and(
  z.object({
    revision: z.number().int().nonnegative(),
    savedAt: z.string(),
  }),
);
