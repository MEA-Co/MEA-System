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
  topRightAction?: ReactNode;
};

export function ConsultingFrame({
  title,
  children,
  currentStep,
  stepCount,
  onBack,
  topRightAction,
}: ConsultingFrameProps) {
  const hasProgress =
    currentStep !== undefined && stepCount !== undefined && stepCount > 0;
  const progress = hasProgress ? (currentStep / stepCount) * 100 : 100;

  return (
    <Card className="relative isolate min-h-168 gap-0 overflow-hidden rounded-2xl border-border/80 bg-background py-0 shadow-sm ring-0">
      <div
        className="absolute inset-0 -z-20 bg-linear-to-br from-muted/65 via-background to-muted/20"
        aria-hidden="true"
      />
      <div
        className="absolute -top-28 right-[-10%] -z-10 size-80 rounded-full bg-primary/4 blur-3xl"
        aria-hidden="true"
      />

      <header className="relative z-10 border-b border-border/70 bg-background/75 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between gap-4 px-5 md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="size-2 shrink-0 rounded-full bg-primary/70 shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_10%,transparent)]"
              aria-hidden="true"
            />
            <p className="truncate text-xs font-semibold tracking-[0.12em] text-muted-foreground">
              {title}
            </p>
          </div>

          {hasProgress && (
            <p className="shrink-0 text-xs font-medium text-muted-foreground">
              {currentStep} / {stepCount}
            </p>
          )}
        </div>

        {hasProgress && (
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

      <CardContent className="relative z-0 min-h-153 p-5 pt-16 md:p-8 md:pt-20">
        {children}
      </CardContent>
    </Card>
  );
}
