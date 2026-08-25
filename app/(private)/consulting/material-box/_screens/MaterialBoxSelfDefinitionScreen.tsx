'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function MaterialBoxSelfDefinitionScreen({
  environment,
}: {
  environment: GuidedConsultingScreenRenderEnvironment;
}) {
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  return (
    <div className="flex min-h-120 items-center justify-center">
      <div className="w-full max-w-3xl">
        <ConsultingPrompter
          animateTyping
          onTypingComplete={() => setIsTypingComplete(true)}
          message={{
            segments: [
              {
                text: '그렇게 하기 위해 먼저 여러분이 어떤 사람인지를 여러분 스스로 잘 정의해두어야 합니다.',
              },
            ],
          }}
        >
          <ConsultingProgressButton
            compact
            disabled={!isTypingComplete}
            spacebarShortcut
            onClick={() => environment.send({ type: 'user.next-explanation' })}
          />
        </ConsultingPrompter>
      </div>
    </div>
  );
}

export const materialBoxSelfDefinitionScreen = {
  mode: 'static',
  render: (_request, environment) => (
    <MaterialBoxSelfDefinitionScreen environment={environment} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
