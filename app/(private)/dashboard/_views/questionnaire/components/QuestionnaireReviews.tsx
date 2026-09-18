'use client';

import { Check, MessageSquarePlus } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';

import {
  requestQuestionnaireReview,
  resolveQuestionnaireReview,
} from '../actions/review-questionnaire';
import type { QuestionnaireReview } from '../lib/types';

export function QuestionnaireReviews({
  versionId,
  isOwner,
  initialReviews,
}: {
  versionId: string;
  isOwner: boolean;
  initialReviews: QuestionnaireReview[];
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<{ id: string; description: string } | null>(null);
  async function submit(reviewId?: string) {
    if (inFlight.current) return;
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
      if (!reviewId && request.current?.description !== text)
        request.current = { id: crypto.randomUUID(), description: text };
      const payload = request.current;
      const result = reviewId
        ? await resolveQuestionnaireReview({ id: reviewId })
        : await requestQuestionnaireReview({ ...payload, versionId });
      if (result.error) {
        toast.update(toastId, {
          type: 'error',
          title: result.error,
          timeout: 8000,
        });
        return;
      }
      if (reviewId)
        setReviews((items) => items.filter((item) => item.id !== reviewId));
      else if (payload) {
        setReviews((items) => [
          {
            id: payload.id,
            description: payload.description,
            requester_name: '나',
            created_at: new Date().toISOString(),
          },
          ...items.filter((item) => item.id !== payload.id),
        ]);
        setDescription('');
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
  return (
    <section
      className="mx-auto mb-6 max-w-4xl space-y-4 rounded-xl border p-5"
      aria-labelledby="questionnaire-reviews-title"
    >
      <h2 id="questionnaire-reviews-title" className="font-semibold">
        {isOwner ? '받은 검토 요청' : '내 검토 요청'} ({reviews.length})
      </h2>
      {!isOwner && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="review-description" className="text-sm">
            검토가 필요한 내용을 설명해 주세요.
          </label>
          <Textarea
            id="review-description"
            className="bg-muted/50"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={5000}
            required
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !description.trim()}>
            <MessageSquarePlus aria-hidden="true" />
            검토 요청
          </Button>
        </form>
      )}
      {reviews.length ? (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{review.requester_name}</p>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => void submit(review.id)}
                  >
                    <Check aria-hidden="true" />
                    확인 완료
                  </Button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {review.description}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          아직 확인하지 않은 검토 요청이 없어요.
        </p>
      )}
    </section>
  );
}
