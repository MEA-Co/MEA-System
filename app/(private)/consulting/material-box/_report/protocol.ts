import {
  isMaterialBoxProgressScreenData,
  type MaterialBoxProgressScreenData,
} from '@/app/(private)/consulting/material-box/_lib/types';
import type { KeywordSuggestion } from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';
import { isPdfFileName } from '@/features/consulting/report';

export type MaterialBoxReportSuggestion = KeywordSuggestion;
export type MaterialBoxReportData = MaterialBoxProgressScreenData;

export type MaterialBoxReportRequest = {
  fileName: string;
  report: MaterialBoxReportData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isMaterialBoxReportRequest(
  value: unknown,
): value is MaterialBoxReportRequest {
  return (
    isRecord(value) &&
    isPdfFileName(value.fileName) &&
    isMaterialBoxProgressScreenData(value.report)
  );
}
