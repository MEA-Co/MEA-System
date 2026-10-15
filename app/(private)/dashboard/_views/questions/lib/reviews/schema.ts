import { z } from 'zod';

import { normalizeRichTextValue, richTextPlainText } from '../rich-text';
export const reviewQuerySchema = z.object({
  completed: z.enum(['true', 'false']).default('false'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export const createReviewSchema = z.object({
  id: z.uuid(),
  description: z
    .string()
    .max(5000)
    .transform(normalizeRichTextValue)
    .refine((value) => richTextPlainText(value).trim().length > 0),
});
export const resolveReviewSchema = z.object({ id: z.uuid() });
export const readReviewsSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
});
