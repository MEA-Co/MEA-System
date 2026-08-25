import type { GuidedConsultingToolModule } from '@/features/guided-consulting/core/tool-module';

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

export type MergeSortToolModule =
  GuidedConsultingToolModule<MergeSortToolSchema>;
