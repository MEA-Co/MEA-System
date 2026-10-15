import type { QuestionBlockRow } from '../question-blocks';
import type { PreviewAnswerRow } from '../reference-rows';
import { richTextPlainText } from '../rich-text';

export const CAREER_FLOW_REQUIREMENTS_MESSAGE =
  '진로 흐름의 고교 입학 전(중등 또는 예비 고1)과 고3 수시 원서 접수 시기에 각각 한 항목 이상 작성해 주세요.';

export function responseRequirementsMessage(
  definition: QuestionBlockRow,
  rows: PreviewAnswerRow[],
) {
  const rule = definition.response_requirements;
  if (!rule) return null;
  const answered = (id: string) =>
    rows.some((row) => !!richTextPlainText(row.answers[id] ?? '').trim());
  return rule.startFieldIds.some(answered) && answered(rule.admissionFieldId)
    ? null
    : CAREER_FLOW_REQUIREMENTS_MESSAGE;
}
