'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  MaterialBoxTable,
  type MaterialBoxTableFocus,
} from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

type MaterialBoxOverviewPage = {
  focus: MaterialBoxTableFocus;
  message: ConsultingPrompterMessage;
};

const overviewPages = [
  {
    focus: null,
    message: {
      segments: [
        { text: '여러분은 지금부터 ' },
        { text: '재료함', emphasis: 'accent' },
        {
          text: '이라고 하는 것을 채워가며 생활기록부에 그려질 여러분의 모습을 만들어볼 것입니다.',
        },
      ],
    },
  },
  {
    focus: null,
    message: {
      segments: [{ text: '각각에 대해 너무 어렵게 생각하지 않아도 됩니다.' }],
    },
  },
  {
    focus: 'interest',
    message: {
      segments: [
        { text: '나는 ' },
        { text: '무엇', emphasis: 'accent' },
        { text: '에 관심이 있는가 (또는 무엇을 중요하게 생각하는가)' },
      ],
    },
  },
  {
    focus: 'motivation',
    message: {
      segments: [
        { text: '나는 ' },
        { text: '왜', emphasis: 'accent' },
        { text: ' 그것에 관심이 있는가 (또는 중요하게 생각하는가)' },
      ],
    },
  },
  {
    focus: 'approach',
    message: {
      segments: [
        { text: '그것을 ' },
        { text: '어떻게', emphasis: 'accent' },
        { text: ' 다룰 것인가' },
      ],
    },
  },
] satisfies ReadonlyArray<MaterialBoxOverviewPage>;

function MaterialBoxOverviewScreen({
  environment,
}: {
  environment: GuidedConsultingScreenRenderEnvironment;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const page = overviewPages[pageIndex];
  const hasNextPage = pageIndex < overviewPages.length - 1;

  return (
    <ConsultingScreenView>
      <MaterialBoxTable focus={page.focus} />
      <ConsultingPrompter
        animateTyping
        message={page.message}
        onTypingComplete={() => setIsTypingComplete(true)}
      >
        <ConsultingProgressButton
          compact
          disabled={!isTypingComplete}
          spacebarShortcut
          onClick={() => {
            if (hasNextPage) {
              setIsTypingComplete(false);
              setPageIndex((current) => current + 1);
              return;
            }

            environment.send({ type: 'user.next-explanation' });
          }}
        >
          {hasNextPage ? '다음으로' : '전공 시작하기'}
        </ConsultingProgressButton>
      </ConsultingPrompter>
    </ConsultingScreenView>
  );
}

export const materialBoxOverviewScreen = {
  mode: 'static',
  render: (_request, environment) => (
    <MaterialBoxOverviewScreen environment={environment} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
