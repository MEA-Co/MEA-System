import type {
  MaterialBoxContext,
  MaterialBoxTools,
} from '@/app/(private)/consulting/material-box/_lib/types';
import { defineGuidedConsultingPlan } from '@/features/guided-consulting/core/plan';

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
    },
  },
});
