import { z } from 'zod';

const name = z.string().trim().min(1).max(120);
export const comparisonRequestSchema = z.object({
  department: name,
  current: name,
  intent: z.enum(['compare', 'consider', 'omit']).default('compare'),
  reason: z
    .enum(['neutral', 'preference', 'interest', 'grades'])
    .default('neutral'),
  concern: z.string().max(1500).default(''),
  completed: z.array(z.object({ name, fixed: z.boolean() })).max(200),
  candidates: z
    .array(
      z.object({
        id: name,
        name,
        reason: z.enum(['neutral', 'preference', 'interest', 'grades']),
        detail: z.string().max(1500),
        confident: z.boolean(),
        baseline: z.string().max(100),
        warnings: z.array(z.string().max(1500)).max(30),
      }),
    )
    .min(1)
    .max(2),
});

export const comparisonResponseSchema = z.object({
  comparisons: z.array(
    z.object({
      id: z.string(),
      recommendation: z.string(),
      currentConnection: z.string(),
      alternativeConnection: z.string(),
      tradeoff: z.string(),
      decisionGuide: z.string(),
    }),
  ),
});

export type ComparisonRequest = z.infer<typeof comparisonRequestSchema>;
export type ComparisonResponse = z.infer<typeof comparisonResponseSchema>;

export function validateComparisonResponse(
  value: unknown,
  request: ComparisonRequest,
) {
  const result = comparisonResponseSchema.parse(value);
  const ids = result.comparisons.map((item) => item.id);
  if (
    ids.length !== request.candidates.length ||
    new Set(ids).size !== ids.length ||
    request.candidates.some((item) => !ids.includes(item.id))
  ) {
    throw new Error('Comparison candidates do not match');
  }
  for (const item of result.comparisons) {
    for (const [key, value] of Object.entries(item)) {
      if (key !== 'id' && (!value.trim() || value.length > 2000))
        throw new Error('Invalid explanation');
    }
  }
  return result;
}
