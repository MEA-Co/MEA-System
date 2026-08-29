import {
  type GenerateKeywordSuggestionsToolInput,
  type GenerateKeywordSuggestionsToolOutput,
  isGenerateKeywordSuggestionsToolOutput,
  isKeywordSuggestion,
  type KeywordSuggestion,
} from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';
import type { ConsultingTools } from '@/features/consulting/core/tools';
import {
  type ExplorationState,
  ExplorationStateSchema,
} from '@/features/exploration/schemas/exploration';

export type MaterialBoxContext = Record<never, never>;

export type MaterialBoxKeywordSuggestionTaskState =
  | { status: 'pending' }
  | {
      status: 'completed';
      results: ReadonlyArray<GenerateKeywordSuggestionsToolOutput>;
    }
  | { status: 'rejected'; error: string };

export type MaterialBoxKeywordScreenData = {
  majors: ReadonlyArray<string>;
  keywords: ReadonlyArray<string>;
  selectedSuggestions: ReadonlyArray<ReadonlyArray<KeywordSuggestion>>;
  explorationStates: ReadonlyArray<ExplorationState>;
  startAtInput: boolean;
  suggestionTaskState?: MaterialBoxKeywordSuggestionTaskState;
};

export type MaterialBoxMajorKeyword = {
  major: string;
  keyword: string;
  selectedSuggestions: ReadonlyArray<KeywordSuggestion>;
  explorationState?: ExplorationState;
};

export type MaterialBoxProgressScreenData = {
  majorKeywords: ReadonlyArray<MaterialBoxMajorKeyword>;
  studentStory?: string;
  coreValue?: string;
  fieldStrength?: string;
  majorFieldStrength?: string;
  personalStrength?: string;
  coreValueDraft?: string;
  pureFieldStrengthDraft?: string;
  majorFieldStrengthDraft?: string;
};

export type MaterialBoxCoreValueScreenData = MaterialBoxProgressScreenData & {
  startAtInput: boolean;
};

export type MaterialBoxStrengthScreenData = MaterialBoxProgressScreenData & {
  startAtInput: boolean;
};

export type MaterialBoxStrengths = {
  pureFieldStrength: string;
  majorFieldStrength: string;
  differentiatingStrength: string;
};

export type GenerateStudentStoryToolInput = {
  majorKeywords: ReadonlyArray<MaterialBoxMajorKeyword>;
};

export type GenerateStudentStoryToolOutput = {
  studentStory: string;
};

export type MaterialBoxStudentStoryTaskState =
  | { status: 'pending' }
  | { status: 'completed' }
  | { status: 'rejected'; error: string };

export type MaterialBoxStudentStoryScreenData =
  MaterialBoxProgressScreenData & {
    jobKey?: string;
    taskState?: MaterialBoxStudentStoryTaskState;
  };

function isExplorationStateForDepartment(
  value: unknown,
  department: string,
): value is ExplorationState {
  const result = ExplorationStateSchema.safeParse(value);
  return result.success && result.data.department === department;
}

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
    'selectedSuggestions' in value &&
    Array.isArray(value.selectedSuggestions) &&
    value.selectedSuggestions.length <= 5 &&
    value.selectedSuggestions.every(isKeywordSuggestion) &&
    (!('explorationState' in value) ||
      value.explorationState === undefined ||
      isExplorationStateForDepartment(value.explorationState, value.major))
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
    value.studentStory.endsWith('학생') &&
    value.studentStory.length <= 220
  );
}

