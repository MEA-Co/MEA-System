'use client';

import { ArrowLeft } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { type ReactNode, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type ConsultingPrompterPlacement =
  'top' | 'bottom' | 'left' | 'right' | 'center';

export type ConsultingPrompterSize = 'compact' | 'default' | 'wide';

type ConsultingMainProps = {
  children?: ReactNode;
  prompter?: ReactNode;
  prompterPlacement?: ConsultingPrompterPlacement;
  prompterSize?: ConsultingPrompterSize;
  canGoBack?: boolean;
  onBack?: () => void;
  onPrompterTransitionComplete?: () => void;
};

const placementClassNames: Record<ConsultingPrompterPlacement, string> = {
  top: 'items-start justify-center',
  bottom: 'items-end justify-center',
  left: 'items-end justify-center md:items-center md:justify-start',
  right: 'items-end justify-center md:items-center md:justify-end',
  center: 'items-center justify-center',
};

const sizeClassNames: Record<ConsultingPrompterSize, string> = {
  compact: 'w-full md:max-w-md',
  default: 'w-full md:max-w-3xl',
  wide: 'w-full',
};

export function ConsultingMain({
  children,
  prompter,
  prompterPlacement = 'bottom',
  prompterSize = 'wide',
  canGoBack = false,
  onBack,
  onPrompterTransitionComplete,
}: ConsultingMainProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!shouldReduceMotion || !onPrompterTransitionComplete) return;

    const completionTimer = window.setTimeout(onPrompterTransitionComplete, 0);
    return () => window.clearTimeout(completionTimer);
  }, [
    onPrompterTransitionComplete,
    prompterPlacement,
    prompterSize,
    shouldReduceMotion,
  ]);

  return (
    <Card className="relative isolate min-h-136 gap-0 overflow-hidden rounded-2xl border-border/80 bg-background py-0 shadow-sm ring-0 md:min-h-152">
      <div
        className="absolute inset-0 -z-20 bg-linear-to-br from-muted/65 via-background to-muted/20"
        aria-hidden="true"
      />
      <div
        className="absolute -top-28 right-[-10%] -z-10 size-80 rounded-full bg-primary/[0.035] blur-3xl"
        aria-hidden="true"
      />

      <div className="absolute inset-x-0 top-0 z-10 flex h-12 items-center gap-3 border-b border-border/70 bg-background/75 px-5 backdrop-blur-sm md:px-7">
        <span
          className="size-2 rounded-full bg-primary/70 shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_10%,transparent)]"
          aria-hidden="true"
        />
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
          main
        </p>
      </div>

      {onBack && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canGoBack}
          onClick={onBack}
          className="absolute top-14 left-3 z-30 text-muted-foreground md:top-16 md:left-5"
          aria-label="이전 단계로 돌아가기"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          이전으로
        </Button>
      )}

      <CardContent className="relative z-0 p-5 pt-16 md:p-8 md:pt-20">
        {children}
      </CardContent>

      {prompter && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-3 top-15 bottom-3 z-20 flex md:inset-x-5 md:top-17 md:bottom-5',
            placementClassNames[prompterPlacement],
          )}
        >
          <motion.div
            layout={!shouldReduceMotion}
            onLayoutAnimationComplete={onPrompterTransitionComplete}
            transition={{
              layout: {
                type: 'spring',
                stiffness: 360,
                damping: 34,
              },
            }}
            className={cn(
              'pointer-events-auto max-h-full',
              sizeClassNames[prompterSize],
            )}
          >
            {prompter}
          </motion.div>
        </div>
      )}
    </Card>
  );
}
