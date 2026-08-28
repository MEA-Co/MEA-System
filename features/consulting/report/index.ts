import type { DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

export type PdfDownloadOptions = {
  document: ReactElement<DocumentProps>;
  fileName: string;
};

export function isPdfFileName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 180 &&
    value.toLocaleLowerCase('en-US').endsWith('.pdf') &&
    !/[\\/\u0000-\u001f\u007f]/.test(value)
  );
}
