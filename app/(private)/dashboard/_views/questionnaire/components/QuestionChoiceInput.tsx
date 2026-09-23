'use client';
import { useId, useLayoutEffect, useRef } from 'react';

import { Input } from '@/components/ui/input';

import {
  choiceAnswerId,
  choiceAnswerValue,
  encodeChoiceAnswerValue,
  encodeScaleAnswer,
  orderedChoiceOptions,
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
          <QuestionOptionalTextInput
            value={answer.text}
            disabled={disabled}
            authorPreview={disabled && previewVariant === 'editor'}
            selectionMade={answer.score !== null}
            selectionPrompt="먼저 점수를 선택해 주세요"
            onChange={(text) =>
              onChange?.(encodeScaleAnswer({ score: answer.score, text }, true))
            }
          />
        )}
      </fieldset>
    );
  }
  const multiple = question.kind === 'multiple';
  const choices = orderedChoiceOptions(question.options ?? []);
  const directInputCount = choices.filter((choice) => choice.isOther).length;
  const parsed = choiceAnswerValue(value, multiple);
  const answers = parsed.choices;
  const selected = answers.map(choiceAnswerId);
  const chipStyle = question.choiceStyle === 'chip';
  function selectChoice(choice: (typeof choices)[number], checked: boolean) {
    if (!onChange) return;
    const answer = choice.isOther ? { id: choice.id, text: '' } : choice.id;
    if (!multiple) {
      onChange(
        encodeChoiceAnswerValue(
          [answer],
          false,
          !!question.choiceAllowText,
          parsed.text,
        ),
      );
      return;
    }
    const next = checked
      ? [...answers, answer]
      : answers.filter((item) => choiceAnswerId(item) !== choice.id);
    const ordered = choices.flatMap((option) =>
      next.filter((item) => choiceAnswerId(item) === option.id),
    );
    onChange(
      encodeChoiceAnswerValue(
        ordered,
        true,
        !!question.choiceAllowText,
        parsed.text,
      ),
    );
  }
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-2 text-xs text-muted-foreground">
        {multiple
          ? '해당하는 항목을 모두 선택해 주세요.'
          : '하나를 선택해 주세요.'}
      </legend>
      <div
        className={chipStyle ? 'flex flex-wrap items-start gap-2' : 'space-y-2'}
      >
        {choices.map((choice, index) => {
          const active = selected.includes(choice.id);
          const showOther = choice.isOther && active;
          const directInputLabel =
            directInputCount > 1
              ? `직접 입력 ${choices.slice(0, index + 1).filter((item) => item.isOther).length}`
              : '직접 입력';
          return (
            <div
              key={choice.id}
              className={
                chipStyle
                  ? showOther
                    ? 'flex w-full flex-wrap items-center gap-2'
                    : 'min-w-0'
                  : 'space-y-2'
              }
            >
              <label
                className={
                  choice.isOther
                    ? `${chipStyle ? 'inline-flex max-w-full rounded-full px-4 py-2' : 'flex rounded-lg px-4 py-3'} items-center gap-2 border border-dashed text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-400/40 ${disabled ? '' : 'cursor-pointer'} ${active ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200' : `border-neutral-300 bg-white text-neutral-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-300 ${disabled ? '' : 'hover:border-blue-400 hover:bg-blue-50/60 dark:hover:border-blue-600 dark:hover:bg-blue-950/30'}`}`
                    : chipStyle
                      ? `inline-flex max-w-full items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-400/40 ${disabled ? '' : 'cursor-pointer'} ${active ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200' : `border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 ${disabled ? '' : 'hover:border-blue-400 hover:bg-blue-50/60 dark:hover:border-blue-600 dark:hover:bg-blue-950/30'}`}`
                      : `flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-blue-400/40 ${disabled ? '' : 'cursor-pointer'} ${active ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40' : `border-neutral-200 bg-neutral-50/70 dark:border-neutral-700 dark:bg-neutral-900/40 ${disabled ? '' : 'hover:border-blue-300 hover:bg-blue-50/60 dark:hover:border-blue-700 dark:hover:bg-blue-950/30'}`}`
                }
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={`choice-${question.id}`}
                  value={choice.id}
                  checked={active}
                  className={
                    chipStyle || choice.isOther
                      ? 'peer sr-only'
                      : 'mt-0.5 size-4 shrink-0 accent-blue-600'
                  }
                  onChange={(event) =>
                    selectChoice(choice, event.target.checked)
                  }
                />
                {choice.isOther && <span aria-hidden="true">+</span>}
                <span className={chipStyle ? 'min-w-0 break-words' : undefined}>
                  {choice.isOther
                    ? directInputLabel
                    : choice.label || `선택지 ${index + 1}`}
                </span>
              </label>
              {showOther && (
                <Input
                  aria-label={`${directInputLabel} 답변`}
                  placeholder="내용을 입력해 주세요"
                  className={`${questionnaireStyles.input} ${chipStyle ? 'min-w-48 max-w-lg flex-1' : ''}`}
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
                      encodeChoiceAnswerValue(
                        answers.map((answer) =>
                          choiceAnswerId(answer) === choice.id
                            ? { id: choice.id, text: event.target.value }
                            : answer,
                        ),
                        multiple,
                        !!question.choiceAllowText,
                        parsed.text,
                      ),
                    )
                  }
                />
              )}
            </div>
          );
        })}
      </div>
      {question.choiceAllowText && (
        <QuestionOptionalTextInput
          value={parsed.text}
          disabled={disabled}
          authorPreview={disabled && previewVariant === 'editor'}
          selectionMade={answers.length > 0}
          selectionPrompt="먼저 선택지를 선택해 주세요"
          onChange={(text) =>
            onChange?.(encodeChoiceAnswerValue(answers, multiple, true, text))
          }
        />
      )}
    </fieldset>
  );
}

export function QuestionOptionalTextInput({
  value,
  disabled,
  authorPreview,
  selectionMade,
  selectionPrompt,
  onChange,
}: {
  value: string;
  disabled: boolean;
  authorPreview: boolean;
  selectionMade: boolean;
  selectionPrompt: string;
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
        disabled={disabled || !selectionMade}
        placeholder={
          authorPreview
            ? '응답자가 답변을 입력하는 공간입니다.'
            : selectionMade || disabled
              ? '답변을 입력해 주세요'
              : selectionPrompt
        }
        className={`block min-h-10 w-full resize-none overflow-hidden rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-neutral-500 dark:placeholder:text-neutral-400 ${authorPreview ? 'border border-dashed border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900' : 'border-0 bg-neutral-100 dark:bg-neutral-800'}`}
      />
    </div>
  );
}
