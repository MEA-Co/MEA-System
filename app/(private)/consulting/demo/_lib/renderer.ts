import type { ReactNode } from 'react';

import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { firstSortExplanationScreen } from '@/app/(private)/consulting/demo/_screens/FirstSortExplanationScreen';
import {
  firstSortInputErrorScreen,
  firstSortInputScreen,
} from '@/app/(private)/consulting/demo/_screens/FirstSortInputScreen';
import { firstSortWaitingScreen } from '@/app/(private)/consulting/demo/_screens/FirstSortWaitingScreen';
import { mergeSortCompleteScreen } from '@/app/(private)/consulting/demo/_screens/MergeSortCompleteScreen';
import { mergeSortPendingScreen } from '@/app/(private)/consulting/demo/_screens/MergeSortPendingScreen';
import { mergeSortResultScreen } from '@/app/(private)/consulting/demo/_screens/MergeSortResultScreen';
import { secondSortExplanationScreen } from '@/app/(private)/consulting/demo/_screens/SecondSortExplanationScreen';
import {
  secondSortInputErrorScreen,
  secondSortInputScreen,
} from '@/app/(private)/consulting/demo/_screens/SecondSortInputScreen';
import { secondSortWaitingScreen } from '@/app/(private)/consulting/demo/_screens/SecondSortWaitingScreen';
import { createConsultingRenderer } from '@/features/consulting/core/renderer';

export const mergeSortRenderer = createConsultingRenderer<
  ConsultingScreenRenderEnvironment,
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
