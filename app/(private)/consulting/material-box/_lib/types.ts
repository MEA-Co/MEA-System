import type { GuidedConsultingTools } from '@/features/guided-consulting/core/tools';

export type MaterialBoxContext = Record<never, never>;

export type MaterialBoxKeywordScreenData = {
  majors: ReadonlyArray<string>;
};

export function isMaterialBoxKeywordScreenData(
  value: unknown,
): value is MaterialBoxKeywordScreenData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'majors' in value &&
    Array.isArray(value.majors) &&
    value.majors.length > 0 &&
    value.majors.length <= 3 &&
    value.majors.every(
      (major) => typeof major === 'string' && major.trim().length > 0,
    )
  );
}

export type MaterialBoxToolSchema = Record<never, never>;

export type MaterialBoxTools = GuidedConsultingTools<MaterialBoxToolSchema>;
