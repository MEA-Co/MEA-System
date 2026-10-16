import type { QuestionResponseSnapshot } from '../question-responses';
export type ResponseVersion = Pick<
  QuestionResponseSnapshot,
  | 'id'
  | 'revision'
  | 'definitionToken'
  | 'status'
  | 'savedAt'
  | 'submittedAt'
  | 'sourceDeleted'
  | 'hasUnsubmittedChanges'
  | 'startNotice'
>;

export function responseVersionKey(value: ResponseVersion): string {
  return JSON.stringify([
    value.id,
    value.revision,
    value.definitionToken,
    value.status,
    value.savedAt,
    value.submittedAt ?? null,
    value.sourceDeleted,
    value.hasUnsubmittedChanges ?? false,
    value.startNotice ?? null,
  ]);
}

/** Never apply a response that raced with a save or a hidden/unmounted editor. */
export async function refreshResponseIfChanged(options: {
  current: ResponseVersion;
  readVersion: () => Promise<ResponseVersion>;
  readSnapshot: () => Promise<QuestionResponseSnapshot>;
  isCurrent: () => boolean;
  apply: (snapshot: QuestionResponseSnapshot) => void;
}) {
  const version = await options.readVersion();
  if (
    !options.isCurrent() ||
    responseVersionKey(version) === responseVersionKey(options.current)
  )
    return;
  const snapshot = await options.readSnapshot();
  if (!options.isCurrent() || snapshot.revision < options.current.revision)
    return;
  options.apply(snapshot);
}
