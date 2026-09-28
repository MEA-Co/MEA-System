/** Visual hierarchy owned by question management. */
export const questionStyles = {
  document:
    'border-neutral-200 bg-background dark:border-neutral-800 dark:bg-neutral-900',
  title: 'rounded-xl bg-neutral-50 p-5 dark:bg-neutral-800/60',
  sectionHeading:
    'flex items-start gap-3 rounded-lg bg-neutral-100 px-4 py-3 text-xl font-semibold text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100',
  sectionNumber:
    'flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-sm font-bold text-white dark:bg-neutral-200 dark:text-neutral-900',
  questionCard:
    'space-y-5 rounded-xl border border-neutral-200 bg-background p-5 sm:p-6 dark:border-neutral-700 dark:bg-neutral-900',
  questionLabel: 'text-sm font-semibold text-neutral-700 dark:text-neutral-300',
  explanation:
    'rounded-lg border-l-[3px] border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-600 dark:bg-neutral-800/50',
  answerArea:
    'space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/50',
  input:
    'border-0 bg-neutral-100 shadow-none focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:bg-neutral-800',
} as const;
