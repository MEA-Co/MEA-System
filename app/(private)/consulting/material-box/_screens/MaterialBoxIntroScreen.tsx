'use client';

import type { ReactNode } from 'react';

import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { ConsultingPrompter } from '@/features/consulting/ui/ConsultingPrompter';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function MaterialBoxIntroScreen() {
  return (
    <div className="flex min-h-120 items-center justify-center">
      <div className="w-full max-w-3xl">
        <ConsultingPrompter
          animateTyping
          message={[
            {
              text: '여러분의 생활기록부가 특별해지기 위해서는 ',
            },
            { text: '3년간의 성장서사', emphasis: 'accent' },
            { text: '가 담겨야 하고, 여러분이 하나의 ' },
            { text: '브랜드', emphasis: 'accent' },
            { text: '로 드러나야 합니다.' },
          ]}
        />
      </div>
    </div>
  );
}

export const materialBoxIntroScreen = {
  mode: 'static',
  render: () => <MaterialBoxIntroScreen />,
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
