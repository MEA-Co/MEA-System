'use client';

import { useState } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { supportsChoiceCondition } from '../lib/choice-condition';
import {
  type QuestionBlockClause,
  type QuestionBlockDocument,
  type QuestionBlockRow,
  questionName,
} from '../lib/question-blocks';

function ConditionSelect({
  label,
  value,
  placeholder,
  options,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || null}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger
        aria-label={label}
        title={options.find((option) => option.value === value)?.label}
        className="h-10 max-w-[min(20rem,100%)] min-w-36 rounded-xl border-0 bg-neutral-100 shadow-none dark:bg-neutral-800"
      >
        <SelectValue placeholder={placeholder} className="min-w-0">
          <span className="truncate">
            {options.find((option) => option.value === value)?.label ??
              placeholder}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className="w-max min-w-(--anchor-width) max-w-[min(24rem,calc(100vw-2rem),var(--available-width))]"
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            title={option.label}
            className="[&>div]:min-w-0 [&>div]:shrink [&>div]:overflow-hidden"
          >
            <span className="block min-w-0 flex-1 truncate">
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function QuestionConditionEditor({
  questions,
  document,
  onChange,
}: {
  questions: QuestionBlockRow[];
  document: QuestionBlockDocument;
  onChange: (patch: Partial<QuestionBlockDocument>) => void;
}) {
  const [pendingQuestionId, setPendingQuestionId] = useState('');
  const [pendingFieldId, setPendingFieldId] = useState('all');
  const clause = document.condition?.clauses[0];
  const questionId = clause?.blockId ?? pendingQuestionId;
  const fieldId = clause ? (clause.fieldId ?? 'all') : pendingFieldId;
  const selectedQuestion = questions.find(
    (question) => question.id === questionId,
  );
  const selectedField = selectedQuestion?.fields.find(
    (field) => field.id === fieldId,
  );
  const canChoose = !!selectedField && supportsChoiceCondition(selectedField);
  const condition =
    clause?.op === 'equals' || clause?.op === 'includes'
      ? 'choice'
      : (clause?.op ?? '');
  const referencing = document.rowMode === 'reference';
  const unavailable = questions.length === 0;

  function applyClause(next: QuestionBlockClause | null) {
    onChange({
      condition: next ? { mode: 'all', clauses: [next] } : null,
      afterBlockId: null,
      ...(referencing
        ? { rowMode: next ? 'reference' : 'single', maxRows: null }
        : {}),
      sourceBlockId: referencing && next ? next.blockId : null,
      sourceFieldId: null,
    });
  }
  function answered(target = questionId, field = fieldId): QuestionBlockClause {
    return {
      blockId: target,
      op: 'answered',
      ...(field !== 'all' ? { fieldId: field } : {}),
    };
  }

  return (
    <div className="space-y-2">
      <fieldset
        disabled={unavailable}
        aria-label="질문 조건 설정"
        className="min-w-0 space-y-4 rounded-2xl border bg-background p-5 disabled:cursor-not-allowed disabled:opacity-50 md:p-6"
      >
        <h3 className="font-semibold">조건</h3>
        <div className="flex flex-wrap items-center gap-2">
          <ConditionSelect
            label="조건 대상 질문"
            value={questionId}
            placeholder="질문 선택"
            disabled={unavailable}
            options={[
              { value: 'none', label: '조건 없음' },
              ...questions.map((question) => ({
                value: question.id,
                label: questionName(question),
              })),
            ]}
            onChange={(target) => {
              setPendingQuestionId(target === 'none' ? '' : target);
              setPendingFieldId('all');
              if (target === 'none') applyClause(null);
              else if (clause) applyClause(answered(target, 'all'));
            }}
          />
          <span className="text-sm">의</span>
          <ConditionSelect
            label="조건 답변 열"
            value={selectedQuestion ? fieldId : ''}
            placeholder="열 선택"
            disabled={!selectedQuestion || unavailable}
            options={[
              { value: 'all', label: '모든 열' },
              ...(selectedQuestion?.fields ?? []).map((field) => ({
                value: field.id,
                label: field.label,
              })),
            ]}
            onChange={(next) => {
              setPendingFieldId(next);
              if (clause) applyClause(answered(questionId, next));
            }}
          />
          <span className="text-sm">
            {condition === 'choice' && canChoose ? '에서' : '에'}
          </span>
          {condition === 'choice' && canChoose && clause && (
            <ConditionSelect
              label="조건 선택지"
              value={typeof clause.value === 'string' ? clause.value : ''}
              placeholder="선택지 선택"
              disabled={unavailable}
              options={(selectedField.options ?? []).map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              onChange={(value) => applyClause({ ...clause, value })}
            />
          )}
          {condition === 'choice' && canChoose && (
            <span className="text-sm">항목을</span>
          )}
          <ConditionSelect
            label="질문 조건"
            value={condition === 'choice' && !canChoose ? '' : condition}
            placeholder="조건 선택"
            disabled={
              !selectedQuestion ||
              (fieldId !== 'all' && !selectedField) ||
              unavailable
            }
            options={[
              { value: 'answered', label: '응답했을 때' },
              ...(canChoose ? [{ value: 'choice', label: '선택했을 때' }] : []),
            ]}
            onChange={(value) => {
              if (value === 'answered') applyClause(answered());
              else if (canChoose)
                applyClause({
                  blockId: questionId,
                  fieldId: selectedField.id,
                  op: selectedField.kind === 'multiple' ? 'includes' : 'equals',
                });
            }}
          />
        </div>
        {clause &&
          selectedQuestion &&
          (condition === 'answered' ||
            (condition === 'choice' && canChoose)) && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="reference-condition-answers">
                  앞선 질문의 응답 참조
                </Label>
                <Switch
                  id="reference-condition-answers"
                  disabled={unavailable}
                  checked={referencing}
                  onCheckedChange={(checked) =>
                    onChange({
                      rowMode: checked ? 'reference' : 'single',
                      maxRows: null,
                      sourceBlockId: checked ? questionId : null,
                      sourceFieldId: null,
                      afterBlockId: null,
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                참조하면 위 조건에 맞는 응답 항목만 가져와 반복합니다.
              </p>
            </div>
          )}
      </fieldset>
      {unavailable && (
        <p className="px-1 text-xs text-muted-foreground">
          선택할 다른 질문이 없어요. 먼저 질문을 만들어 주세요.
        </p>
      )}
    </div>
  );
}
