import type { MergeSortToolSchema } from '@/app/(private)/consulting/guided-demo/_lib/types';
import { mergeSortTool } from '@/app/(private)/consulting/guided-demo/_tools/MergeSortTool';
import { createGuidedConsultingTools } from '@/features/guided-consulting/core/tools';

export const mergeSortTools = createGuidedConsultingTools<MergeSortToolSchema>({
  'numbers.merge-sort': mergeSortTool,
});
