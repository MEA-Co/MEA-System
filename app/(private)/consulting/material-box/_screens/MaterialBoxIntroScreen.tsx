'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

const introMessages = [
  {
    segments: [
      { text: '여러분의 생활기록부가 특별해지기 위해서는 ' },
      { text: '3년간의 성장서사', emphasis: 'accent' },
      { text: '가 담겨야 하고, 여러분이 하나의 ' },
      { text: '브랜드', emphasis: 'accent' },
      { text: '로 드러나야 합니다.' },
    ],
  },
  {
    segments: [
      {
        text: '바꿔 말하면, 여러분의 생활기록부를 읽었을 때 여러분의 생각, 경험 등으로부터 여러분이 ',
      },
      { text: '어떤 학생인지', emphasis: 'accent' },
      {
        text: '가 보여야 합니다. 활동들이 나열되어 있는 것만으로는 여러분이 어떤 학생인지 잘 드러나지 않습니다.',
      },
    ],
  },
  {
    segments: [
      {
        text: '그렇게 하기 위해 먼저 여러분이 어떤 사람인지를 여러분 스스로 잘 정의해두어야 합니다.',
      },
    ],
  },
] satisfies ReadonlyArray<ConsultingPrompterMessage>;

function MaterialBoxIntroScreen({
  environment,
}: {
  environment: GuidedConsultingScreenRenderEnvironment;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const isLastPage = pageIndex === introMessages.length - 1;

  const goToNextPage = () => {
    if (isLastPage) {
      environment.send({ type: 'user.next-explanation' });
      return;
    }

    setIsTypingComplete(false);
    setPageIndex((current) => current + 1);
  };

  return (
    <div className="flex min-h-120 items-center justify-center">
      <div className="w-full max-w-3xl">
        <ConsultingPrompter
          animateTyping
          onTypingComplete={() => setIsTypingComplete(true)}
          message={introMessages[pageIndex]}
        >
          <ConsultingProgressButton
            compact
            disabled={!isTypingComplete}
            spacebarShortcut
            onClick={goToNextPage}
          >
            {isLastPage ? '재료함 시작하기' : '다음으로'}
          </ConsultingProgressButton>
        </ConsultingPrompter>
      </div>
    </div>
  );
}

export const materialBoxIntroScreen = {
  mode: 'static',
  render: (_request, environment) => (
    <MaterialBoxIntroScreen environment={environment} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
