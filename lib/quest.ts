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

export type TextQuestAnswer = {
  type: 'text';
  value: string;
};

export type TableQuestAnswer = {
  type: 'table';
  rows: string[][];
};

export type QuestAnswer = TextQuestAnswer | TableQuestAnswer;

export type QuestResponse = {
  quest_id: string;
  answer: QuestAnswer;
  updated_at: string;
};

export function isQuestAnswerType(value: string): value is QuestAnswerType {
  return QUEST_ANSWER_TYPES.some((type) => type === value);
}

export function isQuestAnswer(value: unknown): value is QuestAnswer {
  if (!value || typeof value !== 'object') return false;

  const answer = value as Record<string, unknown>;

  if (answer.type === 'text') return typeof answer.value === 'string';

  return (
    answer.type === 'table' &&
    Array.isArray(answer.rows) &&
    answer.rows.every(
      (row) =>
        Array.isArray(row) && row.every((cell) => typeof cell === 'string'),
    )
  );
}
