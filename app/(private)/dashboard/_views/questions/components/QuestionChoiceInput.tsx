'use client';

import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
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

import { questionStyles } from './question-styles';

export function QuestionChoiceInput({
  question,
  value = '',
  onChange,
  disabled = false,
  onScaleLabelChange,
  scaleLabelEditingDisabled = false,
}: {
  question: Question;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
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
                              false,
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
                        className={`mt-1 h-8 w-35 shrink-0 px-2 text-center text-xs ${questionStyles.input} ${number === 1 ? 'self-start' : number === config.max ? 'self-end' : 'self-center'}`}
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
    const answer = choice.isOther
      ? {
          id: choice.id,
          text: '',
          ...(multiple ? { entryId: crypto.randomUUID() } : {}),
        }
      : choice.id;
    if (!multiple) {
      onChange(encodeChoiceAnswerValue([answer], false, false, ''));
      return;
    }
    const next = checked
      ? [...answers, answer]
      : answers.filter((item) => choiceAnswerId(item) !== choice.id);
    const ordered = choices.flatMap((option) =>
      next.filter((item) => choiceAnswerId(item) === option.id),
    );
    onChange(encodeChoiceAnswerValue(ordered, true, false, ''));
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
                chipStyle ? (showOther ? 'contents' : 'min-w-0') : 'space-y-2'
              }
            >
              {!showOther && (
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
                  <span
                    className={
                      chipStyle ? 'min-w-0 wrap-break-word' : undefined
                    }
                  >
                    {choice.isOther
                      ? directInputLabel
                      : choice.label || `선택지 ${index + 1}`}
                  </span>
                </label>
              )}
              {showOther && (
                <div className={chipStyle ? 'contents' : 'space-y-2'}>
                  {answers.flatMap((answer, answerIndex) => {
                    if (typeof answer === 'string' || answer.id !== choice.id)
                      return [];
                    return [
                      <div
                        key={answer.entryId ?? choice.id}
                        className={`flex max-w-full items-center gap-2 border border-blue-500 bg-blue-50 text-blue-800 focus-within:ring-2 focus-within:ring-blue-400/40 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200 ${chipStyle ? 'inline-flex rounded-full py-1 pr-1 pl-4' : 'w-full rounded-lg px-4 py-2'}`}
                      >
                        <Input
                          aria-label={`${directInputLabel} 답변 ${answers.slice(0, answerIndex + 1).filter((item) => choiceAnswerId(item) === choice.id).length}`}
                          placeholder="직접 입력"
                          className={`h-8 min-w-0 border-0 bg-transparent px-0 text-sm text-inherit shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent ${chipStyle ? 'flex-none' : 'flex-1'}`}
                          style={
                            chipStyle
                              ? {
                                  width: `${Math.min(40, Math.max(10, Array.from(answer.text).reduce((length, char) => length + (char.charCodeAt(0) > 255 ? 2 : 1), 0) + 2))}ch`,
                                  maxWidth: 'calc(100% - 2.5rem)',
                                }
                              : undefined
                          }
                          maxLength={5000}
                          value={answer.text}
                          onChange={(event) =>
                            onChange?.(
                              encodeChoiceAnswerValue(
                                answers.map((item, index) =>
                                  index === answerIndex
                                    ? { ...answer, text: event.target.value }
                                    : item,
                                ),
                                multiple,
                                false,
                                '',
                              ),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 rounded-full text-inherit hover:bg-blue-100 dark:hover:bg-blue-900"
                          aria-label={`${directInputLabel} 답변 ${answers.slice(0, answerIndex + 1).filter((item) => choiceAnswerId(item) === choice.id).length} 삭제`}
                          onClick={() =>
                            onChange?.(
                              encodeChoiceAnswerValue(
                                answers.filter(
                                  (_, index) => index !== answerIndex,
                                ),
                                multiple,
                                false,
                                '',
                              ),
                            )
                          }
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </div>,
                    ];
                  })}
                  {multiple && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={`border border-dashed border-neutral-300 text-muted-foreground dark:border-neutral-600 ${chipStyle ? 'h-10 rounded-full px-4' : 'h-12 w-full justify-start rounded-lg px-4'}`}
                      onClick={() => {
                        const next = [
                          ...answers,
                          {
                            id: choice.id,
                            text: '',
                            entryId: crypto.randomUUID(),
                          },
                        ];
                        onChange?.(
                          encodeChoiceAnswerValue(
                            choices.flatMap((option) =>
                              next.filter(
                                (item) => choiceAnswerId(item) === option.id,
                              ),
                            ),
                            true,
                            false,
                            '',
                          ),
                        );
                      }}
                    >
                      <Plus aria-hidden="true" /> 직접 입력 답변 추가
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
