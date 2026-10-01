'use client';

import { Plus, Table2, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { careerFlowPlaceholder } from '../../lib/career-flow-placeholders';
import type {
  QuestionBlockDocument,
  QuestionBlockField,
} from '../../lib/question-blocks';
import type { PreviewAnswerRow } from '../../lib/reference-rows';

import { RichTextContent } from './RichTextContent';

export function QuestionAnswerTable({
  document,
  rows,
  waiting,
  disabled,
  renderField,
  summary,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}: {
  document: QuestionBlockDocument;
  rows: PreviewAnswerRow[];
  waiting: boolean;
  disabled: boolean;
  renderField: (
    row: PreviewAnswerRow,
    field: QuestionBlockField,
    index: number,
    placeholder?: string,
  ) => ReactNode;
  summary: (field: QuestionBlockField, value: string) => string;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const answered = rows.reduce(
    (total, row) =>
      total +
      document.fields.filter(
        (field) => !!summary(field, row.answers[field.id] ?? ''),
      ).length,
    0,
  );

  return (
    <Dialog
      open={open && !waiting}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setActiveCell(null);
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <DialogTrigger
          render={<Button type="button" variant="outline" disabled={waiting} />}
        >
          <Table2 aria-hidden="true" />
          {disabled ? '답변 보기' : '답변하기'}
        </DialogTrigger>
      </div>
      <DialogContent className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-4 rounded-2xl p-4 sm:max-w-none sm:p-6">
        <div className="flex shrink-0 flex-col gap-3 pr-10 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <DialogHeader className="min-w-0">
            <DialogTitle>{document.title || '진로 흐름'}</DialogTitle>
            <DialogDescription>
              표를 좌우로 스크롤하고 답변할 칸을 눌러 입력하세요. 닫아도 입력
              내용은 유지됩니다.{' '}
              <span className="inline-block text-blue-500 dark:text-blue-300">
                파란 글씨는 답변 예시입니다.
              </span>
            </DialogDescription>
          </DialogHeader>
          <aside className="max-w-full self-end rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 lg:shrink-0 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <p className="font-medium">탐구활동 참조가 권장되는 질문입니다.</p>
            <p className="mt-1">
              텍스트 입력 시 &apos;@탐구활동&apos;을 입력하여 탐구활동을
              언급해주세요.
            </p>
          </aside>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
          <table
            className="w-full table-fixed border-separate border-spacing-0 text-left text-sm"
            style={{ minWidth: 240 + document.fields.length * 280 }}
          >
            <caption className="sr-only">
              {document.title} 행별·열별 답변 입력
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky top-0 left-0 z-30 w-60 border-r border-b bg-muted p-4"
                >
                  항목
                </th>
                {document.fields.map((field, index) => (
                  <th
                    key={field.id}
                    scope="col"
                    className="sticky top-0 z-20 w-70 border-r border-b bg-muted p-4 whitespace-normal [overflow-wrap:anywhere]"
                  >
                    {field.label || `답변 ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const label =
                  document.rowLabels?.[rowIndex]?.trim() ||
                  String(rowIndex + 1);
                return (
                  <tr key={row.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-b bg-background p-4 align-top font-medium [overflow-wrap:anywhere]"
                    >
                      {label}
                      {canRemove && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={disabled}
                          aria-label={`${label} 삭제`}
                          onClick={() => onRemove(row.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </th>
                    {document.fields.map((field, fieldIndex) => {
                      const key = `${row.id}:${field.id}`;
                      const value = row.answers[field.id] ?? '';
                      const text = summary(field, value);
                      const placeholder =
                        !disabled && field.kind === 'text'
                          ? careerFlowPlaceholder(document.id, label, field.id)
                          : '';
                      const hint =
                        placeholder && !text ? (
                          <span className="block whitespace-pre-wrap text-blue-400 [overflow-wrap:anywhere] dark:text-blue-300">
                            <span className="sr-only">답변 예시: </span>
                            {placeholder}
                          </span>
                        ) : null;
                      return (
                        <td
                          key={field.id}
                          className="border-r border-b p-3 align-top"
                        >
                          {activeCell === key && !disabled ? (
                            renderField(
                              row,
                              field,
                              fieldIndex,
                              placeholder || undefined,
                            )
                          ) : (
                            <button
                              type="button"
                              disabled={disabled}
                              className="min-h-32 w-full rounded-lg p-2 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
                              aria-label={`${label} · ${field.label || `답변 ${fieldIndex + 1}`} 답변 입력`}
                              onClick={() => setActiveCell(key)}
                            >
                              {text ? (
                                field.kind === 'text' ? (
                                  <RichTextContent value={value} />
                                ) : (
                                  <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                                    {text}
                                  </span>
                                )
                              ) : hint ? (
                                hint
                              ) : (
                                <span className="text-muted-foreground">
                                  {disabled ? '미입력' : '눌러서 입력'}
                                </span>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {answered} / {rows.length * document.fields.length}칸 작성
          </span>
          <div className="flex gap-2">
            {canAdd && (
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={onAdd}
              >
                <Plus />
                항목 추가
              </Button>
            )}
            <DialogClose render={<Button type="button" />}>닫기</DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
