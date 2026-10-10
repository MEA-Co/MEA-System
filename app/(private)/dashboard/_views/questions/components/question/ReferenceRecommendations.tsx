import { BookOpen, Compass } from 'lucide-react';

import { cn } from '@/lib/utils';

export function ReferenceRecommendations({
  explorationRecommended = false,
  studyRecommended = false,
  prominent = false,
}: {
  explorationRecommended?: boolean;
  studyRecommended?: boolean;
  prominent?: boolean;
}) {
  if (!explorationRecommended && !studyRecommended) return null;

  return (
    <div
      className={cn(
        'min-w-0',
        prominent ? 'overflow-hidden rounded-xl' : 'space-y-2',
      )}
    >
      {explorationRecommended && (
        <div
          className={cn(
            'px-3 py-2',
            prominent
              ? 'bg-blue-600 pr-9 text-white'
              : 'rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
          )}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Compass className="size-4 shrink-0" aria-hidden="true" />
            탐구활동 참조 권장
          </p>
          <p className="mt-1 text-xs font-normal">
            ‘@탐구활동’을 입력하여 관련 탐구활동을 답변에 연결해 주세요.
          </p>
        </div>
      )}
      {studyRecommended && (
        <div
          className={cn(
            'px-3 py-2',
            prominent
              ? 'bg-violet-600 pr-9 text-white'
              : 'rounded-lg border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300',
          )}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <BookOpen className="size-4 shrink-0" aria-hidden="true" />
            공부법 참조 권장
          </p>
          <p className="mt-1 text-xs font-normal">
            ‘@공부법’을 입력하여 관련 학습 전략을 답변에 연결해 주세요.
          </p>
        </div>
      )}
    </div>
  );
}
