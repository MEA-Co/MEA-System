import { ArrowDown } from 'lucide-react';
import type { ReactNode } from 'react';

import type { GuidedConsultingMainRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  isMergeSortScreenData,
  type MergeSortScreenData,
} from '@/app/(private)/consulting/guided-demo/_screens/data';
import { NumberList } from '@/app/(private)/consulting/guided-demo/_screens/NumberList';
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
  render: (request) => (
    <MergeSortResultScreen data={request.data as MergeSortScreenData} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingMainRenderEnvironment,
  ReactNode
>;
