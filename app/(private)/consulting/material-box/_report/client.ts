import type { MaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';
import { createMaterialBoxReportDocument } from '@/app/(private)/consulting/material-box/_report/document';
import { downloadPdfReport } from '@/features/consulting/report/client';

export async function downloadMaterialBoxReport(
  report: MaterialBoxProgressScreenData,
  fileName = 'MEA_나의_재료함_리포트.pdf',
) {
  return downloadPdfReport({
    document: createMaterialBoxReportDocument(report),
    fileName,
  });
}
