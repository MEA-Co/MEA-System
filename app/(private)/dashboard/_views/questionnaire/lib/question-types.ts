import type { Question } from './types';

export const QUESTION_TYPES = [
  { value: 'text', label: '서술형' },
  { value: 'scale', label: '5점 척도형' },
  { value: 'single', label: '단일선택형' },
  { value: 'multiple', label: '다수선택형' },
] as const;
export type QuestionKind = (typeof QUESTION_TYPES)[number]['value'];
export const SCALE_LABELS = [
  '전혀 그렇지 않다',
  '그렇지 않다',
  '보통이다',
  '그렇다',
  '매우 그렇다',
];
export type ChoiceAnswer = string | { id: string; text: string };
export function choiceAnswers(
  value: string,
  multiple: boolean,
): ChoiceAnswer[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    const items = multiple ? parsed : [parsed];
    if (!Array.isArray(items)) return [];
    return items.every(
      (item) =>
        typeof item === 'string' ||
        (item &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof item.id === 'string' &&
          typeof item.text === 'string'),
    )
      ? items
      : [];
  } catch {
    return multiple ? [] : [value];
  }
}
export function choiceAnswerId(answer: ChoiceAnswer): string {
  return typeof answer === 'string' ? answer : answer.id;
}
export function encodeChoiceAnswers(
  answers: ChoiceAnswer[],
  multiple: boolean,
): string {
  if (!answers.length) return '';
  return multiple
    ? JSON.stringify(answers)
    : typeof answers[0] === 'string'
      ? answers[0]
      : JSON.stringify(answers[0]);
}
export function selectedOptions(value: string): string[] {
  return choiceAnswers(value, true).map(choiceAnswerId);
}
export function validTypedAnswer(
  question: Pick<Question, 'kind' | 'options'>,
  value: string,
  complete = false,
): boolean {
  if (!value.trim()) return !complete;
  const kind = question.kind ?? 'text';
  if (kind === 'text') return true;
  if (kind === 'scale') return /^[1-5]$/.test(value);
  const options = question.options ?? [];
  const answers = choiceAnswers(value, kind === 'multiple');
  const ids = answers.map(choiceAnswerId);
  return (
    answers.length > 0 &&
    new Set(ids).size === ids.length &&
    answers.every((answer) => {
      const option = options.find((o) => o.id === choiceAnswerId(answer));
      if (!option) return false;
      if (!option.isOther) return typeof answer === 'string';
      return (
        typeof answer !== 'string' &&
        answer.text.length <= 5000 &&
        (!complete || !!answer.text.trim())
      );
    })
  );
}
