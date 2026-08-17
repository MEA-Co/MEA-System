import { defineConsultingMemory } from '@/features/consulting/core/memory';
import type { MaterialBoxMemory } from '@/features/material-box-consulting/model/types';

export const materialBoxMemory = defineConsultingMemory<MaterialBoxMemory>(
  () => ({
    majorPreferences: [],
    keyword: '',
  }),
);
