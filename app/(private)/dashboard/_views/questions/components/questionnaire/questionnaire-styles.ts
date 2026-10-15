/** Shared visual hierarchy for authoring, preview, and inReview questionnaires. */
export const questionnaireStyles = {
  document:
    'border-neutral-200 bg-background dark:border-neutral-800 dark:bg-neutral-900',
  title: 'rounded-xl bg-neutral-50 p-5 dark:bg-neutral-800/60',
  sectionHeading:
    'flex items-start gap-3 rounded-lg bg-neutral-100 px-4 py-3 text-xl font-semibold text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100',
  sectionNumber:
    'flex size-7 shrink-0 items-center justify-center rounded bg-brand-foreground text-sm font-bold text-brand',
  questionCard:
    'space-y-5 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 dark:border-neutral-700 dark:bg-neutral-900',
  questionLabel: 'text-sm font-semibold text-neutral-700 dark:text-neutral-300',
  explanation:
    'rounded-lg border-l-[3px] border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-600 dark:bg-neutral-800/50',
  answerArea:
    'space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/50',
  input:
    'border-0 bg-neutral-100 shadow-none focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:bg-neutral-800',
} as const;

/** Status is always named; color only supports its visual hierarchy. */
export const questionnaireStatusColors = {
  draft: 'border-brand/40 bg-brand/15 text-foreground hover:bg-brand/15',
  in_review:
    'border-green-200 bg-green-50 text-green-800 hover:bg-green-50 dark:border-green-800 dark:bg-green-950 dark:text-green-200 dark:hover:bg-green-950',
  published:
    'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-950',
  archived: 'border-border bg-background text-muted-foreground',
} as const;
