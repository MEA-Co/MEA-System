'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

const majorPriorities = ['1순위 전공', '2순위 전공', '3순위 전공'] as const;

type MaterialBoxOverviewScreenProps = {
  onAnimationComplete: () => void;
};

export function MaterialBoxOverviewScreen({
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
            {majorPriorities.map((priority, index) => (
              <motion.tr key={priority} {...rowMotion(0.18 + index * 0.13)}>
                {index === 0 && (
                  <th
                    scope="rowgroup"
                    rowSpan={4}
                    className="w-56 border-r border-b bg-muted/35 px-5 py-5 align-middle text-sm font-bold"
                  >
                    전공 세부 분야 키워드
                  </th>
                )}
                <th
                  scope="row"
                  className="w-44 border-r border-b px-5 py-4 text-sm font-semibold"
                >
                  {priority}
                </th>
                <td className="border-b px-5 py-4 text-sm text-muted-foreground">
                  전공 키워드
                </td>
              </motion.tr>
            ))}

            <motion.tr {...rowMotion(0.57)}>
              <th
                scope="row"
                colSpan={2}
                className="border-b px-5 py-4 text-sm font-semibold"
              >
                학생의 스토리
              </th>
            </motion.tr>

            <motion.tr {...rowMotion(0.7)}>
              <th
                scope="row"
                className="border-r border-b bg-muted/35 px-5 py-5 text-sm font-bold"
              >
                전공 가치관
              </th>
              <td
                colSpan={2}
                className="border-b px-5 py-5 text-sm font-medium"
              />
            </motion.tr>

            <motion.tr {...rowMotion(0.83)}>
              <th
                scope="row"
                className="border-r bg-muted/35 px-5 py-5 text-sm font-bold"
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
