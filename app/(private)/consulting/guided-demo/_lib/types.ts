import type { GuidedConsultingTools } from '@/features/guided-consulting/core/tools';

export type MergeSortContext = {
  firstInput: Array<number>;
  firstSorted: Array<number>;
  secondInput: Array<number>;
  secondSorted: Array<number>;
};

export type MergeSortToolInput = {
  numbers: Array<number>;
  delayMs: number;
};

export type MergeSortToolOutput = {
  sorted: Array<number>;
};

export type ValidateTenNumbersToolInput = {
  value: string;
};

export type ValidateTenNumbersToolOutput = {
  normalized: string;
};

export type MergeSortToolSchema = {
  'numbers.validate-ten': {
    input: ValidateTenNumbersToolInput;
    output: ValidateTenNumbersToolOutput;
  };
  'numbers.merge-sort': {
    input: MergeSortToolInput;
    output: MergeSortToolOutput;
  };
};

export type MergeSortTools = GuidedConsultingTools<MergeSortToolSchema>;
