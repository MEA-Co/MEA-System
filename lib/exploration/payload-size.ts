// PostgreSQL jsonb::text includes a space after each comma and object colon.
// Values contain only JSON strings, booleans, arrays and objects.
export const MAX_EXPLORATION_VALUES_BYTES = 2_500_000;
export const EXPLORATION_SIZE_ERROR =
  '탐구활동 전체 내용이 너무 깁니다. 내용을 줄인 뒤 다시 확정해 주세요.';
export function explorationValuesBytes(value: unknown): number {
  const json = (item: unknown): string => {
    if (Array.isArray(item)) return '[' + item.map(json).join(', ') + ']';
    if (item !== null && typeof item === 'object')
      return (
        '{' +
        Object.entries(item)
          .map(([key, entry]) => JSON.stringify(key) + ': ' + json(entry))
          .join(', ') +
        '}'
      );
    return JSON.stringify(item);
  };
  return new TextEncoder().encode(json(value)).byteLength;
}
