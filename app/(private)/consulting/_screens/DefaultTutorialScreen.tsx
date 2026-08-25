import { BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import type { GuidedConsultingMainRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import type { GuidedConsultingStaticRenderTarget } from '@/features/guided-consulting/core/protocol';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function DefaultTutorialScreen({
  request,
}: {
  request: GuidedConsultingStaticRenderTarget;
}) {
  return (
    <section className="mx-auto flex min-h-64 w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed bg-background/50 px-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BookOpen className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-5 text-xs font-bold tracking-[0.14em] text-primary">
        {request.screenId}
      </p>
      <h1 className="mt-2 text-xl font-bold tracking-[-0.03em] md:text-2xl">
        화면 렌더러가 표시한 설명 화면
      </h1>
    </section>
  );
}

export const defaultTutorialScreen = {
  mode: 'static',
  render: (request) => <DefaultTutorialScreen request={request} />,
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingMainRenderEnvironment,
  ReactNode
>;
