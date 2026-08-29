import {
  isGenerateStudentStoryToolOutput,
  type MaterialBoxContext,
  type MaterialBoxMajorKeyword,
  type MaterialBoxStrengths,
  type MaterialBoxTools,
} from '@/app/(private)/consulting/material-box/_lib/types';
import { isKeywordSuggestion } from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';
import { createStudentStoryJobKey } from '@/app/(private)/consulting/material-box/_tools/GenerateStudentStoryTool';
import {
  MATERIAL_BOX_CONSULTING_ID,
  MATERIAL_BOX_CONSULTING_TITLE,
} from '@/features/consulting/completion';
import type { ConsultingMemory } from '@/features/consulting/core/agent';
import { defineConsultingPlan } from '@/features/consulting/core/plan';
import {
  createCoreValueDraft,
  createMajorFieldStrengthDraft,
  createPureFieldStrengthDraft,
} from '@/features/exploration/domain';
import {
  type ExplorationState,
  ExplorationStateSchema,
} from '@/features/exploration/schemas/exploration';

const STUDENT_STORY_RESULT_KEY = 'generate-student-story';

function getSubmittedMajors(memory: ConsultingMemory<MaterialBoxContext>) {
  const action = memory.actions.major;
  if (action?.type !== 'user.submit') {
    throw new Error('확정된 희망 전공이 없습니다.');
  }

  const majors: unknown = JSON.parse(action.value);
  if (
    !Array.isArray(majors) ||
    majors.length === 0 ||
    majors.length > 3 ||
    majors.some(
      (major) => typeof major !== 'string' || major.trim().length === 0,
    )
  ) {
    throw new Error('희망 전공 입력 형식이 올바르지 않습니다.');
  }

  return majors as Array<string>;
}

function getSubmittedText(
  memory: ConsultingMemory<MaterialBoxContext>,
  nodeId: string,
  label: string,
  maxLength: number,
) {
  const action = memory.actions[nodeId];
  if (action?.type !== 'user.submit') {
    throw new Error(`확정된 ${label} 입력이 없습니다.`);
  }

  const value = action.value.trim();
  if (!value || value.length > maxLength) {
    throw new Error(`${label} 입력 형식이 올바르지 않습니다.`);
  }

  return value;
}

function getSubmittedMajorKeywords(
  memory: ConsultingMemory<MaterialBoxContext>,
) {
  const action = memory.actions.keyword;
  if (action?.type !== 'user.submit') {
    throw new Error('확정된 전공별 세부 키워드가 없습니다.');
  }

  const majors = getSubmittedMajors(memory);
  const majorKeywords: unknown = JSON.parse(action.value);
  if (
    !Array.isArray(majorKeywords) ||
    majorKeywords.length !== majors.length ||
    majorKeywords.some(
      (entry, index) =>
        typeof entry !== 'object' ||
        entry === null ||
        !('major' in entry) ||
        entry.major !== majors[index] ||
        !('keyword' in entry) ||
        typeof entry.keyword !== 'string' ||
        entry.keyword.trim().length === 0 ||
        !('selectedSuggestions' in entry) ||
        !Array.isArray(entry.selectedSuggestions) ||
        entry.selectedSuggestions.length > 5 ||
        !entry.selectedSuggestions.every(isKeywordSuggestion) ||
        !('explorationState' in entry) ||
        !ExplorationStateSchema.safeParse(entry.explorationState).success ||
        (entry.explorationState as ExplorationState).department !==
          majors[index] ||
        (entry.explorationState as ExplorationState).profile === null,
    )
  ) {
    throw new Error('전공별 세부 키워드 입력 형식이 올바르지 않습니다.');
  }

  return majorKeywords as Array<MaterialBoxMajorKeyword>;
}

function getGeneratedStudentStory(
  memory: ConsultingMemory<MaterialBoxContext>,
) {
  const result = memory.toolResults[STUDENT_STORY_RESULT_KEY];
  if (result === undefined) return undefined;

  if (!isGenerateStudentStoryToolOutput(result)) {
    throw new Error('생성된 학생 스토리 형식이 올바르지 않습니다.');
  }

  return result.studentStory;
}

