import type { ReactNode } from 'react';

import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { materialBoxIntroScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxIntroScreen';
import { materialBoxKeywordScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxKeywordScreen';
import { materialBoxMajorScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxMajorScreen';
import { materialBoxOverviewScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxOverviewScreen';
import { createGuidedConsultingRenderer } from '@/features/guided-consulting/core/renderer';

export const materialBoxRenderer = createGuidedConsultingRenderer<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>({
  'material-box.intro': materialBoxIntroScreen,
  'material-box.overview': materialBoxOverviewScreen,
  'material-box.major': materialBoxMajorScreen,
  'material-box.keyword': materialBoxKeywordScreen,
});
