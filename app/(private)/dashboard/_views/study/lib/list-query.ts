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
// Escape the regex and quote the PostgREST value separately so punctuation stays literal.
export function studySearchFilter(text: string) {
  const pattern = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted =
    '"' + pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  return studySearchKeys
    .map((key) => `values->>${key}.imatch.${quoted}`)
    .join(',');
}
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
