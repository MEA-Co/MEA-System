import type { MaterialBoxToolSchema } from '@/app/(private)/consulting/material-box/_lib/types';
import { generateKeywordSuggestionsTool } from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';
import { generateStudentStoryTool } from '@/app/(private)/consulting/material-box/_tools/GenerateStudentStoryTool';
import { createConsultingTools } from '@/features/consulting/core/tools';

export const materialBoxTools = createConsultingTools<MaterialBoxToolSchema>({
  'keyword-suggestions.generate': generateKeywordSuggestionsTool,
  'student-story.generate': generateStudentStoryTool,
});
