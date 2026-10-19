'use client';

import { Fragment, type ReactNode, useCallback, useState } from 'react';
import useSWR from 'swr';

import { cn } from '@/lib/utils';

import type { GuideAnswer } from '../../lib/guide-answers';
import {
  documentFromRow,
  type QuestionBlockRow,
} from '../../lib/question-blocks';
import { questionnaireFetcher } from '../../lib/questionnaire/api-client';
import { placementPreviewState } from '../../lib/questionnaire/placement-preview';
import type {
  QuestionnaireNotice,
  QuestionnaireSection,
} from '../../lib/questionnaire/types';
import type { PreviewAnswerRow } from '../../lib/reference-rows';
import type { SubmissionIssue } from '../../lib/responses/submission-validation';
import { questionCanvasClass } from '../question/question-styles';
import { QuestionBlockPreview } from '../question/QuestionBlockPreview';
import { QuestionReviews } from '../question/QuestionReviews';

import { QuestionChoiceInput } from './QuestionChoiceInput';
import { questionnaireStyles } from './questionnaire-styles';
import { QuestionnaireStartNotice } from './QuestionnaireStartNotice';
import { QuestionTextAnswerPreview } from './QuestionTextAnswerPreview';
import { RichTextContent } from './RichTextContent';

export function QuestionnairePreview({
  embedded = false,
  notices = [],
  beforeLinkRegistration,
  registrationDisabled,
  title,
  reviewQuestionnaireId,
  sections,
  library = [],
  renderQuestionFooter,
  legacyResponsePreview = false,
  showPrivateDetails = false,
  showGuideAnswers = false,
  response,
  submittedView = false,
  submissionIssues = [],
}: {
  submissionIssues?: SubmissionIssue[];
  embedded?: boolean;
  notices?: QuestionnaireNotice[];
  beforeLinkRegistration?: () => Promise<boolean>;
  registrationDisabled?: boolean;
  reviewQuestionnaireId?: string;
  title: string;
  sections: QuestionnaireSection[];
  library?: QuestionBlockRow[];
  renderQuestionFooter?: (questionId: string) => ReactNode;
  /** Only the retained published-response screen renders inline questions. */
  legacyResponsePreview?: boolean;
  submittedView?: boolean;
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
  const placementIds = new Set(
    sections.flatMap((section) => section.questions.map((q) => q.id)),
  );
  function renderNotices(position: string) {
    if (submittedView) return null;
    return notices
      .filter(
        (notice) =>
          (notice.position === 'start' ||
          notice.position === 'end' ||
          placementIds.has(notice.position)
            ? notice.position
            : 'end') === position,
      )
      .map((notice) => (
        <QuestionnaireStartNotice
          key={notice.id}
          notice={notice}
          beforeLinkRegistration={beforeLinkRegistration}
          registrationDisabled={registrationDisabled}
        />
      ));
  }
  return (
    <div
      className={cn(
        questionCanvasClass,
        'min-w-0 max-w-full space-y-5 rounded-lg sm:space-y-8',
        embedded && 'px-0 sm:px-0',
      )}
    >
      <header className="space-y-3 border-b-2 border-foreground pb-4 sm:pb-5">
        <h2 className="text-xl font-extrabold leading-tight whitespace-pre-wrap wrap-break-word sm:text-3xl">
          {title || '제목 없는 질문지'}
        </h2>
        {!response && placedLibrary.length > 0 && (
          <p className="text-sm text-muted-foreground">
            미리보기 답변은 저장되지 않습니다.
          </p>
        )}
      </header>
      {renderNotices('start')}
      {sections.map((section, sectionIndex) => (
        <section key={section.id} className="space-y-3 sm:space-y-5">
          <h3
            className={cn(
              questionnaireStyles.sectionHeading,
              'bg-transparent px-0 py-1 text-base sm:py-3 sm:text-xl dark:bg-transparent',
            )}
          >
            <span className={questionnaireStyles.sectionNumber}>
              {sectionIndex + 1}
            </span>
            <span className="min-w-0 whitespace-pre-wrap wrap-break-word">
              {section.title || '제목 없는 섹션'}
            </span>
          </h3>
          {section.questions.map((question, questionIndex) => (
            <Fragment key={question.id}>
              {question.sourceQuestionId ? (
                <div
                  key={question.id}
                  data-response-question={question.sourceQuestionId}
                  tabIndex={-1}
                  role="group"
                  aria-label={`${section.title || `섹션 ${sectionIndex + 1}`} · ${questionIndex + 1}번 질문`}
                  className="space-y-3 scroll-mt-24 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <PlacedPreview
                    validationMessages={submissionIssues
                      .filter(
                        (issue) =>
                          issue.questionId === question.sourceQuestionId,
                      )
                      .map((issue) => issue.message)}
                    sourceId={question.sourceQuestionId}
                    guideAnswer={guideAnswers?.[question.sourceQuestionId]}
                    number={questionIndex + 1}
                    library={placedLibrary}
                    answers={answers}
                    onRows={onRows}
                    showPrivateDetails={showPrivateDetails}
                    response={response}
                    submittedView={submittedView}
                  />
                  {reviewQuestionnaireId && (
                    <QuestionReviews questionId={question.sourceQuestionId} />
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
              )}
              {renderNotices(question.id)}
            </Fragment>
          ))}
        </section>
      ))}
      {renderNotices('end')}
    </div>
  );
}

function PlacedPreview({
  validationMessages,
  sourceId,
  guideAnswer,
  number,
  library,
  answers,
  onRows,
  showPrivateDetails,
  response,
  submittedView = false,
}: {
  validationMessages?: string[];
  submittedView?: boolean;
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
      validationMessages={validationMessages}
      guideAnswer={guideAnswer}
      showPrivateDetails={showPrivateDetails}
      questions={library}
      questionNumber={number}
      runtime={placementPreviewState(source, library, answers)}
      onAnsweredRowsChange={report}
      initialRows={response?.rows[sourceId]}
      onStoredRowsChange={response ? store : undefined}
      disabled={response?.disabled}
      submittedView={submittedView}
    />
  );
}
