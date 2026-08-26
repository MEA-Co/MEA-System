import type { MaterialBoxToolSchema } from '@/app/(private)/consulting/material-box/_lib/types';
import { generateStudentStoryTool } from '@/app/(private)/consulting/material-box/_tools/GenerateStudentStoryTool';
import { createConsultingTools } from '@/features/consulting/core/tools';

export const materialBoxTools = createConsultingTools<MaterialBoxToolSchema>({
  'student-story.generate': generateStudentStoryTool,
});
