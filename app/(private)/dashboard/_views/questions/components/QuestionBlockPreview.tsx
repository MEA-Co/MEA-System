'use client';

import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { matchingChoiceRows } from '../lib/choice-condition';
import { questionFromField } from '../lib/field-question';
import type {
  QuestionBlockDocument,
  QuestionBlockField,
  QuestionBlockRow,
} from '../lib/question-blocks';
import { documentFromRow } from '../lib/question-blocks';
import {
  choiceAnswerId,
  choiceAnswerValue,
  orderedChoiceOptions,
  scaleAnswer,
  scaleConfig,
  scaleLabel,
  validTypedAnswer,
} from '../lib/question-types';
import { answeredSourceRows, referenceAnswerRows } from '../lib/reference-rows';
import { richTextPlainText } from '../lib/rich-text';

function answerSummary(field: QuestionBlockField, value: string): string {
  if (!value) return '';
  if (field.kind === 'text') return richTextPlainText(value).trim();
  if (field.kind === 'scale') {
    const { score } = scaleAnswer(value);
    if (score === null) return '';
    const label = scaleLabel(scaleConfig(questionFromField(field)), score);
    return `${score}점${label ? ` · ${label}` : ''}`;
  }
  const answers = choiceAnswerValue(value, field.kind === 'multiple').choices;
  return orderedChoiceOptions(field.options ?? [])
    .flatMap((option) => {
      return answers
        .filter((item) => choiceAnswerId(item) === option.id)
        .map((answer) =>
          typeof answer === 'string'
            ? option.label
            : `직접 입력: ${answer.text.trim() || '미입력'}`,
        );
    })
    .join(', ');
}

import { QuestionChoiceInput } from './QuestionChoiceInput';
import { QuestionRichTextEditor } from './QuestionRichTextEditor';
import { RichTextContent } from './RichTextContent';

type PreviewRow = { id: number; answers: Record<string, string> };

