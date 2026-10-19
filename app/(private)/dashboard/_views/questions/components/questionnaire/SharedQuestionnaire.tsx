'use client';

import { Eye, FileText, MessageSquare } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { QuestionBlockRow } from '../../lib/question-blocks';
import type {
  QuestionnaireDraft,
  QuestionnaireReviewContext,
} from '../../lib/questionnaire/types';

import { QuestionAnswerEditor } from './QuestionAnswerEditor';
import { QuestionChoiceInput } from './QuestionChoiceInput';
import { QuestionnaireAnswers } from './QuestionnaireAnswers';
import { QuestionnaireFreeResponse } from './QuestionnaireFreeResponse';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireReviews } from './QuestionnaireReviews';
import type { QuestionnaireEditorState } from './QuestionnaireView';
import { QuestionPlacementCard } from './QuestionPlacementCard';
import { QuestionResponseForm } from './QuestionResponseForm';
import { ReviewResponse } from './ReviewResponse';
import { RichTextContent } from './RichTextContent';
import { SubmittedQuestionnaireResponses } from './SubmittedQuestionnaireResponses';
export function SharedQuestionnaire({
  document,
  sources = [],
  published = false,
  submittedResponseCount,
  staff = true,
  reviewContext,
  onEditorState,
}: {
  document: QuestionnaireDraft;
  sources?: QuestionBlockRow[];
  published?: boolean;
  submittedResponseCount?: number;
  staff?: boolean;
  reviewContext?: QuestionnaireReviewContext;
  onEditorState?: (state: QuestionnaireEditorState) => void;
}) {
  const params = useSearchParams();
  const placements = document.sections.some((section) =>
    section.questions.some((question) => question.sourceQuestionId),
  );
  if (staff && !published)
    return (
      <ReviewResponse
        document={document}
        sources={sources}
        onEditorState={onEditorState}
      />
    );
  if (!staff && published && placements)
    return (
      <QuestionResponseForm
        key={`published:${document.questionnaireId}`}
        questionnaireId={document.questionnaireId}
        published
        onEditorState={onEditorState}
      />
    );
  const content = (
    <article className="mx-auto w-full min-w-0 max-w-6xl space-y-8 rounded-xl border bg-background p-5 sm:p-10">
      <header>
        <Badge variant="secondary">
          {published ? '배포된 질문지' : '검토 중인 질문지'}
        </Badge>
        <h1 className="mt-3 whitespace-pre-wrap wrap-break-word text-2xl font-semibold">
          {document.title}
        </h1>
        {published && placements && (
          <p className="mt-3 text-sm text-muted-foreground">
            배포된 질문지와 질문 내용은 수정할 수 없습니다.
          </p>
        )}
      </header>
      {document.sections.map((section, index) => (
        <section key={section.id} className="space-y-5">
          <h2 className="whitespace-pre-wrap wrap-break-word text-xl font-semibold">
            {section.title || `섹션 ${index + 1}`}
          </h2>
          {section.questions.map((question, questionIndex) => (
            <div key={question.id} className="space-y-4 rounded-lg border p-5">
              <h3 className="text-sm font-medium text-muted-foreground">
                질문 {questionIndex + 1}
              </h3>
              {question.sourceQuestionId ? (
                (() => {
                  const source = sources.find(
                    (q) => q.id === question.sourceQuestionId,
                  );
                  return source ? (
                    <QuestionPlacementCard
                      question={source}
                      showPrivate={staff}
                      showSourceLink={false}
                    />
                  ) : (
                    <p role="status">
                      질문을 불러오지 못했어요. 새로고침해 주세요.
                    </p>
                  );
                })()
              ) : (
                <RichTextContent value={question.text} />
              )}
              {staff && question.kind && question.kind !== 'text' && (
                <QuestionChoiceInput question={question} disabled />
              )}
              {staff && reviewContext && (
                <QuestionnaireReviews
                  {...reviewContext}
                  questionId={question.sourceQuestionId ?? undefined}
                  initialReviews={reviewContext.initialReviews.filter(
                    (review) => review.question_id === question.id,
                  )}
                />
              )}
              {published && !staff && !placements && (
                <QuestionAnswerEditor question={question} />
              )}
            </div>
          ))}
        </section>
      ))}
      {published && !staff && !placements && <QuestionnaireFreeResponse />}
    </article>
  );
  if (!staff && placements) return content;
  if (!staff)
    return (
      <QuestionnaireAnswers
        questionnaireId={document.questionnaireId}
        questions={document.sections.flatMap((section) => section.questions)}
      >
        {content}
      </QuestionnaireAnswers>
    );
  return (
    <Tabs
      value={
        params.get('questionnairePanel') === 'preview'
          ? 'preview'
          : published &&
              placements &&
              params.get('questionnairePanel') === 'responses'
            ? 'responses'
            : published
              ? 'preview'
              : 'detail'
      }
      onValueChange={(value) => {
        const url = new URL(window.location.href);
        url.searchParams.set('questionnairePanel', String(value));
        url.searchParams.delete('submittedResponse');
        window.history.replaceState(null, '', url);
      }}
      className="mx-auto w-full min-w-0 max-w-6xl"
    >
      <TabsList
        className="h-auto! max-w-full flex-wrap"
        aria-label="질문지 보기 방식"
      >
        {[
          ...(!published
            ? [{ value: 'detail', label: '질문지 상세', icon: FileText }]
            : []),
          { value: 'preview', label: '미리보기', icon: Eye },
          ...(published && placements
            ? [
                {
                  value: 'responses',
                  label: '제출된 답변',
                  icon: MessageSquare,
                },
              ]
            : []),
        ].map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className={
              value === 'responses' ? 'relative gap-2 pl-3 pr-9' : 'gap-2 px-3'
            }
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            {value === 'responses' && (
              <span
                className="absolute right-1.5 top-1 min-w-4 rounded bg-foreground/10 px-1 text-center text-[10px] font-semibold leading-4 tabular-nums"
                aria-label={
                  submittedResponseCount === undefined
                    ? '제출 인원 확인 중'
                    : `제출 ${submittedResponseCount}명`
                }
              >
                {submittedResponseCount ?? '–'}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {!published && (
        <TabsContent value="detail" keepMounted className="data-hidden:hidden">
          {content}
        </TabsContent>
      )}
      {published && placements && (
        <TabsContent value="responses">
          <SubmittedQuestionnaireResponses
            key={document.questionnaireId}
            questionnaireId={document.questionnaireId}
          />
        </TabsContent>
      )}
      <TabsContent value="preview" className="rounded-xl border bg-background">
        <QuestionnairePreview
          questionnaireId={document.questionnaireId}
          notices={document.notices}
          title={document.title}
          sections={document.sections}
          library={sources}
          legacyResponsePreview={published}
          showGuideAnswers={published}
        />
      </TabsContent>
    </Tabs>
  );
}
