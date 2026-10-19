import type { LinkRecord } from '@/lib/exploration-links/model';

export async function linkRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
    signal: init?.signal ?? AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error ?? '탐구줄기 요청에 실패했습니다.');
  return body;
}
export const readLink = (id: string, signal?: AbortSignal) =>
  linkRequest<{ link: LinkRecord }>(`/api/exploration-links/${id}`, { signal });
