import { defineConsultingTasks } from '@/features/consulting/core/task';
import type {
  MaterialBoxMemory,
  MaterialBoxTaskOutputs,
  MaterialBoxView,
} from '@/features/material-box-consulting/model/types';
import { loadKeywordRecommendations } from '@/features/material-box-consulting/tasks/loadKeywordRecommendations';
import { loadMentorAdvice } from '@/features/material-box-consulting/tasks/loadMentorAdvice';

export const materialBoxTasks = defineConsultingTasks<
  MaterialBoxMemory,
  MaterialBoxView,
  MaterialBoxTaskOutputs
>({
  mentorAdvice: ({ signal }) => loadMentorAdvice(signal),
  keywordRecommendations: ({ memory, signal }) =>
    loadKeywordRecommendations(memory.majorPreferences, signal),
});
