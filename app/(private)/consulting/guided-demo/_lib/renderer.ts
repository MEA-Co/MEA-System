import type { ReactNode } from 'react';

import type { GuidedConsultingMainRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { defaultInputScreen } from '@/app/(private)/consulting/_screens/DefaultInputScreen';
import { defaultTutorialScreen } from '@/app/(private)/consulting/_screens/DefaultTutorialScreen';
import { mergeSortCompleteScreen } from '@/app/(private)/consulting/guided-demo/_screens/MergeSortCompleteScreen';
import { mergeSortPendingScreen } from '@/app/(private)/consulting/guided-demo/_screens/MergeSortPendingScreen';
import { mergeSortResultScreen } from '@/app/(private)/consulting/guided-demo/_screens/MergeSortResultScreen';
import { createGuidedConsultingRenderer } from '@/features/guided-consulting/core/renderer';

export const mergeSortRenderer = createGuidedConsultingRenderer<
  GuidedConsultingMainRenderEnvironment,
  ReactNode
>({
  'tutorial.default': defaultTutorialScreen,
  'input.default': defaultInputScreen,
  'merge-sort.pending': mergeSortPendingScreen,
  'merge-sort.result': mergeSortResultScreen,
  'result.default': mergeSortCompleteScreen,
});
