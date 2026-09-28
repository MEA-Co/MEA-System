import { MessageSquare } from 'lucide-react';

export function ReviewRequestBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/60 dark:text-green-200">
      <MessageSquare className="size-3" aria-hidden="true" />
      검토 요청 {count}개
    </span>
  );
}
