import type { GuidedConsultingTools } from '@/features/guided-consulting/core/tools';

export type MaterialBoxContext = Record<never, never>;

export type MaterialBoxKeywordScreenData = {
  majors: ReadonlyArray<string>;
};

export type MaterialBoxProgressScreenData = MaterialBoxKeywordScreenData & {
  keyword: string;
  careerIdentity?: string;
  coreValue?: string;
  fieldStrength?: string;
  personalStrength?: string;
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

export function isMaterialBoxProgressScreenData(
  value: unknown,
): value is MaterialBoxProgressScreenData {
  const isOptionalText = (key: string, maxLength: number) => {
    if (!value || typeof value !== 'object' || !(key in value)) return true;

    const text = (value as Record<string, unknown>)[key];
    if (text === undefined) return true;

    return (
      typeof text === 'string' &&
      text.trim().length > 0 &&
      text.length <= maxLength
    );
  };

  return (
    isMaterialBoxKeywordScreenData(value) &&
    'keyword' in value &&
    typeof value.keyword === 'string' &&
    value.keyword.trim().length > 0 &&
    value.keyword.length <= 80 &&
    isOptionalText('careerIdentity', 80) &&
    isOptionalText('coreValue', 180) &&
    isOptionalText('fieldStrength', 180) &&
    isOptionalText('personalStrength', 180)
  );
}

export type MaterialBoxToolSchema = Record<never, never>;

export type MaterialBoxTools = GuidedConsultingTools<MaterialBoxToolSchema>;
