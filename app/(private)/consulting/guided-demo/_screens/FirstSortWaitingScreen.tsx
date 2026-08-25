import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import type { GuidedConsultingMainRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function FirstSortWaitingScreen() {
  return (
    <section className="mx-auto flex min-h-72 w-full max-w-2xl flex-col items-center justify-center rounded-2xl border bg-background/90 p-6 text-center shadow-sm md:p-8">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      </span>
      <p className="mt-5 text-xs font-bold tracking-[0.14em] text-primary">
        FIRST MERGE SORT
      </p>
      <h1 className="mt-2 text-xl font-bold tracking-[-0.03em]">
        결과가 도착할 때까지 기다리고 있어요
      </h1>
    </section>
  );
}

export const firstSortWaitingScreen = {
  mode: 'static',
  render: () => <FirstSortWaitingScreen />,
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingMainRenderEnvironment,
  ReactNode
>;
