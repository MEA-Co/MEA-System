import type { PreviewAnswerRow } from './reference-rows';

export type GuideAnswer = {
  rows: (PreviewAnswerRow & { label: string })[];
};
