'use client';

import { GuidedConsultingFlow } from '@/app/(private)/consulting/_components/GuidedConsultingFlow';
import { materialBoxPlan } from '@/app/(private)/consulting/material-box/_lib/plan';
import { materialBoxRenderer } from '@/app/(private)/consulting/material-box/_lib/renderer';
import { materialBoxTools } from '@/app/(private)/consulting/material-box/_lib/tools';

export function MaterialBoxConsulting() {
  return (
    <GuidedConsultingFlow
      plan={materialBoxPlan}
      renderer={materialBoxRenderer}
      tools={materialBoxTools}
    />
  );
}
