'use client';

import { ConsultingFlow } from '@/app/(private)/consulting/_components/ConsultingFlow';
import { materialBoxPlan } from '@/app/(private)/consulting/material-box/_lib/plan';
import { materialBoxRenderer } from '@/app/(private)/consulting/material-box/_lib/renderer';
import { materialBoxTools } from '@/app/(private)/consulting/material-box/_lib/tools';

export function MaterialBoxConsulting() {
  return (
    <ConsultingFlow
      debug
      plan={materialBoxPlan}
      renderer={materialBoxRenderer}
      tools={materialBoxTools}
    />
  );
}
