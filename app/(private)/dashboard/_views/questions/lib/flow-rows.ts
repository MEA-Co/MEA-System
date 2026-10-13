import type { PreviewAnswerRow } from './reference-rows';

export const MAX_FLOW_ROWS = 20;

export function isCustomFlowRow(row: PreviewAnswerRow): boolean {
  return Number.isInteger(row.flowAfter) && (row.flowAfter ?? 0) > 0;
}

/** Preserve base-period identity independently of inserted custom periods. */
export function materializeFlowRows(
  rows: readonly PreviewAnswerRow[],
  baseCount: number,
): PreviewAnswerRow[] {
  const count = Math.min(MAX_FLOW_ROWS, Math.max(1, baseCount));
  const fixed = new Map<number, PreviewAnswerRow>();
  const inserted = new Map<number, PreviewAnswerRow[]>();
  const unplaced: PreviewAnswerRow[] = [];
  let ordinal = 0;
  for (const row of rows) {
    if (isCustomFlowRow(row)) {
      const after = row.flowAfter!;
      if (after <= count)
        inserted.set(after, [...(inserted.get(after) ?? []), row]);
      else unplaced.push(row);
      continue;
    }
    ordinal++;
    const index = row.flowIndex ?? ordinal;
    if (index >= 1 && index <= count && !fixed.has(index))
      fixed.set(
        index,
        row.flowIndex === index ? row : { ...row, flowIndex: index },
      );
    else
      unplaced.push(
        row.flowIndex === index ? row : { ...row, flowIndex: index },
      );
  }
  const ids = new Set(rows.map((row) => row.id));
  let spareId = -1;
  const result: PreviewAnswerRow[] = [];
  for (let index = 1; index <= count; index++) {
    let row = fixed.get(index);
    if (!row) {
      while (ids.has(spareId)) spareId--;
      row = { id: spareId--, flowIndex: index, answers: {} };
      ids.add(row.id);
    }
    result.push(row, ...(inserted.get(index) ?? []));
  }
  // Server policy prevents shrinking configured periods with saved metadata.
  // Keep unexpected legacy/out-of-range rows visible rather than losing answers.
  return [...result, ...unplaced];
}

export function flowRowLabel(
  row: PreviewAnswerRow,
  baseLabels: readonly string[] = [],
): string {
  if (isCustomFlowRow(row)) return row.label?.trim() || '추가 시기';
  const index = row.flowIndex ?? 1;
  return baseLabels[index - 1]?.trim() || `시기 ${index}`;
}

/** Append to the anchor's custom group rather than reversing repeated additions. */
export function insertFlowRow(
  rows: readonly PreviewAnswerRow[],
  baseCount: number,
  after: number,
  id: number,
): PreviewAnswerRow[] {
  const current = materializeFlowRows(rows, baseCount);
  if (
    !Number.isInteger(after) ||
    after < 1 ||
    after > baseCount ||
    current.length >= MAX_FLOW_ROWS ||
    current.some((row) => row.id === id)
  )
    return current;
  return materializeFlowRows(
    [...current, { id, flowAfter: after, label: '', answers: {} }],
    baseCount,
  );
}
