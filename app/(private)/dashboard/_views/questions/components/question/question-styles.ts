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

/** Shared by the authoring surface and the actual questionnaire renderer. */
export const questionSurfaceClass =
  'min-w-0 max-w-full space-y-4 rounded-lg border border-border border-t-2 border-t-brand bg-background p-3 sm:space-y-6 sm:p-6';
export const questionPromptClass =
  'flex flex-wrap items-start gap-2 border-b border-border pb-3 text-base font-semibold leading-7 sm:gap-3 sm:pb-5';

export const questionNumberClass =
  'inline-flex min-w-4 shrink-0 items-center justify-start text-sm font-bold leading-7 text-muted-foreground tabular-nums';
export const questionExplanationClass =
  'rounded-r-lg border-l-2 border-neutral-300 bg-neutral-50 px-4 py-3 text-sm leading-7 dark:border-neutral-600 dark:bg-neutral-800/50';
