import type { Question, ScaleConfig } from './types';

export const QUESTION_TYPES = [
  { value: 'text', label: '서술형' },
  { value: 'scale', label: '척도형' },
  { value: 'single', label: '단일선택형' },
  { value: 'multiple', label: '다수선택형' },
] as const;
export type QuestionKind = (typeof QUESTION_TYPES)[number]['value'];
export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  max: 5,
  low: '전혀 그렇지 않다',
  middle: '보통이다',
  high: '매우 그렇다',
  allowText: false,
};
export function scaleConfig(
  question: Pick<Question, 'scaleConfig'>,
): ScaleConfig {
  return question.scaleConfig ?? DEFAULT_SCALE_CONFIG;
}
export function scaleLabel(config: ScaleConfig, score: number): string {
  if (score === 1) return config.low;
  if (score === config.max) return config.high;
  if (config.max % 2 === 1 && score === (config.max + 1) / 2)
    return config.middle;
  return '';
}
export type ScaleAnswer = { score: number | null; text: string };
export function scaleAnswer(value: string): ScaleAnswer {
  if (/^[1-9]$/.test(value)) return { score: Number(value), text: '' };
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'score' in parsed &&
      'text' in parsed &&
      Object.keys(parsed).length === 2 &&
      typeof parsed.score === 'number' &&
      Number.isInteger(parsed.score) &&
      typeof parsed.text === 'string'
    )
      return { score: parsed.score, text: parsed.text };
  } catch {}
  return { score: null, text: '' };
}
export function encodeScaleAnswer(
  answer: ScaleAnswer,
  allowText: boolean,
): string {
  if (answer.score === null) return '';
  return allowText ? JSON.stringify(answer) : String(answer.score);
}
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
  question: Pick<Question, 'kind' | 'options' | 'scaleConfig'>,
  value: string,
  complete = false,
): boolean {
  if (!value.trim()) return !complete;
  const kind = question.kind ?? 'text';
  if (kind === 'text') return true;
  if (kind === 'scale') {
    const config = scaleConfig(question);
    const answer = scaleAnswer(value);
    return (
      answer.score !== null &&
      answer.score >= 1 &&
      answer.score <= config.max &&
      answer.text.length <= 5000 &&
      (config.allowText || answer.text === '') &&
      (config.allowText || /^[1-9]$/.test(value))
    );
  }
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
