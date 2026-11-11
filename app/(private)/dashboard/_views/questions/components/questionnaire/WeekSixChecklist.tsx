'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { flowRowLabel } from '../../lib/flow-rows';
import type {
  QuestionBlockField,
  QuestionBlockRow,
} from '../../lib/question-blocks';
import { QUESTIONNAIRE_HEADERS } from '../../lib/questionnaire/api-client';
import type { QuestionnaireSection } from '../../lib/questionnaire/types';
import { WEEK_SIX_ID } from '../../lib/questionnaire/week-six';
import type { PreviewAnswerRow } from '../../lib/reference-rows';
import { submittedAnswerText } from '../../lib/submitted-response-export';
import { submittedRowLabel } from '../../lib/submitted-row-label';
import {
  questionCanvasClass,
  questionNumberClass,
  questionPromptClass,
  questionSurfaceClass,
} from '../question/question-styles';
import { RichTextContent } from '../question/RichTextContent';
import {
  SubmittedAnswerField,
  SubmittedAnswerGroup,
} from '../question/SubmittedAnswerLayout';

type Source = {
  fields: QuestionBlockField[];
  rows: PreviewAnswerRow[];
  labels: string[];
};
type Checks = Record<string, PreviewAnswerRow[]>;

export function WeekSixChecklist({
  title,
  review,
  sections,
  library,
  response,
}: {
  title: string;
  review: boolean;
  sections: QuestionnaireSection[];
  library: QuestionBlockRow[];
  response?: {
    rows: Checks;
    disabled: boolean;
    onChange: (id: string, rows: PreviewAnswerRow[]) => void;
  };
}) {
  const [sources, setSources] = useState<Record<string, Source>>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<Checks>({});
  useEffect(() => {
    if (review) return;
    const controller = new AbortController();
    async function load() {
      try {
        const result = await fetch(
          '/api/questionnaires/' + WEEK_SIX_ID + '/prior-answers',
          {
            headers: QUESTIONNAIRE_HEADERS,
            cache: 'no-store',
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(30000),
            ]),
          },
        );
        if (!result.ok) throw new Error();
        const data = await result.json();
        if (!controller.signal.aborted) setSources(data);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt, review]);
  return (
    <article className="space-y-5 rounded-xl border bg-background p-5 sm:p-8">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p>1~5주차에 제출한 답변을 읽고 활용을 마친 질문에 체크해 주세요.</p>
      {(review || !response) && (
        <p className="text-sm text-muted-foreground">
          미리보기에서 체크한 내용은 저장되지 않습니다.
        </p>
      )}
      {error ? (
        <div role="alert">
          이전 답변을 불러오지 못했어요.{' '}
          <Button
            onClick={() => {
              setError(false);
              setAttempt((a) => a + 1);
            }}
          >
            다시 시도
          </Button>
        </div>
      ) : !review && !sources ? (
        <p role="status">내 제출 답변을 불러오는 중이에요.</p>
      ) : (
        <Tabs defaultValue={sections[0]?.id}>
          <TabsList aria-label="답변 주차" className="w-full sm:w-fit">
            {sections.map((section, index) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="px-2 sm:px-4"
              >
                {section.title.match(/^\d+주차/)?.[0] ?? index + 1 + '주차'}
              </TabsTrigger>
            ))}
          </TabsList>
          {sections.map((section) => {
            const questions = section.questions.flatMap((p, questionIndex) => {
              const id = p.sourceQuestionId;
              const definition = library.find((q) => q.id === id);
              if (!id || !definition) return [];
              const source: Source | undefined = review
                ? {
                    fields: definition.fields,
                    rows: [{ id: 1, answers: {} }],
                    labels: [],
                  }
                : sources?.[id];
              if (!source?.rows.length) return [];
              const stored = ((review ? undefined : response?.rows) ?? preview)[
                id
              ]?.[0] ?? {
                id: 1,
                answers: {},
              };
              const firstField = definition.fields[0];
              if (!firstField) return [];
              const complete =
                stored.answers[firstField.id] === '질문 활용 완료' ||
                (!review &&
                  source.rows.every((row) =>
                    source.fields.every(
                      (field) =>
                        !row.answers[field.id]?.trim() ||
                        (stored.answers[field.id] ?? '')
                          .split('\n')
                          .includes('활용 완료 · 행 ' + row.id),
                    ),
                  ));
              return [
                <section
                  key={id}
                  className={cn(
                    questionSurfaceClass,
                    complete &&
                      'border-emerald-500 border-t-emerald-500 bg-emerald-50 dark:bg-emerald-950',
                  )}
                  data-response-question={id}
                >
                  <div className={questionPromptClass}>
                    <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
                      <span className={questionNumberClass}>
                        {questionIndex + 1}
                      </span>
                      <RichTextContent
                        value={definition.prompt}
                        className="min-w-0 flex-1"
                      />
                    </div>
                    <label
                      className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm ${complete ? 'bg-emerald-700 font-semibold text-white' : 'bg-muted'}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={
                          section.title +
                          ' ' +
                          (questionIndex + 1) +
                          '번 질문 활용 완료'
                        }
                        checked={complete}
                        disabled={response?.disabled}
                        onChange={(event) => {
                          const answers = event.target.checked
                            ? { [firstField.id]: '질문 활용 완료' }
                            : {};
                          const next = [{ ...stored, answers }];
                          if (!review && response) response.onChange(id, next);
                          else setPreview((prev) => ({ ...prev, [id]: next }));
                        }}
                      />
                      활용 완료
                    </label>
                  </div>
                  {source.rows.map((row, index) => (
                    <SubmittedAnswerGroup
                      key={row.id}
                      title={
                        source.rows.length > 1 ||
                        row.label ||
                        row.flowIndex !== undefined ||
                        row.flowAfter !== undefined
                          ? row.flowIndex !== undefined ||
                            row.flowAfter !== undefined
                            ? flowRowLabel(row, source.labels)
                            : submittedRowLabel(
                                row,
                                index,
                                source.rows.length,
                                source.labels,
                              )
                          : undefined
                      }
                    >
                      {source.fields.map((field) => {
                        const value = row.answers[field.id];
                        if (!review && !value?.trim()) return null;
                        return (
                          <SubmittedAnswerField
                            key={field.id}
                            label={field.label}
                            multiple={source.fields.length > 1}
                          >
                            {review ? (
                              <p className="text-muted-foreground">
                                컨설턴트가 제출한 답변이 여기에 표시됩니다.
                              </p>
                            ) : field.kind === 'text' ? (
                              <RichTextContent value={value} />
                            ) : (
                              <p>{submittedAnswerText(field, value)}</p>
                            )}
                          </SubmittedAnswerField>
                        );
                      })}
                    </SubmittedAnswerGroup>
                  ))}
                </section>,
              ];
            });
            return (
              <TabsContent
                key={section.id}
                value={section.id}
                className={cn(
                  questionCanvasClass,
                  'space-y-4 rounded-lg sm:space-y-6',
                )}
              >
                <h3 className="font-semibold">{section.title}</h3>
                {questions.length ? (
                  questions
                ) : (
                  <p className="text-sm text-muted-foreground">
                    이 주차에 내가 제출한 답변이 없어요.
                  </p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </article>
  );
}
