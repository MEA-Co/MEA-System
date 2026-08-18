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
      <div className="overflow-x-auto">
        <table className="w-full min-w-160 border-separate border-spacing-0 overflow-hidden rounded-xl border text-left">
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
                  'w-56 border-r border-b px-5 py-5 align-middle text-sm font-bold transition-colors duration-500',
                  focus === 'interest'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    : 'bg-muted/35',
                )}
              >
                전공 세부 분야 키워드
              </th>
              <td className="w-44 border-r border-b px-5 py-5 text-sm font-semibold">
                전공
              </td>
              <td className="border-b px-5 py-5 text-sm text-muted-foreground">
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
                className="border-b px-5 py-5 text-sm font-semibold"
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
                  'border-r border-b px-5 py-5 text-sm font-bold transition-colors duration-500',
                  focus === 'motivation'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    : 'bg-muted/35',
                )}
              >
                전공 가치관
              </th>
              <td
                colSpan={2}
                className="border-b px-5 py-5 text-sm font-medium"
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
                  'border-r px-5 py-5 text-sm font-bold transition-colors duration-500',
                  focus === 'approach'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    : 'bg-muted/35',
                )}
              >
                계열 적합 역량
              </th>
              <td colSpan={2} className="px-5 py-5 text-sm font-medium" />
            </motion.tr>
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}
