import { z } from 'zod';

import { questionBlockSchema } from './question-blocks';

export const saveRequestSchema = z.object({
  document: questionBlockSchema.refine(
    (document) => document.purpose !== 'study_registration',
    '학습법 등록 안내는 질문지 시작 안내에서 관리합니다.',
  ),
  expectedRevision: z.number().int().min(0),
  saveId: z.uuid(),
  confirmedGuideAnswerFields: z.array(z.uuid()).max(20).optional(),
});

export const archiveRequestSchema = z.object({
  expectedRevision: z.number().int().min(1),
});