export function isMaterialBoxKeywordScreenData(
  value: unknown,
): value is MaterialBoxKeywordScreenData {
  if (!(
    typeof value === 'object' &&
    value !== null &&
    'majors' in value &&
    Array.isArray(value.majors) &&
    value.majors.length > 0 &&
    value.majors.length <= 3 &&
    value.majors.every(
      (major) => typeof major === 'string' && major.trim().length > 0,
    ) &&
    'keywords' in value &&
    Array.isArray(value.keywords) &&
    (value.keywords.length === 0 ||
      value.keywords.length === value.majors.length) &&
    value.keywords.every(
      (keyword) => typeof keyword === 'string' && keyword.trim().length > 0,
    ) &&
    'selectedSuggestions' in value &&
    Array.isArray(value.selectedSuggestions) &&
    (value.selectedSuggestions.length === 0 ||
      value.selectedSuggestions.length === value.majors.length) &&
    value.selectedSuggestions.every(
      (suggestions) =>
        Array.isArray(suggestions) &&
        suggestions.length <= 5 &&
        suggestions.every(isKeywordSuggestion),
    ) &&
    'explorationStates' in value &&
    Array.isArray(value.explorationStates) &&
    (value.explorationStates.length === 0 ||
      value.explorationStates.length === value.majors.length) &&
    value.explorationStates.every(
      (state, index) =>
        typeof (value.majors as ReadonlyArray<unknown>)[index] === 'string' &&
        isExplorationStateForDepartment(
          state,
          (value.majors as ReadonlyArray<string>)[index],
        ),
    ) &&
    'startAtInput' in value &&
    typeof value.startAtInput === 'boolean'
  )) {
    return false;
  }

  if (
    !('suggestionTaskState' in value) ||
    value.suggestionTaskState === undefined
  ) {
    return true;
  }
  if (
    typeof value.suggestionTaskState !== 'object' ||
    value.suggestionTaskState === null
  ) {
    return false;
  }

  const taskState = value.suggestionTaskState as Record<string, unknown>;
  if (taskState.status === 'pending') return true;
  if (taskState.status === 'rejected') {
    return (
      typeof taskState.error === 'string' && taskState.error.trim().length > 0
    );
  }
  if (taskState.status !== 'completed' || !Array.isArray(taskState.results)) {
    return false;
  }

  const majors = value.majors as ReadonlyArray<string>;
  return (
    taskState.results.length === majors.length &&
    taskState.results.every(
      (result, index) =>
        isGenerateKeywordSuggestionsToolOutput(result) &&
        result.major === majors[index],
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
    isOptionalText('coreValue', 180) &&
    isOptionalText('fieldStrength', 180) &&
    isOptionalText('majorFieldStrength', 180) &&
    isOptionalText('personalStrength', 180) &&
    isOptionalText('coreValueDraft', 180) &&
    isOptionalText('pureFieldStrengthDraft', 180) &&
    isOptionalText('majorFieldStrengthDraft', 180)
  );
}

export function isMaterialBoxStudentStoryScreenData(
  value: unknown,
): value is MaterialBoxStudentStoryScreenData {
  if (!isMaterialBoxProgressScreenData(value)) return false;
  if (
    'jobKey' in value &&
    value.jobKey !== undefined &&
    (typeof value.jobKey !== 'string' || value.jobKey.length === 0)
  ) {
    return false;
  }
  if (!('taskState' in value) || value.taskState === undefined) return true;
  if (typeof value.taskState !== 'object' || value.taskState === null) {
    return false;
  }
  const taskState = value.taskState as Record<string, unknown>;

  if (
    taskState.status !== 'pending' &&
    taskState.status !== 'completed' &&
    taskState.status !== 'rejected'
  ) {
    return false;
  }

  if (
    taskState.status === 'completed' &&
    typeof value.studentStory !== 'string'
  ) {
    return false;
  }

  return (
    taskState.status !== 'rejected' ||
    (typeof taskState.error === 'string' && taskState.error.trim().length > 0)
  );
}

export function isMaterialBoxCoreValueScreenData(
  value: unknown,
): value is MaterialBoxCoreValueScreenData {
  return (
    isMaterialBoxProgressScreenData(value) &&
    'startAtInput' in value &&
    typeof value.startAtInput === 'boolean'
  );
}

export function isMaterialBoxStrengthScreenData(
  value: unknown,
): value is MaterialBoxStrengthScreenData {
  return (
    isMaterialBoxProgressScreenData(value) &&
    'startAtInput' in value &&
    typeof value.startAtInput === 'boolean'
  );
}

export type MaterialBoxToolSchema = {
  'keyword-suggestions.generate': {
    input: GenerateKeywordSuggestionsToolInput;
    output: GenerateKeywordSuggestionsToolOutput;
  };
  'student-story.generate': {
    input: GenerateStudentStoryToolInput;
    output: GenerateStudentStoryToolOutput;
  };
};

export type MaterialBoxTools = ConsultingTools<MaterialBoxToolSchema>;
