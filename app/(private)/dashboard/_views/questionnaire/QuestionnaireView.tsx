'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { PublicationReadMarker } from './components/PublicationNotifications';
import { PublishedQuestionnaire } from './components/PublishedQuestionnaire';
import { QuestionnaireEditor } from './components/QuestionnaireEditor';
import { QuestionnaireList } from './components/QuestionnaireList';
import { QuestionnaireLoading } from './components/QuestionnaireLoading';
import { QuestionnaireReviews } from './components/QuestionnaireReviews';
import {
  type QuestionnaireApiError,
  useQuestionnaireResource,
} from './lib/api-client';
import type { QuestionnaireViewData } from './lib/types';

export function QuestionnaireView({ requestedId }: { requestedId?: string }) {
  const searchParams = useSearchParams();
  const id = searchParams.get('draft') ?? requestedId;
  const [creation, setCreation] = useState(() => ({
    id,
    key: crypto.randomUUID(),
  }));
  if (creation.id !== id)
    setCreation({ id, key: id === 'new' ? crypto.randomUUID() : creation.key });
  const newKey = creation.key;
  const path = id === 'new' ? `/new?instance=${newKey}` : id ? `/${id}` : '';
  const { data, error, mutate, isLoading } =
    useQuestionnaireResource<QuestionnaireViewData>(path);
  if (!data || (id === 'new' && isLoading)) {
    if (!error) return <QuestionnaireLoading />;
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-6" role="alert">
        <p>{error.message}</p>
        <Button variant="outline" onClick={() => void mutate()}>
          다시 시도
        </Button>
      </div>
    );
  }
  const document = data.initialDraft ?? data.publishedDocument;
  if (id && id !== 'new' && document?.versionId !== id)
    return error ? (
      <p role="alert">{error.message}</p>
    ) : (
      <QuestionnaireLoading />
    );
  return (
    <QuestionnaireContent
      key={document?.versionId ?? 'list'}
      data={data}
      error={error}
    />
  );
}
function QuestionnaireContent({
  data,
  error,
}: {
  data: QuestionnaireViewData;
  error?: QuestionnaireApiError;
}) {
  const [openedDraft] = useState(data.initialDraft);
  const {
    initialDraft,
    drafts,
    published,
    distributed,
    staff,
    selected,
    reviews,
    publishedDocument,
  } = data;
  const editorDraft = initialDraft ?? openedDraft;
  const editUnavailable =
    error?.status === 404 ||
    error?.status === 403 ||
    error?.status === 401 ||
    (!!openedDraft && !initialDraft);
  const reviewContext =
    selected && selected.status !== 'draft' && staff
      ? {
          versionId: selected.id,
          isOwner: selected.isOwner,
          initialReviews: reviews,
          disabled: !!error,
          canRequest: selected.status === 'published',
        }
      : undefined;
  const pendingReviewCount = reviews.filter(
    (review) => !review.resolved_at,
  ).length;
  const unlinkedReviews = reviews.filter((review) => !review.question_id);
  if (editorDraft || publishedDocument) {
    return (
      <>
        {error && (
          <p
            role="alert"
            className="mx-auto mb-4 max-w-4xl rounded-lg bg-destructive/10 p-4 text-sm"
          >
            {error.message}
          </p>
        )}
        {((staff && selected?.status === 'published' && !selected.isOwner) ||
          (!staff && selected?.status === 'distributed')) &&
          selected && <PublicationReadMarker versionId={selected.id} />}
        <div className="mx-auto mb-6 max-w-4xl">
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link href="/dashboard?view=questionnaire" prefetch={false} />
            }
            nativeButton={false}
          >
            <ArrowLeft aria-hidden="true" />
            질문지 목록으로
          </Button>
        </div>
        {reviewContext?.isOwner && pendingReviewCount > 0 && (
          <div
            role="status"
            className="mx-auto mb-4 max-w-4xl rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
          >
            확인하지 않은 검토 요청이 {pendingReviewCount}개 있어요. 각 질문
            아래에서 확인해 주세요.
          </div>
        )}
        {reviewContext && unlinkedReviews.length > 0 && (
          <div className="mx-auto mb-6 max-w-4xl">
            <QuestionnaireReviews
              {...reviewContext}
              initialReviews={unlinkedReviews}
            />
          </div>
        )}
        {initialDraft && selected?.status === 'published' && (
          <p className="mx-auto mb-4 max-w-4xl rounded-lg bg-muted p-4 text-sm">
            게시 중인 질문지예요. 저장한 수정 내용은 다른 리드와 관리자에게도
            반영됩니다. 배포는 목록에서 진행할 수 있어요.
          </p>
        )}
        {editorDraft ? (
          <QuestionnaireEditor
            key={`editor:${editorDraft.versionId}`}
            initialDraft={editorDraft}
            remoteUnavailable={editUnavailable}
            reviewContext={reviewContext}
          />
        ) : publishedDocument && !error ? (
          <PublishedQuestionnaire
            document={publishedDocument}
            distributed={selected?.status === 'distributed'}
            staff={staff}
            editableExplanationIds={data.editableExplanationIds}
            reviewContext={reviewContext}
          />
        ) : null}
      </>
    );
  }
  return (
    <section
      className="mx-auto max-w-4xl"
      aria-labelledby="questionnaire-management-title"
    >
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error.message}
        </p>
      )}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            id="questionnaire-management-title"
            className="text-2xl font-semibold tracking-tight"
          >
            질문지 관리
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {staff
              ? '질문지를 작성하고 게시·검토·배포할 수 있어요.'
              : '배포된 질문지를 확인해 보세요.'}
          </p>
        </div>
        {staff && (
          <Button
            render={
              <Link
                href="/dashboard?view=questionnaire&draft=new"
                prefetch={false}
              />
            }
            nativeButton={false}
          >
            <Plus aria-hidden="true" />새 질문지 제작
          </Button>
        )}
      </div>
      <QuestionnaireList
        drafts={drafts}
        published={published}
        distributed={distributed}
        staff={staff}
      />
    </section>
  );
}
