import type { ReactNode } from 'react';

import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { firstSortExplanationScreen } from '@/app/(private)/consulting/guided-demo/_screens/FirstSortExplanationScreen';
import {
  firstSortInputErrorScreen,
  firstSortInputScreen,
} from '@/app/(private)/consulting/guided-demo/_screens/FirstSortInputScreen';
import { firstSortWaitingScreen } from '@/app/(private)/consulting/guided-demo/_screens/FirstSortWaitingScreen';
import { mergeSortCompleteScreen } from '@/app/(private)/consulting/guided-demo/_screens/MergeSortCompleteScreen';
import { mergeSortPendingScreen } from '@/app/(private)/consulting/guided-demo/_screens/MergeSortPendingScreen';
import { mergeSortResultScreen } from '@/app/(private)/consulting/guided-demo/_screens/MergeSortResultScreen';
import { secondSortExplanationScreen } from '@/app/(private)/consulting/guided-demo/_screens/SecondSortExplanationScreen';
import {
  secondSortInputErrorScreen,
  secondSortInputScreen,
} from '@/app/(private)/consulting/guided-demo/_screens/SecondSortInputScreen';
import { secondSortWaitingScreen } from '@/app/(private)/consulting/guided-demo/_screens/SecondSortWaitingScreen';
import { createGuidedConsultingRenderer } from '@/features/guided-consulting/core/renderer';

export const mergeSortRenderer = createGuidedConsultingRenderer<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>({
  'first-sort.explanation': firstSortExplanationScreen,
  'first-sort.input': firstSortInputScreen,
  'first-sort.input-error': firstSortInputErrorScreen,
  'first-sort.validating': secondSortWaitingScreen,
  'first-sort.waiting': firstSortWaitingScreen,
  'second-sort.explanation': secondSortExplanationScreen,
  'second-sort.input': secondSortInputScreen,
  'second-sort.input-error': secondSortInputErrorScreen,
  'second-sort.waiting': secondSortWaitingScreen,
  'merge-sort.pending': mergeSortPendingScreen,
  'merge-sort.result': mergeSortResultScreen,
  'result.default': mergeSortCompleteScreen,
});
