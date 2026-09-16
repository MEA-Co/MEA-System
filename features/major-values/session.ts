import {
  restoreValuesState,
  validateStateReferences,
  type ValuesContext,
  type ValuesState,
  valuesStateSchema,
} from './domain';

export type ValuesStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function valuesStorageKey(ownerId: string, context: ValuesContext) {
  // The full context avoids hash collisions between students' chosen interests.
  return `mea:major-values:v2:${ownerId}:${JSON.stringify(context)}`;
}
export function loadValuesSession(
  storage: ValuesStorage | null,
  ownerId: string | null,
  context: ValuesContext,
  flowDraft: string,
) {
  if (flowDraft) return restoreValuesState(context, flowDraft);
  try {
    return restoreValuesState(
      context,
      storage && ownerId
        ? (storage.getItem(valuesStorageKey(ownerId, context)) ?? '')
        : '',
    );
  } catch {
    return restoreValuesState(context, '');
  }
}
export function saveValuesSession(
  storage: ValuesStorage | null,
  ownerId: string | null,
  state: ValuesState,
) {
  if (!storage || !ownerId) return false;
  try {
    storage.setItem(
      valuesStorageKey(ownerId, state.context),
      JSON.stringify(state),
    );
    storage.setItem(
      `mea:major-values:last:${ownerId}`,
      valuesStorageKey(ownerId, state.context),
    );
    return true;
  } catch {
    return false;
  }
}

export function lastValuesSession(
  storage: ValuesStorage,
  ownerId: string,
): ValuesState | null {
  try {
    const key = storage.getItem(`mea:major-values:last:${ownerId}`);
    if (!key?.startsWith(`mea:major-values:v2:${ownerId}:`)) return null;
    const state = valuesStateSchema.parse(
      JSON.parse(storage.getItem(key) ?? 'null'),
    );
    validateStateReferences(state);
    return state;
  } catch {
    return null;
  }
}
