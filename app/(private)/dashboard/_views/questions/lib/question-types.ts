import type { Question, ScaleConfig } from './types';

export const QUESTION_TYPES = [
  { value: 'text', label: '서술형' },
  { value: 'scale', label: '척도형' },
  { value: 'single', label: '단일선택형' },
  { value: 'multiple', label: '다수선택형' },
] as const;
export type QuestionKind = (typeof QUESTION_TYPES)[number]['value'];
export function orderedChoiceOptions<T extends { isOther?: boolean }>(
  options: readonly T[],
): T[] {
  return [
    ...options.filter((option) => !option.isOther),
    ...options.filter((option) => option.isOther),
  ];
}
export function nextDirectInputLabel(
  options: readonly { label: string }[],
): string {
  const labels = new Set(options.map((option) => option.label.trim()));
  if (!labels.has('직접 입력')) return '직접 입력';
  let number = 2;
  while (labels.has(`직접 입력 ${number}`)) number += 1;
  return `직접 입력 ${number}`;
}
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
export type ChoiceAnswer =
  string | { id: string; text: string; entryId?: string };
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
          typeof item.text === 'string' &&
          (item.entryId === undefined ||
            (typeof item.entryId === 'string' && item.entryId.length > 0))),
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
export function choiceAnswerValue(
  value: string,
  multiple: boolean,
): { choices: ChoiceAnswer[]; text: string; wrapped: boolean } {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'choices' in parsed &&
      'text' in parsed &&
      Object.keys(parsed).length === 2 &&
      Array.isArray(parsed.choices) &&
      typeof parsed.text === 'string' &&
      parsed.choices.every(
        (item: unknown) =>
          typeof item === 'string' ||
          (item !== null &&
            typeof item === 'object' &&
            !Array.isArray(item) &&
            'id' in item &&
            'text' in item &&
            typeof item.id === 'string' &&
            typeof item.text === 'string' &&
            (!('entryId' in item) ||
              (typeof item.entryId === 'string' && item.entryId.length > 0))),
      )
    )
      return { choices: parsed.choices, text: parsed.text, wrapped: true };
  } catch {}
  return { choices: choiceAnswers(value, multiple), text: '', wrapped: false };
}
export function encodeChoiceAnswerValue(
  choices: ChoiceAnswer[],
  multiple: boolean,
  allowText: boolean,
  text: string,
): string {
  if (!choices.length) return '';
  return allowText
    ? JSON.stringify({ choices, text })
    : encodeChoiceAnswers(choices, multiple);
}
export function selectedOptions(value: string): string[] {
  return choiceAnswerValue(value, true).choices.map(choiceAnswerId);
}
export function validTypedAnswer(
  question: Pick<
    Question,
    'kind' | 'options' | 'scaleConfig' | 'choiceAllowText'
  >,
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
  const parsed = choiceAnswerValue(value, kind === 'multiple');
  const answers = parsed.choices;
  const keys = answers.map((answer) =>
    typeof answer === 'string'
      ? `option:${answer}`
      : `entry:${answer.entryId ?? answer.id}`,
  );
  const regularIds = answers.filter((answer) => typeof answer === 'string');
  return (
    answers.length > 0 &&
    (kind === 'multiple' || answers.length === 1) &&
    (!parsed.wrapped || !!question.choiceAllowText) &&
    parsed.text.length <= 5000 &&
    new Set(keys).size === keys.length &&
    new Set(regularIds).size === regularIds.length &&
    (kind === 'multiple' ||
      answers.every(
        (answer) => typeof answer === 'string' || !answer.entryId,
      )) &&
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