function createStudentStoryEffect(
  memory: ConsultingMemory<MaterialBoxContext>,
) {
  const input = getStudentStoryInput(memory);
  const jobKey = createStudentStoryJobKey(input);

  return [
    {
      toolId: 'student-story.generate' as const,
      input,
      key: jobKey,
      groupId: jobKey,
      policy: 'replace' as const,
      label: '학생 스토리 생성',
      resultKey: STUDENT_STORY_RESULT_KEY,
    },
  ];
}

function getStudentStoryInput(memory: ConsultingMemory<MaterialBoxContext>) {
  return {
    majorKeywords: getSubmittedMajorKeywords(memory).map(
      ({ major, keyword, selectedSuggestions }) => ({
        major,
        keyword,
        selectedSuggestions,
      }),
    ),
  };
}

function getSubmittedStrengths(
  memory: ConsultingMemory<MaterialBoxContext>,
): MaterialBoxStrengths {
  const action = memory.actions['field-strength'];
  if (action?.type !== 'user.submit') {
    throw new Error('확정된 계열 적합 역량이 없습니다.');
  }

  const strengths: unknown = JSON.parse(action.value);
  if (
    typeof strengths !== 'object' ||
    strengths === null ||
    !('pureFieldStrength' in strengths) ||
    typeof strengths.pureFieldStrength !== 'string' ||
    !strengths.pureFieldStrength.trim() ||
    strengths.pureFieldStrength.length > 180 ||
    !('majorFieldStrength' in strengths) ||
    typeof strengths.majorFieldStrength !== 'string' ||
    !strengths.majorFieldStrength.trim() ||
    strengths.majorFieldStrength.length > 180 ||
    !('differentiatingStrength' in strengths) ||
    typeof strengths.differentiatingStrength !== 'string' ||
    !strengths.differentiatingStrength.trim() ||
    strengths.differentiatingStrength.length > 180
  ) {
    throw new Error('계열 적합 역량 입력 형식이 올바르지 않습니다.');
  }

  return strengths as MaterialBoxStrengths;
}

export function getMaterialBoxProgressScreenData(
  memory: ConsultingMemory<MaterialBoxContext>,
) {
  const getOptionalSubmittedText = (
    nodeId: string,
    label: string,
    maxLength: number,
  ) =>
    memory.actions[nodeId]?.type === 'user.submit'
      ? getSubmittedText(memory, nodeId, label, maxLength)
      : undefined;

  const strengths =
    memory.actions['field-strength']?.type === 'user.submit'
      ? getSubmittedStrengths(memory)
      : undefined;
  const majorKeywords = getSubmittedMajorKeywords(memory);
  const explorationStates = majorKeywords
    .map((entry) => entry.explorationState)
    .filter((state): state is ExplorationState => state !== undefined);

  return {
    majorKeywords,
    studentStory: getGeneratedStudentStory(memory),
    coreValue: getOptionalSubmittedText('core-value', '핵심 가치', 180),
    fieldStrength: strengths?.pureFieldStrength,
    majorFieldStrength: strengths?.majorFieldStrength,
    personalStrength: strengths?.differentiatingStrength,
    coreValueDraft: createCoreValueDraft(explorationStates),
    pureFieldStrengthDraft: createPureFieldStrengthDraft(explorationStates),
    majorFieldStrengthDraft: createMajorFieldStrengthDraft(explorationStates),
  };
}

export const materialBoxPlan = defineConsultingPlan<
  MaterialBoxContext,
  MaterialBoxTools
