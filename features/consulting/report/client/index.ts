'use client';

import type { PdfDownloadRequest } from '@/features/consulting/report';

function getResponseError(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { error?: unknown }).error === 'string'
  ) {
    return (value as { error: string }).error;
  }

  return null;
}

export async function downloadPdfReport({
  endpoint,
  fileName,
  body,
}: PdfDownloadRequest) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    throw new Error(
      getResponseError(data) ??
        'PDF를 만드는 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
