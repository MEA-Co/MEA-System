'use client';

import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';

export type MaterialBoxTableFocus =
  'interest' | 'major' | 'keyword' | 'motivation' | 'approach' | null;

type MaterialBoxTableProps = {
  focus: MaterialBoxTableFocus;
  compact?: boolean;
  majorRowCount?: 1 | 2 | 3;
  majors?: ReadonlyArray<string>;
  keywords?: ReadonlyArray<string>;
  careerIdentity?: string;
  coreValue?: string;
  fieldStrength?: string;
  personalStrength?: string;
};

export function MaterialBoxTable({
  focus,
  compact = false,
  majorRowCount = 1,
  majors = [],
  keywords = [],
  careerIdentity = '',
  coreValue = '',
  fieldStrength = '',
  personalStrength = '',
}: MaterialBoxTableProps) {
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
      className={cn(
        'mx-auto flex w-full items-center',
        compact ? 'max-w-md' : 'max-w-4xl',
      )}
      aria-label="생활기록부 브랜딩 재료함 구성"
    >
      <div className="w-full overflow-hidden sm:overflow-x-auto">
        <table
          className={cn(
            'w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border text-left text-xs',
            !compact && 'sm:min-w-160 sm:table-auto sm:rounded-xl sm:text-sm',
          )}
        >
          <tbody>
            {Array.from({ length: majorRowCount }, (_, index) => (
              <motion.tr
                key={`major-row-${index}`}
                {...rowMotion(0.18 + index * 0.18)}
                className={cn(
                  'transition-colors duration-500',
                  focus === 'interest' && 'bg-blue-500/10',
                )}
              >
                {index === 0 && (
                  <th
                    scope="rowgroup"
                    rowSpan={majorRowCount + 1}
                    className={cn(
                      'border-r border-b px-2.5 py-3 align-middle font-bold leading-5 transition-colors duration-500',
                      compact
                        ? 'w-[42%] text-[11px] sm:w-[40%] sm:text-xs'
                        : 'w-[38%] sm:w-56 sm:px-5 sm:py-5 sm:text-sm',
                      focus === 'interest'
                        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                        : 'bg-muted/35',
                    )}
                  >
                    전공 세부 분야 키워드
                  </th>
                )}
                <td
                  className={cn(
                    'border-r border-b px-2.5 py-3 font-semibold transition-colors duration-500',
                    compact
                      ? 'w-[35%] sm:w-[36%]'
                      : 'w-[29%] sm:w-44 sm:px-5 sm:py-5 sm:text-sm',
                    focus === 'major' &&
                      'bg-blue-500/15 text-blue-700 dark:text-blue-300',
                  )}
                >
                  {majors[index]?.trim() ||
                    (majorRowCount === 1 ? '전공' : `${index + 1}순위 전공`)}
                </td>
                <td
                  className={cn(
                    'border-b px-2.5 py-3 text-muted-foreground transition-colors duration-500',
                    !compact && 'sm:px-5 sm:py-5 sm:text-sm',
                    focus === 'keyword' &&
                      'bg-blue-500/15 text-blue-700 dark:text-blue-300',
                  )}
                >
                  <span
                    className="block truncate"
                    title={keywords[index]?.trim() || undefined}
                  >
                    {keywords[index]?.trim() || '키워드'}
                  </span>
                </td>
              </motion.tr>
            ))}

            <motion.tr
              {...rowMotion(0.18 + majorRowCount * 0.18)}
              className={cn(
                'transition-colors duration-500',
                focus === 'interest' && 'bg-blue-500/10',
              )}
            >
              <th
                scope="row"
                colSpan={2}
                className={cn(
                  'border-b px-2.5 py-3 font-semibold',
                  !compact && 'sm:px-5 sm:py-5 sm:text-sm',
                )}
              >
                <span className="block">학생의 스토리</span>
                {careerIdentity && (
                  <span
                    className={cn(
                      'mt-1 block font-medium text-muted-foreground',
                      compact && 'truncate text-[10px]',
                    )}
                    title={careerIdentity}
                  >
                    {careerIdentity}
                  </span>
                )}
              </th>
            </motion.tr>
            <motion.tr
              {...rowMotion(0.36 + majorRowCount * 0.18)}
              className={cn(
                'transition-colors duration-500',
                focus === 'motivation' && 'bg-blue-500/10',
              )}
            >
              <th
                scope="row"
                className={cn(
                  'border-r border-b px-2.5 py-3 font-bold leading-5 transition-colors duration-500',
                  !compact && 'sm:px-5 sm:py-5 sm:text-sm',
                  focus === 'motivation'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    : 'bg-muted/35',
                )}
              >
                전공 가치관
              </th>
              <td
                colSpan={2}
                className={cn(
                  'border-b px-2.5 py-3 font-medium',
                  !compact && 'sm:px-5 sm:py-5 sm:text-sm',
                )}
              >
                {coreValue && (
                  <span
                    className={cn('block', compact && 'truncate text-[10px]')}
                    title={coreValue}
                  >
                    {coreValue}
                  </span>
                )}
              </td>
            </motion.tr>
            <motion.tr
              {...rowMotion(0.54 + majorRowCount * 0.18)}
              className={cn(
                'transition-colors duration-500',
                focus === 'approach' && 'bg-blue-500/10',
              )}
            >
              <th
                scope="row"
                className={cn(
                  'border-r px-2.5 py-3 font-bold leading-5 transition-colors duration-500',
                  !compact && 'sm:px-5 sm:py-5 sm:text-sm',
                  focus === 'approach'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    : 'bg-muted/35',
                )}
              >
                계열 적합 역량
              </th>
              <td
                colSpan={2}
                className={cn(
                  'px-2.5 py-3 font-medium',
                  !compact && 'sm:px-5 sm:py-5 sm:text-sm',
                )}
              >
                {[fieldStrength, personalStrength]
                  .filter(Boolean)
                  .map((strength) => (
                    <span
                      key={strength}
                      className={cn('block', compact && 'truncate text-[10px]')}
                      title={strength}
                    >
                      {strength}
                    </span>
                  ))}
              </td>
            </motion.tr>
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}
