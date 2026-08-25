'use client';

import { GuidedConsultingFlow } from '@/app/(private)/consulting/_components/GuidedConsultingFlow';
import { mergeSortPlan } from '@/app/(private)/consulting/guided-demo/_lib/plan';
import { mergeSortRenderer } from '@/app/(private)/consulting/guided-demo/_lib/renderer';
import { mergeSortTools } from '@/app/(private)/consulting/guided-demo/_lib/tools';

export function MergeSortDemo() {
  return (
    <GuidedConsultingFlow
      debug
      plan={mergeSortPlan}
      renderer={mergeSortRenderer}
      tools={mergeSortTools}
    />
  );
}
