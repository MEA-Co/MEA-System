'use client';
import { useId, useLayoutEffect, useRef } from 'react';

import { Input } from '@/components/ui/input';

import {
  choiceAnswerId,
  choiceAnswers,
  encodeChoiceAnswers,
  encodeScaleAnswer,
  scaleAnswer,
  scaleConfig,
  scaleLabel,
} from '../lib/question-types';
import type { Question } from '../lib/types';

import { questionnaireStyles } from './questionnaire-styles';

export function QuestionChoiceInput({
  question,
  value = '',
  onChange,
  disabled = false,
  previewVariant = 'questionnaire',
  onScaleLabelChange,
  scaleLabelEditingDisabled = false,
}: {
  question: Question;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  previewVariant?: 'editor' | 'questionnaire';
  onScaleLabelChange?: (key: 'low' | 'middle' | 'high', value: string) => void;
  scaleLabelEditingDisabled?: boolean;
}) {
  if (question.kind === 'scale') {
    const config = scaleConfig(question);
    const answer = scaleAnswer(value);
    return (
      <fieldset
        disabled={disabled && !onScaleLabelChange}
        className="min-w-0 space-y-4 py-2"
      >
        <legend
          className={
            onScaleLabelChange
              ? 'sr-only'
              : 'mb-2 text-xs text-muted-foreground'
          }
        >
          {onScaleLabelChange
            ? '척도 라벨 편집'
            : disabled
              ? `${config.max}점 척도`
              : '해당하는 점수를 선택해 주세요.'}
        </legend>
        <div className="overflow-x-auto">
          <div
            className="relative grid"
            style={{
              minWidth: `${Math.max(onScaleLabelChange ? 420 : 360, config.max * 64)}px`,
              gridTemplateColumns: `repeat(${config.max}, minmax(0, 1fr))`,
            }}
          >
            <div
              aria-hidden="true"
              className="absolute top-5 h-0.5 -translate-y-1/2 bg-border"
              style={{
                left: `${50 / config.max}%`,
                right: `${50 / config.max}%`,
              }}
            />
            {Array.from({ length: config.max }, (_, index) => index + 1).map(
              (number) => {
                const score = String(number);
                const label = scaleLabel(config, number);
                const labelKey =
                  number === 1
                    ? 'low'
                    : number === config.max
                      ? 'high'
                      : config.max % 2 === 1 && number === (config.max + 1) / 2
                        ? 'middle'
                        : null;
                return (
                  <div
                    key={score}
                    className="relative flex min-w-0 flex-col items-center px-1 text-center"
                  >
                    <label
                      className={`flex flex-col items-center ${disabled ? '' : 'cursor-pointer'}`}
                    >
                      <input
                        type="radio"
                        name={`choice-${question.id}`}
                        value={score}
                        checked={answer.score === number}
                        disabled={disabled}
                        onChange={() =>
                          onChange?.(
                            encodeScaleAnswer(
                              { score: number, text: answer.text },
                              config.allowText,
                            ),
                          )
                        }
                        className="peer sr-only"
                        aria-label={
                          label ? `${score}점 · ${label}` : `${score}점`
                        }
                      />
                      <span className="flex h-10 items-center justify-center peer-focus-visible:rounded-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                        <span
                          className={`relative size-5 rounded-full border-2 transition-colors ${answer.score === number ? 'border-blue-600 bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-950' : 'border-muted-foreground/40 bg-background'}`}
                        />
                      </span>
                      <span className="mt-1 text-sm font-medium">
                        {score}점
                      </span>
                    </label>
                    {labelKey && onScaleLabelChange ? (
                      <Input
                        aria-label={`${score}점 라벨`}
                        value={label}
                        maxLength={500}
                        disabled={scaleLabelEditingDisabled}
                        onChange={(event) =>
                          onScaleLabelChange(labelKey, event.target.value)
                        }
                        className={`mt-1 h-8 w-[140px] shrink-0 px-2 text-center text-xs ${questionnaireStyles.input} ${number === 1 ? 'self-start' : number === config.max ? 'self-end' : 'self-center'}`}
                      />
                    ) : (
                      <span className="mt-1 min-h-4 text-[11px] leading-relaxed break-keep text-muted-foreground sm:text-xs">
                        {label}
                      </span>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </div>
        {config.allowText && (
          <ScaleTextInput
            value={answer.text}
            disabled={disabled}
            authorPreview={disabled && previewVariant === 'editor'}
            scoreSelected={answer.score !== null}
            onChange={(text) =>
              onChange?.(encodeScaleAnswer({ score: answer.score, text }, true))
            }
          />
        )}
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

function ScaleTextInput({
  value,
  disabled,
  authorPreview,
  scoreSelected,
  onChange,
}: {
  value: string;
  disabled: boolean;
  authorPreview: boolean;
  scoreSelected: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [value]);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="sr-only">
        추가 서술 답변
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={1}
        maxLength={5000}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || !scoreSelected}
        placeholder={
          authorPreview
            ? '응답자가 답변을 입력하는 공간입니다.'
            : scoreSelected || disabled
              ? '답변을 입력해 주세요'
              : '먼저 점수를 선택해 주세요'
        }
        className={`block min-h-10 w-full resize-none overflow-hidden rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-neutral-500 dark:placeholder:text-neutral-400 ${authorPreview ? 'border border-dashed border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900' : 'border-0 bg-neutral-100 dark:bg-neutral-800'}`}
      />
    </div>
  );
}
