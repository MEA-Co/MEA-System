import { z } from 'zod';

export const COMPARISON_VERSION = 'content-fit-v2';

const name = z.string().trim().min(1).max(120);
export const comparisonRequestSchema = z.object({
  department: name,
  secondaryDepartment: name.optional(),
  current: name,
  intent: z.enum(['compare', 'consider', 'omit']).default('compare'),
  reason: z
    .enum(['neutral', 'interest', 'grades'])
    .default('neutral'),
  concern: z.string().max(1500).default(''),
  completed: z.array(z.object({ name, fixed: z.boolean() })).max(200),
  candidates: z
    .array(
      z.object({
        id: name,
        name,
        reason: z.enum(['neutral', 'interest', 'grades']),
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
      fitReason: z.string().min(1).max(400),
      fitPreference: z.enum(['current', 'alternative', 'similar']),
      alternativeInterest: z.string().trim().min(1).max(15),
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

export function comparisonFitSummary(
  current: string,
  alternative: string,
  judgment: Pick<ComparisonResponse['comparisons'][number], 'fitPreference' | 'alternativeInterest'>,
) {
  if (!judgment.fitPreference || judgment.fitPreference === 'similar')
    return '두 과목은 전공 연관성 측면에서 비슷해요. 더 관심 있거나 성적에 자신 있는 과목을 골라주세요.';
  const preferred = judgment.fitPreference === 'current' ? current : alternative;
  const other = judgment.fitPreference === 'current' ? alternative : current;
  const last = preferred.charCodeAt(preferred.length - 1);
  const particle = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0 ? '이' : '가';
  return `전공 연관성에서는 ${preferred}${particle} ${other}보다 더 적합해요. 하지만 ${judgment.alternativeInterest}에 관심이 있다면 ${other}도 괜찮은 선택이에요.`;
}

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
