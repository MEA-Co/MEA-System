import type { PreviewAnswerRow } from './reference-rows';

/** A compact legacy submission cannot reveal a missing row's original position. */
export function submittedRowLabel(
  row: PreviewAnswerRow,
  index: number,
  rowCount: number,
  labels: readonly string[] = [],
): string {
  if (row.label?.trim()) return row.label.trim();
  if (labels.length && rowCount < labels.length)
    return `항목 ${index + 1} · 원래 이름 미확인`;
  return labels[index]?.trim() || `항목 ${index + 1}`;
}
