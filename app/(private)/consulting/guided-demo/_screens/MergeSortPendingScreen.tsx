import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  isMergeSortScreenData,
  type MergeSortScreenData,
} from '@/app/(private)/consulting/guided-demo/_screens/data';
import { NumberList } from '@/app/(private)/consulting/guided-demo/_screens/NumberList';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function MergeSortPendingScreen({ data }: { data: MergeSortScreenData }) {
  return (
    <ConsultingScreenView>
      <section className="mx-auto flex min-h-72 w-full max-w-3xl flex-col items-center justify-center rounded-2xl border bg-background/90 p-6 text-center shadow-sm md:p-8">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-bold tracking-[0.14em] text-primary">
          두 번째 머지 소트 실행 중
        </p>
        <h1 className="mt-2 text-xl font-bold tracking-[-0.03em]">
          결과가 도착하면 이 화면이 업데이트됩니다
        </h1>
        <div className="mt-6">
          <NumberList numbers={data.input} />
        </div>
      </section>
      <ConsultingPrompter
        message={{
          label: 'UPDATING',
          title: '결과를 기다리는 동안 화면을 먼저 보여줍니다',
          segments: [
            {
              text: 'Tool 결과가 도착하면 Agent가 결과 화면 ID와 데이터를 새로 전달합니다.',
            },
          ],
        }}
      />
    </ConsultingScreenView>
  );
}

export const mergeSortPendingScreen = {
  mode: 'dynamic',
  validateData: isMergeSortScreenData,
  render: (request) => (
    <MergeSortPendingScreen data={request.data as MergeSortScreenData} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
