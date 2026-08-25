'use client';

import { GuidedConsultingFlow } from '@/app/(private)/consulting/_components/GuidedConsultingFlow';
import { mergeSortConsulting } from '@/app/(private)/consulting/guided-demo/_lib/definition';
import { mergeSortRenderer } from '@/app/(private)/consulting/guided-demo/_lib/renderer';
import { mergeSortTools } from '@/app/(private)/consulting/guided-demo/_lib/tools';

export function MergeSortDemo() {
  return (
    <GuidedConsultingFlow
      debug
      definition={mergeSortConsulting}
      renderer={mergeSortRenderer}
      tools={mergeSortTools}
    />
  );
}
