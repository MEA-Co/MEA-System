import { CheckCircle2, Lightbulb } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import type { GuidedConsultingExplanation } from '@/features/guided-consulting/core/types';

type ConsultingPrompterProps = {
  explanation: GuidedConsultingExplanation;
  pageLabel?: string;
  complete?: boolean;
  children?: ReactNode;
};

export function ConsultingPrompter({
  explanation,
  pageLabel,
  complete = false,
  children,
}: ConsultingPrompterProps) {
  return (
    <Card className="gap-0 overflow-hidden rounded-xl border bg-card/95 py-0 shadow-xl ring-0 backdrop-blur-md supports-backdrop-filter:bg-card/90">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="h-px w-6 bg-primary/70" aria-hidden="true" />
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground">
              메아 (MEA)
            </p>
          </div>
          <p className="text-xs font-bold tracking-[0.12em] text-primary">
            {pageLabel ?? explanation.eyebrow}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)] md:items-start">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-[-0.02em] md:text-xl">
              {complete && (
                <CheckCircle2
                  className="size-5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              )}
              {explanation.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-[0.95rem]">
              {explanation.description}
            </p>
          </div>

          {explanation.tips && explanation.tips.length > 0 && (
            <div className="rounded-lg bg-muted/55 px-3.5 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold">
                <Lightbulb
                  className="size-3.5 text-primary"
                  aria-hidden="true"
                />
                입력 가이드
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                {explanation.tips.map((tip) => (
                  <li key={tip}>· {tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {children && (
          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
