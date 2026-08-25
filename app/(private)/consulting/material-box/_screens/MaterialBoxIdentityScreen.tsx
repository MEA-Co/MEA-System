'use client';

import type { ReactNode } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function MaterialBoxIdentityScreen() {
  return (
    <div className="flex min-h-120 items-center justify-center">
      <div className="w-full max-w-3xl">
        <ConsultingPrompter
          animateTyping
          message={{
            segments: [
              {
                text: '바꿔 말하면, 여러분의 생활기록부를 읽었을 때 여러분의 생각, 경험 등으로부터 여러분이 ',
              },
              { text: '어떤 학생인지', emphasis: 'accent' },
              {
                text: '가 보여야 합니다. 활동들이 나열되어 있는 것만으로는 여러분이 어떤 학생인지 잘 드러나지 않습니다.',
              },
            ],
          }}
        />
      </div>
    </div>
  );
}

export const materialBoxIdentityScreen = {
  mode: 'static',
  render: () => <MaterialBoxIdentityScreen />,
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
