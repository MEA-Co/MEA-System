'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import type { QuestionResponseSnapshot } from '../../lib/question-responses';
import { useQuestionnaireResource } from '../../lib/questionnaire/api-client';

import { QuestionnaireLoading } from './QuestionnaireLoading';
import { QuestionnairePreview } from './QuestionnairePreview';

type SubmittedResponse = Pick<
  QuestionResponseSnapshot,
  'id' | 'title' | 'sections' | 'questions'
> & {
  respondentName: string;
  submittedAt: string;
};
const readOnly = () => {};

export function SubmittedQuestionnaireResponses({
  questionnaireId,
}: {
  questionnaireId: string;
}) {
  const { data, error } = useQuestionnaireResource<SubmittedResponse[]>(
    `/${questionnaireId}/submitted-responses`,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (error) return <p role="alert">{error.message}</p>;
  if (!data) return <QuestionnaireLoading />;
  const selected = data.find((item) => item.id === selectedId);
  if (selected)
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setSelectedId(null)}>
          제출 목록으로
        </Button>
        <div>
          <h2 className="text-lg font-semibold">
            {selected.respondentName || '이름 없음'}의 답변
          </h2>
          <p className="text-sm text-muted-foreground">
            {new Date(selected.submittedAt).toLocaleString('ko-KR')} 제출 ·
            마지막 제출 내용입니다.
          </p>
        </div>
        <QuestionnairePreview
          key={`${selected.id}:${selected.submittedAt}`}
          title={selected.title}
          sections={selected.sections}
          library={selected.questions.map((q) => q.definition)}
          response={{
            rows: Object.fromEntries(
              selected.questions.map((q) => [q.questionId, q.rows]),
            ),
            onChange: readOnly,
            disabled: true,
          }}
        />
      </div>
    );
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        제출한 답변만 표시됩니다. 작성 중이거나 저장만 한 내용은 공개되지
        않습니다.
      </p>
      {data.length ? (
        <ul className="divide-y rounded-xl border bg-background">
          {data.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-muted/50"
                onClick={() => setSelectedId(item.id)}
              >
                <span className="font-medium">
                  {item.respondentName || '이름 없음'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {new Date(item.submittedAt).toLocaleString('ko-KR')} · 답변
                  보기
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          아직 제출된 답변이 없어요.
        </p>
      )}
    </section>
  );
}
