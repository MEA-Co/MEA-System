'use client';

import { Check, ChevronDown, Plus, Send, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

import { useQuestionnaireApi } from '../lib/api-client';
import type { QuestionnaireReviewContext } from '../lib/types';

import { QuestionAnnotationEditor } from './QuestionAnnotationEditor';
import { RichTextContent } from './RichTextContent';

export function QuestionnaireReviews({
  versionId,
  questionId,
  isOwner,
  initialReviews,
  disabled = false,
  canRequest = true,
}: QuestionnaireReviewContext & { questionId?: string }) {
  const reviews = initialReviews.filter((review) => !review.resolved_at);
  const previousReviews = initialReviews.filter(
    (review) => !!review.resolved_at,
  );
  const { command } = useQuestionnaireApi();
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
    if (!reviewId && (!questionId || !description.trim())) return;
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
      const result = reviewId
        ? await command(`/${versionId}/reviews/${reviewId}`, 'PATCH', {
            resolved: true,
          })
        : await command(`/${versionId}/reviews`, 'POST', request.current);
      if (result.error) {
        toast.update(toastId, {
          type: 'error',
          title: result.error,
          timeout: 8000,
        });
        return;
      }
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
  if (!initialReviews.length && (isOwner || !questionId || !canRequest))
    return null;
  return (
    <section
      className={`mt-4 space-y-3 border-l-2 pl-4 ${reviews.length || (!isOwner && questionId && canRequest) ? 'border-green-300 dark:border-green-700' : 'border-border'}`}
      aria-label={isOwner ? '받은 검토 요청' : '내 검토 요청'}
    >
      {reviews.length > 0 && (
        <p className="text-xs font-medium text-green-700 dark:text-green-300">
          {isOwner ? '받은 검토 요청' : '내 검토 요청'} ({reviews.length})
        </p>
      )}
      {reviews.map((review) => (
        <div
          key={review.id}
          className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-green-700 dark:text-green-300">
              {review.requester_name}
            </p>
            {isOwner && (
              <Button
                size="sm"
                className="bg-green-200 text-green-900 hover:bg-green-300 focus-visible:ring-green-500/40 dark:bg-green-900 dark:text-green-100 dark:hover:bg-green-800"
                disabled={pending || disabled}
                onClick={() => void submit(review.id)}
              >
                <Check aria-hidden="true" />
                확인 완료
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
            이전 검토 요청 ({previousReviews.length})
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
                  <span>{review.requester_name}</span>
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3" aria-hidden="true" />
                    확인 완료
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
      {!isOwner &&
        canRequest &&
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
                  disabled={pending || disabled || !description.trim()}
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
