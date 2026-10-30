'use client';
import {
  Check,
  ChevronDown,
  LoaderCircle,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatKoreanDate } from '@/lib/date-time';

import { useQuestionReviews } from '../../hooks/useQuestionReviews';
import { richTextPlainText } from '../../lib/rich-text';

import { QuestionAnnotationEditor } from './QuestionAnnotationEditor';
import { RichTextContent } from './RichTextContent';

type Props = {
  questionId: string;
  disabled?: boolean;
};
export function QuestionReviews(props: Props) {
  return <QuestionReviewsContent key={props.questionId} {...props} />;
}
function ReviewReadMarker({
  id,
  onVisible,
}: {
  id: string;
  onVisible: (id: string, visible: boolean) => void;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = marker.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) =>
      onVisible(
        id,
        entries.some((entry) => entry.isIntersecting),
      ),
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      onVisible(id, false);
    };
  }, [id, onVisible]);
  return (
    <span
      ref={marker}
      className="inline-flex items-center gap-1 text-xs text-blue-700"
    >
      <span className="size-2 rounded-full bg-blue-500" />새 검토 요청
    </span>
  );
}
function QuestionReviewsContent({ questionId, disabled = false }: Props) {
  const {
    data,
    error,
    canRequest,
    reload,
    editing,
    setEditing,
    description,
    setDescription,
    pending,
    submit,
    visible,
    cancel,
    setHistoryOpen,
    previousReviews,
    historyError,
    historyLoading,
    historyMore,
    loadMore,
    retryHistory,
  } = useQuestionReviews(questionId, disabled);
  const isOwner = data?.canResolve ?? false;
  const reviews = data?.reviews ?? [];
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      className="overflow-hidden rounded-xl border border-t-2 border-t-green-500 bg-background"
      aria-label="검토 요청"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded(!expanded);
          if (expanded) setHistoryOpen(false);
        }}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span>검토 요청</span>
        {!data && !error ? (
          <LoaderCircle
            className="size-4 animate-spin"
            aria-label="검토 요청 로딩"
          />
        ) : error ? (
          <span className="text-xs text-destructive">불러오기 실패</span>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-md bg-green-50 px-2 py-1 text-green-800 dark:bg-green-900 dark:text-green-100">
              미처리 {data?.pendingCount ?? 0}
            </span>
            <span className="text-muted-foreground">
              완료 {data?.completedCount ?? 0}
            </span>
            {!!data?.unreadIds?.length && (
              <span
                className="size-2 rounded-full bg-blue-500"
                aria-label="새 검토 요청"
              />
            )}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={`ml-auto size-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="space-y-3 border-t p-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              검토 요청을 불러오지 못했어요.{' '}
              <Button variant="ghost" size="sm" onClick={() => void reload()}>
                다시 시도
              </Button>
            </p>
          )}
          {!data && !error && (
            <div
              className="h-20 animate-pulse rounded-lg bg-muted"
              aria-label="검토 요청 로딩"
            />
          )}
          {data && !data.pendingCount && (
            <p className="text-sm text-muted-foreground">
              미처리 검토 요청이 없습니다.
            </p>
          )}
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                {data?.unreadIds?.includes(review.id) && (
                  <ReviewReadMarker id={review.id} onVisible={visible} />
                )}
                <p className="text-xs text-green-700 dark:text-green-300">
                  {review.requester_name} ·{' '}
                  {formatKoreanDate(review.created_at)}
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
          {!!data?.completedCount && (
            <details
              className="group rounded-xl border bg-background"
              onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                처리 완료된 요청 ({data.completedCount})
                <ChevronDown
                  className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <div className="space-y-3 border-t p-4">
                {previousReviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-lg border bg-background p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {review.requester_name} ·{' '}
                        {formatKoreanDate(review.created_at)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Check className="size-3" aria-hidden="true" />
                        처리 완료
                      </span>
                    </div>
                    <div className="text-sm text-foreground">
                      {review.title && (
                        <p className="mb-2 whitespace-pre-wrap">
                          {review.title}
                        </p>
                      )}
                      <RichTextContent value={review.description} />
                    </div>
                  </div>
                ))}
                {historyError && (
                  <p role="alert" className="text-sm text-destructive">
                    완료된 요청을 불러오지 못했어요.{' '}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void retryHistory()}
                    >
                      다시 시도
                    </Button>
                  </p>
                )}
                {historyLoading && !previousReviews.length && (
                  <p className="text-sm text-muted-foreground">
                    검토 요청을 불러오는 중…
                  </p>
                )}
                {historyMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyLoading}
                    onClick={() => void loadMore()}
                  >
                    더 보기
                  </Button>
                )}
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
                        cancel();
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
        </div>
      )}
    </section>
  );
}
