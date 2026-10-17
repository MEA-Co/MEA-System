export const announcementColors = {
  red: { label: '빨강', surface: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950', icon: 'text-red-600 dark:text-red-400' },
  yellow: { label: '노랑', surface: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950', icon: 'text-amber-600 dark:text-amber-400' },
  green: { label: '초록', surface: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950', icon: 'text-emerald-600 dark:text-emerald-400' },
} as const;
export type AnnouncementColor = keyof typeof announcementColors;
export function announcementTheme(color?: AnnouncementColor) {
  return announcementColors[color ?? 'yellow'];
}
