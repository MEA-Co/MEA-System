import type { StudentPeriod } from '@/lib/profile';

export const QUEST_ANSWER_TYPES = ['text', 'table'] as const;

export type QuestAnswerType = (typeof QUEST_ANSWER_TYPES)[number];

export type Quest = {
  id: string;
  student_period: StudentPeriod;
  question: string;
  answer_type: QuestAnswerType;
  table_columns: string[];
  created_at: string;
};

export function isQuestAnswerType(value: string): value is QuestAnswerType {
  return QUEST_ANSWER_TYPES.some((type) => type === value);
}
