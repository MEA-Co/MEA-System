'use client';

import type { MaterialBoxReportRequest } from '@/app/(private)/consulting/material-box/_report/protocol';
import { downloadPdfReport } from '@/features/consulting/report/client';

export async function downloadMaterialBoxReport(
  request: MaterialBoxReportRequest,
) {
  return downloadPdfReport({
    endpoint: '/api/consulting/material-box/report',
    fileName: request.fileName,
    body: request,
  });
}
