import type { MergeSortContext } from '@/app/(private)/consulting/demo/_lib/types';

export type MergeSortScreenData = {
  input: Array<number>;
  sorted?: Array<number>;
};

export type FinalResultsScreenData = {
  context: MergeSortContext;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumberArray(value: unknown): value is Array<number> {
  return (
    Array.isArray(value) &&
    value.every((candidate) => typeof candidate === 'number')
  );
}

export function isMergeSortScreenData(
  value: unknown,
): value is MergeSortScreenData {
  return (
    isRecord(value) &&
    isNumberArray(value.input) &&
    (value.sorted === undefined || isNumberArray(value.sorted))
  );
}

function isMergeSortContext(value: unknown): value is MergeSortContext {
  return (
    isRecord(value) &&
    isNumberArray(value.firstInput) &&
    isNumberArray(value.firstSorted) &&
    isNumberArray(value.secondInput) &&
    isNumberArray(value.secondSorted)
  );
}

export function isFinalResultsScreenData(
  value: unknown,
): value is FinalResultsScreenData {
  return isRecord(value) && isMergeSortContext(value.context);
}
