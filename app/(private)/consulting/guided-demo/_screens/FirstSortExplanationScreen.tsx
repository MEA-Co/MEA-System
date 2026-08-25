'use client';

import { BookOpen, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function FirstSortExplanationScreen({
  environment,
}: {
  environment: GuidedConsultingScreenRenderEnvironment;
}) {
  return (
    <ConsultingScreenView>
      <section className="mx-auto flex min-h-64 w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed bg-background/50 px-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BookOpen className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-bold tracking-[0.14em] text-primary">
          FIRST MERGE SORT
        </p>
        <h1 className="mt-2 text-xl font-bold tracking-[-0.03em] md:text-2xl">
          결과를 기다린 뒤 다음 화면으로 이동합니다
        </h1>
      </section>

      <ConsultingPrompter
        message={{
          label: 'STEP 1 · 1/1',
          title: '정렬할 숫자 10개를 입력해 주세요',
          segments: [
            {
              text: '첫 번째 실행은 머지 소트 Tool 결과를 기다린 다음 결과 화면을 표시합니다.',
            },
          ],
        }}
      >
        <Button
          type="button"
          onClick={() => environment.send({ type: 'user.start-input' })}
        >
          입력하기
          <ChevronRight aria-hidden="true" />
        </Button>
      </ConsultingPrompter>
    </ConsultingScreenView>
  );
}

export const firstSortExplanationScreen = {
  mode: 'static',
  render: (_request, environment) => (
    <FirstSortExplanationScreen environment={environment} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
