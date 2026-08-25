'use client';

import { ConsultingFlow } from '@/app/(private)/consulting/_components/ConsultingFlow';
import { mergeSortPlan } from '@/app/(private)/consulting/demo/_lib/plan';
import { mergeSortRenderer } from '@/app/(private)/consulting/demo/_lib/renderer';
import { mergeSortTools } from '@/app/(private)/consulting/demo/_lib/tools';

export function MergeSortDemo() {
  return (
    <ConsultingFlow
      debug
      plan={mergeSortPlan}
      renderer={mergeSortRenderer}
      tools={mergeSortTools}
    />
  );
}