>({
  id: MATERIAL_BOX_CONSULTING_ID,
  title: MATERIAL_BOX_CONSULTING_TITLE,
  entry: 'intro',
  createInitialContext: () => ({}),
  nodes: {
    intro: {
      id: 'intro',
      label: '컨설팅 소개',
      type: 'screen',
      screen: { screenId: 'material-box.intro', mode: 'static' },
      on: { 'user.next-explanation': 'material-box-overview' },
    },
    'material-box-overview': {
      id: 'material-box-overview',
      label: '재료함 안내',
      type: 'screen',
      screen: { screenId: 'material-box.overview', mode: 'static' },
      on: { 'user.next-explanation': 'major' },
    },
    major: {
      id: 'major',
      label: '희망 전공',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.major',
        mode: 'dynamic',
        data: {
          majors:
            memory.actions.major?.type === 'user.submit'
              ? getSubmittedMajors(memory)
              : [],
          startAtInput: memory.lastAction?.type === 'user.previous-explanation',
        },
      }),
      on: {
        'user.submit': 'keyword',
        'user.previous-explanation': 'material-box-overview',
      },
    },
    keyword: {
      id: 'keyword',
      label: '세부 키워드',
      type: 'screen',
      screen: (memory) => {
        const submittedKeywords =
          memory.actions.keyword?.type === 'user.submit'
            ? getSubmittedMajorKeywords(memory).map((entry) => entry.keyword)
            : [];
        const submittedExplorationStates =
          memory.actions.keyword?.type === 'user.submit'
            ? getSubmittedMajorKeywords(memory)
                .map((entry) => entry.explorationState)
                .filter(
                  (state): state is ExplorationState => state !== undefined,
                )
            : [];

        return {
          screenId: 'material-box.keyword',
          mode: 'dynamic',
          data: {
            majors: getSubmittedMajors(memory),
            keywords: submittedKeywords,
            selectedSuggestions:
              memory.actions.keyword?.type === 'user.submit'
                ? getSubmittedMajorKeywords(memory).map(
                    (entry) => entry.selectedSuggestions,
                  )
                : [],
            explorationStates: submittedExplorationStates,
            startAtInput:
              memory.lastAction?.type === 'user.previous-explanation',
          },
        };
      },
      on: {
        'user.submit': 'student-story',
        'user.previous-explanation': 'major',
      },
      effects: {
        'user.submit': ({ memory }) => createStudentStoryEffect(memory),
      },
    },
    'student-story': {
      id: 'student-story',
      label: '학생 스토리',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.student-story',
        mode: 'dynamic',
        data: {
          ...getMaterialBoxProgressScreenData(memory),
          jobKey: createStudentStoryJobKey({
            majorKeywords: getStudentStoryInput(memory).majorKeywords,
          }),
        },
      }),
      on: {
        'user.next-explanation': {
          target: 'core-value',
          guard: ({ memory }) => getGeneratedStudentStory(memory) !== undefined,
        },
        'user.previous-explanation': 'keyword',
        'user.retry': 'student-story',
      },
      effects: {
        'user.retry': ({ memory }) => createStudentStoryEffect(memory),
      },
    },
    'core-value': {
      id: 'core-value',
      label: '핵심 가치',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.core-value',
        mode: 'dynamic',
        data: {
          ...getMaterialBoxProgressScreenData(memory),
          startAtInput:
            memory.actions['core-value']?.type ===
              'user.previous-explanation' ||
            memory.lastAction?.type === 'user.previous-explanation',
        },
      }),
      on: {
        'user.submit': 'field-strength',
        'user.previous-explanation': 'student-story',
      },
    },
    'field-strength': {
      id: 'field-strength',
      label: '계열 적합 역량',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.field-strength',
        mode: 'dynamic',
        data: {
          ...getMaterialBoxProgressScreenData(memory),
          startAtInput:
            memory.actions['field-strength']?.type ===
            'user.previous-explanation',
        },
      }),
      on: {
        'user.submit': 'complete',
        'user.previous-explanation': 'core-value',
      },
    },
    complete: {
      id: 'complete',
      label: '완료 리포트',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.complete',
        mode: 'dynamic',
        data: getMaterialBoxProgressScreenData(memory),
      }),
      terminal: true,
    },
  },
});
