/** Shared visual hierarchy for authoring, preview, and published questionnaires. */
export const questionnaireStyles = {
  document:
    'border-neutral-200 bg-background dark:border-neutral-800 dark:bg-neutral-900',
  title: 'rounded-xl bg-neutral-50 p-5 dark:bg-neutral-800/60',
  sectionHeading:
    'flex items-start gap-3 rounded-lg bg-neutral-100 px-4 py-3 text-xl font-semibold text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100',
  sectionNumber:
    'flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-sm font-bold text-white dark:bg-neutral-200 dark:text-neutral-900',
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

/** Shared status colors for filters and status controls. */
export const questionnaireStatusColors = {
  draft:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  published:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  distributed:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  archived:
    'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
} as const;
