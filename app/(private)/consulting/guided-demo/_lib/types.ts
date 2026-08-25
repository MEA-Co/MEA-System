import type { GuidedConsultingTools } from '@/features/guided-consulting/core/tools';

export type MergeSortContext = {
  firstInput: Array<number>;
  firstSorted: Array<number>;
  secondInput: Array<number>;
  secondSorted: Array<number>;
};

export type MergeSortToolSchema = {
  'numbers.merge-sort': {
    input: {
      numbers: Array<number>;
      delayMs: number;
    };
    output: {
      sorted: Array<number>;
    };
  };
};

export type MergeSortTools = GuidedConsultingTools<MergeSortToolSchema>;
