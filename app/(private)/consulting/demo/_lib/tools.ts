import type { MergeSortToolSchema } from '@/app/(private)/consulting/demo/_lib/types';
import { mergeSortTool } from '@/app/(private)/consulting/demo/_tools/MergeSortTool';
import { validateTenNumbersTool } from '@/app/(private)/consulting/demo/_tools/ValidateTenNumbersTool';
import { createConsultingTools } from '@/features/consulting/core/tools';

export const mergeSortTools = createConsultingTools<MergeSortToolSchema>({
  'numbers.validate-ten': validateTenNumbersTool,
  'numbers.merge-sort': mergeSortTool,
});
