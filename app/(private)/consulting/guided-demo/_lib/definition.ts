import type {
  MergeSortContext,
  MergeSortTools,
} from '@/app/(private)/consulting/guided-demo/_lib/types';
import { defineGuidedConsulting } from '@/features/guided-consulting/core/definition';
import type { GuidedConsultingStepValidation } from '@/features/guided-consulting/core/types';

function parseNormalizedNumbers(value: string) {
  const numbers = value.split(',').map((token) => Number(token.trim()));
  if (
    numbers.length !== 10 ||
    numbers.some((number) => !Number.isFinite(number))
  ) {
    throw new Error('검증된 숫자 데이터 형식이 올바르지 않습니다.');
  }
  return numbers;
}

function getNormalizedValue(output: unknown) {
  if (
    typeof output !== 'object' ||
    output === null ||
    !('normalized' in output) ||
    typeof output.normalized !== 'string'
  ) {
    throw new Error('숫자 검증 결과 형식이 올바르지 않습니다.');
  }

  return output.normalized;
}

function getSortedNumbers(output: unknown) {
  if (
    typeof output !== 'object' ||
    output === null ||
    !('sorted' in output) ||
    !Array.isArray(output.sorted) ||
    output.sorted.some((number) => typeof number !== 'number')
  ) {
    throw new Error('머지 소트 결과 형식이 올바르지 않습니다.');
  }

  return output.sorted as Array<number>;
}

const tenNumbersValidation = {
  id: 'numbers.validate-ten',
  createInput: ({ value }) => ({ value }),
  resolve: ({ output }) => getNormalizedValue(output),
} satisfies GuidedConsultingStepValidation<MergeSortContext, MergeSortTools>;

export const mergeSortConsulting = defineGuidedConsulting<
  MergeSortContext,
  MergeSortTools
>({
  id: 'async-merge-sort-demo',
  title: '비동기 머지 소트 실험',
  createInitialContext: () => ({
    firstInput: [],
    firstSorted: [],
    secondInput: [],
    secondSorted: [],
  }),
  steps: [
    {
      id: 'first-sort',
      explain: {
        screenId: 'first-sort.explanation',
        mode: 'static',
      },
      input: {
        label: '첫 번째 숫자 10개',
        placeholder: '예: 42, 7, 19, 3, 88, 14, 1, 55, 26, 9',
        maxLength: 160,
      },
      inputScreen: ({ status, error }) =>
        status === 'error'
          ? {
              screenId: 'first-sort.input-error',
              mode: 'dynamic',
              data: { error: error ?? '입력 내용을 다시 확인해 주세요.' },
            }
          : {
              screenId:
                status === 'ready' ? 'first-sort.input' : 'first-sort.waiting',
              mode: 'static',
            },
      validation: tenNumbersValidation,
      tool: {
        id: 'numbers.merge-sort',
        createInput: ({ value }) => ({
          numbers: parseNormalizedNumbers(value),
          delayMs: 1_400,
        }),
        resolve: ({ value, output }) => {
          const numbers = parseNormalizedNumbers(value);

          return {
            context: {
              firstInput: numbers,
              firstSorted: getSortedNumbers(output),
            },
          };
        },
      },
    },
    {
      id: 'second-sort',
      explain: ({ firstInput, firstSorted }) => [
        {
          screenId: 'merge-sort.result',
          mode: 'dynamic',
          data: {
            label: '첫 번째 정렬 결과',
            input: firstInput,
            sorted: firstSorted,
          },
        },
        {
          screenId: 'second-sort.explanation',
          mode: 'static',
        },
      ],
      input: {
        label: '두 번째 숫자 10개',
        placeholder: '예: 31 4 72 18 6 90 11 43 2 65',
        maxLength: 160,
      },
      validation: tenNumbersValidation,
      pending: ({ value }) => ({
        screenId: 'merge-sort.pending',
        mode: 'dynamic',
        data: {
          label: '두 번째 머지 소트 실행 중',
          input: parseNormalizedNumbers(value),
        },
      }),
      tool: {
        id: 'numbers.merge-sort',
        createInput: ({ value }) => ({
          numbers: parseNormalizedNumbers(value),
          delayMs: 2_400,
        }),
        resolve: ({ value, output }) => {
          const numbers = parseNormalizedNumbers(value);

          return {
            context: {
              secondInput: numbers,
              secondSorted: getSortedNumbers(output),
            },
          };
        },
      },
    },
  ],
  complete: (context) => ({
    screenId: 'result.default',
    mode: 'dynamic',
    data: { context },
  }),
});
