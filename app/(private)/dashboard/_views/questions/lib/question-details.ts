import { z } from 'zod';

import { richTextPlainText } from './rich-text';

export const QUESTION_DETAIL_LIMITS = {
  count: 20,
  title: 200,
  text: 10000,
} as const;
export const questionDetailSchema = z.object({
  id: z.uuid(),
  title: z.string().max(QUESTION_DETAIL_LIMITS.title),
  text: z.string().max(QUESTION_DETAIL_LIMITS.text),
  visibleToConsultants: z.boolean(),
});
export type QuestionDetail = z.infer<typeof questionDetailSchema>;

/** Display only: keep empty editing drafts and persisted data intact. */
export function hasQuestionDetailContent(detail: QuestionDetail): boolean {
  return Boolean(detail.title.trim() || richTextPlainText(detail.text).trim());
}
