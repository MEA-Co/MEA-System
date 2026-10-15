import type { SubmittedResponse } from '../submitted-response-export';
export type SubmissionSummary = Pick<
  SubmittedResponse,
  'id' | 'respondentName' | 'submittedAt'
> & { revision: number };
export type SubmissionPage = {
  items: SubmissionSummary[];
  total: number;
  page: number;
  pages: number;
};
export type SubmissionManifestEntry = { id: string; revision: number };
export type SubmissionDownload = {
  total: number;
  load: (index: number) => Promise<SubmittedResponse>;
};
