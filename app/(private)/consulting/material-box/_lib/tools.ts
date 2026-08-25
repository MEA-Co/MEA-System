import type { MaterialBoxToolSchema } from '@/app/(private)/consulting/material-box/_lib/types';
import { createConsultingTools } from '@/features/consulting/core/tools';

export const materialBoxTools =
  createConsultingTools<MaterialBoxToolSchema>({});
