'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

import type { MaterialBoxOverviewFocus } from '@/features/material-box-consulting/model/types';
import { cn } from '@/lib/utils';

type MaterialBoxOverviewScreenProps = {
  focus: MaterialBoxOverviewFocus | null;
  onAnimationComplete: () => void;
};

export function MaterialBoxOverviewScreen({
  focus,
  onAnimationComplete,
}: MaterialBoxOverviewScreenProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const completionTimer = window.setTimeout(
      onAnimationComplete,
      shouldReduceMotion ? 0 : 900,
    );

    return () => window.clearTimeout(completionTimer);
  }, [onAnimationComplete, shouldReduceMotion]);

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
      className="mx-auto min-h-112 w-full max-w-4xl pt-6 pb-56 md:pt-8 md:pb-48"
      aria-label="생활기록부 브랜딩 재료함 구성"
    >
      <div className="overflow-hidden sm:overflow-x-auto">
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
