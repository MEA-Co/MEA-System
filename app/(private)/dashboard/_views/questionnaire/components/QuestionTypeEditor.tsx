'use client';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { QUESTION_TYPES, type QuestionKind } from '../lib/question-types';
import type { Question } from '../lib/types';

import { QuestionChoiceInput } from './QuestionChoiceInput';
import { questionnaireStyles } from './questionnaire-styles';
import { QuestionTextAnswerPreview } from './QuestionTextAnswerPreview';

export function QuestionTypeEditor({
  question,
  onChange,
  disabled,
  part = 'settings',
}: {
  question: Question;
  onChange: (value: Question) => void;
  disabled: boolean;
  part?: 'header' | 'settings';
}) {
  const kind = question.kind ?? 'text';
  const options = question.options ?? [];
  return (
    <div className="space-y-3">
      {part === 'header' && (
        <div className="flex flex-wrap items-center gap-3">
          <label id={`kind-${question.id}`} className="text-sm font-medium">
            질문 유형
          </label>
          <Select
            value={kind}
            onValueChange={(value) => {
              if (!value) return;
              const next = value as QuestionKind;
              onChange({
                ...question,
                kind: next,
                options:
                  next === 'single' || next === 'multiple'
                    ? options.length
                      ? options
                      : [
                          { id: crypto.randomUUID(), label: '' },
                          { id: crypto.randomUUID(), label: '' },
                        ]
                    : [],
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger aria-labelledby={`kind-${question.id}`}>
              <SelectValue>
                {QUESTION_TYPES.find((type) => type.value === kind)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {part === 'settings' && kind === 'text' && <QuestionTextAnswerPreview />}
      {part === 'settings' && kind === 'scale' && (
        <QuestionChoiceInput question={question} disabled />
      )}
      {part === 'settings' && (kind === 'single' || kind === 'multiple') && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {kind === 'single' ? '하나만' : '여러 개를'} 선택할 수 있어요.
            선택지는 2~20개까지 작성할 수 있어요.
          </p>
          {options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-4 shrink-0 border-2 border-muted-foreground/40 ${kind === 'single' ? 'rounded-full' : 'rounded-sm'}`}
              />
              <Input
                aria-label={`선택지 ${index + 1}`}
                placeholder={`선택지 ${index + 1}`}
                className={questionnaireStyles.input}
                value={option.label}
                maxLength={500}
                disabled={disabled || option.isOther}
                onChange={(event) =>
                  onChange({
                    ...question,
                    options: options.map((o) =>
                      o.id === option.id
                        ? { ...o, label: event.target.value }
                        : o,
                    ),
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`선택지 ${index + 1} 삭제`}
                disabled={disabled || (!option.isOther && options.length <= 2)}
                onClick={() =>
                  onChange({
                    ...question,
                    options: options.filter((o) => o.id !== option.id),
                  })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || options.length >= 20}
            onClick={() =>
              onChange({
                ...question,
                options: [...options, { id: crypto.randomUUID(), label: '' }],
              })
            }
          >
            <Plus />
            선택지 추가
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={
              disabled || options.length >= 20 || options.some((o) => o.isOther)
            }
            onClick={() =>
              onChange({
                ...question,
                options: [
                  ...options,
                  { id: crypto.randomUUID(), label: '기타', isOther: true },
                ],
              })
            }
          >
            <Plus />
            기타 추가
          </Button>
          {options.some((o) => o.isOther) && (
            <p className="text-xs text-muted-foreground">
              기타를 선택한 응답자는 내용을 직접 입력할 수 있어요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
