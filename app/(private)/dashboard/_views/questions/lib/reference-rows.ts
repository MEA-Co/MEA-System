export type PreviewAnswerRow = { id: number; answers: Record<string, string> };

/** Follow stable source row IDs, preserving answers even when another row disappears. */
export function referenceAnswerRows(
  sourceRows: PreviewAnswerRow[],
  savedRows: PreviewAnswerRow[],
): PreviewAnswerRow[] {
  const byId = new Map(savedRows.map((row) => [row.id, row]));
  return sourceRows.map(
    (source) => byId.get(source.id) ?? { id: source.id, answers: {} },
  );
}

/** All-column conditions require every column in the same row, not across different rows. */
export function answeredSourceRows(
  rows: PreviewAnswerRow[],
  fieldIds: string[],
  hasAnswer: (fieldId: string, value: string) => boolean,
): PreviewAnswerRow[] {
  return fieldIds.length
    ? rows.filter((row) =>
        fieldIds.every((id) => hasAnswer(id, row.answers[id] ?? '')),
      )
    : [];
}

/** Add empty preview rows up to the configured minimum without replacing existing answers. */
export function minimumAnswerRows(
  rows: PreviewAnswerRow[],
  minimum: number,
  maximum: number,
): PreviewAnswerRow[] {
  const visible = rows.slice(0, maximum);
  let id = -1;
  while (visible.length < Math.min(minimum, maximum)) {
    while (visible.some((row) => row.id === id)) id--;
    visible.push({ id: id--, answers: {} });
  }
  return visible;
}
