'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';
import { cn } from '@/lib/utils';

type MaterialBoxOverviewFocus = 'interest' | 'motivation' | 'approach' | null;

type MaterialBoxOverviewPage = {
  focus: MaterialBoxOverviewFocus;
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

function MaterialBoxOverview({ focus }: { focus: MaterialBoxOverviewFocus }) {
  const shouldReduceMotion = useReducedMotion();
  const rowMotion = (delay: number) => ({
    initial: shouldReduceMotion ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay },
  });

  return (
    <motion.section
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto flex w-full max-w-4xl items-center"
      aria-label="생활기록부 브랜딩 재료함 구성"
    >
      <div className="w-full overflow-hidden sm:overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border text-left text-xs sm:min-w-160 sm:table-auto sm:rounded-xl sm:text-sm">
          <tbody>
            <motion.tr
              {...rowMotion(0.18)}
              className={cn(
                'transition-colors duration-500',
                focus === 'interest' && 'bg-blue-500/10',
              )}
            >
              <th
                scope="rowgroup"
                rowSpan={2}
                className={cn(
                  'w-[38%] border-r border-b px-2.5 py-3 align-middle font-bold leading-5 transition-colors duration-500 sm:w-56 sm:px-5 sm:py-5 sm:text-sm',
                  focus === 'interest'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    : 'bg-muted/35',
                )}
              >
                전공 세부 분야 키워드
              </th>
              <td className="w-[29%] border-r border-b px-2.5 py-3 font-semibold sm:w-44 sm:px-5 sm:py-5 sm:text-sm">
                전공
              </td>
              <td className="border-b px-2.5 py-3 text-muted-foreground sm:px-5 sm:py-5 sm:text-sm">
                키워드
              </td>
            </motion.tr>
            <motion.tr
              {...rowMotion(0.36)}
              className={cn(
                'transition-colors duration-500',
                focus === 'interest' && 'bg-blue-500/10',
              )}
            >
              <th
                scope="row"
                colSpan={2}
                className="border-b px-2.5 py-3 font-semibold sm:px-5 sm:py-5 sm:text-sm"
              >
                학생의 스토리
              </th>
            </motion.tr>
            <motion.tr
              {...rowMotion(0.54)}
              className={cn(
                'transition-colors duration-500',
                focus === 'motivation' && 'bg-blue-500/10',
              )}
            >
              <th
                scope="row"
                className={cn(
                  'border-r border-b px-2.5 py-3 font-bold leading-5 transition-colors duration-500 sm:px-5 sm:py-5 sm:text-sm',
                  focus === 'motivation'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    : 'bg-muted/35',
                )}
              >
                전공 가치관
              </th>
              <td
                colSpan={2}
                className="border-b px-2.5 py-3 font-medium sm:px-5 sm:py-5 sm:text-sm"
              />
            </motion.tr>
            <motion.tr
              {...rowMotion(0.72)}
              className={cn(
                'transition-colors duration-500',
                focus === 'approach' && 'bg-blue-500/10',
              )}
            >
              <th
                scope="row"
                className={cn(
                  'border-r px-2.5 py-3 font-bold leading-5 transition-colors duration-500 sm:px-5 sm:py-5 sm:text-sm',
                  focus === 'approach'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    : 'bg-muted/35',
                )}
              >
                계열 적합 역량
              </th>
              <td
                colSpan={2}
                className="px-2.5 py-3 font-medium sm:px-5 sm:py-5 sm:text-sm"
              />
            </motion.tr>
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}

function MaterialBoxOverviewScreen() {
  const [pageIndex, setPageIndex] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const page = overviewPages[pageIndex];
  const hasNextPage = pageIndex < overviewPages.length - 1;

  return (
    <ConsultingScreenView>
      <MaterialBoxOverview focus={page.focus} />
      <ConsultingPrompter
        animateTyping
        message={page.message}
        onTypingComplete={() => setIsTypingComplete(true)}
      >
        {hasNextPage && (
          <ConsultingProgressButton
            compact
            disabled={!isTypingComplete}
            spacebarShortcut
            onClick={() => {
              setIsTypingComplete(false);
              setPageIndex((current) => current + 1);
            }}
          >
            다음으로
          </ConsultingProgressButton>
        )}
      </ConsultingPrompter>
    </ConsultingScreenView>
  );
}

export const materialBoxOverviewScreen = {
  mode: 'static',
  render: () => <MaterialBoxOverviewScreen />,
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
