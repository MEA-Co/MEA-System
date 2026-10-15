'use client';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import useSWRInfinite from 'swr/infinite';

import { toast } from '@/components/ui/toast';

import { questionnaireFetcher } from '../lib/questionnaire/api-client';
import {
  createReviewReadBatch,
  mutateQuestionReview,
  prepareReviewSubmission,
  questionReviewUrl,
  type ReviewSubmission,
} from '../lib/reviews/client';
import type { QuestionReviewPage } from '../lib/reviews/types';
import { richTextPlainText } from '../lib/rich-text';

export function useQuestionReviews(questionId: string, disabled: boolean) {
  const url = questionReviewUrl(questionId);
  const { mutate: refresh } = useSWRConfig();
  const current = useSWR<QuestionReviewPage>(url, questionnaireFetcher, {
    refreshInterval: 10000,
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useSWRInfinite<QuestionReviewPage>(
    (index, previous) => {
      if (!historyOpen || (previous && !previous.hasMore)) return null;
      return `${url}${url.includes('?') ? '&' : '?'}completed=true&page=${index + 1}`;
    },
    questionnaireFetcher,
    {
      revalidateOnFocus: historyOpen,
      revalidateOnReconnect: historyOpen,
      refreshInterval: historyOpen ? 10000 : 0,
      revalidateFirstPage: true,
    },
  );
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<ReviewSubmission | null>(null);
  const canRequest = !!current.data?.canRequest;
  const refreshCounts = () =>
    refresh(
      (key) =>
        typeof key === 'string' &&
        (key.startsWith('/api/question-reviews?') ||
          key.startsWith('/api/questionnaires')),
    );
  async function reload() {
    const results = await Promise.allSettled([
      current.mutate(),
      ...(historyOpen ? [history.mutate()] : []),
      refreshCounts(),
    ]);
    return results.every((result) => result.status === 'fulfilled');
  }
  const readReload = useEffectEvent(async () => {
    await Promise.allSettled([current.mutate(), refreshCounts()]);
  });
  const batch = useRef<ReturnType<typeof createReviewReadBatch> | null>(null);
  if (batch.current === null)
    batch.current = createReviewReadBatch((ids) =>
      mutateQuestionReview(url, 'PUT', { ids }),
    );
  const [readVersion, setReadVersion] = useState(0);
  const flush = useEffectEvent(async () => {
    if (document.hidden) return;
    try {
      if (await batch.current!.flush()) await readReload();
    } catch {
      /* Retry visible IDs on the next poll/focus. */
    }
  });
  const visible = useCallback((id: string, value: boolean) => {
    batch.current!.setVisible(id, value);
    if (value) setReadVersion((version) => version + 1);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void flush();
    }, 150);
    return () => clearTimeout(timer);
  }, [current.data, readVersion]);
  useEffect(() => {
    const focus = () => {
      void flush();
    };
    document.addEventListener('visibilitychange', focus);
    return () => {
      document.removeEventListener('visibilitychange', focus);
    };
  }, []);
  async function submit(reviewId?: string) {
    if (
      disabled ||
      inFlight.current ||
      (reviewId
        ? !current.data?.canResolve
        : !canRequest || !richTextPlainText(description).trim())
    )
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
      if (!reviewId)
        request.current = prepareReviewSubmission(
          request.current,
          questionId,
          description,
        );
      await mutateQuestionReview(
        url,
        reviewId ? 'PATCH' : 'POST',
        reviewId ? { id: reviewId } : request.current,
      );
      // The write succeeded: clear the form before any refresh can fail.
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
      if (!(await reload().catch(() => false)))
        toast.add({
          type: 'error',
          title:
            '저장은 완료했지만 목록을 갱신하지 못했어요. 목록을 다시 불러와 주세요.',
          timeout: 8000,
        });
    } catch (error) {
      toast.update(toastId, {
        type: 'error',
        title:
          error instanceof Error
            ? error.message
            : '처리 결과를 확인하지 못했어요. 다시 시도해 주세요.',
        timeout: 8000,
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return {
    data: current.data,
    error: current.error,
    canRequest,
    reload,
    editing,
    setEditing,
    description,
    setDescription,
    pending,
    submit,
    visible,
    cancel: () => {
      setEditing(false);
      setDescription('');
      request.current = null;
    },
    setHistoryOpen,
    previousReviews: [
      ...new Map(
        (history.data ?? [])
          .flatMap((page) => page.reviews)
          .map((review) => [review.id, review]),
      ).values(),
    ],
    historyError: history.error,
    historyLoading: history.isLoading || history.isValidating,
    historyMore: history.data?.at(-1)?.hasMore ?? false,
    loadMore: async () => {
      try {
        await history.setSize((size) => size + 1);
      } catch {
        /* SWR exposes historyError for retry. */
      }
    },
    retryHistory: async () => {
      try {
        await history.mutate();
      } catch {
        /* Keep the retry UI available. */
      }
    },
  };
}
