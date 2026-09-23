'use client';

import { Trash2 } from 'lucide-react';

import { questionStyles } from '@/app/(private)/dashboard/_views/questions/components/question-styles';
import { QuestionTypeEditor } from '@/app/(private)/dashboard/_views/questions/components/QuestionTypeEditor';
import type { Question } from '@/app/(private)/dashboard/_views/questions/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { questionFromField } from '../lib/field-question';
import type { QuestionBlockField } from '../lib/question-blocks';

function asField(
  field: QuestionBlockField,
  question: Question,
): QuestionBlockField {
  const kind = question.kind ?? 'text';
  return {
    id: field.id,
    label: field.label,
    kind,
    options:
      kind === 'single' || kind === 'multiple' ? question.options : undefined,
    choiceStyle:
      kind === 'single' || kind === 'multiple'
        ? question.choiceStyle
        : undefined,
    choiceAllowText:
      kind === 'single' || kind === 'multiple'
        ? question.choiceAllowText
        : undefined,
    scaleMax: kind === 'scale' ? (question.scaleConfig?.max ?? 5) : undefined,
    scaleConfig: kind === 'scale' ? question.scaleConfig : undefined,
  };
}

export function QuestionBlockFieldEditor({
  field,
  index,
  fieldCount,
  onChange,
  onRemove,
}: {
  field: QuestionBlockField;
  index: number;
  fieldCount: number;
  onChange: (value: QuestionBlockField) => void;
  onRemove: () => void;
}) {
  const question = questionFromField(field);
  const changeQuestion = (updated: Question) =>
    onChange(asField(field, updated));

  return (
    <div className={questionStyles.questionCard}>
      <div className="flex items-center justify-between gap-3">
        <QuestionTypeEditor
          part="header"
          question={question}
          onChange={changeQuestion}
          disabled={false}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`답변 열 ${index + 1} 삭제`}
          disabled={fieldCount === 1}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`answer-label-${field.id}`}>열 제목</Label>
        <Input
          id={`answer-label-${field.id}`}
          value={field.label}
          maxLength={100}
          placeholder={`답변 ${index + 1}`}
          className={questionStyles.input}
          onChange={(event) =>
            onChange({ ...asField(field, question), label: event.target.value })
          }
        />
      </div>
      <QuestionTypeEditor
        question={question}
        onChange={changeQuestion}
        disabled={false}
      />
    </div>
  );
}
