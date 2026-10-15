'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import {
  flowRowLabel,
  isCustomFlowRow,
  MAX_FLOW_ROWS,
} from '../../lib/flow-rows';
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
  onInsertFlow?: (after: number) => number | undefined;
  onFlowLabelChange?: (id: number, label: string) => void;
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
  onInsertFlow,
  onFlowLabelChange,
}: QuestionGridInputProps) {
  const gridId = useId();
  const gridRegion = useRef<HTMLDivElement>(null);
  const removalOpener = useRef<HTMLElement>(null);
  const cancelRemoval = useRef<HTMLButtonElement>(null);
  const flowLabelInputs = useRef(new Map<number, HTMLInputElement>());
  const pendingFlowFocus = useRef<number | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const editable = !disabled && !waiting;
  const firstColumnWidth = transposed ? 160 : 112;
  const columnCount = transposed ? rows.length : document.fields.length;
  const insertionWidth = 48;
  const insertionAfterRows = new Map<number, PreviewAnswerRow>();
  if (transposed && editable && onInsertFlow && rows.length < MAX_FLOW_ROWS) {
    rows.forEach((row, index) => {
      if (
        isCustomFlowRow(row) ||
        row.flowIndex === undefined ||
        row.flowIndex > (document.maxRows ?? 1) ||
        !document.flowInsertAfter?.includes(row.flowIndex)
      )
        return;
      let last = index;
      while (rows[last + 1]?.flowAfter === row.flowIndex) last++;
      insertionAfterRows.set(rows[last].id, row);
    });
  }
  const cellClass = 'border-r border-b p-2 align-top';
  const headerClass =
    'border-r border-b px-3 py-3 text-left align-top font-medium whitespace-normal [overflow-wrap:anywhere] last:border-r-0';

  useEffect(() => {
    if (!editable) {
      pendingFlowFocus.current = null;
      return;
    }
    if (pendingFlowFocus.current === null) return;
    const input = flowLabelInputs.current.get(pendingFlowFocus.current);
    if (!input) return;
    input.focus();
    input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    pendingFlowFocus.current = null;
  }, [rows, editable]);

  function rowLabel(index: number) {
    if (transposed) return flowRowLabel(rows[index], document.rowLabels);
    return document.rowLabels?.[index]?.trim() || String(index + 1);
  }

  function fieldLabel(index: number) {
    return document.fields[index].label || `답변 ${index + 1}`;
  }

  function requestRemoval(
    row: PreviewAnswerRow,
    index: number,
    opener: HTMLElement,
  ) {
    if (!canRemoveRow(row)) return;
    const hasInput =
      !!row.label?.trim() ||
      document.fields.some((field) => {
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

  function canRemoveRow(row: PreviewAnswerRow) {
    return editable && canRemove && (!transposed || isCustomFlowRow(row));
  }

  function removeButton(row: PreviewAnswerRow, index: number) {
    if (!canRemoveRow(row)) return null;
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
        className={`${cellClass} ${insertionAfterRows.has(row.id) ? '' : 'last:border-r-0'} ${!transposed && field.required === false ? 'bg-slate-50/60 dark:bg-slate-950/20' : 'bg-background'}`}
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

  function flowHeader(row: PreviewAnswerRow, rowIndex: number) {
    const insertionAnchor = insertionAfterRows.get(row.id);
    return (
      <Fragment key={row.id}>
        <th
          id={`${gridId}-row-${row.id}`}
          scope="col"
          className={`${headerClass} sticky top-0 z-20 bg-muted`}
        >
          <div className="flex items-start justify-between gap-2">
            {isCustomFlowRow(row) && editable && onFlowLabelChange ? (
              <Input
                ref={(input) => {
                  if (input) flowLabelInputs.current.set(row.id, input);
                  else flowLabelInputs.current.delete(row.id);
                }}
                id={`${gridId}-flow-label-${row.id}`}
                value={row.label ?? ''}
                maxLength={100}
                placeholder="시기 이름"
                aria-label={`${document.rowLabels?.[(row.flowAfter ?? 1) - 1]?.trim() || `시기 ${row.flowAfter}`} 뒤 추가 시기 ${rows.filter((item) => item.flowAfter === row.flowAfter).findIndex((item) => item.id === row.id) + 1} 이름`}
                className="h-8 min-w-0 flex-1 rounded-lg text-sm"
                onChange={(event) =>
                  onFlowLabelChange(row.id, event.target.value)
                }
              />
            ) : (
              <span>{rowLabel(rowIndex)}</span>
            )}
            {removeButton(row, rowIndex)}
          </div>
        </th>
        {insertionAnchor && (
          <td
            rowSpan={document.fields.length + 1}
            className="relative border-r border-b bg-slate-100/80 p-0 align-middle last:border-r-0 dark:bg-slate-900/70"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute inset-0 size-full rounded-none p-0 text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 focus-visible:ring-inset dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={`${flowRowLabel(insertionAnchor, document.rowLabels)} 뒤 시기 추가`}
              onClick={() => {
                const id = onInsertFlow?.(insertionAnchor.flowIndex!);
                if (id !== undefined) pendingFlowFocus.current = id;
              }}
            >
              <Plus aria-hidden="true" />
            </Button>
          </td>
        )}
      </Fragment>
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
          <div className="overflow-hidden rounded-xl border">
            <div
              ref={gridRegion}
              role="region"
              aria-label={`${document.title || '질문'} ${transposed ? '흐름표' : '표'}`}
              tabIndex={0}
              className="max-h-[70dvh] overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <table
                className="w-full table-fixed border-separate border-spacing-0 text-sm"
                style={{
                  minWidth:
                    firstColumnWidth +
                    columnCount * 240 +
                    insertionAfterRows.size * insertionWidth,
                }}
              >
                <caption className="sr-only">
                  {document.title || '질문'} ·{' '}
                  {transposed ? '시기별 답변 입력' : '행별 답변 입력'}
                </caption>
                <colgroup>
                  <col style={{ width: firstColumnWidth }} />
                  {transposed
                    ? rows.map((row) => (
                        <Fragment key={row.id}>
                          <col style={{ width: 240 }} />
                          {insertionAfterRows.has(row.id) && (
                            <col style={{ width: insertionWidth }} />
                          )}
                        </Fragment>
                      ))
                    : document.fields.map((field) => (
                        <col key={field.id} style={{ width: 240 }} />
                      ))}
                </colgroup>
                {!transposed && (
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th
                        scope="col"
                        className={`${headerClass} sticky left-0 z-30 bg-muted`}
                      >
                        번호
                      </th>
                      {document.fields.map((field, fieldIndex) => (
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
                )}
                <tbody>
                  {/* The flow header shares this row group so each + cell spans the whole table. */}
                  {transposed && (
                    <tr>
                      <th
                        scope="col"
                        className={`${headerClass} sticky top-0 left-0 z-30 bg-muted`}
                      >
                        항목
                      </th>
                      {rows.map(flowHeader)}
                    </tr>
                  )}
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
            {!transposed && editable && canAdd && (
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full rounded-none border-t bg-background text-muted-foreground"
                onClick={onAdd}
              >
                <Plus aria-hidden="true" /> 항목 추가
              </Button>
            )}
          </div>
          {(disabled || transposed) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {(disabled || transposed) && (
                <p className="text-xs text-muted-foreground">
                  {disabled
                    ? '가로로 스크롤해 모든 항목을 확인할 수 있어요.'
                    : '기억나는 칸만 입력해주세요.'}
                </p>
              )}
              {transposed && editable && canAdd && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={onAdd}
                >
                  <Plus aria-hidden="true" />
                  시기 추가
                </Button>
              )}
            </div>
          )}
        </>
      )}
      <Dialog
        open={
          pendingRemoval !== null &&
          rows.some((row) => row.id === pendingRemoval.id && canRemoveRow(row))
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
                  rows.some(
                    (row) => row.id === pendingRemoval.id && canRemoveRow(row),
                  )
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
