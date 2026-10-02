'use client';

import { type ReactNode, useCallback, useState } from 'react';
import useSWR from 'swr';

import { cn } from '@/lib/utils';

import type { GuideAnswer } from '../../lib/guide-answers';
import {
  documentFromRow,
  type QuestionBlockRow,
} from '../../lib/question-blocks';
import { questionnaireFetcher } from '../../lib/questionnaire/api-client';
import { placementPreviewState } from '../../lib/questionnaire/placement-preview';
import type { QuestionnaireSection } from '../../lib/questionnaire/types';
import type { PreviewAnswerRow } from '../../lib/reference-rows';
import { QuestionBlockPreview } from '../question/QuestionBlockPreview';
import { QuestionReviews } from '../question/QuestionReviews';

import { QuestionChoiceInput } from './QuestionChoiceInput';
import { questionnaireStyles } from './questionnaire-styles';
import { QuestionTextAnswerPreview } from './QuestionTextAnswerPreview';
import { RichTextContent } from './RichTextContent';

export function QuestionnairePreview({
  title,
  reviewVersionId,
  sections,
  library = [],
  renderQuestionFooter,
  legacyResponsePreview = false,
  showPrivateDetails = false,
  showGuideAnswers = false,
  response,
}: {
  reviewVersionId?: string;
  title: string;
  sections: QuestionnaireSection[];
  library?: QuestionBlockRow[];
  renderQuestionFooter?: (questionId: string) => ReactNode;
  /** Only the retained distributed-response screen renders inline questions. */
  legacyResponsePreview?: boolean;
  showPrivateDetails?: boolean;
  showGuideAnswers?: boolean;
  response?: {
    rows: Record<string, PreviewAnswerRow[]>;
    onChange: (id: string, rows: PreviewAnswerRow[]) => void;
    disabled: boolean;
  };
}) {
  const [answers, setAnswers] = useState<Record<string, PreviewAnswerRow[]>>(
    {},
  );
  const onRows = useCallback((id: string, rows: PreviewAnswerRow[]) => {
    setAnswers((current) =>
      JSON.stringify(current[id] ?? []) === JSON.stringify(rows)
        ? current
        : { ...current, [id]: rows },
    );
  }, []);
  const guideIds = [
    ...new Set(
      sections.flatMap((section) =>
        section.questions.flatMap((q) =>
          q.sourceQuestionId ? [q.sourceQuestionId] : [],
        ),
      ),
    ),
  ].sort();
  const { data: guideAnswers } = useSWR<Record<string, GuideAnswer>>(
    (showPrivateDetails || showGuideAnswers) && guideIds.length
      ? `/api/questionnaires/guide-answers?questions=${guideIds.join(',')}`
      : null,
    questionnaireFetcher,
    { refreshInterval: 10000 },
  );
  const placedLibrary = sections.flatMap((section) =>
    section.questions.flatMap((q) => {
      const source = library.find((item) => item.id === q.sourceQuestionId);
      return source ? [source] : [];
    }),
  );
  return (
    <div className="min-w-0 max-w-full space-y-8 rounded-2xl bg-neutral-100 p-5 sm:p-10 dark:bg-neutral-950">
      <h2 className="whitespace-pre-wrap wrap-break-word text-3xl font-semibold">
        {title || '제목 없는 질문지'}
      </h2>
      {!response && placedLibrary.length > 0 && (
        <p className="text-sm text-muted-foreground">
          미리보기 답변은 저장되지 않습니다.
        </p>
      )}
      {sections.map((section, sectionIndex) => (
        <section key={section.id} className="space-y-5">
          <h3
            className={cn(
              questionnaireStyles.sectionHeading,
              'bg-transparent px-0 dark:bg-transparent',
            )}
          >
            <span className={questionnaireStyles.sectionNumber}>
              {sectionIndex + 1}
            </span>
            <span className="min-w-0 whitespace-pre-wrap wrap-break-word">
              {section.title || '제목 없는 섹션'}
            </span>
          </h3>
          {section.questions.map((question, questionIndex) =>
            question.sourceQuestionId ? (
              <div key={question.id} className="space-y-3">
                <PlacedPreview
                  sourceId={question.sourceQuestionId}
                  guideAnswer={guideAnswers?.[question.sourceQuestionId]}
                  number={questionIndex + 1}
                  library={placedLibrary}
                  answers={answers}
                  onRows={onRows}
                  showPrivateDetails={showPrivateDetails}
                  response={response}
                />
                {reviewVersionId && (
                  <QuestionReviews
                    questionId={question.sourceQuestionId}
                    versionId={reviewVersionId}
                  />
                )}
                {renderQuestionFooter?.(question.id)}
              </div>
            ) : legacyResponsePreview ? (
              <div
                key={question.id}
                className={questionnaireStyles.questionCard}
              >
                <div className="flex items-start gap-2 font-medium">
                  <span
                    className={`w-6 shrink-0 tabular-nums ${questionnaireStyles.questionLabel}`}
                  >
                    {questionIndex + 1}
                  </span>
                  <RichTextContent
                    className="min-w-0 flex-1"
                    value={question.text || '작성하지 않은 질문'}
                  />
                </div>
                {question.kind && question.kind !== 'text' ? (
                  <QuestionChoiceInput question={question} disabled />
                ) : (
                  <QuestionTextAnswerPreview variant="questionnaire" />
                )}
                {renderQuestionFooter?.(question.id)}
              </div>
            ) : (
              <p
                key={question.id}
                role="alert"
                className="text-sm text-destructive"
              >
                원본 질문이 없는 배치예요. 원본 질문을 저장한 뒤 다시 배치해
                주세요.
              </p>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

function PlacedPreview({
  sourceId,
  guideAnswer,
  number,
  library,
  answers,
  onRows,
  showPrivateDetails,
  response,
}: {
  showPrivateDetails: boolean;
  guideAnswer?: GuideAnswer;
  response?: {
    rows: Record<string, PreviewAnswerRow[]>;
    onChange: (id: string, rows: PreviewAnswerRow[]) => void;
    disabled: boolean;
  };
  sourceId: string;
  number: number;
  library: QuestionBlockRow[];
  answers: Record<string, PreviewAnswerRow[]>;
  onRows: (id: string, rows: PreviewAnswerRow[]) => void;
}) {
  const source = library.find((q) => q.id === sourceId);
  const report = useCallback(
    (rows: PreviewAnswerRow[]) => onRows(sourceId, rows),
    [onRows, sourceId],
  );
  const onStoredChange = response?.onChange;
  const store = useCallback(
    (rows: PreviewAnswerRow[]) => onStoredChange?.(sourceId, rows),
    [onStoredChange, sourceId],
  );
  if (!source)
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        배치된 질문을 불러올 수 없어요.
      </p>
    );
  return (
    <QuestionBlockPreview
      key={`${source.id}:${source.revision}`}
      document={documentFromRow(source)}
      guideAnswer={guideAnswer}
      showPrivateDetails={showPrivateDetails}
      questions={library}
      questionNumber={number}
      runtime={placementPreviewState(source, library, answers)}
      onAnsweredRowsChange={report}
      initialRows={response?.rows[sourceId]}
      onStoredRowsChange={response ? store : undefined}
      disabled={response?.disabled}
    />
  );
}
