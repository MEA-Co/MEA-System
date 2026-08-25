import type {
  MergeSortToolInput,
  MergeSortToolOutput,
} from '@/app/(private)/consulting/guided-demo/_lib/types';
import type { GuidedConsultingToolEntry } from '@/features/guided-consulting/core/tools';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMergeSortInput(value: unknown): value is MergeSortToolInput {
  return (
    isRecord(value) &&
    Array.isArray(value.numbers) &&
    value.numbers.every((number) => typeof number === 'number') &&
    typeof value.delayMs === 'number'
  );
}

function isMergeSortOutput(value: unknown): value is MergeSortToolOutput {
  return (
    isRecord(value) &&
    Array.isArray(value.sorted) &&
    value.sorted.every((number) => typeof number === 'number')
  );
}

function wait(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('요청이 취소되었습니다.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, duration);

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

function merge(left: Array<number>, right: Array<number>) {
  const result: Array<number> = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] <= right[rightIndex]) {
      result.push(left[leftIndex]);
      leftIndex += 1;
    } else {
      result.push(right[rightIndex]);
      rightIndex += 1;
    }
  }

  return [...result, ...left.slice(leftIndex), ...right.slice(rightIndex)];
}

function mergeSort(numbers: Array<number>): Array<number> {
  if (numbers.length <= 1) return numbers;
  const middle = Math.floor(numbers.length / 2);
  return merge(
    mergeSort(numbers.slice(0, middle)),
    mergeSort(numbers.slice(middle)),
  );
}

export const mergeSortTool = {
  validateInput: isMergeSortInput,
  validateOutput: isMergeSortOutput,
  execute: async ({ numbers, delayMs }, { signal }) => {
    await wait(delayMs, signal);
    return { sorted: mergeSort(numbers) };
  },
} satisfies GuidedConsultingToolEntry<MergeSortToolInput, MergeSortToolOutput>;
