'use client';

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

import type { GuideAnswer } from '../../lib/guide-answers';
import type {
  QuestionBlockDocument,
  QuestionBlockField,
} from '../../lib/question-blocks';
import { choiceAnswerValue, scaleAnswer } from '../../lib/question-types';

import { RichTextContent } from './RichTextContent';

export function QuestionGuideAnswerTable({
  document,
  answer,
  summary,
}: {
  document: QuestionBlockDocument;
  answer: GuideAnswer;
  summary: (field: QuestionBlockField, value: string) => string;
}) {
  // The guide API omits empty rows; use its display labels, never internal IDs.
  const labels = document.rowLabels?.length
    ? document.rowLabels.map(
        (label, index) => label.trim() || String(index + 1),
      )
    : answer.rows.map((row) => row.label);
  return (
    <Dialog>
      <DialogTrigger className="w-full cursor-pointer rounded-lg border-l-2 border-neutral-300 bg-muted/40 p-4 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
        <span aria-hidden="true" className="mr-1.5 text-[10px]">
          ▶
        </span>
        가이드 답변
      </DialogTrigger>
      <DialogContent className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-4 rounded-2xl p-4 sm:max-w-none sm:p-6">
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle>
            {document.title || '진로 흐름'} · 가이드 답변
          </DialogTitle>
          <DialogDescription>
            표를 좌우로 스크롤해 가이드 답변을 확인하세요.
          </DialogDescription>
        </DialogHeader>
        <div
          className="min-h-0 flex-1 overflow-auto rounded-lg border"
          tabIndex={0}
          role="region"
          aria-label="진로 흐름 가이드 답변 표"
        >
          <table
            className="w-full table-fixed border-separate border-spacing-0 text-left text-sm"
            style={{ minWidth: 240 + document.fields.length * 280 }}
          >
            <caption className="sr-only">진로 흐름 가이드 답변</caption>
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
                    className="sticky top-0 z-20 w-70 border-r border-b bg-muted p-4 [overflow-wrap:anywhere]"
                  >
                    {field.label || `답변 ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, index) => {
                const row = answer.rows.find((item) => item.label === label);
                return (
                  <tr key={index}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-b bg-background p-4 align-top font-medium [overflow-wrap:anywhere]"
                    >
                      {label}
                    </th>
                    {document.fields.map((field) => {
                      const value = row?.answers[field.id] ?? '';
                      const extra =
                        field.kind === 'scale'
                          ? scaleAnswer(value).text
                          : field.kind === 'single' || field.kind === 'multiple'
                            ? choiceAnswerValue(
                                value,
                                field.kind === 'multiple',
                              ).text
                            : '';
                      return (
                        <td
                          key={field.id}
                          className="border-r border-b bg-background p-4 align-top"
                        >
                          {!value.trim() ? (
                            <span className="text-muted-foreground">—</span>
                          ) : field.kind === 'text' ? (
                            <RichTextContent value={value} />
                          ) : (
                            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                              {summary(field, value)}
                            </p>
                          )}
                          {extra && (
                            <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                              {extra}
                            </p>
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
        <div className="flex shrink-0 justify-end">
          <DialogClose render={<Button type="button" />}>닫기</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
