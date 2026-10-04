'use client';

import { Popover } from '@base-ui/react/popover';
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

export type QuestionAnswerTableProps = {
  triggerLabel?: string;
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
};

export function QuestionAnswerTable({
  triggerLabel,
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
}: QuestionAnswerTableProps) {
  const [open, setOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [addingGroup, setAddingGroup] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const startIds = [
    'f4689fea-ba91-400f-82be-f0b1dbf185db',
    '720f88bd-1ace-4b86-828f-5df7abbe0a10',
  ];
  const admissionId = 'e75649e4-82f5-4175-8c14-2298c522a45d';
  const hasAnswer = (field: QuestionBlockField) =>
    rows.some((row) => !!summary(field, row.answers[field.id] ?? ''));
  const groupFor = (field: QuestionBlockField) => {
    if (startIds.includes(field.id) || field.id === admissionId)
      return field.id;
    return (
      field.label.replace(/\s/g, '').match(/^고[123]-[12]/)?.[0] ?? field.label
    );
  };
  const groups = Array.from(new Set(document.fields.map(groupFor)));
  const columns: { key: string; group: string; field?: QuestionBlockField }[] =
    groups.flatMap((group) => {
      const fields = document.fields.filter(
        (field) => groupFor(field) === group,
      );
      const visible = fields.filter(
        (field) =>
          expanded.includes(field.id) ||
          startIds.includes(field.id) ||
          field.id === admissionId ||
          hasAnswer(field),
      );
      const result: {
        key: string;
        group: string;
        field?: QuestionBlockField;
      }[] = visible.map((field) => ({ key: field.id, group, field }));
      if (visible.length < fields.length)
        result.push({ key: `add-${group}`, group });
      return result;
    });
  const completed =
    Number(
      document.fields.some(
        (field) => startIds.includes(field.id) && hasAnswer(field),
      ),
    ) +
    Number(
      document.fields.some(
        (field) => field.id === admissionId && hasAnswer(field),
      ),
    );
  const answered = document.fields.filter(hasAnswer).length;

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
          {triggerLabel ?? (disabled ? '답변 보기' : '답변하기')}
        </DialogTrigger>
      </div>
      <DialogContent className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-4 rounded-2xl bg-neutral-100 p-4 sm:max-w-none sm:p-6 dark:bg-neutral-950">
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle>{document.title || '진로 흐름'}</DialogTitle>
          <DialogDescription>
            진로 희망이 처음 생긴 때 · 바뀐 때 · 확정된 때, 그리고 기억에 남는
            대응이 있었던 칸만 채워주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="shrink-0 rounded-2xl border bg-background p-4 text-sm leading-7">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <p>
              <strong>1　모든 칸을 채울 필요 없어요.</strong> 고교 입학 전과
              수시 원서 접수 시기는 꼭 작성해주세요.
            </p>
            <p>
              <strong>2　학기의 추가하기를 누르면</strong> 중간고사 전·중간기말
              사이·기말고사 후 중 필요한 시기를 고를 수 있어요.
            </p>
            <p>
              <strong>3　비워둔 칸은 ‘이전과 동일’</strong>로 봐요.
            </p>
            <p>
              <strong>4　‘해당 시’ 시기</strong>는 해당하는 경우에만
              추가해주세요.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 text-sm">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              필수 {completed}/2
            </span>
            <span className="rounded-full border bg-background px-3 py-2">
              작성한 시기 {answered}개
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              aria-pressed={showExamples}
              onClick={() => setShowExamples(!showExamples)}
            >
              {showExamples ? '작성 예시 숨기기' : '작성 예시 보기'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setExpanded(
                  expanded.length === document.fields.length
                    ? []
                    : document.fields.map((field) => field.id),
                )
              }
            >
              {expanded.length === document.fields.length
                ? '빈 시기 접기'
                : '모든 시기 펼치기'}
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
          <table
            className="w-full table-fixed border-separate border-spacing-0 text-left text-sm"
            style={{
              minWidth:
                240 +
                columns.reduce(
                  (width, column) => width + (column.field ? 280 : 116),
                  0,
                ),
            }}
          >
            <caption className="sr-only">
              {document.title} 행별·열별 답변 입력
            </caption>
            <colgroup>
              <col style={{ width: 240 }} />
              {columns.map((column) => (
                <col
                  key={column.key}
                  style={{ width: column.field ? 280 : 116 }}
                />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr>
                <th
                  className="sticky left-0 z-30 border-r border-b bg-muted"
                  aria-label="항목"
                />
                {columns.map((column, index) => {
                  const isStart =
                    column.field && startIds.includes(column.field.id);
                  if (
                    isStart &&
                    index > 0 &&
                    columns[index - 1].field &&
                    startIds.includes(columns[index - 1].field!.id)
                  )
                    return null;
                  const span = isStart
                    ? columns
                        .slice(index)
                        .findIndex(
                          (item) =>
                            !item.field || !startIds.includes(item.field.id),
                        )
                    : 1;
                  return (
                    <th
                      key={column.key}
                      scope={isStart ? 'colgroup' : 'col'}
                      colSpan={
                        isStart
                          ? span === -1
                            ? columns.length - index
                            : span
                          : 1
                      }
                      className="border-r border-b bg-background px-3 py-3"
                    >
                      {isStart && (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <span>고교 입학 전</span>
                          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-normal text-amber-700">
                            두 시기 중 하나 입력 필수
                          </span>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-30 w-60 border-r border-b bg-muted p-4"
                >
                  항목
                </th>
                {columns.map(({ key, group, field }) => (
                  <th
                    key={key}
                    scope="col"
                    style={{ width: field ? 280 : 116 }}
                    className="border-r border-b bg-background p-3 align-top whitespace-normal [overflow-wrap:anywhere]"
                  >
                    <div className="min-h-12 font-semibold">
                      {field?.label || group}
                    </div>
                    {field ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-normal">
                        {startIds.includes(field.id) ? null : field.id ===
                          admissionId ? (
                          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                            필수
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {!/^고[123]-[12]/.test(group) ? '해당 시' : '선택'}
                          </span>
                        )}
                        {!startIds.includes(field.id) &&
                          field.id !== admissionId &&
                          !hasAnswer(field) && (
                            <button
                              type="button"
                              className="rounded border px-2 py-1 hover:bg-muted"
                              onClick={() => {
                                setExpanded((current) =>
                                  current.filter((item) => item !== field.id),
                                );
                                setActiveCell(null);
                              }}
                            >
                              접기
                            </button>
                          )}
                      </div>
                    ) : (
                      <Popover.Root
                        open={addingGroup === group}
                        onOpenChange={(next) =>
                          setAddingGroup(next ? group : null)
                        }
                      >
                        <Popover.Trigger
                          render={
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={disabled}
                            />
                          }
                          aria-label={`${group} 시기 추가하기`}
                        >
                          + 추가하기
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Positioner
                            sideOffset={8}
                            align="start"
                            className="z-[60]"
                          >
                            <Popover.Popup className="w-max max-w-[calc(100vw-2rem)] max-h-[var(--available-height)] overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg outline-none">
                              <Popover.Title className="px-2 py-2 text-sm font-semibold">
                                {group} · 시기 선택
                              </Popover.Title>
                              <div className="flex flex-col gap-1">
                                {document.fields
                                  .filter(
                                    (item) =>
                                      groupFor(item) === group &&
                                      !columns.some(
                                        (column) =>
                                          column.field?.id === item.id,
                                      ),
                                  )
                                  .map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      className="flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-left text-sm font-normal hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                                      onClick={() => {
                                        setExpanded((current) => [
                                          ...current,
                                          item.id,
                                        ]);
                                        setAddingGroup(null);
                                      }}
                                    >
                                      <Plus
                                        aria-hidden="true"
                                        className="size-4 shrink-0"
                                      />
                                      {item.label}
                                    </button>
                                  ))}
                              </div>
                            </Popover.Popup>
                          </Popover.Positioner>
                        </Popover.Portal>
                      </Popover.Root>
                    )}
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
                      className={`sticky left-0 z-10 border-r border-b bg-background p-4 align-top font-medium [overflow-wrap:anywhere] ${rowIndex >= 3 ? 'text-muted-foreground' : ''}`}
                    >
                      {label}
                      {rowIndex >= 3 && (
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          (선택)
                        </span>
                      )}
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
                    {columns.map(({ key: columnKey, group, field }) => {
                      if (!field)
                        return (
                          <td
                            key={columnKey}
                            className="border-r border-b bg-background/50 p-3 text-center align-top text-xs text-muted-foreground"
                            style={{
                              backgroundImage:
                                'repeating-linear-gradient(135deg, transparent, transparent 8px, rgb(128 128 128 / 0.05) 8px, rgb(128 128 128 / 0.05) 16px)',
                            }}
                          >
                            {rowIndex === 0 ? (
                              '변화 없음'
                            ) : (
                              <span className="sr-only">
                                {group} · 이전과 동일
                              </span>
                            )}
                          </td>
                        );
                      const fieldIndex = document.fields.indexOf(field);
                      const key = `${row.id}:${field.id}`;
                      const value = row.answers[field.id] ?? '';
                      const text = summary(field, value);
                      const placeholder =
                        showExamples && !disabled && field.kind === 'text'
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
                          className={`border-r border-b p-3 align-top ${startIds.includes(field.id) || field.id === admissionId ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'bg-background'}`}
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
            @탐구활동을 입력해 탐구활동을 언급할 수 있어요. 닫아도 입력 내용은
            유지됩니다.
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
