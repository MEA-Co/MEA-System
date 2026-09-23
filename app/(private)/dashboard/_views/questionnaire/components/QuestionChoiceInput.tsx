'use client';
import { Input } from '@/components/ui/input';

import {
  choiceAnswerId,
  choiceAnswers,
  encodeChoiceAnswers,
  SCALE_LABELS,
} from '../lib/question-types';
import type { Question } from '../lib/types';

import { questionnaireStyles } from './questionnaire-styles';

export function QuestionChoiceInput({
  question,
  value = '',
  onChange,
  disabled = false,
}: {
  question: Question;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  if (question.kind === 'scale') {
    return (
      <fieldset disabled={disabled} className="min-w-0 py-2">
        <legend className="mb-2 text-xs text-muted-foreground">
          {disabled ? '5점 척도' : '해당하는 점수를 선택해 주세요.'}
        </legend>
        <div className="relative grid grid-cols-5">
          <div
            aria-hidden="true"
            className="absolute inset-x-[10%] top-5 h-0.5 -translate-y-1/2 bg-border"
          />
          {SCALE_LABELS.map((label, index) => {
            const score = String(index + 1);
            return (
              <label
                key={score}
                className={`relative flex min-w-0 flex-col items-center px-1 text-center ${disabled ? '' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name={`choice-${question.id}`}
                  value={score}
                  checked={value === score}
                  onChange={() => onChange?.(score)}
                  className="peer sr-only"
                  aria-label={`${score}점 · ${label}`}
                />
                <span className="flex h-10 items-center justify-center peer-focus-visible:rounded-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                  <span
                    className={`relative size-5 rounded-full border-2 transition-colors ${value === score ? 'border-blue-600 bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-950' : 'border-muted-foreground/40 bg-background'}`}
                  />
                </span>
                <span className="mt-1 text-sm font-medium">{score}점</span>
                <span className="mt-1 text-[11px] leading-relaxed break-keep text-muted-foreground sm:text-xs">
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }
  const multiple = question.kind === 'multiple';
  const choices = question.options ?? [];
  const answers = choiceAnswers(value, multiple);
  const selected = answers.map(choiceAnswerId);
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-2 text-xs text-muted-foreground">
        {multiple
          ? '해당하는 항목을 모두 선택해 주세요.'
          : '하나를 선택해 주세요.'}
      </legend>
      {choices.map((choice, index) => (
        <div key={choice.id} className="space-y-2">
          <label
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-blue-400/40 ${disabled ? '' : 'cursor-pointer'} ${selected.includes(choice.id) ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40' : `border-neutral-200 bg-neutral-50/70 dark:border-neutral-700 dark:bg-neutral-900/40 ${disabled ? '' : 'hover:border-blue-300 hover:bg-blue-50/60 dark:hover:border-blue-700 dark:hover:bg-blue-950/30'}`}`}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={`choice-${question.id}`}
              value={choice.id}
              checked={selected.includes(choice.id)}
              className="mt-0.5 size-4 shrink-0 accent-blue-600"
              onChange={(event) => {
                if (!onChange) return;
                const answer = choice.isOther
                  ? { id: choice.id, text: '' }
                  : choice.id;
                if (!multiple) {
                  onChange(encodeChoiceAnswers([answer], false));
                  return;
                }
                const next = event.target.checked
                  ? [...answers, answer]
                  : answers.filter(
                      (item) => choiceAnswerId(item) !== choice.id,
                    );
                const ordered = choices.flatMap((option) =>
                  next.filter((item) => choiceAnswerId(item) === option.id),
                );
                onChange(encodeChoiceAnswers(ordered, true));
              }}
            />
            <span>{choice.label || `선택지 ${index + 1}`}</span>
          </label>
          {choice.isOther && (disabled || selected.includes(choice.id)) && (
            <Input
              aria-label="기타 답변"
              placeholder="기타 내용을 직접 입력해 주세요"
              className={questionnaireStyles.input}
              maxLength={5000}
              value={
                answers.flatMap((answer) =>
                  typeof answer !== 'string' && answer.id === choice.id
                    ? [answer.text]
                    : [],
                )[0] ?? ''
              }
              onChange={(event) =>
                onChange?.(
                  encodeChoiceAnswers(
                    answers.map((answer) =>
                      choiceAnswerId(answer) === choice.id
                        ? { id: choice.id, text: event.target.value }
                        : answer,
                    ),
                    multiple,
                  ),
                )
              }
            />
          )}
        </div>
      ))}
    </fieldset>
  );
}
