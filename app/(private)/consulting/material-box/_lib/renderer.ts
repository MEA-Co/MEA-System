import type { ReactNode } from 'react';

import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { materialBoxCoreValueScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxCoreValueScreen';
import { materialBoxIntroScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxIntroScreen';
import { materialBoxKeywordScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxKeywordScreen';
import { materialBoxMajorScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxMajorScreen';
import { materialBoxOverviewScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxOverviewScreen';
import { materialBoxStrengthScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxStrengthScreen';
import { materialBoxStudentStoryScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxStudentStoryScreen';
import { materialBoxCompleteScreen } from '@/app/(private)/consulting/material-box/_screens/report/MaterialBoxCompleteScreen';
import { createConsultingRenderer } from '@/features/consulting/core/renderer';

export const materialBoxRenderer = createConsultingRenderer<
  ConsultingScreenRenderEnvironment,
  ReactNode
>({
  'material-box.intro': materialBoxIntroScreen,
  'material-box.overview': materialBoxOverviewScreen,
  'material-box.major': materialBoxMajorScreen,
  'material-box.keyword': materialBoxKeywordScreen,
  'material-box.student-story': materialBoxStudentStoryScreen,
  'material-box.core-value': materialBoxCoreValueScreen,
  'material-box.field-strength': materialBoxStrengthScreen,
  'material-box.complete': materialBoxCompleteScreen,
});
