'use client';

import { Check, ChevronDown, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

import { questionnaireFetcher } from '../../lib/questionnaire/api-client';
import type { QuestionnaireReview } from '../../lib/questionnaire/types';
import { richTextPlainText } from '../../lib/rich-text';
import { QuestionAnnotationEditor } from '../questionnaire/QuestionAnnotationEditor';

import { RichTextContent } from './RichTextContent';

type ReviewData = {
  reviews: QuestionnaireReview[];
  canResolve: boolean;
  canRequest: boolean;
  unreadIds?: string[];
};
export function QuestionReviews({
  questionId,
  questionnaireId,
  disabled = false,
  allowRequest = true,
}: {
  questionId: string;
  questionnaireId?: string;
  disabled?: boolean;
  allowRequest?: boolean;
}) {
  const { mutate: refresh } = useSWRConfig();
  const url = `/api/question-reviews/${questionId}${questionnaireId ? `?originQuestionnaireId=${questionnaireId}` : ''}`;
  const { data, error, mutate } = useSWR<ReviewData>(
    url,
    questionnaireFetcher,
    { refreshInterval: 10000 },
  );
  return (
    <QuestionReviewsContent
      key={questionId}
      questionId={questionId}
      questionnaireId={questionnaireId}
      disabled={disabled}
      data={
        data
          ? { ...data, canRequest: data.canRequest && allowRequest }
          : undefined
      }
      error={error}
      reload={async () => {
        await mutate();
        void refresh(
          (key) =>
            typeof key === 'string' &&
            (key.startsWith('/api/question-reviews') ||
              key.startsWith('/api/questionnaires')),
        );
      }}
    />
  );
}
function ReviewReadMarker({
  id,
  questionId,
  onRead,
}: {
  id: string;
  questionId: string;
  onRead: () => Promise<unknown>;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = marker.current;
    if (!node) return;
    let cancelled = false;
    let visible = false;
    let busy = false;
    const mark = async () => {
      if (!visible || document.hidden || busy || cancelled) return;
      busy = true;
      try {
        const response = await fetch(`/api/question-reviews/${questionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id] }),
        });
        if (response.ok && !cancelled) await onRead();
      } finally {
        busy = false;
      }
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      void mark().catch(() => {});
    });
    observer.observe(node);
    const focus = () => void mark().catch(() => {});
    document.addEventListener('visibilitychange', focus);
    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', focus);
    };
  }, [id, questionId, onRead]);
  return (
    <span
      ref={marker}
      className="inline-flex items-center gap-1 text-xs text-blue-700"
    >
      <span className="size-2 rounded-full bg-blue-500" />새 검토 요청
    </span>
  );
}
function QuestionReviewsContent({
  questionId,
  questionnaireId,
  disabled,
  data,
  error,
  reload,
}: {
  questionId: string;
  questionnaireId?: string;
  disabled: boolean;
  data?: ReviewData;
  error?: Error;
  reload: () => Promise<unknown>;
}) {
  const initialReviews = data?.reviews ?? [];
  const isOwner = data?.canResolve ?? false;
  const canRequest = data?.canRequest ?? false;
  const reviews = initialReviews.filter((review) => !review.resolved_at);
  const previousReviews = initialReviews.filter(
    (review) => !!review.resolved_at,
  );
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<{
    id: string;
    questionId: string;
    description: string;
  } | null>(null);
  async function submit(reviewId?: string) {
    if (disabled || inFlight.current) return;
    if (!reviewId && !canRequest) return;
    if (!reviewId && (!questionId || !richTextPlainText(description).trim()))
      return;
    inFlight.current = true;
    setPending(true);
    const toastId = toast.add({
      type: 'loading',
      title: reviewId
        ? '검토 요청을 확인 처리하고 있어요.'
        : '검토 요청을 남기고 있어요.',
      timeout: 0,
    });
    try {
      const text = description.trim();
      if (
        !reviewId &&
        questionId &&
        (request.current?.description !== text ||
          request.current?.questionId !== questionId)
      )
        request.current = {
          id: crypto.randomUUID(),
          questionId,
          description: text,
        };
      const response = await fetch(`/api/question-reviews/${questionId}`, {
        method: reviewId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          reviewId
            ? { id: reviewId }
            : {
                ...request.current,
                originQuestionnaireId: questionnaireId ?? null,
              },
        ),
      });
      const result = await response.json();
      if (!response.ok && !result.error)
        throw new Error('Review request failed');
      if (result.error) {
        toast.update(toastId, {
          type: 'error',
          title: result.error,
          timeout: 8000,
        });
        return;
      }
      await reload();
      if (!reviewId) {
        setDescription('');
        setEditing(false);
        request.current = null;
      }
      toast.update(toastId, {
        type: 'success',
        title: reviewId ? '검토 요청을 확인했어요.' : '검토 요청을 남겼어요.',
        timeout: 3000,
      });
    } catch {
      toast.update(toastId, {
        type: 'error',
        title: '처리 결과를 확인하지 못했어요. 다시 시도해 주세요.',
        timeout: 8000,
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        검토 요청을 불러오지 못했어요.{' '}
        <button onClick={() => void reload()}>다시 시도</button>
      </p>
    );
  if (!data)
    return (
      <p className="text-sm text-muted-foreground">검토 요청을 불러오는 중…</p>
    );
  if (!initialReviews.length && !canRequest) return null;
  return (
    <section
      className={`mt-4 space-y-3 border-l-2 pl-4 ${reviews.length || (!isOwner && questionId && canRequest) ? 'border-green-300 dark:border-green-700' : 'border-border'}`}
      aria-label={'검토 요청'}
    >
      {reviews.length > 0 && (
        <p className="text-xs font-medium text-green-700 dark:text-green-300">
          {'검토 요청'} ({reviews.length})
        </p>
      )}
      {reviews.map((review) => (
        <div
          key={review.id}
          className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {data.unreadIds?.includes(review.id) && (
              <ReviewReadMarker
                id={review.id}
                questionId={questionId}
                onRead={reload}
              />
            )}
            <p className="text-xs text-green-700 dark:text-green-300">
              {review.requester_name} ·{' '}
              {new Date(review.created_at).toLocaleDateString('ko-KR')}
            </p>
            {isOwner && (
              <Button
                size="sm"
                className="bg-green-200 text-green-900 hover:bg-green-300 focus-visible:ring-green-500/40 dark:bg-green-900 dark:text-green-100 dark:hover:bg-green-800"
                disabled={pending || disabled}
                onClick={() => void submit(review.id)}
              >
                <Check aria-hidden="true" />
                처리 완료
              </Button>
            )}
          </div>
          {!questionId && (
            <p className="mb-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
              기존 질문지 전체 검토 요청
            </p>
          )}
          <div className="text-sm">
            {review.title && (
              <p className="mb-2 whitespace-pre-wrap">{review.title}</p>
            )}
            <RichTextContent value={review.description} />
          </div>
        </div>
      ))}
      {previousReviews.length > 0 && (
        <details className="group rounded-xl border bg-muted/30">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            처리 완료된 요청 ({previousReviews.length})
            <ChevronDown
              className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-3 border-t p-4">
            {previousReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-lg border bg-muted/40 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {review.requester_name} ·{' '}
                    {new Date(review.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3" aria-hidden="true" />
                    처리 완료
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {review.title && (
                    <p className="mb-2 whitespace-pre-wrap">{review.title}</p>
                  )}
                  <RichTextContent value={review.description} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {canRequest &&
        questionId &&
        (editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <QuestionAnnotationEditor
              id={`review-${questionId}`}
              label="검토 항목"
              text={description}
              onTextChange={setDescription}
              disabled={pending || disabled}
              required
              textMaxLength={5000}
              actions={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="검토 항목 작성 취소"
                  disabled={pending}
                  onClick={() => {
                    setEditing(false);
                    setDescription('');
                    request.current = null;
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              }
            >
              <div className="mt-3 flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    pending ||
                    disabled ||
                    !richTextPlainText(description).trim()
                  }
                >
                  <Send aria-hidden="true" />
                  검토 요청
                </Button>
              </div>
            </QuestionAnnotationEditor>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => setEditing(true)}
          >
            <Plus aria-hidden="true" />
            검토 요청 추가
          </Button>
        ))}
    </section>
  );
}
