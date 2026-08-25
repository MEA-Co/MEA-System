import type {
  MergeSortContext,
  MergeSortToolModule,
} from '@/app/(private)/consulting/guided-demo/_lib/types';
import { defineGuidedConsulting } from '@/features/guided-consulting/core/definition';

function parseTenNumbers(value: string) {
  const tokens = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const numbers = tokens.map(Number);

  if (
    numbers.length !== 10 ||
    numbers.some((number) => !Number.isFinite(number))
  ) {
    throw new Error('쉼표나 공백으로 구분한 숫자 10개를 입력해 주세요.');
  }

  return numbers;
}

function validateNumbers(value: string) {
  return parseTenNumbers(value).join(', ');
}

export const mergeSortConsulting = defineGuidedConsulting<
  MergeSortContext,
  MergeSortToolModule
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
        eyebrow: 'STEP 1 · WAIT',
        title: '정렬할 숫자 10개를 입력해 주세요',
        description:
          '첫 번째 실행은 머지 소트 Tool Result를 기다린 다음 결과 화면을 표시합니다.',
        tips: ['쉼표 또는 공백으로 숫자를 구분할 수 있어요.'],
      },
      input: {
        label: '첫 번째 숫자 10개',
        placeholder: '예: 42, 7, 19, 3, 88, 14, 1, 55, 26, 9',
        maxLength: 160,
      },
      validate: validateNumbers,
      tool: {
        name: 'numbers.merge-sort',
        execute: async ({ value, services, signal }) => {
          const numbers = parseTenNumbers(value);
          const { sorted } = await services.execute(
            'numbers.merge-sort',
            { numbers, delayMs: 1_400 },
            { signal },
          );

          return {
            context: {
              firstInput: numbers,
              firstSorted: sorted,
            },
          };
        },
      },
    },
    {
      id: 'second-sort',
      explain: ({ firstInput, firstSorted }) => [
        {
          eyebrow: 'RESULT 1',
          title: '첫 번째 머지 소트가 끝났어요',
          description:
            'Agent는 Tool Result가 도착할 때까지 기다린 후 이 결과 화면을 요청했습니다.',
          main: {
            id: 'merge-sort.result',
            data: {
              label: '첫 번째 정렬 결과',
              input: firstInput,
              sorted: firstSorted,
            },
          },
        },
        {
          eyebrow: 'STEP 2 · UPDATE',
          title: '다시 숫자 10개를 입력해 주세요',
          description:
            '이번에는 대기 화면을 먼저 표시하고, 머지 소트 결과가 도착하면 같은 화면 영역을 업데이트합니다.',
          tips: ['첫 번째와 다른 순서의 숫자를 입력해보세요.'],
        },
      ],
      input: {
        label: '두 번째 숫자 10개',
        placeholder: '예: 31 4 72 18 6 90 11 43 2 65',
        maxLength: 160,
      },
      validate: validateNumbers,
      pending: ({ value }) => ({
        id: 'merge-sort.pending',
        data: {
          label: '두 번째 머지 소트 실행 중',
          input: parseTenNumbers(value),
        },
      }),
      tool: {
        name: 'numbers.merge-sort',
        execute: async ({ value, services, signal }) => {
          const numbers = parseTenNumbers(value);
          const { sorted } = await services.execute(
            'numbers.merge-sort',
            { numbers, delayMs: 2_400 },
            { signal },
          );

          return {
            context: {
              secondInput: numbers,
              secondSorted: sorted,
            },
          };
        },
      },
    },
  ],
});
