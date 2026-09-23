import { z } from 'zod';

import { normalizeRichTextValue } from './rich-text';

const detailSchema = z.object({
  id: z.uuid(),
  title: z.string().max(500),
  text: z.string().max(20000).transform(normalizeRichTextValue),
  visibleToConsultants: z.boolean(),
});
const questionSchema = z.object({
  kind: z.enum(['text', 'scale', 'single', 'multiple']).optional(),
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
      (options) => options.filter((o) => o.isOther).length <= 1,
      'Only one other option is allowed',
    )
    .refine(
      (options) => new Set(options.map((o) => o.id)).size === options.length,
      'Duplicate option IDs',
    )
    .optional(),
  id: z.uuid(),
  logicalKey: z.uuid(),
  text: z.string().max(20000).transform(normalizeRichTextValue),
  details: z.array(detailSchema).max(30),
});
const sectionSchema = z.object({
  id: z.uuid(),
  title: z.string().max(500),
  questions: z.array(questionSchema).max(100),
});
export const questionnaireDocumentSchema = z
  .object({
    questionnaireId: z.uuid(),
    versionId: z.uuid(),
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
  document: questionnaireDocumentSchema,
  expectedRevision: z.number().int().nonnegative().max(2147483646),
  saveId: z.uuid(),
});
export const savedDraftSchema = questionnaireDocumentSchema.and(
  z.object({
    revision: z.number().int().nonnegative(),
    savedAt: z.string(),
  }),
);
