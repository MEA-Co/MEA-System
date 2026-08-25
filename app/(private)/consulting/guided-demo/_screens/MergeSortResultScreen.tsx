import { ArrowDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  isMergeSortScreenData,
  type MergeSortScreenData,
} from '@/app/(private)/consulting/guided-demo/_screens/data';
import { NumberList } from '@/app/(private)/consulting/guided-demo/_screens/NumberList';
import { Button } from '@/components/ui/button';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

export function MergeSortResultScreen({ data }: { data: MergeSortScreenData }) {
  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border bg-background/90 p-6 text-center shadow-sm md:p-8">
      <p className="text-xs font-bold tracking-[0.14em] text-primary">
        {data.label}
      </p>
      <p className="mt-5 text-xs font-semibold text-muted-foreground">INPUT</p>
      <div className="mt-3">
        <NumberList numbers={data.input} />
      </div>
      <ArrowDown
        className="mx-auto my-5 size-5 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="text-xs font-semibold text-muted-foreground">
        MERGE SORT RESULT
      </p>
      <div className="mt-3">
        <NumberList numbers={data.sorted ?? []} />
      </div>
    </section>
  );
}

export const mergeSortResultScreen = {
  mode: 'dynamic',
  validateData: isMergeSortScreenData,
  render: (request, environment) => (
    <ConsultingScreenView>
      <MergeSortResultScreen data={request.data as MergeSortScreenData} />
      <ConsultingPrompter
        pageLabel="RESULT 1 · 1/2"
        message={{
          title: '첫 번째 머지 소트가 끝났어요',
          description:
            'Agent는 Tool 결과가 도착할 때까지 기다린 후 이 화면을 요청했습니다.',
        }}
      >
        <Button
          type="button"
          onClick={() => environment.send({ type: 'user.next-explanation' })}
        >
          다음 설명
          <ChevronRight aria-hidden="true" />
        </Button>
      </ConsultingPrompter>
    </ConsultingScreenView>
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
