import type {
  MergeSortContext,
  MergeSortToolOutput,
  MergeSortTools,
  ValidateTenNumbersToolOutput,
} from '@/app/(private)/consulting/guided-demo/_lib/types';
import { defineGuidedConsulting } from '@/features/guided-consulting/core/definition';
import type { GuidedConsultingMemory } from '@/features/guided-consulting/core/types';

function getSubmittedValue(memory: GuidedConsultingMemory<MergeSortContext>) {
  const action = memory.lastAction;
  if (action?.type !== 'user.submit') {
    throw new Error('Plan에 제출된 사용자 입력이 없습니다.');
  }
  return action.value;
}

function getValidationResult(
  memory: GuidedConsultingMemory<MergeSortContext>,
  nodeId: string,
) {
  const output = memory.toolResults[nodeId];
  if (
    typeof output !== 'object' ||
    output === null ||
    !('normalized' in output) ||
    typeof output.normalized !== 'string' ||
    !('numbers' in output) ||
    !Array.isArray(output.numbers) ||
    output.numbers.some((number) => typeof number !== 'number')
  ) {
    throw new Error(`Validation Tool 결과가 없습니다: ${nodeId}`);
  }
  return output as ValidateTenNumbersToolOutput;
}

function getSortResult(output: unknown) {
  if (
    typeof output !== 'object' ||
    output === null ||
    !('sorted' in output) ||
    !Array.isArray(output.sorted) ||
    output.sorted.some((number) => typeof number !== 'number')
  ) {
    throw new Error('머지 소트 Tool 결과가 올바르지 않습니다.');
  }
  return output as MergeSortToolOutput;
}

function getLastError(memory: GuidedConsultingMemory<MergeSortContext>) {
  return memory.lastToolError?.message ?? '작업을 처리하지 못했습니다.';
}

export const mergeSortConsulting = defineGuidedConsulting<
  MergeSortContext,
  MergeSortTools
>({
  id: 'async-merge-sort-demo',
  title: '비동기 머지 소트 실험',
  entry: 'first-explanation',
  createInitialContext: () => ({
    firstInput: [],
    firstSorted: [],
    secondInput: [],
    secondSorted: [],
  }),
  nodes: {
    'first-explanation': {
      id: 'first-explanation',
      type: 'screen',
      screen: { screenId: 'first-sort.explanation', mode: 'static' },
      progress: { current: 1, total: 2 },
      on: { 'user.start-input': 'first-input' },
    },
    'first-input': {
      id: 'first-input',
      type: 'screen',
      screen: { screenId: 'first-sort.input', mode: 'static' },
      draftKey: 'first-sort',
      progress: { current: 1, total: 2 },
      on: {
        'user.submit': 'validate-first',
        'user.review-explanation': 'first-explanation',
      },
    },
    'first-input-error': {
      id: 'first-input-error',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'first-sort.input-error',
        mode: 'dynamic',
        data: { error: getLastError(memory) },
      }),
      draftKey: 'first-sort',
      progress: { current: 1, total: 2 },
      on: {
        'user.submit': 'validate-first',
        'user.review-explanation': 'first-explanation',
      },
    },
    'validate-first': {
      id: 'validate-first',
      type: 'tool',
      toolId: 'numbers.validate-ten',
      input: (memory) => ({ value: getSubmittedValue(memory) }),
      pendingScreen: { screenId: 'first-sort.validating', mode: 'static' },
      progress: { current: 1, total: 2 },
      next: 'sort-first',
      onRejected: 'first-input-error',
    },
    'sort-first': {
      id: 'sort-first',
      type: 'tool',
      toolId: 'numbers.merge-sort',
      input: (memory) => ({
        numbers: getValidationResult(memory, 'validate-first').numbers,
        delayMs: 1_400,
      }),
      pendingScreen: { screenId: 'first-sort.waiting', mode: 'static' },
      progress: { current: 1, total: 2 },
      next: 'first-result',
      onRejected: 'first-input-error',
      reduce: ({ context, output, memory }) => ({
        ...context,
        firstInput: getValidationResult(memory, 'validate-first').numbers,
        firstSorted: getSortResult(output).sorted,
      }),
    },
    'first-result': {
      id: 'first-result',
      type: 'screen',
      screen: ({ context }) => ({
        screenId: 'merge-sort.result',
        mode: 'dynamic',
        data: {
          input: context.firstInput,
          sorted: context.firstSorted,
        },
      }),
      progress: { current: 2, total: 2 },
      on: {
        'user.next-explanation': 'second-explanation',
        'user.back': 'first-input',
      },
    },
    'second-explanation': {
      id: 'second-explanation',
      type: 'screen',
      screen: { screenId: 'second-sort.explanation', mode: 'static' },
      progress: { current: 2, total: 2 },
      on: {
        'user.previous-explanation': 'first-result',
        'user.start-input': 'second-input',
        'user.back': 'first-input',
      },
    },
    'second-input': {
      id: 'second-input',
      type: 'screen',
      screen: { screenId: 'second-sort.input', mode: 'static' },
      draftKey: 'second-sort',
      progress: { current: 2, total: 2 },
      on: {
        'user.submit': 'validate-second',
        'user.review-explanation': 'first-result',
        'user.back': 'first-input',
      },
    },
    'second-input-error': {
      id: 'second-input-error',
      type: 'screen',
      screen: (memory) => ({
        screenId: 'second-sort.input-error',
        mode: 'dynamic',
        data: { error: getLastError(memory) },
      }),
      draftKey: 'second-sort',
      progress: { current: 2, total: 2 },
      on: {
        'user.submit': 'validate-second',
        'user.review-explanation': 'first-result',
        'user.back': 'first-input',
      },
    },
    'validate-second': {
      id: 'validate-second',
      type: 'tool',
      toolId: 'numbers.validate-ten',
      input: (memory) => ({ value: getSubmittedValue(memory) }),
      pendingScreen: { screenId: 'second-sort.waiting', mode: 'static' },
      progress: { current: 2, total: 2 },
      next: 'sort-second',
      onRejected: 'second-input-error',
    },
    'sort-second': {
      id: 'sort-second',
      type: 'tool',
      toolId: 'numbers.merge-sort',
      input: (memory) => ({
        numbers: getValidationResult(memory, 'validate-second').numbers,
        delayMs: 2_400,
      }),
      pendingScreen: (memory) => ({
        screenId: 'merge-sort.pending',
        mode: 'dynamic',
        data: {
          input: getValidationResult(memory, 'validate-second').numbers,
        },
      }),
      progress: { current: 2, total: 2 },
      next: 'complete',
      onRejected: 'second-input-error',
      reduce: ({ context, output, memory }) => ({
        ...context,
        secondInput: getValidationResult(memory, 'validate-second').numbers,
        secondSorted: getSortResult(output).sorted,
      }),
    },
    complete: {
      id: 'complete',
      type: 'screen',
      screen: ({ context }) => ({
        screenId: 'result.default',
        mode: 'dynamic',
        data: { context },
      }),
      progress: { current: 2, total: 2 },
      terminal: true,
      on: { 'user.back': 'second-input' },
    },
  },
});
