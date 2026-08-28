'use client';

import {
  isPdfFileName,
  type PdfDownloadOptions,
} from '@/features/consulting/report';

export async function downloadPdfReport({
  document: pdfDocument,
  fileName,
}: PdfDownloadOptions) {
  if (!isPdfFileName(fileName)) {
    throw new Error('PDF 파일명이 올바르지 않습니다.');
  }

  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(pdfDocument).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
