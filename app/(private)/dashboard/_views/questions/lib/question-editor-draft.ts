import type { QuestionBlockDocument } from './question-blocks';
export function readError(result: unknown) {
  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    typeof result.error === 'string'
  )
    return result.error;
  return '요청을 처리하지 못했어요.';
}

export function stableDocument(value: QuestionBlockDocument) {
  return JSON.stringify(
    { ...value, title: value.title.trim(), details: value.details ?? [] },
    (_key, item: unknown) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          )
        : item,
  );
}

export function localDraftKey(userId: string, id?: string) {
  return `question-block-draft:${userId}${id ? `:${id}` : ''}`;
}

export function clearLocalDraft(userId: string | null, id: string) {
  if (!userId) return;
  try {
    window.localStorage.removeItem(localDraftKey(userId, id));
    const legacy = readLocalDraft(userId);
    if (legacy?.document.id === id)
      window.localStorage.removeItem(localDraftKey(userId));
  } catch {}
}

export type LocalQuestionBlockDraft = {
  document: QuestionBlockDocument;
  savedDocument: QuestionBlockDocument | null;
  initialDocument?: QuestionBlockDocument | null;
  revision: number;
  savedAt: string | null;
};

export function readLocalDraft(
  userId: string,
  id?: string,
): LocalQuestionBlockDraft | null {
  try {
    const raw =
      window.localStorage.getItem(localDraftKey(userId, id)) ??
      (id ? window.localStorage.getItem(localDraftKey(userId)) : null);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const local = value as Partial<LocalQuestionBlockDraft>;
    if (
      !local.document ||
      typeof local.document.id !== 'string' ||
      (id !== undefined && local.document.id !== id) ||
      typeof local.document.title !== 'string' ||
      typeof local.document.prompt !== 'string' ||
      !Array.isArray(local.document.fields) ||
      typeof local.revision !== 'number' ||
      !Number.isInteger(local.revision) ||
      local.revision < 0
    )
      return null;
    return {
      document: {
        ...local.document,
        fields: local.document.fields.map((field, index) => ({
          ...field,
          label: field.label.trim() || `답변 ${index + 1}`,
        })),
      },
      savedDocument: local.savedDocument ?? null,
      initialDocument: local.initialDocument ?? null,
      revision: local.revision,
      savedAt: local.savedAt ?? null,
    };
  } catch {
    return null;
  }
}
