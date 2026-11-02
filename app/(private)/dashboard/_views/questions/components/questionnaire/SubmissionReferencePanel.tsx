'use client';

import useSWR from 'swr';

import { Button } from '@/components/ui/button';

import type { QuestionBlockField } from '../../lib/question-blocks';
import { QUESTIONNAIRE_HEADERS } from '../../lib/questionnaire/api-client';
import type { SubmissionReference } from '../../lib/questionnaire/types';
import type { PreviewAnswerRow } from '../../lib/reference-rows';
import { richTextPlainText } from '../../lib/rich-text';
import { submittedAnswerText } from '../../lib/submitted-response-export';
import { RichTextContent } from '../question/RichTextContent';

type Reference = {
  title: string;
  question: string;
  fields: QuestionBlockField[];
  rows: PreviewAnswerRow[];
};

export function SubmissionReferencePanel({
  questionnaireId,
  sessionId,
  noticeId,
  selection,
}: {
  questionnaireId?: string;
  sessionId?: string;
  noticeId: string;
  selection: SubmissionReference;
}) {
  const { data, error, mutate, isValidating } = useSWR(
    questionnaireId && sessionId
      ? ([
          `/api/questionnaires/${questionnaireId}/notice-reference/${noticeId}`,
          sessionId,
          selection,
        ] as const)
      : null,
    async ([url]): Promise<{ reference: Reference | null }> => {
      const response = await fetch(url, {
        headers: QUESTIONNAIRE_HEADERS,
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error();
      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );
  return (
    <aside className="my-4 space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <h4 className="font-semibold">이전에 내가 제출한 답변</h4>
      {data?.reference && (
        <p>
          {data.reference.title} · {richTextPlainText(data.reference.question)}
        </p>
      )}
      {!sessionId ? (
        <p>
          응답 화면에서 선택한 질문에 본인이 제출한 답변을 확인할 수 있어요.
        </p>
      ) : error || (data && !data.reference) ? (
        <div>
          <p>
            {error
              ? '이전 제출 답변을 불러오지 못했어요.'
              : '이 질문에 표시할 제출 답변이 없어요.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isValidating}
            onClick={() => void mutate()}
          >
            다시 확인
          </Button>
        </div>
      ) : !data?.reference ? (
        <p>제출 답변을 불러오는 중이에요.</p>
      ) : (
        data.reference.rows.map((row, index) => (
          <section
            key={row.id}
            className="space-y-2 rounded-md border bg-background p-3"
          >
            <h5 className="font-medium">{row.label || `항목 ${index + 1}`}</h5>
            <dl className="grid gap-2 sm:grid-cols-2">
              {data.reference?.fields.map((field) => (
                <div key={field.id} className="min-w-0">
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd>
                    {field.kind === 'text' && row.answers[field.id] ? (
                      <RichTextContent value={row.answers[field.id]} />
                    ) : (
                      submittedAnswerText(field, row.answers[field.id] ?? '')
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
    </aside>
  );
}
