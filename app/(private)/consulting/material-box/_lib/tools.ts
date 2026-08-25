import type { MaterialBoxToolSchema } from '@/app/(private)/consulting/material-box/_lib/types';
import { createGuidedConsultingTools } from '@/features/guided-consulting/core/tools';

export const materialBoxTools =
  createGuidedConsultingTools<MaterialBoxToolSchema>({});
