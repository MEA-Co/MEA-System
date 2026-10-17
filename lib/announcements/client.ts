import type { Announcement } from './schema';

export async function readAnnouncement(): Promise<Announcement> {
  const response = await fetch('/api/announcements', {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('공지를 불러오지 못했습니다.');
  return response.json();
}

export const ANNOUNCEMENT_UPDATED_EVENT = 'mea:announcement-updated';
