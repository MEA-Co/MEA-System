'use client';

import { Tabs } from '@base-ui/react/tabs';
import { Eye, FileText, MessageSquare } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import type { QuestionBlockRow } from '../../lib/question-blocks';
import type {
  QuestionnaireDraft,
  QuestionnaireReviewContext,
} from '../../lib/questionnaire/types';

import { PublishedResponse } from './PublishedResponse';
import { QuestionAnswerEditor } from './QuestionAnswerEditor';
import { QuestionChoiceInput } from './QuestionChoiceInput';
import { QuestionnaireAnswers } from './QuestionnaireAnswers';
import { QuestionnaireFreeResponse } from './QuestionnaireFreeResponse';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireReviews } from './QuestionnaireReviews';
import type { QuestionnaireEditorState } from './QuestionnaireView';
import { QuestionPlacementCard } from './QuestionPlacementCard';
import { QuestionResponseForm } from './QuestionResponseForm';
import { RichTextContent } from './RichTextContent';
import { SubmittedQuestionnaireResponses } from './SubmittedQuestionnaireResponses';
export function PublishedQuestionnaire({
  document,
  sources = [],
  distributed = false,
  staff = true,
  reviewContext,
  onEditorState,
}: {
  document: QuestionnaireDraft;
  sources?: QuestionBlockRow[];
  distributed?: boolean;
  staff?: boolean;
  reviewContext?: QuestionnaireReviewContext;
  onEditorState?: (state: QuestionnaireEditorState) => void;
}) {
  const placements = document.sections.some((section) =>
    section.questions.some((question) => question.sourceQuestionId),
  );
  if (staff && !distributed)
    return (
      <PublishedResponse
        document={document}
        sources={sources}
        onEditorState={onEditorState}
      />
    );
  if (!staff && distributed && placements)
    return (
      <QuestionResponseForm
        key={`distributed:${document.questionnaireId}`}
        questionnaireId={document.questionnaireId}
        distributed
        onEditorState={onEditorState}
      />
    );
  const content = (
    <article className="mx-auto w-full min-w-0 max-w-4xl space-y-8 rounded-xl border bg-background p-5 sm:p-10">
      <header>
        <Badge variant="secondary">
          {distributed ? '배포된 질문지' : '게시된 질문지'}
        </Badge>
        <h1 className="mt-3 whitespace-pre-wrap wrap-break-word text-2xl font-semibold">
          {document.title}
        </h1>
        {distributed && placements && (
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
                  canRequest={
                    !distributed && reviewContext.canRequest !== false
                  }
                  questionId={question.sourceQuestionId ?? undefined}
                  initialReviews={reviewContext.initialReviews.filter(
                    (review) => review.question_id === question.id,
                  )}
                />
              )}
              {distributed && !staff && !placements && (
                <QuestionAnswerEditor question={question} />
              )}
            </div>
          ))}
        </section>
      ))}
      {distributed && !staff && !placements && <QuestionnaireFreeResponse />}
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
    <Tabs.Root
      defaultValue="detail"
      className="mx-auto w-full min-w-0 max-w-4xl"
    >
      <Tabs.List
        className="mb-4 inline-flex max-w-full gap-1 rounded-xl bg-muted p-1"
        aria-label="질문지 보기 방식"
      >
        {[
          { value: 'detail', label: '질문지 상세', icon: FileText },
          { value: 'preview', label: '미리보기', icon: Eye },
          ...(distributed && placements
            ? [
                {
                  value: 'responses',
                  label: '제출된 답변',
                  icon: MessageSquare,
                },
              ]
            : []),
        ].map(({ value, label, icon: Icon }) => (
          <Tabs.Tab
            key={value}
            value={value}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-active:bg-background data-active:text-foreground data-active:shadow-sm"
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panel value="detail" keepMounted className="data-hidden:hidden">
        {content}
      </Tabs.Panel>
      {distributed && placements && (
        <Tabs.Panel value="responses">
          <SubmittedQuestionnaireResponses
            key={document.questionnaireId}
            questionnaireId={document.questionnaireId}
          />
        </Tabs.Panel>
      )}
      <Tabs.Panel value="preview" className="rounded-xl border bg-background">
        <QuestionnairePreview
          title={document.title}
          sections={document.sections}
          library={sources}
          legacyResponsePreview={distributed}
        />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
