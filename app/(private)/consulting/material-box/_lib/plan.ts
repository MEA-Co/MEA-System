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
    },
  },
});
