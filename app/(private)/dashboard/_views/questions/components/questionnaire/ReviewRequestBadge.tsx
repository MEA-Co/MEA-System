import { MessageSquare } from 'lucide-react';

import { QUESTIONNAIRE_REVIEWS_VISIBLE } from '../../lib/questionnaire/features';

export function ReviewRequestBadge({ count }: { count: number }) {
  if (!QUESTIONNAIRE_REVIEWS_VISIBLE || !count) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/60 dark:text-green-200">
      <MessageSquare className="size-3" aria-hidden="true" />
      검토 요청 {count}개
    </span>
  );
}

export function NewReviewBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      <span className="size-2 rounded-full bg-blue-500" aria-hidden="true" />새
      검토 요청 {count}개
    </span>
  );
}
