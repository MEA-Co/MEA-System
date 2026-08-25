import type { MergeSortToolSchema } from '@/app/(private)/consulting/guided-demo/_lib/types';
import { mergeSortTool } from '@/app/(private)/consulting/guided-demo/_tools/MergeSortTool';
import { validateTenNumbersTool } from '@/app/(private)/consulting/guided-demo/_tools/ValidateTenNumbersTool';
import { createGuidedConsultingTools } from '@/features/guided-consulting/core/tools';

export const mergeSortTools = createGuidedConsultingTools<MergeSortToolSchema>({
  'numbers.validate-ten': validateTenNumbersTool,
  'numbers.merge-sort': mergeSortTool,
});
