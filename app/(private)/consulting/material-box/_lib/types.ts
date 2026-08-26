import type { ConsultingTools } from '@/features/consulting/core/tools';

export type MaterialBoxContext = Record<never, never>;

export type MaterialBoxKeywordScreenData = {
  majors: ReadonlyArray<string>;
};

export type MaterialBoxMajorKeyword = {
  major: string;
  keyword: string;
};

export type MaterialBoxProgressScreenData = {
  majorKeywords: ReadonlyArray<MaterialBoxMajorKeyword>;
  studentStory?: string;
  careerIdentity?: string;
  coreValue?: string;
  fieldStrength?: string;
  personalStrength?: string;
};

export type GenerateStudentStoryToolInput = {
  majorKeywords: ReadonlyArray<MaterialBoxMajorKeyword>;
};

export type GenerateStudentStoryToolOutput = {
  studentStory: string;
};

export type MaterialBoxStudentStoryErrorScreenData =
  MaterialBoxProgressScreenData & {
    error: string;
  };

function isMaterialBoxMajorKeyword(
  value: unknown,
): value is MaterialBoxMajorKeyword {
  return (
    typeof value === 'object' &&
    value !== null &&
    'major' in value &&
    typeof value.major === 'string' &&
    value.major.trim().length > 0 &&
    value.major.length <= 120 &&
    'keyword' in value &&
    typeof value.keyword === 'string' &&
    value.keyword.trim().length > 0 &&
    value.keyword.length <= 80
  );
}

export function isGenerateStudentStoryToolInput(
  value: unknown,
): value is GenerateStudentStoryToolInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'majorKeywords' in value &&
    Array.isArray(value.majorKeywords) &&
    value.majorKeywords.length > 0 &&
    value.majorKeywords.length <= 3 &&
    value.majorKeywords.every(isMaterialBoxMajorKeyword)
  );
}

export function isGenerateStudentStoryToolOutput(
  value: unknown,
): value is GenerateStudentStoryToolOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'studentStory' in value &&
    typeof value.studentStory === 'string' &&
    value.studentStory.trim().length > 0 &&
    !/[\r\n]/.test(value.studentStory) &&
    value.studentStory.length <= 220
  );
}

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
    typeof value === 'object' &&
    value !== null &&
    'majorKeywords' in value &&
    Array.isArray(value.majorKeywords) &&
    value.majorKeywords.length > 0 &&
    value.majorKeywords.length <= 3 &&
    value.majorKeywords.every(isMaterialBoxMajorKeyword) &&
    isOptionalText('studentStory', 220) &&
    isOptionalText('careerIdentity', 80) &&
    isOptionalText('coreValue', 180) &&
    isOptionalText('fieldStrength', 180) &&
    isOptionalText('personalStrength', 180)
  );
}

export function isMaterialBoxStudentStoryScreenData(
  value: unknown,
): value is MaterialBoxProgressScreenData & { studentStory: string } {
  return (
    isMaterialBoxProgressScreenData(value) &&
    typeof value.studentStory === 'string'
  );
}

export function isMaterialBoxStudentStoryErrorScreenData(
  value: unknown,
): value is MaterialBoxStudentStoryErrorScreenData {
  return (
    isMaterialBoxProgressScreenData(value) &&
    'error' in value &&
    typeof value.error === 'string' &&
    value.error.trim().length > 0
  );
}

export type MaterialBoxToolSchema = {
  'student-story.generate': {
    input: GenerateStudentStoryToolInput;
    output: GenerateStudentStoryToolOutput;
  };
};

export type MaterialBoxTools = ConsultingTools<MaterialBoxToolSchema>;
