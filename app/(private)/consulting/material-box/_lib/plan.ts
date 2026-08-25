import type {
  MaterialBoxContext,
  MaterialBoxTools,
} from '@/app/(private)/consulting/material-box/_lib/types';
import type { GuidedConsultingMemory } from '@/features/guided-consulting/core/agent/memory';
import { defineGuidedConsultingPlan } from '@/features/guided-consulting/core/plan';

function getSubmittedMajors(
  memory: GuidedConsultingMemory<MaterialBoxContext>,
) {
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
  memory: GuidedConsultingMemory<MaterialBoxContext>,
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

function getProgressScreenData(
  memory: GuidedConsultingMemory<MaterialBoxContext>,
) {
  const getOptionalSubmittedText = (
    nodeId: string,
    label: string,
    maxLength: number,
  ) =>
    memory.actions[nodeId]
      ? getSubmittedText(memory, nodeId, label, maxLength)
      : undefined;

  return {
    majors: getSubmittedMajors(memory),
    keyword: getSubmittedText(memory, 'keyword', '세부 키워드', 80),
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

export const materialBoxPlan = defineGuidedConsultingPlan<
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
      screen: { screenId: 'material-box.major', mode: 'static' },
      on: { 'user.submit': 'keyword' },
    },
    keyword: {
      id: 'keyword',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'material-box.keyword',
        mode: 'dynamic',
        data: { majors: getSubmittedMajors(memory) },
      }),
      on: { 'user.submit': 'career-identity' },
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
