import type { ReactNode } from 'react';

import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { materialBoxIntroScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxIntroScreen';
import { materialBoxOverviewScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxOverviewScreen';
import { createGuidedConsultingRenderer } from '@/features/guided-consulting/core/renderer';

export const materialBoxRenderer = createGuidedConsultingRenderer<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>({
  'material-box.intro': materialBoxIntroScreen,
  'material-box.overview': materialBoxOverviewScreen,
});
