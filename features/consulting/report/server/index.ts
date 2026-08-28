import { type DocumentProps, renderToBuffer } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

import { isPdfFileName } from '@/features/consulting/report';

export async function createPdfDownloadResponse(
  document: ReactElement<DocumentProps>,
  fileName: string,
) {
  if (!isPdfFileName(fileName)) {
    throw new Error('PDF 파일명이 올바르지 않습니다.');
  }

  const pdfBuffer = await renderToBuffer(document);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
