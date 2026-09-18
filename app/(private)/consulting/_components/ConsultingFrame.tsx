'use client';

import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type ConsultingFrameProps = {
  title: string;
  children: ReactNode;
  currentStep?: number;
  stepCount?: number;
  onBack?: () => void;
  headerStatus?: ReactNode;
  topRightAction?: ReactNode;
  progressLabels?: readonly string[];
  isComplete?: boolean;
};

export function ConsultingFrame({
  title,
  children,
  currentStep,
  stepCount,
  onBack,
  headerStatus,
  topRightAction,
  progressLabels,
  isComplete = false,
}: ConsultingFrameProps) {
  const hasProgress =
    currentStep !== undefined && stepCount !== undefined && stepCount > 0;
  const progress = hasProgress ? (currentStep / stepCount) * 100 : 100;

  return (
    <Card className="relative min-h-168 gap-0 overflow-hidden rounded-2xl border-border bg-background py-0 shadow-none ring-0">
      <header className="border-b border-border bg-background">
        <div className="flex h-14 items-center justify-between gap-4 px-5 md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="size-2 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
            <p className="truncate text-xs font-semibold tracking-[0.12em] text-muted-foreground">
              {title}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {headerStatus}
            {hasProgress && !progressLabels && (
              <p className="text-xs font-medium text-muted-foreground">
                {currentStep} / {stepCount}
              </p>
            )}
          </div>
        </div>

        {hasProgress && !progressLabels && (
          <div
            className="h-1 bg-muted"
            role="progressbar"
            aria-label="컨설팅 진행률"
            aria-valuemin={0}
            aria-valuemax={stepCount}
            aria-valuenow={currentStep}
          >
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      {onBack && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="absolute top-18 left-3 z-30 text-muted-foreground md:left-5"
          aria-label="이전 단계로 돌아가기"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          이전으로
        </Button>
      )}

      {topRightAction && (
        <div className="absolute top-18 right-3 z-30 md:right-5">
          {topRightAction}
        </div>
      )}

      <CardContent
        className={
          progressLabels
            ? 'min-h-153 bg-muted/20 p-5 md:p-8'
            : 'min-h-153 bg-muted/20 p-5 pt-16 md:p-8 md:pt-20'
        }
      >
        {progressLabels && (
          <div className="mb-6 flex justify-end">
            <ol
              tabIndex={0}
              aria-label="컨설팅 진행 단계"
              className="group/progress grid w-full max-w-sm rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600"
              style={{
                gridTemplateColumns: `repeat(${progressLabels.length}, minmax(0, 1fr))`,
              }}
            >
              {progressLabels.map((label, index) => {
                const filled = isComplete || index < (currentStep ?? 0);
                const current = !isComplete && index === (currentStep ?? 0) - 1;
                const status = current ? '진행 중' : filled ? '완료' : '예정';
                return (
                  <li
                    key={label}
                    className="relative min-w-0 text-center"
                    aria-current={current ? 'step' : undefined}
                  >
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className={`absolute top-4 right-1/2 h-px w-full ${filled ? 'bg-violet-500' : 'bg-slate-200'}`}
                      />
                    )}
                    <span className="relative flex h-8 items-center justify-center">
                      <span
                        aria-hidden="true"
                        className={`size-3 rounded-full border-2 ${filled ? 'border-violet-600 bg-violet-600' : 'border-slate-300 bg-white'} ${current ? 'outline-2 outline-offset-3 outline-violet-200' : ''}`}
                      />
                    </span>
                    <span
                      className={`block px-1 text-xs leading-5 opacity-0 transition-opacity group-hover/progress:opacity-100 group-focus-within/progress:opacity-100 motion-reduce:transition-none ${current ? 'font-semibold text-violet-800' : 'text-muted-foreground'}`}
                    >
                      {label}
                    </span>
                    <span className="sr-only">{status}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
