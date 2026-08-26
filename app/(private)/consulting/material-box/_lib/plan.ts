import {
  isGenerateStudentStoryToolOutput,
  type MaterialBoxContext,
  type MaterialBoxMajorKeyword,
  type MaterialBoxStrengths,
  type MaterialBoxTools,
} from '@/app/(private)/consulting/material-box/_lib/types';
import type { ConsultingMemory } from '@/features/consulting/core/agent';
import { defineConsultingPlan } from '@/features/consulting/core/plan';

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
        entry.keyword.length > 80,
    )
  ) {
    throw new Error('전공별 세부 키워드 입력 형식이 올바르지 않습니다.');
  }

  return majorKeywords as Array<MaterialBoxMajorKeyword>;
}

function getGeneratedStudentStory(
  memory: ConsultingMemory<MaterialBoxContext>,
) {
  const result = memory.toolResults['generate-student-story'];
  if (result === undefined) return undefined;

  if (!isGenerateStudentStoryToolOutput(result)) {
    throw new Error('생성된 학생 스토리 형식이 올바르지 않습니다.');
  }

  return result.studentStory;
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

function getProgressScreenData(memory: ConsultingMemory<MaterialBoxContext>) {
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

  return {
    majorKeywords: getSubmittedMajorKeywords(memory),
    studentStory: getGeneratedStudentStory(memory),
    coreValue: getOptionalSubmittedText('core-value', '핵심 가치', 180),
    fieldStrength: strengths?.pureFieldStrength,
    majorFieldStrength: strengths?.majorFieldStrength,
    personalStrength: strengths?.differentiatingStrength,
  };
}

export const materialBoxPlan = defineConsultingPlan<
  MaterialBoxContext,
  MaterialBoxTools
>({
  id: 'material-box-consulting',
  title: '생활기록부 브랜딩 컨설팅 · 재료함 설계',
  entry: 'intro',
  createInitialContext: () => ({}),
  nodes: {
    intro: {
      id: 'intro',
      type: 'screen',
      screen: { screenId: 'material-box.intro', mode: 'static' },
      on: { 'user.next-explanation': 'material-box-overview' },
    },
    'material-box-overview': {
      id: 'material-box-overview',
      type: 'screen',
      screen: { screenId: 'material-box.overview', mode: 'static' },
      on: { 'user.next-explanation': 'major' },
    },
    major: {
      id: 'major',
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
      type: 'screen',
      screen: (memory) => {
        const submittedKeywords =
          memory.actions.keyword?.type === 'user.submit'
            ? getSubmittedMajorKeywords(memory).map((entry) => entry.keyword)
            : [];

        return {
          screenId: 'material-box.keyword',
          mode: 'dynamic',
          data: {
            majors: getSubmittedMajors(memory),
            keywords: submittedKeywords,
            startAtInput:
              memory.lastAction?.type === 'user.previous-explanation',
          },
        };
      },
      on: {
        'user.submit': 'generate-student-story',
        'user.previous-explanation': 'major',
      },
    },
    'generate-student-story': {
      id: 'generate-student-story',
      type: 'tool',
      toolId: 'student-story.generate',
      input: (memory) => ({
        majorKeywords: getSubmittedMajorKeywords(memory),
      }),
      pendingScreen: (memory) => ({
        screenId: 'material-box.student-story-pending',
        mode: 'dynamic',
        data: getProgressScreenData(memory),
      }),
      next: 'student-story',
      onRejected: 'student-story-error',
    },
    'student-story-error': {
      id: 'student-story-error',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.student-story-error',
        mode: 'dynamic',
        data: {
          ...getProgressScreenData(memory),
          error:
            memory.toolErrors['generate-student-story']?.message ??
            '학생의 스토리를 만들지 못했습니다.',
        },
      }),
      on: { 'user.next-explanation': 'generate-student-story' },
    },
    'student-story': {
      id: 'student-story',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.student-story',
        mode: 'dynamic',
        data: getProgressScreenData(memory),
      }),
      on: {
        'user.next-explanation': 'core-value',
        'user.previous-explanation': 'keyword',
      },
    },
    'core-value': {
      id: 'core-value',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.core-value',
        mode: 'dynamic',
        data: {
          ...getProgressScreenData(memory),
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
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.field-strength',
        mode: 'dynamic',
        data: {
          ...getProgressScreenData(memory),
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
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.complete',
        mode: 'dynamic',
        data: getProgressScreenData(memory),
      }),
      terminal: true,
    },
  },
});
