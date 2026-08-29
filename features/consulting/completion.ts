export const TEMP_STUDENT_CONSULTING_RESULTS_TABLE =
  'temp_student_consulting_results' as const;

export const MATERIAL_BOX_CONSULTING_ID = 'material-box-consulting' as const;
export const MATERIAL_BOX_CONSULTING_TITLE =
  '생활기록부 브랜딩 컨설팅 · 재료함 설계' as const;

export type TempStudentConsultingResultRow = {
  student_id: string;
  consulting_id: string;
  consulting_title: string;
  agent_memory: unknown;
  result_data: unknown;
  completed_at: string;
  created_at: string;
  updated_at: string;
};
