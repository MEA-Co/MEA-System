import {
  isMaterialBoxProgressScreenData,
  type MaterialBoxProgressScreenData,
} from '@/app/(private)/consulting/material-box/_lib/types';
import type { KeywordSuggestion } from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';

export type MaterialBoxReportSuggestion = KeywordSuggestion;
export type MaterialBoxReportData = MaterialBoxProgressScreenData;

export type MaterialBoxReportRequest = {
  fileName: string;
  report: MaterialBoxReportData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPdfFileName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 180 &&
    value.toLocaleLowerCase('en-US').endsWith('.pdf') &&
    !/[\\/\u0000-\u001f\u007f]/.test(value)
  );
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
