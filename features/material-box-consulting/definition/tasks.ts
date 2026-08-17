import { defineConsultingTasks } from '@/features/consulting/core/task';
import type {
  MaterialBoxMemory,
  MaterialBoxTaskOutputs,
  MaterialBoxView,
} from '@/features/material-box-consulting/model/types';
import { loadMentorAdvice } from '@/features/material-box-consulting/tasks/loadMentorAdvice';

export const materialBoxTasks = defineConsultingTasks<
  MaterialBoxMemory,
  MaterialBoxView,
  MaterialBoxTaskOutputs
>({
  mentorAdvice: ({ signal }) => loadMentorAdvice(signal),
});
