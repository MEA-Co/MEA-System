/** Stored instants retain their UTC/offset representation; only display uses Korea time. */
export function formatKoreanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul' }).format(
    date,
  );
}

export function formatKoreanDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}
