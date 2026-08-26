import {
  isGenerateStudentStoryToolOutput,
  type MaterialBoxContext,
  type MaterialBoxMajorKeyword,
  type MaterialBoxTools,
} from '@/app/(private)/consulting/material-box/_lib/types';
import type { ConsultingMemory } from '@/features/consulting/core/agent/memory';
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

function getProgressScreenData(memory: ConsultingMemory<MaterialBoxContext>) {
  const getOptionalSubmittedText = (
    nodeId: string,
    label: string,
    maxLength: number,
  ) =>
    memory.actions[nodeId]
      ? getSubmittedText(memory, nodeId, label, maxLength)
      : undefined;

  return {
    majorKeywords: getSubmittedMajorKeywords(memory),
    studentStory: getGeneratedStudentStory(memory),
    careerIdentity: getOptionalSubmittedText(
      'career-identity',
      '진로 명칭',
      80,
    ),
    coreValue: getOptionalSubmittedText('core-value', '핵심 가치', 180),
    fieldStrength: getOptionalSubmittedText('field-strength', '분야 강점', 180),
    personalStrength: getOptionalSubmittedText(
      'personal-strength',
      '개인 장점',
      180,
    ),
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
          startAtInput: memory.lastAction?.type === 'user.back',
        },
      }),
      on: { 'user.submit': 'keyword' },
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
            startAtInput: memory.lastAction?.type === 'user.back',
          },
        };
      },
      on: {
        'user.submit': 'generate-student-story',
        'user.back': 'major',
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
        'user.next-explanation': 'career-identity',
        'user.back': 'keyword',
      },
    },
    'career-identity': {
      id: 'career-identity',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.career-identity',
        mode: 'dynamic',
        data: getProgressScreenData(memory),
      }),
      on: { 'user.submit': 'core-value' },
    },
    'core-value': {
      id: 'core-value',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.core-value',
        mode: 'dynamic',
        data: getProgressScreenData(memory),
      }),
      on: { 'user.submit': 'field-strength' },
    },
    'field-strength': {
      id: 'field-strength',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.field-strength',
        mode: 'dynamic',
        data: getProgressScreenData(memory),
      }),
      on: { 'user.submit': 'personal-strength' },
    },
    'personal-strength': {
      id: 'personal-strength',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.personal-strength',
        mode: 'dynamic',
        data: getProgressScreenData(memory),
      }),
      on: { 'user.submit': 'complete' },
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
