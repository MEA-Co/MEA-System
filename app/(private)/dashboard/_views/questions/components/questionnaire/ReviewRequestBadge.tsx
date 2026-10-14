import { MessageSquare } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { QUESTIONNAIRE_REVIEWS_VISIBLE } from '../../lib/questionnaire/features';

export function ReviewRequestBadge({ count }: { count: number }) {
  if (!QUESTIONNAIRE_REVIEWS_VISIBLE || !count) return null;
  return (
    <Badge variant="highlight">
      <MessageSquare className="size-3" aria-hidden="true" />
      검토 요청 {count}개
    </Badge>
  );
}

export function NewReviewBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <Badge
      variant="secondary"
      className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
    >
      <span className="size-2 rounded-full bg-blue-500" aria-hidden="true" />새
      검토 요청 {count}개
    </Badge>
  );
}
