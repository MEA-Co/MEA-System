import type { ReactNode } from 'react';

import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { materialBoxCompleteScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxCompleteScreen';
import { materialBoxIntroScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxIntroScreen';
import { materialBoxKeywordScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxKeywordScreen';
import { materialBoxMajorScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxMajorScreen';
import { materialBoxOverviewScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxOverviewScreen';
import { createMaterialBoxReflectionScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxReflectionScreen';
import { createGuidedConsultingRenderer } from '@/features/guided-consulting/core/renderer';

export const materialBoxRenderer = createGuidedConsultingRenderer<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>({
  'material-box.intro': materialBoxIntroScreen,
  'material-box.overview': materialBoxOverviewScreen,
  'material-box.major': materialBoxMajorScreen,
  'material-box.keyword': materialBoxKeywordScreen,
  'material-box.career-identity':
    createMaterialBoxReflectionScreen('career-identity'),
  'material-box.core-value': createMaterialBoxReflectionScreen('core-value'),
  'material-box.field-strength':
    createMaterialBoxReflectionScreen('field-strength'),
  'material-box.personal-strength':
    createMaterialBoxReflectionScreen('personal-strength'),
  'material-box.complete': materialBoxCompleteScreen,
});