export function QuestionBlockPreview({
  document,
  questions = [],
  ancestors = [],
  onAnsweredRowsChange,
}: {
  document: QuestionBlockDocument;
  questions?: QuestionBlockRow[];
  ancestors?: string[];
  onAnsweredRowsChange?: (rows: PreviewRow[]) => void;
}) {
  const nextRow = useRef(2);
  const previewId = useId();
  const [activeRowId, setActiveRowId] = useState<number | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([{ id: 1, answers: {} }]);
  const [sourceRows, setSourceRows] = useState<PreviewRow[]>([]);
  const reference = document.rowMode === 'reference';
  const repeated = document.rowMode !== 'single';
  const maxRows =
    document.rowMode === 'repeatable' ? (document.maxRows ?? 1) : 1;
  const conditionClause = document.condition?.clauses[0];
  const sourceId = reference
    ? document.sourceBlockId
    : (conditionClause?.blockId ?? null);
  const source = questions.find(
    (question) =>
      question.id === sourceId &&
      question.id !== document.id &&
      !ancestors.includes(question.id),
  );
  const matchedRows = useMemo(() => {
    if (!conditionClause) return sourceRows;
    if (!source) return [];
    if (conditionClause.op === 'answered') {
      return answeredSourceRows(
        sourceRows,
        conditionClause.fieldId
          ? [conditionClause.fieldId]
          : source.fields.map((field) => field.id),
        (id, value) => {
          const field = source.fields.find((item) => item.id === id);
          return (
            !!field &&
            (field.kind === 'text'
              ? !!richTextPlainText(value).trim()
              : validTypedAnswer(questionFromField(field), value, true))
          );
        },
      );
    }
    return matchingChoiceRows(sourceRows, conditionClause, source.fields);
  }, [sourceRows, conditionClause, source]);
  const waiting = !!sourceId && matchedRows.length === 0;
  const visibleRows = useMemo(
    () =>
      waiting
        ? []
        : reference
          ? referenceAnswerRows(matchedRows, rows)
          : rows.slice(0, maxRows),
    [waiting, reference, matchedRows, rows, maxRows],
  );
  const answeredRows = useMemo(
    () =>
      visibleRows.filter((row) =>
        document.fields.some((field) => {
          const value = row.answers[field.id] ?? '';
          return field.kind === 'text'
            ? !!richTextPlainText(value).trim()
            : validTypedAnswer(questionFromField(field), value, true);
        }),
      ),
    [visibleRows, document.fields],
  );
  useEffect(() => {
    onAnsweredRowsChange?.(answeredRows);
  }, [answeredRows, onAnsweredRowsChange]);

  function updateAnswer(rowId: number, fieldId: string, value: string) {
    setRows((current) =>
      current.some((row) => row.id === rowId)
        ? current.map((row) =>
            row.id === rowId
              ? { ...row, answers: { ...row.answers, [fieldId]: value } }
              : row,
          )
        : [...current, { id: rowId, answers: { [fieldId]: value } }],
    );
  }

  function renderInputs(row: (typeof rows)[number]) {
    return (
      <div className="space-y-5">
        {document.fields.map((field, fieldIndex) => {
          const question = questionFromField(field);
          question.id = `preview-${row.id}-${field.id}`;
          return (
            <div key={field.id} className="space-y-2">
              <p className="text-sm font-medium">
                {field.label || `답변 ${fieldIndex + 1}`}
              </p>
              {field.kind === 'text' ? (
                <QuestionRichTextEditor
                  id={question.id}
                  value={row.answers[field.id] ?? ''}
                  onChange={(value) => updateAnswer(row.id, field.id, value)}
                  placeholder="답변을 입력해 주세요"
                  ariaLabel={`미리보기 답변 ${fieldIndex + 1}`}
                />
              ) : (
                <QuestionChoiceInput
                  question={question}
                  value={row.answers[field.id] ?? ''}
                  onChange={(value) => updateAnswer(row.id, field.id, value)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        사용자가 보는 답변 화면을 체험할 수 있어요. 여기서 입력한 답변은
        저장되지 않아요.
      </p>
      {source && (
        <div className="space-y-3 rounded-xl border border-dashed p-4">
          <p className="text-sm font-medium">앞선 질문에 응답해 보세요</p>
          <QuestionBlockPreview
            key={source.id}
            document={documentFromRow(source)}
            questions={questions}
            ancestors={[...ancestors, document.id]}
            onAnsweredRowsChange={setSourceRows}
          />
        </div>
      )}
      <div className="space-y-6 rounded-2xl border border-neutral-200 bg-background p-5 sm:p-8 dark:border-neutral-700">
        <div className="flex items-start gap-3 font-medium">
          <span className="w-6 shrink-0 text-sm font-semibold">1</span>
          <RichTextContent
            value={document.prompt || '질문을 입력하세요'}
            className="min-w-0 flex-1"
          />
        </div>
        {(document.details ?? [])
          .filter((detail) => detail.visibleToConsultants)
          .map((detail) => (
            <div
              key={detail.id}
              className="rounded-lg border-l-2 border-neutral-300 bg-muted/40 p-4"
            >
              {detail.title && (
                <h3 className="mb-2 text-sm font-semibold">{detail.title}</h3>
              )}
              <RichTextContent value={detail.text} />
            </div>
          ))}
        {sourceId && !source && (
          <p className="text-sm text-muted-foreground">
            앞선 질문을 불러올 수 없어요. 조건 설정을 확인해 주세요.
          </p>
        )}
        {waiting && (
          <p className="text-sm text-muted-foreground">
            앞선 질문의 조건에 맞는 응답이 있으면 답변을 입력할 수 있어요.
          </p>
        )}
        {reference && !waiting && (
          <p className="text-xs text-muted-foreground">
            조건에 맞는 앞선 응답 {matchedRows.length}개에 맞춰 입력합니다.
          </p>
        )}
        {repeated ? (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                답변 목록. 항목을 누르면 열별 답변을 입력할 수 있습니다.
              </caption>
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="w-24 whitespace-nowrap px-4 py-3">
                    항목
                  </th>
                  {document.fields.map((field, index) => (
                    <th
                      key={field.id}
                      scope="col"
                      className="min-w-40 px-4 py-3 font-medium"
                    >
                      {field.label || `답변 ${index + 1}`}
                    </th>
                  ))}
                  <th scope="col" className="w-12 px-2 py-3">
                    <span className="sr-only">삭제</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const expanded = activeRowId === row.id;
                  const panelId = `${previewId}-row-${row.id}`;
                  const toggle = () => setActiveRowId(expanded ? null : row.id);
                  return (
                    <Fragment key={row.id}>
                      <tr
                        onClick={toggle}
                        className={`cursor-pointer border-t transition-colors hover:bg-muted/50 ${expanded ? 'bg-muted/50' : ''}`}
                      >
                        <th scope="row" className="px-3 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-expanded={expanded}
                            aria-controls={expanded ? panelId : undefined}
                            aria-label={`항목 ${index + 1} 답변 ${expanded ? '접기' : '입력'}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggle();
                            }}
                          >
                            <ChevronDown
                              aria-hidden="true"
                              className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                            />
                            {index + 1}
                          </Button>
                        </th>
                        {document.fields.map((field) => {
                          const summary = answerSummary(
                            field,
                            row.answers[field.id] ?? '',
                          );
                          return (
                            <td key={field.id} className="max-w-72 px-4 py-3">
                              <span
                                className={`line-clamp-2 whitespace-pre-wrap break-words ${summary ? '' : 'text-muted-foreground'}`}
                              >
                                {summary || '미입력'}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-2 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={reference || visibleRows.length === 1}
                            aria-label={`미리보기 항목 ${index + 1} 삭제`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setRows((current) =>
                                current.filter((item) => item.id !== row.id),
                              );
                              if (expanded) setActiveRowId(null);
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td
                            colSpan={document.fields.length + 2}
                            className="border-t bg-muted/20 p-4 sm:p-6"
                          >
                            <div
                              id={panelId}
                              role="region"
                              aria-label={`항목 ${index + 1} 답변 입력`}
                            >
                              {reference && source && (
                                <div className="mb-4 space-y-1 rounded-lg bg-muted p-3 text-sm">
                                  <p className="font-medium">앞선 응답</p>
                                  {source.fields.map((field) => (
                                    <p key={field.id}>
                                      {field.label}:{' '}
                                      {answerSummary(
                                        field,
                                        sourceRows.find(
                                          (item) => item.id === row.id,
                                        )?.answers[field.id] ?? '',
                                      ) || '미입력'}
                                    </p>
                                  ))}
                                </div>
                              )}
                              {renderInputs(row)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!reference && !waiting && (
                  <tr className="border-t border-dashed">
                    <td colSpan={document.fields.length + 2} className="p-0">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-12 w-full rounded-none text-muted-foreground"
                        disabled={visibleRows.length >= maxRows}
                        onClick={() => {
                          if (visibleRows.length >= maxRows) return;
                          const id = nextRow.current++;
                          setRows((current) => [
                            ...current.slice(0, maxRows - 1),
                            { id, answers: {} },
                          ]);
                          setActiveRowId(id);
                        }}
                      >
                        <Plus aria-hidden="true" /> 항목 추가
                        <span className="text-xs" role="status">
                          ({visibleRows.length} / {maxRows})
                        </span>
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          visibleRows.map((row) => <div key={row.id}>{renderInputs(row)}</div>)
        )}
      </div>
    </div>
  );
}
