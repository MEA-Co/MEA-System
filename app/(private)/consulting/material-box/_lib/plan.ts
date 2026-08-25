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
      on: { 'user.next-explanation': 'identity' },
    },
    identity: {
      id: 'identity',
      type: 'screen',
      screen: { screenId: 'material-box.identity', mode: 'static' },
      on: { 'user.next-explanation': 'self-definition' },
    },
    'self-definition': {
      id: 'self-definition',
      type: 'screen',
      screen: { screenId: 'material-box.self-definition', mode: 'static' },
      on: { 'user.next-explanation': 'overview-intro' },
    },
    'overview-intro': {
      id: 'overview-intro',
      type: 'screen',
      screen: { screenId: 'material-box.overview-intro', mode: 'static' },
    },
  },
});
