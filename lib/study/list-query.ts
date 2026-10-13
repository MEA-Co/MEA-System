import { z } from 'zod';

export const STUDY_PAGE_SIZE = 10;
export const studySearchKeys = [
  'title',
  'category',
  'subject',
  'customSubject',
  'problemSource',
  'problem',
  'problemExperience',
  'strategy',
  'practiceGuide',
  'practicePeriod',
  'checklist',
  'followup',
  'resultDiagnosis',
] as const;
export const studyPageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  scope: z.enum(['own', 'others']).default('own'),
  q: z.string().trim().max(200).default(''),
  owner: z.union([z.uuid(), z.literal('')]).default(''),
});
export function matchesStudySearch(
  values: Record<string, unknown>,
  query: string,
) {
  return studySearchKeys.some(
    (key) =>
      typeof values[key] === 'string' &&
      values[key].toLowerCase().includes(query.trim().toLowerCase()),
  );
}
