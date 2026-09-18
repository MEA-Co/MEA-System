'use client';

import { Tabs } from '@base-ui/react/tabs';
import { Eye, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import type {
  QuestionnaireDraft,
  QuestionnaireReviewContext,
} from '../lib/types';

import { PublishedExplanation } from './PublishedExplanation';
import { QuestionExplanationForm } from './QuestionExplanationForm';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireReviews } from './QuestionnaireReviews';
export function PublishedQuestionnaire({
  document,
  distributed = false,
  staff = true,
  reviewContext,
  editableExplanationIds = [],
}: {
  document: QuestionnaireDraft;
  distributed?: boolean;
  staff?: boolean;
  reviewContext?: QuestionnaireReviewContext;
  editableExplanationIds?: string[];
}) {
  const content = (
    <article className="mx-auto max-w-4xl space-y-8 rounded-xl border bg-background p-5 sm:p-10">
      <header>
        <Badge variant="secondary">
          {distributed ? '배포된 질문지' : '게시된 질문지'}
        </Badge>
        <h1 className="mt-3 whitespace-pre-wrap break-words text-2xl font-semibold">
          {document.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {distributed
            ? '배포된 질문지는 수정할 수 없어요.'
            : '컨설턴트 리드와 관리자만 볼 수 있어요.'}
        </p>
      </header>
      {document.sections.map((section, index) => (
        <section key={section.id} className="space-y-5">
          <h2 className="whitespace-pre-wrap break-words text-xl font-semibold">
            {section.title || `섹션 ${index + 1}`}
          </h2>
          {section.questions.map((question, questionIndex) => (
            <div key={question.id} className="space-y-4 rounded-lg border p-5">
              <h3 className="text-sm font-medium text-muted-foreground">
                질문 {questionIndex + 1}
              </h3>
              <p className="whitespace-pre-wrap break-words">{question.text}</p>
              {question.details.map((detail) => (
                <PublishedExplanation
                  key={detail.id}
                  detail={detail}
                  versionId={document.versionId}
                  questionId={question.id}
                  revision={document.revision}
                  staff={staff}
                  canManage={
                    staff &&
                    !distributed &&
                    editableExplanationIds.includes(detail.id)
                  }
                />
              ))}
              {staff && !distributed && (
                <QuestionExplanationForm
                  versionId={document.versionId}
                  questionId={question.id}
                  count={question.details.length}
                />
              )}
              {staff && reviewContext && (
                <QuestionnaireReviews
                  {...reviewContext}
                  questionId={question.id}
                  initialReviews={reviewContext.initialReviews.filter(
                    (review) => review.question_id === question.id,
                  )}
                />
              )}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
  if (!staff) return content;
  return (
    <Tabs.Root defaultValue="detail" className="mx-auto max-w-4xl">
      <Tabs.List
        className="mb-4 inline-flex max-w-full gap-1 rounded-xl bg-muted p-1"
        aria-label="질문지 보기 방식"
      >
        {[
          { value: 'detail', label: '질문지 상세', icon: FileText },
          { value: 'preview', label: '미리보기', icon: Eye },
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
      <Tabs.Panel value="detail" keepMounted className="data-[hidden]:hidden">
        {content}
      </Tabs.Panel>
      <Tabs.Panel value="preview" className="rounded-xl border bg-background">
        <QuestionnairePreview
          title={document.title}
          sections={document.sections}
        />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
