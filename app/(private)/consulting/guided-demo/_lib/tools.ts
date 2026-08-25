import { createGuidedConsultingTools } from '@/features/guided-consulting/core/tools';

import type { MergeSortToolSchema } from './types';

function wait(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, duration);

    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('요청이 취소되었습니다.', 'AbortError'));
      },
      { once: true },
    );
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

export const mergeSortTools = createGuidedConsultingTools<MergeSortToolSchema>({
  'numbers.merge-sort': async ({ numbers, delayMs }, { signal }) => {
    await wait(delayMs, signal);
    return { sorted: mergeSort(numbers) };
  },
});
