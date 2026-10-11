'use client';

import { Plus, X } from 'lucide-react';
import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  choiceAnswerId,
  choiceAnswerValue,
  encodeChoiceAnswerValue,
  orderedChoiceOptions,
  updateChoiceSelection,
} from '../../lib/question-types';
import type { Question } from '../../lib/types';

export function QuestionChoiceDropdownInput({
  question,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  question: Question;
  value: string;
  onChange?: (value: string) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const multiple = question.kind === 'multiple';
  const choices = orderedChoiceOptions(question.options ?? []);
  const answers = choiceAnswerValue(value, multiple).choices;
  const selected = [...new Set(answers.map(choiceAnswerId))];
  const directChoices = choices.filter((choice) => choice.isOther);
  function labelFor(choice: (typeof choices)[number]) {
    if (!choice.isOther) return choice.label;
    return directChoices.length > 1
      ? `직접 입력 ${directChoices.findIndex((item) => item.id === choice.id) + 1}`
      : '직접 입력';
  }
  const summary = choices
    .filter((choice) => selected.includes(choice.id))
    .map(labelFor)
    .join(', ');

  function save(next: typeof answers) {
    if (disabled) return;
    onChange?.(encodeChoiceAnswerValue(next, multiple, false, ''));
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-center gap-1">
        <Select
          multiple={multiple}
          value={multiple ? selected : (selected[0] ?? null)}
          disabled={disabled}
          items={choices.map((choice) => ({
            value: choice.id,
            label: labelFor(choice),
          }))}
          onValueChange={(next) => {
            if (disabled) return;
            const ids = Array.isArray(next)
              ? next
              : next === null
                ? []
                : [next];
            onChange?.(updateChoiceSelection(question, value, ids));
          }}
        >
          <SelectTrigger
            ref={trigger}
            aria-label={ariaLabel}
            title={summary || (multiple ? '여러 항목 선택' : '항목 선택')}
            className="w-full min-w-0 flex-1 rounded-lg"
          >
            <SelectValue className="min-w-0 truncate">
              {summary || (multiple ? '여러 항목 선택' : '항목 선택')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {choices.map((choice) => (
              <SelectItem
                key={choice.id}
                value={choice.id}
                label={labelFor(choice)}
                className="[&>span:first-child]:min-w-0 [&>span:first-child]:shrink [&>span:first-child]:whitespace-normal"
              >
                <span className="wrap-anywhere">{labelFor(choice)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled}
            aria-label={`${ariaLabel} 선택 지우기`}
            className="shrink-0 text-muted-foreground"
            onClick={() => {
              save([]);
              trigger.current?.focus();
            }}
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      {directChoices.map((choice) => {
        const entries = answers.flatMap((answer, index) =>
          typeof answer !== 'string' && answer.id === choice.id
            ? [{ answer, index }]
            : [],
        );
        if (!entries.length) return null;
        return (
          <div key={choice.id} className="min-w-0 space-y-2">
            {entries.map(({ answer, index }, entryIndex) => (
              <div
                key={answer.entryId ?? choice.id}
                className="flex min-w-0 items-center gap-1"
              >
                <Input
                  aria-label={`${ariaLabel} · ${labelFor(choice)} 답변 ${entryIndex + 1}`}
                  placeholder={labelFor(choice)}
                  value={answer.text}
                  maxLength={5000}
                  disabled={disabled}
                  className="min-w-0 flex-1"
                  onChange={(event) =>
                    save(
                      answers.map((item, answerIndex) =>
                        answerIndex === index
                          ? { ...answer, text: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                {multiple && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={disabled}
                    aria-label={`${ariaLabel} · ${labelFor(choice)} 답변 ${entryIndex + 1} 삭제`}
                    className="shrink-0 text-muted-foreground"
                    onClick={() => {
                      save(
                        answers.filter(
                          (_, answerIndex) => answerIndex !== index,
                        ),
                      );
                      trigger.current?.focus();
                    }}
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            {multiple && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="h-auto max-w-full justify-start px-2 py-1 text-xs whitespace-normal"
                aria-label={`${ariaLabel} · ${labelFor(choice)} 답변 추가`}
                onClick={() => {
                  const next = [
                    ...answers,
                    { id: choice.id, text: '', entryId: crypto.randomUUID() },
                  ];
                  save(
                    choices.flatMap((option) =>
                      next.filter((item) => choiceAnswerId(item) === option.id),
                    ),
                  );
                }}
              >
                <Plus aria-hidden="true" /> 직접 입력 답변 추가
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
