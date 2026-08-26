import type { ReactNode } from 'react';

import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { materialBoxIntroScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxIntroScreen';
import { materialBoxKeywordScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxKeywordScreen';
import { materialBoxMajorScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxMajorScreen';
import { materialBoxOverviewScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxOverviewScreen';
import { createMaterialBoxReflectionScreen } from '@/app/(private)/consulting/material-box/_screens/MaterialBoxReflectionScreen';
import {
  materialBoxStudentStoryErrorScreen,
  materialBoxStudentStoryPendingScreen,
  materialBoxStudentStoryScreen,
} from '@/app/(private)/consulting/material-box/_screens/MaterialBoxStudentStoryScreen';
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
  'material-box.student-story-pending': materialBoxStudentStoryPendingScreen,
  'material-box.student-story': materialBoxStudentStoryScreen,
  'material-box.student-story-error': materialBoxStudentStoryErrorScreen,
  'material-box.career-identity':
    createMaterialBoxReflectionScreen('career-identity'),
  'material-box.core-value': createMaterialBoxReflectionScreen('core-value'),
  'material-box.field-strength':
    createMaterialBoxReflectionScreen('field-strength'),
  'material-box.personal-strength':
    createMaterialBoxReflectionScreen('personal-strength'),
  'material-box.complete': materialBoxCompleteScreen,
});
