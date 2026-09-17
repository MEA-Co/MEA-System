import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const tutorialHighlight =
  'relative z-40 border border-emerald-400 bg-emerald-50/70 p-4 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]';

export function TutorialBubble({
  step,
  title,
  children,
  actionLabel,
  onAction,
  className,
  arrowClassName,
  onBack,
  onSkip,
}: {
  step: string;
  title: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  className?: string;
  arrowClassName?: string;
  onBack?: () => void;
  onSkip?: () => void;
}) {
  return (
    <aside
      role="dialog"
      aria-label={`선택과목 컨설팅 안내 ${step}`}
      className={cn(
        'relative z-50 mt-4 border border-emerald-300 bg-background p-4 shadow-lg',
        className,
      )}
    >
      <span
        className={cn(
          'absolute -top-2 left-7 size-4 rotate-45 border-l border-t border-emerald-300 bg-background',
          arrowClassName,
        )}
        aria-hidden="true"
      />
      <p className="text-xs font-semibold text-emerald-700">{step}</p>
      <p className="mt-2 text-base font-semibold">{title}</p>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {onSkip ? (
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            안내 건너뛰기
          </Button>
        ) : null}
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack}>
            이전
          </Button>
        ) : null}
        <Button type="button" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </aside>
  );
}
