'use client';

import { Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type {
  QuestionBlockDocument,
  QuestionBlockField,
} from '../../lib/question-blocks';
import type { PreviewAnswerRow } from '../../lib/reference-rows';
import { richTextPlainText } from '../../lib/rich-text';

export type QuestionGridInputProps = {
  document: QuestionBlockDocument;
  rows: PreviewAnswerRow[];
  transposed: boolean;
  disabled: boolean;
  waiting: boolean;
  renderField: (
    row: PreviewAnswerRow,
    field: QuestionBlockField,
    index: number,
    placeholder?: string,
  ) => ReactNode;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: (id: number) => void;
};

export function QuestionGridInput({
  document,
  rows,
  transposed,
  disabled,
  waiting,
  renderField,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}: QuestionGridInputProps) {
  const gridId = useId();
  const gridRegion = useRef<HTMLDivElement>(null);
  const removalOpener = useRef<HTMLElement>(null);
  const cancelRemoval = useRef<HTMLButtonElement>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const editable = !disabled && !waiting;
  const firstColumnWidth = transposed ? 160 : 112;
  const columnCount = transposed ? rows.length : document.fields.length;
  const cellClass = 'border-r border-b p-2 align-top last:border-r-0';
  const headerClass =
    'border-r border-b px-3 py-3 text-left align-top font-medium whitespace-normal [overflow-wrap:anywhere] last:border-r-0';

  function rowLabel(index: number) {
    return (
      document.rowLabels?.[index]?.trim() ||
      (transposed ? `시기 ${index + 1}` : String(index + 1))
    );
  }

  function fieldLabel(index: number) {
    return document.fields[index].label || `답변 ${index + 1}`;
  }

  function requestRemoval(
    row: PreviewAnswerRow,
    index: number,
    opener: HTMLElement,
  ) {
    if (!editable || !canRemove) return;
    const hasInput = document.fields.some((field) => {
      const value = row.answers[field.id] ?? '';
      return !!(
        field.kind === 'text' ? richTextPlainText(value) : value
      ).trim();
    });
    if (hasInput) {
      removalOpener.current = opener;
      setPendingRemoval({ id: row.id, label: rowLabel(index) });
    } else {
      onRemove(row.id);
      gridRegion.current?.focus();
    }
  }

  function removeButton(row: PreviewAnswerRow, index: number) {
    if (!editable || !canRemove) return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`${rowLabel(index)} ${transposed ? '시기' : '행'} 삭제`}
        onClick={(event) => requestRemoval(row, index, event.currentTarget)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    );
  }

  function inputCell(row: PreviewAnswerRow, fieldIndex: number) {
    const field = document.fields[fieldIndex];
    return (
      <td
        key={transposed ? row.id : field.id}
        headers={`${gridId}-row-${row.id} ${gridId}-field-${field.id}`}
        className={`${cellClass} ${!transposed && field.required === false ? 'bg-slate-50/60 dark:bg-slate-950/20' : 'bg-background'}`}
      >
        <div className="min-w-0">
          {renderField(
            row,
            field,
            fieldIndex,
            `${fieldLabel(fieldIndex)} 입력`,
          )}
        </div>
      </td>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-3">
      {waiting ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          앞선 질문에 응답하면 표를 작성할 수 있어요.
        </p>
      ) : (
        <>
          <div
            ref={gridRegion}
            role="region"
            aria-label={`${document.title || '질문'} ${transposed ? '흐름표' : '표'}`}
            tabIndex={0}
            className="max-h-[70dvh] overflow-auto rounded-xl border outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table
              className="w-full table-fixed border-separate border-spacing-0 text-sm"
              style={{ minWidth: firstColumnWidth + columnCount * 240 }}
            >
              <caption className="sr-only">
                {document.title || '질문'} ·{' '}
                {transposed ? '시기별 답변 입력' : '행별 답변 입력'}
              </caption>
              <colgroup>
                <col style={{ width: firstColumnWidth }} />
                {Array.from({ length: columnCount }, (_, index) => (
                  <col key={index} style={{ width: 240 }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th
                    scope="col"
                    className={`${headerClass} sticky left-0 z-30 bg-muted`}
                  >
                    {transposed ? '항목' : '번호'}
                  </th>
                  {transposed
                    ? rows.map((row, rowIndex) => (
                        <th
                          key={row.id}
                          id={`${gridId}-row-${row.id}`}
                          scope="col"
                          className={`${headerClass} bg-muted`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span>{rowLabel(rowIndex)}</span>
                            {removeButton(row, rowIndex)}
                          </div>
                        </th>
                      ))
                    : document.fields.map((field, fieldIndex) => (
                        <th
                          key={field.id}
                          id={`${gridId}-field-${field.id}`}
                          scope="col"
                          className={`${headerClass} ${field.required === false ? 'bg-slate-100/70 text-slate-600 dark:bg-slate-900 dark:text-slate-300' : 'bg-muted'}`}
                        >
                          {fieldLabel(fieldIndex)}
                          {field.required === false && (
                            <span className="ml-2 inline-flex rounded-md bg-slate-200/60 px-1.5 py-0.5 text-xs font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              (선택)
                            </span>
                          )}
                        </th>
                      ))}
                </tr>
              </thead>
              <tbody>
                {transposed
                  ? document.fields.map((field, fieldIndex) => (
                      <tr key={field.id}>
                        <th
                          id={`${gridId}-field-${field.id}`}
                          scope="row"
                          className={`${headerClass} sticky left-0 z-10 bg-muted`}
                        >
                          {fieldLabel(fieldIndex)}
                        </th>
                        {rows.map((row) => inputCell(row, fieldIndex))}
                      </tr>
                    ))
                  : rows.map((row, rowIndex) => (
                      <tr key={row.id}>
                        <th
                          id={`${gridId}-row-${row.id}`}
                          scope="row"
                          className={`${headerClass} sticky left-0 z-10 bg-muted`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span>{rowLabel(rowIndex)}</span>
                            {removeButton(row, rowIndex)}
                          </div>
                        </th>
                        {document.fields.map((_, fieldIndex) =>
                          inputCell(row, fieldIndex),
                        )}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {disabled
                ? '가로로 스크롤해 모든 항목을 확인할 수 있어요.'
                : transposed
                  ? '기억나는 칸만 입력하세요. Tab 키로 다음 칸으로 이동할 수 있어요.'
                  : '각 칸에 바로 입력하세요. Tab 키로 다음 칸으로 이동할 수 있어요.'}
            </p>
            {editable && canAdd && (
              <Button type="button" variant="outline" size="sm" onClick={onAdd}>
                <Plus aria-hidden="true" />
                {transposed ? '시기 추가' : '행 추가'}
              </Button>
            )}
          </div>
        </>
      )}
      <Dialog
        open={
          pendingRemoval !== null &&
          editable &&
          canRemove &&
          rows.some((row) => row.id === pendingRemoval.id)
        }
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
      >
        <DialogContent
          initialFocus={cancelRemoval}
          finalFocus={() =>
            removalOpener.current?.isConnected
              ? removalOpener.current
              : gridRegion.current
          }
        >
          <DialogHeader>
            <DialogTitle>
              입력한 {transposed ? '시기를' : '행을'} 삭제할까요?
            </DialogTitle>
            <DialogDescription>
              {pendingRemoval?.label}에 작성한 모든 답변이 함께 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={cancelRemoval}
              type="button"
              variant="outline"
              onClick={() => setPendingRemoval(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (
                  pendingRemoval &&
                  editable &&
                  canRemove &&
                  rows.some((row) => row.id === pendingRemoval.id)
                )
                  onRemove(pendingRemoval.id);
                setPendingRemoval(null);
              }}
            >
              {transposed ? '시기 삭제' : '행 삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
