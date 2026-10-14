import { z } from 'zod';

export const EXPLORATION_PAGE_SIZE = 10;
export const explorationSearchKeys = [
  'grade',
  'semester',
  'recordType',
  'recordArea',
  'schoolContext',
  'topic',
  'record',
  'competencies',
  'motivation',
  'story',
  'result',
  'followup',
] as const;
export const explorationPageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  scope: z.enum(['own', 'others']).default('own'),
  q: z.string().trim().max(200).default(''),
  owner: z.union([z.uuid(), z.literal('')]).default(''),
});
export function matchesExplorationSearch(
  values: Record<string, unknown>,
  query: string,
) {
  return (
    explorationSearchKeys.some(
      (key) =>
        typeof values[key] === 'string' &&
        values[key].toLowerCase().includes(query.trim().toLowerCase()),
    ) ||
    (Array.isArray(values.references) &&
      values.references.some(
        (ref) =>
          ref &&
          typeof ref === 'object' &&
          ['title', 'selection', 'usage'].some(
            (key) =>
              typeof ref[key] === 'string' &&
              ref[key].toLowerCase().includes(query.trim().toLowerCase()),
          ),
      ))
  );
}
